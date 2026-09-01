import type { PropOneWidgetData } from "@/server/services/propone-service";
import type { PropOneTrends } from "@/server/services/propone-service";
import type { PropOneDomainView, PropOneFilter } from "./propone-section";
import { formatNumber } from "@/lib/utils";
import { localDateStr, statusTone } from "@/lib/propone-metrics";

const C = {
  c1: "var(--c1)",
  c2: "var(--c2)",
  c3: "var(--c3)",
  c4: "var(--c4)",
  red: "var(--red)",
  muted: "var(--muted)",
};

const TONE_COLOR = { ok: C.c1, warn: C.c3, bad: C.red } as const;

/** Work-order statuses classified explicitly by `aggregateWorkOrders`. */
const WO_NAMED = ["Completed", "Rejected", "Pending Procurement"];

export interface PropOnePeriod {
  today: string;
  weekStart: string;
  weekEnd: string;
}

function fmtDateTime(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function day(d: Date | null): string | null {
  return d ? localDateStr(d) : null;
}

/**
 * Maps server PropOne data into the tabbed section's view model.
 * Chart choice follows §3.10: composition for status mixes, line only when
 * there is enough history — never incomparable scopes on one axis. Each KPI
 * carries the filter that reproduces it against the record table (§4).
 */
export function buildPropOneDomains(
  widgets: PropOneWidgetData[],
  trends: PropOneTrends,
  period: PropOnePeriod,
): PropOneDomainView[] {
  const views: PropOneDomainView[] = [];
  const all: PropOneFilter = { type: "statusNot", values: [], label: "All records" };

  for (const w of widgets) {
    if (w.workOrders) {
      const m = w.workOrders;
      const other: PropOneFilter = {
        type: "statusNot",
        values: WO_NAMED,
        label: "In progress / other",
      };
      const composition = [
        { name: "Completed", value: m.completed, color: C.c1, filter: { type: "status" as const, value: "Completed" } },
        { name: "Rejected", value: m.rejected, color: C.red, filter: { type: "status" as const, value: "Rejected" } },
        {
          name: "Pending Procurement",
          value: m.pendingProcurement,
          color: C.c3,
          filter: { type: "status" as const, value: "Pending Procurement" },
        },
        { name: "In Progress / Other", value: m.other, color: C.c2, filter: other },
      ].filter((s) => s.value > 0);
      views.push({
        key: "work-orders",
        label: "Work Orders",
        kpis: [
          { label: "Total", value: formatNumber(m.all), filter: all },
          {
            label: "Completed",
            value: formatNumber(m.completed),
            tone: "green",
            filter: { type: "status", value: "Completed" },
          },
          ...(m.other > 0
            ? [
                {
                  label: "In Progress",
                  value: formatNumber(m.other),
                  tone: "blue" as const,
                  filter: other,
                },
              ]
            : []),
          ...(m.pendingProcurement > 0
            ? [
                {
                  label: "Pending Procurement",
                  value: formatNumber(m.pendingProcurement),
                  tone: "orange" as const,
                  filter: { type: "status" as const, value: "Pending Procurement" },
                },
              ]
            : []),
          {
            label: "Rejected",
            value: formatNumber(m.rejected),
            tone: "red",
            filter: { type: "status", value: "Rejected" },
          },
        ],
        composition,
        compositionTotal: m.all,
        // Monthly history is only meaningful with ≥4 periods (audit R3).
        trend:
          trends.workOrdersMonthly.length >= 4
            ? {
                label: "Work orders",
                data: trends.workOrdersMonthly.map((m2) => ({ week: m2.month, count: m2.total })),
              }
            : undefined,
        table: {
          columns: ["Issue", "Unit", "Date", "Assignee", "Status"],
          rows: m.latest.map((r) => [
            r.issue,
            r.unit || "—",
            r.orderDate ?? "—",
            r.assignee || "—",
            r.status,
          ]),
          rowDates: m.latest.map((r) => r.orderDate ?? null),
          period,
          statusColumn: 4,
          sampled: m.latest.length < m.all,
        },
        note:
          trends.workOrdersMonthly.length < 4
            ? "A monthly trend appears once at least four months of work-order history have been synced."
            : undefined,
      });
    }

    if (w.visits) {
      const m = w.visits;
      views.push({
        key: "visits",
        label: "Visits",
        // Today / This week / All-time are incomparable scopes — KPI values
        // only, with a real weekly trend beneath (audit R2).
        kpis: [
          {
            label: "Today",
            value: formatNumber(m.today),
            filter: { type: "scope", value: "today" },
          },
          {
            label: "This Week",
            value: formatNumber(m.thisWeek),
            tone: "green",
            filter: { type: "scope", value: "week" },
          },
          { label: "All-time", value: formatNumber(m.allTime), tone: "neutral", filter: all },
        ],
        trend: { label: "Visits", data: trends.visitsWeekly },
        table: {
          columns: ["Visitor", "Unit", "Arrival", "Departure", "Status"],
          rows: m.latest.map((r) => [
            r.visitorName,
            r.unit || "—",
            fmtDateTime(r.arrivalAt),
            fmtDateTime(r.departureAt),
            r.status,
          ]),
          rowDates: m.latest.map((r) => day(r.arrivalAt)),
          period,
          statusColumn: 4,
          sampled: m.latest.length < m.allTime,
        },
      });
    }

    if (w.visitors) {
      const m = w.visitors;
      views.push({
        key: "visitors",
        label: "Visitors",
        kpis: [{ label: "Visitors (period)", value: formatNumber(m.period), filter: all }],
        trend: { label: "Visitors", data: trends.visitsWeekly },
        table: {
          columns: ["Visitor", "Unit", "Arrival", "Status"],
          rows: m.latest.map((r) => [r.visitorName, r.unit || "—", fmtDateTime(r.arrivalAt), r.status]),
          rowDates: m.latest.map((r) => day(r.arrivalAt)),
          period,
          statusColumn: 3,
          sampled: m.latest.length < m.period,
        },
      });
    }

    if (w.bookings) {
      const m = w.bookings;
      const entries = Object.entries(m.byStatus).sort((a, b) => b[1] - a[1]);
      const isCinema = w.domain === "CINEMA_BOOKINGS";
      views.push({
        key: isCinema ? "cinema" : "amenities",
        label: isCinema ? "Cinema" : "Amenities",
        kpis: [
          { label: "Bookings", value: formatNumber(m.total), filter: all },
          ...entries.slice(0, 4).map(([status, count]) => ({
            label: status,
            value: formatNumber(count),
            tone: (statusTone(status) === "ok"
              ? "green"
              : statusTone(status) === "bad"
                ? "red"
                : "orange") as "green" | "red" | "orange",
            filter: { type: "status" as const, value: status },
          })),
        ],
        // Donut/composition only for ≤5 meaningful categories (§3.10).
        composition:
          entries.length <= 5
            ? entries.map(([status, count]) => ({
                name: status,
                value: count,
                color: TONE_COLOR[statusTone(status)],
                filter: { type: "status" as const, value: status },
              }))
            : undefined,
        compositionTotal: m.total,
        trend: { label: "Bookings", data: trends.bookingsWeekly },
        table: {
          columns: ["Amenity", "Booked", "Status"],
          rows: m.latest.map((r) => [r.amenity, fmtDateTime(r.bookingAt), r.status]),
          rowDates: m.latest.map((r) => day(r.bookingAt)),
          period,
          statusColumn: 2,
          sampled: m.latest.length < m.total,
        },
      });
    }

    if (w.stickers) {
      const m = w.stickers;
      views.push({
        key: "stickers",
        label: "Vehicle Stickers",
        kpis: [
          { label: "Issued (period)", value: formatNumber(m.issuedPeriod), filter: { type: "scope", value: "week" } },
          { label: "Issued (all-time)", value: formatNumber(m.issuedAllTime), filter: all },
        ],
        table: {
          columns: ["Unit", "Owner", "Vehicle", "Type", "Issued"],
          rows: m.latest.map((r) => [r.unit, r.ownerName, r.vehicle, r.stickerType, r.issuedDate ?? "—"]),
          rowDates: m.latest.map((r) => r.issuedDate ?? null),
          period,
          sampled: m.latest.length < m.issuedAllTime,
        },
      });
    }

    if (w.announcements) {
      const m = w.announcements;
      views.push({
        key: "announcements",
        label: "Announcements",
        kpis: [
          { label: "Sent (all-time)", value: formatNumber(m.total) },
          { label: "Sent (period)", value: formatNumber(m.sentPeriod) },
        ],
        note: m.latest
          ? `Latest: “${m.latest.title}” — sent ${fmtDateTime(m.latest.sentAt)}${m.latest.audience ? ` to ${m.latest.audience}` : ""}.`
          : "No announcements have been synced for this property.",
      });
    }
  }

  return views;
}
