import { describe, expect, it } from "vitest";
import {
  computeCompliance,
  effectiveSeverity,
  entryIsFlagged,
  responseHasIssue,
  responseIsDefect,
  selectBottlenecks,
} from "@/lib/compliance";

const clean = { op: true, cl: true, comment: "" };
const unchecked = { op: false, cl: true, comment: "" };
const defect = { op: true, cl: true, comment: "Pump leaking", severity: "HIGH" as const };

describe("responseIsDefect", () => {
  it("is a defect when a comment exists", () => {
    expect(responseIsDefect(defect)).toBe(true);
    expect(responseIsDefect({ ...clean, comment: "  " })).toBe(false);
  });
  it("is a defect when severity was set without comment", () => {
    expect(responseIsDefect({ ...clean, severity: "LOW" })).toBe(true);
  });
});

describe("responseHasIssue (compliance rule)", () => {
  it("clean OP+CL rows are not issues", () => {
    expect(responseHasIssue(clean)).toBe(false);
  });
  it("incomplete OP/CL marks count as issues (reference flags blank sheets)", () => {
    expect(responseHasIssue(unchecked)).toBe(true);
    expect(responseHasIssue({ op: false, cl: false, comment: "" })).toBe(true);
  });
  it("defect comments count as issues even when checked", () => {
    expect(responseHasIssue(defect)).toBe(true);
  });
});

describe("computeCompliance (reference formula: clean/total)", () => {
  it("matches the reference rounding: pct = round(clean/total*100)", () => {
    const result = computeCompliance([
      { responses: [clean, clean] },
      { responses: [defect] },
      { responses: [clean] },
    ]);
    expect(result).toEqual({ total: 3, clean: 2, flagged: 1, pct: 67 });
  });
  it("guards against divide-by-zero with a null pct", () => {
    expect(computeCompliance([]).pct).toBeNull();
  });
  it("an entry with zero responses (LOG category) is clean", () => {
    expect(entryIsFlagged([])).toBe(false);
    expect(computeCompliance([{ responses: [] }])).toMatchObject({ clean: 1, flagged: 0, pct: 100 });
  });
});

describe("effectiveSeverity", () => {
  it("returns null for healthy rows — severity is never forced", () => {
    expect(effectiveSeverity(clean)).toBeNull();
    expect(effectiveSeverity(unchecked)).toBeNull();
  });
  it("defaults defects without a chosen severity to LOW", () => {
    expect(effectiveSeverity({ ...clean, comment: "broken" })).toBe("LOW");
  });
  it("preserves the chosen severity", () => {
    expect(effectiveSeverity(defect)).toBe("HIGH");
  });
});

describe("selectBottlenecks", () => {
  it("selects only defects, ordered most severe first then most recent", () => {
    const rows = [
      { ...clean, entryDate: "2026-09-01" },
      { op: true, cl: true, comment: "medium issue", severity: "MEDIUM" as const, entryDate: "2026-09-01" },
      { op: true, cl: true, comment: "critical issue", severity: "CRITICAL" as const, entryDate: "2026-08-30" },
      { op: true, cl: true, comment: "older medium", severity: "MEDIUM" as const, entryDate: "2026-08-29" },
      { ...unchecked, entryDate: "2026-09-01" }, // issue but not a described defect
    ];
    const result = selectBottlenecks(rows);
    expect(result.map((r) => r.comment)).toEqual(["critical issue", "medium issue", "older medium"]);
  });
});
