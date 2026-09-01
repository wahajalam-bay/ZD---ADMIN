import type { PropOneWidgetData } from "@/server/services/propone-service";
import type { PropOneWidgetView } from "./propone-widgets";
import { formatNumber } from "@/lib/utils";

const TEAL = "#0d9488";
const AMBER = "#f59e0b";
const RED = "#dc2626";

function fmtDateTime(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** Maps server-side PropOne widget data into a serializable client view. */
export function buildPropOneWidgetViews(widgets: PropOneWidgetData[]): PropOneWidgetView[] {
  return widgets.map((w): PropOneWidgetView => {
    if (w.workOrders) {
      const m = w.workOrders;
      return {
        domain: w.domain,
        label: w.label,
        kpis: [
          { label: "Work Orders (All)", value: formatNumber(m.all) },
          { label: "Completed", value: formatNumber(m.completed), tone: "ok" },
          { label: "Rejected", value: formatNumber(m.rejected), tone: "bad" },
          ...(m.pendingProcurement > 0
            ? [{ label: "Pending Procurement", value: formatNumber(m.pendingProcurement), tone: "warn" as const }]
            : []),
        ],
        chart: {
          kind: "donut",
          slices: [
            { name: "Completed", value: m.completed, color: TEAL },
            { name: "Rejected", value: m.rejected, color: RED },
            { name: "Pending Procurement", value: m.pendingProcurement, color: AMBER },
          ].filter((s) => s.value > 0),
          center: String(m.all),
          centerLabel: "Total",
        },
        detail: {
          title: `${w.label} — latest records`,
          note: `${m.latest.length} most recent of ${m.all} imported work orders.`,
          columns: ["Issue", "Unit", "Added By", "Date", "Charges", "Assignee", "Status"],
          rows: m.latest.map((r) => [
            r.issue,
            r.unit,
            r.addedBy,
            r.orderDate ?? "—",
            r.serviceCharges || "—",
            r.assignee || "—",
            r.status,
          ]),
          statusColumn: 6,
        },
      };
    }
    if (w.visits) {
      const m = w.visits;
      return {
        domain: w.domain,
        label: w.label,
        kpis: [
          { label: "Today", value: formatNumber(m.today) },
          { label: "This Week", value: formatNumber(m.thisWeek) },
          { label: "All-time", value: formatNumber(m.allTime) },
        ],
        chart: {
          kind: "bar",
          data: [
            { name: "Today", value: m.today },
            { name: "This Week", value: m.thisWeek },
            { name: "All-time", value: m.allTime },
          ],
        },
        detail: {
          title: `${w.label} — latest visits`,
          note: `${m.latest.length} most recent of ${m.allTime} imported visits.`,
          columns: ["Visitor", "Unit", "Resident", "Arrival", "Departure", "Status"],
          rows: m.latest.map((r) => [
            r.visitorName,
            r.unit,
            r.residentName,
            fmtDateTime(r.arrivalAt),
            fmtDateTime(r.departureAt),
            r.status,
          ]),
          statusColumn: 5,
        },
      };
    }
    if (w.visitors) {
      const m = w.visitors;
      return {
        domain: w.domain,
        label: w.label,
        kpis: [{ label: "Visitors (period)", value: formatNumber(m.period) }],
        detail: {
          title: `${w.label} — latest entries`,
          columns: ["Visitor", "Unit", "Resident", "Arrival", "Status"],
          rows: m.latest.map((r) => [
            r.visitorName,
            r.unit,
            r.residentName,
            fmtDateTime(r.arrivalAt),
            r.status,
          ]),
          statusColumn: 4,
        },
      };
    }
    if (w.bookings) {
      const m = w.bookings;
      return {
        domain: w.domain,
        label: w.label,
        kpis: [
          { label: "Bookings", value: formatNumber(m.total) },
          { label: "Attended", value: formatNumber(m.attended), tone: "ok" },
          { label: "Pre-booked", value: formatNumber(m.preBooked), tone: "warn" },
          { label: "Cancelled", value: formatNumber(m.cancelled), tone: "bad" },
        ],
        chart: {
          kind: "donut",
          slices: [
            { name: "Attended", value: m.attended, color: TEAL },
            { name: "Pre-booked", value: m.preBooked, color: AMBER },
            { name: "Cancelled", value: m.cancelled, color: RED },
          ].filter((s) => s.value > 0),
          center: String(m.total),
          centerLabel: "Total",
        },
        detail: {
          title: `${w.label} — latest bookings`,
          columns: ["Amenity", "Unit", "Booked By", "When", "Status"],
          rows: m.latest.map((r) => [r.amenity, r.unit, r.bookedBy, fmtDateTime(r.bookingAt), r.status]),
          statusColumn: 4,
        },
      };
    }
    if (w.stickers) {
      const m = w.stickers;
      return {
        domain: w.domain,
        label: w.label,
        kpis: [
          { label: "Issued (period)", value: formatNumber(m.issuedPeriod) },
          { label: "Issued (all-time)", value: formatNumber(m.issuedAllTime) },
        ],
        detail: {
          title: `${w.label} — latest stickers`,
          columns: ["Unit", "Owner", "Vehicle", "Type", "Issued"],
          rows: m.latest.map((r) => [r.unit, r.ownerName, r.vehicle, r.stickerType, r.issuedDate ?? "—"]),
        },
      };
    }
    if (w.announcements) {
      const m = w.announcements;
      return {
        domain: w.domain,
        label: w.label,
        kpis: [
          { label: "Sent (all-time)", value: formatNumber(m.total) },
          { label: "Sent (period)", value: formatNumber(m.sentPeriod) },
        ],
        note: m.latest
          ? `Latest: “${m.latest.title}” — sent ${fmtDateTime(m.latest.sentAt)}${m.latest.audience ? ` to ${m.latest.audience}` : ""}.`
          : "No announcements imported yet.",
      };
    }
    return { domain: w.domain, label: w.label, kpis: [] };
  });
}
