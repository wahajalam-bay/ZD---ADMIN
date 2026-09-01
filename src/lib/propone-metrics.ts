/**
 * Pure PropOne aggregation helpers. Services fetch scoped rows and these
 * functions reduce them to the dashboard metrics demonstrated by the
 * reference Command Center — nothing here is hard-coded to a property.
 */

export const PROPONE_DOMAINS = [
  "WORK_ORDERS",
  "VISITS",
  "VISITORS",
  "CINEMA_BOOKINGS",
  "AMENITY_BOOKINGS",
  "VEHICLE_STICKERS",
  "ANNOUNCEMENTS",
] as const;
export type PropOneDomain = (typeof PROPONE_DOMAINS)[number];

export const PROPONE_DOMAIN_LABELS: Record<PropOneDomain, string> = {
  WORK_ORDERS: "Work Orders",
  VISITS: "Visits",
  VISITORS: "Visitors",
  CINEMA_BOOKINGS: "Cinema Bookings",
  AMENITY_BOOKINGS: "Amenity Bookings",
  VEHICLE_STICKERS: "Vehicle Stickers",
  ANNOUNCEMENTS: "Announcements",
};

export interface WorkOrderMetrics {
  all: number;
  completed: number;
  rejected: number;
  pendingProcurement: number;
  other: number;
}

export function aggregateWorkOrders(rows: Array<{ status: string }>): WorkOrderMetrics {
  const m: WorkOrderMetrics = { all: rows.length, completed: 0, rejected: 0, pendingProcurement: 0, other: 0 };
  for (const r of rows) {
    const s = r.status.trim().toLowerCase();
    if (s === "completed") m.completed++;
    else if (s === "rejected") m.rejected++;
    else if (s === "pending procurement") m.pendingProcurement++;
    else m.other++;
  }
  return m;
}

export interface VisitMetrics {
  today: number;
  thisWeek: number;
  allTime: number;
}

export function aggregateVisits(
  rows: Array<{ arrivalAt: Date }>,
  opts: { today: string; weekStart: string; weekEnd: string },
): VisitMetrics {
  const m: VisitMetrics = { today: 0, thisWeek: 0, allTime: rows.length };
  for (const r of rows) {
    const day = localDateStr(r.arrivalAt);
    if (day === opts.today) m.today++;
    if (day >= opts.weekStart && day <= opts.weekEnd) m.thisWeek++;
  }
  return m;
}

export interface BookingMetrics {
  total: number;
  attended: number;
  preBooked: number;
  cancelled: number;
  other: number;
}

export function aggregateBookings(rows: Array<{ status: string }>): BookingMetrics {
  const m: BookingMetrics = { total: rows.length, attended: 0, preBooked: 0, cancelled: 0, other: 0 };
  for (const r of rows) {
    const s = r.status.trim().toLowerCase();
    if (s === "attended") m.attended++;
    else if (s === "pre-booked" || s === "prebooked") m.preBooked++;
    else if (s === "cancelled" || s === "canceled") m.cancelled++;
    else m.other++;
  }
  return m;
}

export function countInPeriod(
  rows: Array<{ when: string | null }>,
  weekStart: string,
  weekEnd: string,
): number {
  return rows.filter((r) => r.when !== null && r.when >= weekStart && r.when <= weekEnd).length;
}

export function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
