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
import { addDays, todayStr, weekEndOf, weekStartOf } from "@/lib/week";
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
      // Amenity names come from the source ("CINEMA" in CSV imports, "Cinema"
      // in the FMS warehouse) — match case-insensitively.
      const amenityFilter =
        cfg.metricDomain === "CINEMA_BOOKINGS"
          ? sql`${propOneBookings.amenity} ilike '%cinema%'`
          : sql`${propOneBookings.amenity} not ilike '%cinema%'`;
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

export interface PropOneTrends {
  /** Visits per week (Monday key), oldest → newest, gaps zero-filled. */
  visitsWeekly: Array<{ week: string; count: number }>;
  /** Amenity bookings per week (Monday key), oldest → newest, zero-filled. */
  bookingsWeekly: Array<{ week: string; count: number }>;
  /** Work orders created per month with per-status split, oldest → newest. */
  workOrdersMonthly: Array<{ month: string; byStatus: Record<string, number>; total: number }>;
}

/**
 * Time-series analytics from the synced PropOne records (trend lines for the
 * property dashboards). Aggregation happens in SQL; missing periods are
 * zero-filled so lines do not jump over quiet weeks.
 */
export async function propOneTrendsForProperty(
  propertyId: string,
  opts: { weeks?: number; months?: number } = {},
): Promise<PropOneTrends> {
  const weeks = opts.weeks ?? 12;
  const months = opts.months ?? 6;

  const zeroFillWeeks = (rows: Array<{ week: string; count: number }>) => {
    const byWeek = new Map(rows.map((r) => [r.week, r.count]));
    const out: Array<{ week: string; count: number }> = [];
    let cursor = addDays(weekStartOf(todayStr()), -7 * (weeks - 1));
    for (let i = 0; i < weeks; i++) {
      out.push({ week: cursor, count: byWeek.get(cursor) ?? 0 });
      cursor = addDays(cursor, 7);
    }
    return out;
  };

  const visitRows = await db
    .select({
      week: sql<string>`to_char(date_trunc('week', ${propOneVisits.arrivalAt}), 'YYYY-MM-DD')`,
      count: sql<number>`count(*)::int`,
    })
    .from(propOneVisits)
    .where(
      and(
        eq(propOneVisits.propertyId, propertyId),
        sql`${propOneVisits.arrivalAt} >= now() - make_interval(weeks => ${weeks})`,
      ),
    )
    .groupBy(sql`1`);

  const bookingRows = await db
    .select({
      week: sql<string>`to_char(date_trunc('week', ${propOneBookings.bookingAt}), 'YYYY-MM-DD')`,
      count: sql<number>`count(*)::int`,
    })
    .from(propOneBookings)
    .where(
      and(
        eq(propOneBookings.propertyId, propertyId),
        sql`${propOneBookings.bookingAt} >= now() - make_interval(weeks => ${weeks})`,
      ),
    )
    .groupBy(sql`1`);

  const woRows = await db
    .select({
      month: sql<string>`to_char(date_trunc('month', ${propOneWorkOrders.orderDate}::date), 'YYYY-MM')`,
      status: propOneWorkOrders.status,
      count: sql<number>`count(*)::int`,
    })
    .from(propOneWorkOrders)
    .where(
      and(
        eq(propOneWorkOrders.propertyId, propertyId),
        sql`${propOneWorkOrders.orderDate} is not null`,
        sql`${propOneWorkOrders.orderDate}::date >= date_trunc('month', now()) - make_interval(months => ${months - 1})`,
      ),
    )
    .groupBy(sql`1`, propOneWorkOrders.status);

  const monthsMap = new Map<string, { byStatus: Record<string, number>; total: number }>();
  for (const r of woRows) {
    const m = monthsMap.get(r.month) ?? { byStatus: {}, total: 0 };
    m.byStatus[r.status] = (m.byStatus[r.status] ?? 0) + r.count;
    m.total += r.count;
    monthsMap.set(r.month, m);
  }
  const workOrdersMonthly = [...monthsMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, v]) => ({ month, ...v }));

  return {
    visitsWeekly: zeroFillWeeks(visitRows),
    bookingsWeekly: zeroFillWeeks(bookingRows),
    workOrdersMonthly,
  };
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
