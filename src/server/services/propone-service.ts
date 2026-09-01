import "server-only";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/server/db";
import {
  properties,
  propOneAnnouncements,
  propOneBookings,
  propOneSyncRuns,
  propOneVehicleStickers,
  propOneVisits,
  propOneWidgetConfigs,
  propOneWorkOrders,
} from "@/db/schema";
import { env } from "@/server/env";
import {
  aggregateBookings,
  aggregateVisits,
  aggregateWorkOrders,
  countInPeriod,
  localDateStr,
  PROPONE_DOMAIN_LABELS,
  type BookingMetrics,
  type PropOneDomain,
  type VisitMetrics,
  type WorkOrderMetrics,
} from "@/lib/propone-metrics";
import { todayStr, weekEndOf } from "@/lib/week";
import { PropOneApiAdapter } from "@/server/integrations/propone/api-adapter";
import { PropOneFileImportAdapter } from "@/server/integrations/propone/file-import-adapter";
import { PropOneRedshiftAdapter } from "@/server/integrations/propone/redshift-adapter";

export function getActiveAdapter() {
  if (env.PROPONE_MODE === "api") return new PropOneApiAdapter();
  if (env.PROPONE_MODE === "redshift") return new PropOneRedshiftAdapter();
  return new PropOneFileImportAdapter();
}

export interface PropOneWidgetData {
  domain: PropOneDomain;
  label: string;
  workOrders?: WorkOrderMetrics & { latest: Array<typeof propOneWorkOrders.$inferSelect> };
  visits?: VisitMetrics & { latest: Array<typeof propOneVisits.$inferSelect> };
  visitors?: { period: number; latest: Array<typeof propOneVisits.$inferSelect> };
  bookings?: BookingMetrics & { latest: Array<typeof propOneBookings.$inferSelect> };
  stickers?: { issuedPeriod: number; issuedAllTime: number; latest: Array<typeof propOneVehicleStickers.$inferSelect> };
  announcements?: {
    total: number;
    latest: typeof propOneAnnouncements.$inferSelect | null;
    sentPeriod: number;
  };
}

const DETAIL_LIMIT = 12;

/** Widget data for one property's dashboard, driven by its widget config. */
export async function propOneWidgetsForProperty(
  propertyId: string,
  weekStart: string,
): Promise<PropOneWidgetData[]> {
  const configs = await db
    .select()
    .from(propOneWidgetConfigs)
    .where(and(eq(propOneWidgetConfigs.propertyId, propertyId), eq(propOneWidgetConfigs.enabled, true)))
    .orderBy(asc(propOneWidgetConfigs.sortOrder));

  const weekEnd = weekEndOf(weekStart);
  const today = todayStr();
  const widgets: PropOneWidgetData[] = [];

  for (const cfg of configs) {
    const label = cfg.displayLabel ?? PROPONE_DOMAIN_LABELS[cfg.metricDomain];
    if (cfg.metricDomain === "WORK_ORDERS") {
      const rows = await db
        .select()
        .from(propOneWorkOrders)
        .where(eq(propOneWorkOrders.propertyId, propertyId))
        .orderBy(desc(propOneWorkOrders.orderDate));
      widgets.push({
        domain: cfg.metricDomain,
        label,
        workOrders: { ...aggregateWorkOrders(rows), latest: rows.slice(0, DETAIL_LIMIT) },
      });
    } else if (cfg.metricDomain === "VISITS") {
      const rows = await db
        .select()
        .from(propOneVisits)
        .where(eq(propOneVisits.propertyId, propertyId))
        .orderBy(desc(propOneVisits.arrivalAt));
      widgets.push({
        domain: cfg.metricDomain,
        label,
        visits: {
          ...aggregateVisits(rows, { today, weekStart, weekEnd }),
          latest: rows.slice(0, DETAIL_LIMIT),
        },
      });
    } else if (cfg.metricDomain === "VISITORS") {
      const rows = await db
        .select()
        .from(propOneVisits)
        .where(eq(propOneVisits.propertyId, propertyId))
        .orderBy(desc(propOneVisits.arrivalAt));
      const period = countInPeriod(
        rows.map((r) => ({ when: localDateStr(r.arrivalAt) })),
        weekStart,
        weekEnd,
      );
      widgets.push({
        domain: cfg.metricDomain,
        label,
        visitors: { period, latest: rows.slice(0, DETAIL_LIMIT) },
      });
    } else if (cfg.metricDomain === "CINEMA_BOOKINGS" || cfg.metricDomain === "AMENITY_BOOKINGS") {
      const amenityFilter =
        cfg.metricDomain === "CINEMA_BOOKINGS"
          ? eq(propOneBookings.amenity, "CINEMA")
          : sql`${propOneBookings.amenity} <> 'CINEMA'`;
      const rows = await db
        .select()
        .from(propOneBookings)
        .where(and(eq(propOneBookings.propertyId, propertyId), amenityFilter))
        .orderBy(desc(propOneBookings.bookingAt));
      widgets.push({
        domain: cfg.metricDomain,
        label,
        bookings: { ...aggregateBookings(rows), latest: rows.slice(0, DETAIL_LIMIT) },
      });
    } else if (cfg.metricDomain === "VEHICLE_STICKERS") {
      const rows = await db
        .select()
        .from(propOneVehicleStickers)
        .where(eq(propOneVehicleStickers.propertyId, propertyId))
        .orderBy(desc(propOneVehicleStickers.issuedDate));
      widgets.push({
        domain: cfg.metricDomain,
        label,
        stickers: {
          issuedAllTime: rows.length,
          issuedPeriod: countInPeriod(
            rows.map((r) => ({ when: r.issuedDate })),
            weekStart,
            weekEnd,
          ),
          latest: rows.slice(0, DETAIL_LIMIT),
        },
      });
    } else if (cfg.metricDomain === "ANNOUNCEMENTS") {
      const rows = await db
        .select()
        .from(propOneAnnouncements)
        .where(eq(propOneAnnouncements.propertyId, propertyId))
        .orderBy(desc(propOneAnnouncements.sentAt));
      widgets.push({
        domain: cfg.metricDomain,
        label,
        announcements: {
          total: rows.length,
          latest: rows[0] ?? null,
          sentPeriod: countInPeriod(
            rows.map((r) => ({ when: localDateStr(r.sentAt) })),
            weekStart,
            weekEnd,
          ),
        },
      });
    }
  }
  return widgets;
}

/** Admin integrations page status block. */
export async function integrationStatus() {
  const adapter = getActiveAdapter();
  const apiAdapter = new PropOneApiAdapter();
  const redshiftAdapter = new PropOneRedshiftAdapter();
  const recentRuns = await db
    .select({
      run: propOneSyncRuns,
      propertyName: properties.name,
    })
    .from(propOneSyncRuns)
    .leftJoin(properties, eq(properties.id, propOneSyncRuns.propertyId))
    .orderBy(desc(propOneSyncRuns.startedAt))
    .limit(20);

  const [lastSuccess] = await db
    .select()
    .from(propOneSyncRuns)
    .where(eq(propOneSyncRuns.status, "SUCCESS"))
    .orderBy(desc(propOneSyncRuns.startedAt))
    .limit(1);

  return {
    mode: env.PROPONE_MODE,
    active: adapter.describe(),
    api: apiAdapter.describe(),
    redshift: redshiftAdapter.describe(),
    redshiftConfigured: Boolean(env.PROPONE_REDSHIFT_URL),
    lastSuccess: lastSuccess ?? null,
    recentRuns,
  };
}

export async function listWidgetConfigs() {
  return db
    .select({
      config: propOneWidgetConfigs,
      propertyName: properties.name,
      propertyCode: properties.code,
    })
    .from(propOneWidgetConfigs)
    .innerJoin(properties, eq(properties.id, propOneWidgetConfigs.propertyId))
    .orderBy(asc(properties.displayOrder), asc(propOneWidgetConfigs.sortOrder));
}
