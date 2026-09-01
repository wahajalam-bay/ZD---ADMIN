import { describe, expect, it } from "vitest";
import {
  addDays,
  isInWeek,
  isIsoDate,
  recentWeekStarts,
  weekEndOf,
  weekLabel,
  weekRangeLabel,
  weekStartOf,
} from "@/lib/week";

describe("weekStartOf (canonical Monday week)", () => {
  it("returns the same day for a Monday", () => {
    expect(weekStartOf("2026-08-31")).toBe("2026-08-31"); // Monday
  });
  it("returns the previous Monday for midweek days", () => {
    expect(weekStartOf("2026-09-02")).toBe("2026-08-31"); // Wednesday
    expect(weekStartOf("2026-09-05")).toBe("2026-08-31"); // Saturday
  });
  it("treats Sunday as the last day of the week", () => {
    expect(weekStartOf("2026-09-06")).toBe("2026-08-31");
  });
  it("crosses month boundaries correctly", () => {
    expect(weekStartOf("2026-09-01")).toBe("2026-08-31");
  });
  it("crosses year boundaries correctly", () => {
    expect(weekStartOf("2026-01-01")).toBe("2025-12-29");
  });
});

describe("weekEndOf", () => {
  it("returns the Sunday of the week", () => {
    expect(weekEndOf("2026-08-31")).toBe("2026-09-06");
  });
});

describe("addDays", () => {
  it("adds and subtracts days across boundaries", () => {
    expect(addDays("2026-08-31", 7)).toBe("2026-09-07");
    expect(addDays("2026-08-31", -7)).toBe("2026-08-24");
  });
});

describe("isIsoDate", () => {
  it("accepts valid dates and rejects garbage", () => {
    expect(isIsoDate("2026-08-31")).toBe(true);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("31-08-2026")).toBe(false);
    expect(isIsoDate("not-a-date")).toBe(false);
    expect(isIsoDate("2026-8-1")).toBe(false);
  });
});

describe("labels", () => {
  it("formats the reference-style week label", () => {
    expect(weekLabel("2026-08-31")).toBe("Week of 31 Aug 2026");
  });
  it("formats the week range", () => {
    expect(weekRangeLabel("2026-08-31")).toBe("31 Aug – 06 Sep 2026");
  });
});

describe("recentWeekStarts / isInWeek", () => {
  it("enumerates weeks most recent first", () => {
    expect(recentWeekStarts("2026-09-02", 3)).toEqual(["2026-08-31", "2026-08-24", "2026-08-17"]);
  });
  it("checks membership of a date in a week", () => {
    expect(isInWeek("2026-09-06", "2026-08-31")).toBe(true);
    expect(isInWeek("2026-09-07", "2026-08-31")).toBe(false);
  });
});
