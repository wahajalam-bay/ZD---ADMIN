import { describe, expect, it } from "vitest";
import {
  DECK_CATEGORIES,
  LEGACY_BOTTLENECKS,
  LEGACY_SUMMARIES,
  LEGACY_TASKS,
  LEGACY_WEEK_END,
  LEGACY_WEEK_START,
  SHEET_POINT,
  SHEET_POINT_CATEGORIES,
  trackingFromCompletion,
} from "@/db/seeds/legacy-data";
import { CHECKLIST_DEFINITIONS } from "@/db/seeds/checklist-definitions";

/**
 * The legacy Command Center deck is the source of record for the week of
 * 20 Aug 2026. These tests lock the merged dataset against the figures the deck
 * itself printed, so a future edit cannot silently drift from the source.
 */
describe("legacy merge — weekly tasks", () => {
  it("carries all 24 tasks the deck listed", () => {
    const counts = Object.fromEntries(
      Object.entries(LEGACY_TASKS).map(([code, list]) => [code, list.length]),
    );
    expect(counts).toEqual({ opal: 12, aurum: 5, quadrangle: 7 });
    expect(Object.values(LEGACY_TASKS).flat()).toHaveLength(24);
  });

  it("reproduces the deck's per-property completed / in-process split", () => {
    const split = (code: string) => {
      const list = LEGACY_TASKS[code]!;
      const completed = list.filter((t) => t.status === "COMPLETED").length;
      return { completed, inProcess: list.length - completed };
    };
    expect(split("opal")).toEqual({ completed: 9, inProcess: 3 });
    expect(split("aurum")).toEqual({ completed: 3, inProcess: 2 });
    expect(split("quadrangle")).toEqual({ completed: 3, inProcess: 4 });
  });

  it("reproduces the deck's portfolio totals (15 completed, 9 in process)", () => {
    const all = Object.values(LEGACY_TASKS).flat();
    expect(all.filter((t) => t.status === "COMPLETED")).toHaveLength(15);
    expect(all.filter((t) => t.status === "IN_PROCESS")).toHaveLength(9);
  });

  it("dates every task inside a plausible reporting window, in ISO form", () => {
    for (const t of Object.values(LEGACY_TASKS).flat()) {
      expect(t.etaDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(t.etaDate >= "2026-08-10").toBe(true);
      expect(t.etaDate <= "2026-08-25").toBe(true);
    }
  });

  it("has no duplicated task text within a property", () => {
    for (const [code, list] of Object.entries(LEGACY_TASKS)) {
      const unique = new Set(list.map((t) => t.task));
      expect(unique.size, `${code} has duplicate task text`).toBe(list.length);
    }
  });
});

describe("legacy merge — checklist bottlenecks", () => {
  it("carries all 12 bottlenecks the deck listed, per property", () => {
    expect(LEGACY_BOTTLENECKS).toHaveLength(12);
    const byProperty = LEGACY_BOTTLENECKS.reduce<Record<string, number>>((acc, b) => {
      acc[b.property] = (acc[b.property] ?? 0) + 1;
      return acc;
    }, {});
    expect(byProperty).toEqual({ opal: 3, aurum: 6, quadrangle: 3 });
  });

  it("preserves the deck's severity mix", () => {
    const bySeverity = LEGACY_BOTTLENECKS.reduce<Record<string, number>>((acc, b) => {
      acc[b.severity] = (acc[b.severity] ?? 0) + 1;
      return acc;
    }, {});
    // Deck: 4 High, 7 Medium, 1 Low across the twelve rows.
    expect(bySeverity).toEqual({ HIGH: 4, MEDIUM: 7, LOW: 1 });
  });

  it("records every issue against a checklist point that actually exists", () => {
    const engine = new Map(CHECKLIST_DEFINITIONS.map((d) => [d.key, d.items ?? []]));
    const deck = new Map(DECK_CATEGORIES.map((d) => [d.key, d.items]));

    for (const b of LEGACY_BOTTLENECKS) {
      const items = deck.get(b.categoryKey) ?? engine.get(b.categoryKey);
      expect(items, `unknown category ${b.categoryKey}`).toBeDefined();
      const known =
        items!.includes(b.itemName) ||
        (b.itemName === SHEET_POINT && SHEET_POINT_CATEGORIES.includes(b.categoryKey));
      expect(known, `${b.categoryKey} has no point "${b.itemName}"`).toBe(true);
    }
  });

  it("files every issue inside the legacy reporting week", () => {
    for (const b of LEGACY_BOTTLENECKS) {
      expect(b.entryDate >= LEGACY_WEEK_START).toBe(true);
      expect(b.entryDate <= LEGACY_WEEK_END).toBe(true);
    }
  });

  it("keeps the deck's own checklist name for audit, even when remapped", () => {
    for (const b of LEGACY_BOTTLENECKS) {
      expect(b.deckChecklist.length).toBeGreaterThan(0);
      expect(b.issue.trim()).toBe(b.issue);
      expect(b.issue.length).toBeGreaterThan(10);
    }
  });

  it("only adds the sheet-level point where the deck flags a sheet omission", () => {
    const usingSheetPoint = LEGACY_BOTTLENECKS.filter((b) => b.itemName === SHEET_POINT);
    expect([...new Set(usingSheetPoint.map((b) => b.categoryKey))].sort()).toEqual([
      "cafeteria",
      "fire_fighting",
      "gym",
      "swimming_pool",
    ]);
    // …and every such category is declared for the extra point.
    for (const b of usingSheetPoint) expect(SHEET_POINT_CATEGORIES).toContain(b.categoryKey);
  });
});

describe("legacy merge — deck-sourced categories", () => {
  it("adds only the checklists the Data Entry Engine schema is missing", () => {
    const engineKeys = new Set(CHECKLIST_DEFINITIONS.map((d) => d.key));
    for (const d of DECK_CATEGORIES) expect(engineKeys.has(d.key)).toBe(false);
    expect(DECK_CATEGORIES.map((d) => d.key).sort()).toEqual([
      "genset_100_log",
      "genset_maintenance",
      "genset_performance",
      "reception",
    ]);
  });

  it("gives every deck category the sheet-level point and real check points", () => {
    for (const d of DECK_CATEGORIES) {
      expect(d.items).toContain(SHEET_POINT);
      expect(d.items.length).toBeGreaterThan(1);
      expect(new Set(d.items).size).toBe(d.items.length);
      expect(d.topFields.length).toBeGreaterThan(0);
    }
  });

  it("leaves the 22 Data Entry Engine categories intact", () => {
    expect(CHECKLIST_DEFINITIONS).toHaveLength(22);
  });
});

describe("legacy merge — summaries and tracking", () => {
  it("keeps a verbatim management summary for each property", () => {
    expect(Object.keys(LEGACY_SUMMARIES).sort()).toEqual(["aurum", "opal", "quadrangle"]);
    expect(LEGACY_SUMMARIES.aurum).toContain("23 work orders logged");
    expect(LEGACY_SUMMARIES.quadrangle).toContain("11 snooker bookings, all attended");
  });

  it("derives tracking from the deck's completion rate", () => {
    expect(trackingFromCompletion(9, 3)).toBe("ON_TRACK"); // Opal 75%
    expect(trackingFromCompletion(3, 2)).toBe("WATCH"); // Aurum 60%
    expect(trackingFromCompletion(3, 4)).toBe("AT_RISK"); // Quadrangle 43%
  });

  it("does not pretend to know a status with no tasks at all", () => {
    expect(trackingFromCompletion(0, 0)).toBe("WATCH");
  });
});
