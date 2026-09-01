import { describe, expect, it } from "vitest";
import {
  complianceDeltaPp,
  computeCompliance,
  effectiveSeverity,
  groupCompliance,
  isVisibleForReporting,
  PREVIEW_VISIBILITY,
  PUBLISHED_VISIBILITY,
  responseHasIssue,
  responseIsDefect,
  selectBottlenecks,
  type ResponseLike,
} from "@/lib/compliance";
import type { WorkflowStatus } from "@/lib/roles";

const clean: ResponseLike = { op: true, cl: true, comment: "" };
const unchecked: ResponseLike = { op: false, cl: true, comment: "" };
const defect: ResponseLike = { op: true, cl: true, comment: "Pump leaking", severity: "HIGH" };

describe("responseIsDefect — the single definition of a flagged point", () => {
  it("flags a point when the site team recorded a comment", () => {
    expect(responseIsDefect(defect)).toBe(true);
    expect(responseIsDefect({ ...clean, comment: "  " })).toBe(false);
  });
  it("flags a point when a severity was set without a comment", () => {
    expect(responseIsDefect({ ...clean, severity: "LOW" })).toBe(true);
  });
  it("does NOT treat an unticked OP or CL as a failure", () => {
    // OP/CL are the opening and closing checks in the reference sheets, not
    // pass/fail marks — inventing a failure rule would fabricate compliance.
    expect(responseIsDefect(unchecked)).toBe(false);
    expect(responseIsDefect({ op: false, cl: false, comment: "" })).toBe(false);
  });
  it("responseHasIssue is the same rule under a readable alias", () => {
    expect(responseHasIssue).toBe(responseIsDefect);
  });
});

describe("computeCompliance — round(clean / applicable points * 100)", () => {
  it("counts checklist POINTS, not entries", () => {
    const result = computeCompliance([clean, clean, defect]);
    expect(result).toEqual({ total: 3, clean: 2, flagged: 1, pct: 67 });
  });
  it("a flagged point lowers the percentage", () => {
    const before = computeCompliance([clean, clean, clean, clean]);
    const after = computeCompliance([clean, clean, clean, defect]);
    expect(before.pct).toBe(100);
    expect(after.pct).toBe(75);
    expect(after.flagged).toBe(1);
  });
  it("unticked OP/CL points still count as clean", () => {
    expect(computeCompliance([unchecked, unchecked]).pct).toBe(100);
  });
  it("guards divide-by-zero with a null pct rather than 0%", () => {
    expect(computeCompliance([]).pct).toBeNull();
    expect(computeCompliance([])).toEqual({ total: 0, clean: 0, flagged: 0, pct: null });
  });
});

describe("workflow visibility — unfinished work never moves a KPI", () => {
  const drafts: WorkflowStatus[] = ["DRAFT", "SUBMITTED", "RETURNED"];

  it("excludes draft, submitted and returned entries from published reporting", () => {
    for (const status of drafts) {
      expect(isVisibleForReporting(status, PUBLISHED_VISIBILITY)).toBe(false);
      expect(isVisibleForReporting(status, PREVIEW_VISIBILITY)).toBe(false);
    }
  });
  it("counts published entries in both modes", () => {
    expect(isVisibleForReporting("PUBLISHED", PUBLISHED_VISIBILITY)).toBe(true);
    expect(isVisibleForReporting("PUBLISHED", PREVIEW_VISIBILITY)).toBe(true);
  });
  it("counts approved entries only in management preview", () => {
    expect(isVisibleForReporting("APPROVED", PUBLISHED_VISIBILITY)).toBe(false);
    expect(isVisibleForReporting("APPROVED", PREVIEW_VISIBILITY)).toBe(true);
  });
});

describe("groupCompliance — per-property isolation and portfolio aggregation", () => {
  interface Point extends ResponseLike {
    propertyCode: string;
  }
  const points: Point[] = [
    { ...clean, propertyCode: "OPAL" },
    { ...clean, propertyCode: "OPAL" },
    { ...defect, propertyCode: "OPAL" },
    { ...clean, propertyCode: "AURUM" },
    { ...clean, propertyCode: "AURUM" },
    { ...clean, propertyCode: "QUAD" },
    { ...defect, propertyCode: "QUAD" },
  ];

  it("computes each property only from its own points", () => {
    const byProperty = groupCompliance(points, (p) => p.propertyCode);
    expect(byProperty.get("OPAL")).toEqual({ total: 3, clean: 2, flagged: 1, pct: 67 });
    expect(byProperty.get("AURUM")).toEqual({ total: 2, clean: 2, flagged: 0, pct: 100 });
    expect(byProperty.get("QUAD")).toEqual({ total: 2, clean: 1, flagged: 1, pct: 50 });
  });

  it("a property with no points is absent rather than reported as 0%", () => {
    expect(groupCompliance(points, (p) => p.propertyCode).has("HIVE")).toBe(false);
  });

  it("portfolio compliance aggregates every point, not an average of averages", () => {
    const portfolio = computeCompliance(points);
    expect(portfolio).toEqual({ total: 7, clean: 5, flagged: 2, pct: 71 });
    // Averaging the three property rates (67/100/50) would give 72 — wrong.
    expect(portfolio.pct).not.toBe(72);
  });
});

describe("complianceDeltaPp — rates compare in percentage points", () => {
  it("returns the signed point difference", () => {
    expect(complianceDeltaPp(92, 88)).toBe(4);
    expect(complianceDeltaPp(71, 80)).toBe(-9);
  });
  it("returns null when either week has nothing to measure", () => {
    expect(complianceDeltaPp(92, null)).toBeNull();
    expect(complianceDeltaPp(null, 88)).toBeNull();
  });
});

describe("effectiveSeverity", () => {
  it("returns null for clean points — severity is never forced", () => {
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
  it("selects only flagged points, most severe first then most recent", () => {
    const rows = [
      { ...clean, entryDate: "2026-09-01" },
      { op: true, cl: true, comment: "medium issue", severity: "MEDIUM" as const, entryDate: "2026-09-01" },
      { op: true, cl: true, comment: "critical issue", severity: "CRITICAL" as const, entryDate: "2026-08-30" },
      { op: true, cl: true, comment: "older medium", severity: "MEDIUM" as const, entryDate: "2026-08-29" },
      { ...unchecked, entryDate: "2026-09-01" }, // unticked only — not a defect
    ];
    const result = selectBottlenecks(rows);
    expect(result.map((r) => r.comment)).toEqual(["critical issue", "medium issue", "older medium"]);
  });

  it("agrees with computeCompliance on what counts as flagged", () => {
    const rows = [
      { ...clean, entryDate: "2026-09-01" },
      { ...defect, entryDate: "2026-09-01" },
      { ...unchecked, entryDate: "2026-09-01" },
    ];
    expect(selectBottlenecks(rows).length).toBe(computeCompliance(rows).flagged);
  });
});
