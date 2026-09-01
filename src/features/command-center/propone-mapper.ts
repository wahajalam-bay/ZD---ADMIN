import type { PropOneWidgetData } from "@/server/services/propone-service";
import type { PropOneTrends } from "@/server/services/propone-service";
import type { PropOneDomainView } from "./propone-section";
import { formatNumber } from "@/lib/utils";
import { statusTone } from "@/lib/propone-metrics";

const C = {
  c1: "var(--c1)",
  c2: "var(--c2)",
  c3: "var(--c3)",
  c4: "var(--c4)",
  red: "var(--red)",
  muted: "var(--muted)",
};

const TONE_COLOR = { ok: C.c1, warn: C.c3, bad: C.red } as const;

function fmtDateTime(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Maps server PropOne data into the tabbed section's view model.
 * Chart choice follows §3.10: composition for status mixes, line only when
 * there is enough history — never incomparable scopes on one axis.
 */
export function buildPropOneDomains(
  widgets: PropOneWidgetData[],
  trends: PropOneTrends,
): PropOneDomainView[] {
  const views: PropOneDomainView[] = [];

  for (const w of widgets) {
    if (w.workOrders) {
      const m = w.workOrders;
      const composition = [
        { name: "Completed", value: m.completed, color: C.c1 },
        { name: "Rejected", value: m.rejected, color: C.red },
        { name: "Pending Procurement", value: m.pendingProcurement, color: C.c3 },
        { name: "In Progress / Other", value: m.other, color: C.c2 },
      ].filter((s) => s.value > 0);
      views.push({
        key: "work-orders",
        label: "Work Orders",
        kpis: [
          { label: "Total", value: formatNumber(m.all) },
          { label: "Completed", value: formatNumber(m.completed), tone: "green" },
          ...(m.other > 0
            ? [{ label: "In Progress", value: formatNumber(m.other), tone: "blue" as const }]
            : []),
          ...(m.pendingProcurement > 0
            ? [
                {
                  label: "Pending Procurement",
                  value: formatNumber(m.pendingProcurement),
                  tone: "orange" as const,
                },
              ]
            : []),
          { label: "Rejected", value: formatNumber(m.rejected), tone: "red" },
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
          statusColumn: 4,
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
          { label: "Today", value: formatNumber(m.today) },
          { label: "This Week", value: formatNumber(m.thisWeek), tone: "green" },
          { label: "All-time", value: formatNumber(m.allTime), tone: "neutral" },
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
          statusColumn: 4,
        },
      });
    }

    if (w.visitors) {
      const m = w.visitors;
      views.push({
        key: "visitors",
        label: "Visitors",
        kpis: [{ label: "Visitors (period)", value: formatNumber(m.period) }],
        trend: { label: "Visitors", data: trends.visitsWeekly },
        table: {
          columns: ["Visitor", "Unit", "Arrival", "Status"],
          rows: m.latest.map((r) => [r.visitorName, r.unit || "—", fmtDateTime(r.arrivalAt), r.status]),
          statusColumn: 3,
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
          { label: "Bookings", value: formatNumber(m.total) },
          ...entries.slice(0, 4).map(([status, count]) => ({
            label: status,
            value: formatNumber(count),
            tone: (statusTone(status) === "ok"
              ? "green"
              : statusTone(status) === "bad"
                ? "red"
                : "orange") as "green" | "red" | "orange",
          })),
        ],
        // Donut/composition only for ≤5 meaningful categories (§3.10).
        composition:
          entries.length <= 5
            ? entries.map(([status, count]) => ({
                name: status,
                value: count,
                color: TONE_COLOR[statusTone(status)],
              }))
            : undefined,
        compositionTotal: m.total,
        trend: { label: "Bookings", data: trends.bookingsWeekly },
        table: {
          columns: ["Amenity", "Booked", "Status"],
          rows: m.latest.map((r) => [r.amenity, fmtDateTime(r.bookingAt), r.status]),
          statusColumn: 2,
        },
      });
    }

    if (w.stickers) {
      const m = w.stickers;
      views.push({
        key: "stickers",
        label: "Vehicle Stickers",
        kpis: [
          { label: "Issued (period)", value: formatNumber(m.issuedPeriod) },
          { label: "Issued (all-time)", value: formatNumber(m.issuedAllTime) },
        ],
        table: {
          columns: ["Unit", "Owner", "Vehicle", "Type", "Issued"],
          rows: m.latest.map((r) => [r.unit, r.ownerName, r.vehicle, r.stickerType, r.issuedDate ?? "—"]),
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
