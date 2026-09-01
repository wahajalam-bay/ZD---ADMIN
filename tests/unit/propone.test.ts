import { describe, expect, it } from "vitest";
import {
  aggregateBookings,
  aggregateVisits,
  aggregateWorkOrders,
  countInPeriod,
} from "@/lib/propone-metrics";
import { parseCsv } from "@/server/integrations/propone/csv";
import {
  bookingRowSchema,
  visitRowSchema,
  workOrderRowSchema,
} from "@/server/integrations/propone/validators";

describe("aggregateWorkOrders", () => {
  it("reproduces the reference KPI breakdown (all/completed/rejected/pending procurement)", () => {
    const rows = [
      ...Array.from({ length: 15 }, () => ({ status: "Completed" })),
      ...Array.from({ length: 6 }, () => ({ status: "Rejected" })),
      ...Array.from({ length: 2 }, () => ({ status: "Pending Procurement" })),
    ];
    expect(aggregateWorkOrders(rows)).toEqual({
      all: 23,
      completed: 15,
      rejected: 6,
      pendingProcurement: 2,
      other: 0,
    });
  });
  it("is case/whitespace tolerant and buckets unknown statuses", () => {
    expect(aggregateWorkOrders([{ status: " completed " }, { status: "In Review" }])).toMatchObject({
      completed: 1,
      other: 1,
    });
  });
});

describe("aggregateVisits", () => {
  it("counts today / this-week / all-time from arrival timestamps", () => {
    const mk = (d: string) => ({ arrivalAt: new Date(`${d}T10:00:00`) });
    const result = aggregateVisits(
      [mk("2026-09-01"), mk("2026-09-01"), mk("2026-08-31"), mk("2026-08-20"), mk("2026-07-01")],
      { today: "2026-09-01", weekStart: "2026-08-31", weekEnd: "2026-09-06" },
    );
    expect(result).toEqual({ today: 2, thisWeek: 3, allTime: 5 });
  });
});

describe("aggregateBookings", () => {
  it("reproduces the reference cinema breakdown (attended/pre-booked/cancelled)", () => {
    const rows = [
      ...Array.from({ length: 16 }, () => ({ status: "Attended" })),
      ...Array.from({ length: 4 }, () => ({ status: "Pre-booked" })),
      ...Array.from({ length: 2 }, () => ({ status: "Cancelled" })),
    ];
    expect(aggregateBookings(rows)).toMatchObject({
      total: 22,
      attended: 16,
      preBooked: 4,
      cancelled: 2,
      other: 0,
    });
  });
  it("exposes raw per-status counts for source-agnostic dashboards (FMS statuses)", () => {
    const m = aggregateBookings([
      { status: "Confirmed" },
      { status: "Confirmed" },
      { status: "Pending" },
      { status: "Cancelled" },
    ]);
    expect(m.byStatus).toEqual({ Confirmed: 2, Pending: 1, Cancelled: 1 });
    expect(m.other).toBe(3); // Confirmed/Pending are not in the legacy buckets
  });
});

describe("countInPeriod", () => {
  it("counts records inside the week and ignores nulls", () => {
    expect(
      countInPeriod(
        [{ when: "2026-08-31" }, { when: "2026-09-06" }, { when: "2026-09-07" }, { when: null }],
        "2026-08-31",
        "2026-09-06",
      ),
    ).toBe(2);
  });
});

describe("parseCsv", () => {
  it("parses headers, quoted fields, embedded commas and escaped quotes", () => {
    const rows = parseCsv(
      'external_id,issue,status\nWO-1,"Plumbing, basic",Completed\nWO-2,"He said ""leak""",Rejected\n',
    );
    expect(rows).toEqual([
      { external_id: "WO-1", issue: "Plumbing, basic", status: "Completed" },
      { external_id: "WO-2", issue: 'He said "leak"', status: "Rejected" },
    ]);
  });
  it("handles CRLF, BOM and blank lines", () => {
    const rows = parseCsv("﻿a,b\r\n1,2\r\n\r\n");
    expect(rows).toEqual([{ a: "1", b: "2" }]);
  });
  it("returns empty for an empty file", () => {
    expect(parseCsv("")).toEqual([]);
  });
});

describe("import validators (Zod)", () => {
  it("accepts a valid work-order row", () => {
    const parsed = workOrderRowSchema.parse({
      external_id: "WO-9",
      issue: "Plumbing Visit (Basic)",
      unit: "508",
      added_by: "Resident",
      order_date: "2026-08-16",
      service_charges: "PKR 1,000",
      assignee: "",
      status: "Rejected",
    });
    expect(parsed.issue).toBe("Plumbing Visit (Basic)");
  });
  it("rejects a work-order row without issue/status", () => {
    expect(() => workOrderRowSchema.parse({ issue: "", status: "" })).toThrow();
  });
  it("rejects a visit row with a malformed arrival timestamp", () => {
    expect(() =>
      visitRowSchema.parse({
        visitor_name: "X",
        arrival_at: "not-a-date",
        status: "Pending",
      }),
    ).toThrow();
  });
  it("rejects a booking row with a bad date but accepts a good one", () => {
    expect(() =>
      bookingRowSchema.parse({ amenity: "CINEMA", booking_at: "garbage", status: "Attended" }),
    ).toThrow();
    expect(
      bookingRowSchema.parse({ amenity: "CINEMA", booking_at: "2026-09-01T18:00:00Z", status: "Attended" })
        .amenity,
    ).toBe("CINEMA");
  });
});
