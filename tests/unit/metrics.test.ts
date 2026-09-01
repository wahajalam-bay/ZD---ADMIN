import { describe, expect, it } from "vitest";
import { aggregateTaskCounts, taskCompletionPct, totalArea } from "@/lib/metrics";

describe("taskCompletionPct", () => {
  it("computes completed/total", () => {
    expect(taskCompletionPct({ completed: 15, inProcess: 9 })).toBe(63); // 15/24 = 62.5 → 63
    expect(taskCompletionPct({ completed: 9, inProcess: 3 })).toBe(75);
  });
  it("returns null when there are no tasks (no divide-by-zero)", () => {
    expect(taskCompletionPct({ completed: 0, inProcess: 0 })).toBeNull();
  });
  it("handles all-complete and none-complete", () => {
    expect(taskCompletionPct({ completed: 5, inProcess: 0 })).toBe(100);
    expect(taskCompletionPct({ completed: 0, inProcess: 5 })).toBe(0);
  });
});

describe("totalArea", () => {
  it("sums authoritative areas", () => {
    expect(totalArea([{ areaSqFt: 300000 }, { areaSqFt: 163000 }, { areaSqFt: 252000 }])).toEqual({
      sum: 715000,
      complete: true,
    });
  });
  it("marks the portfolio incomplete when any property lacks area data", () => {
    expect(totalArea([{ areaSqFt: 300000 }, { areaSqFt: null }])).toEqual({
      sum: 300000,
      complete: false,
    });
  });
  it("empty portfolio is complete with zero area", () => {
    expect(totalArea([])).toEqual({ sum: 0, complete: true });
  });
});

describe("aggregateTaskCounts", () => {
  it("counts completed and in-process tasks", () => {
    expect(
      aggregateTaskCounts([
        { status: "COMPLETED" },
        { status: "COMPLETED" },
        { status: "IN_PROCESS" },
        { status: "UNKNOWN_FUTURE_STATUS" },
      ]),
    ).toEqual({ completed: 2, inProcess: 1 });
  });
});
