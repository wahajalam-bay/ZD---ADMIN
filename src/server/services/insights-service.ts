import "server-only";
import type { ComplianceResult } from "@/lib/compliance";
import type { FlaggedPoint } from "./checklist-compliance-service";

/**
 * Deterministic management insights.
 *
 * Every sentence is computed from values already loaded from PostgreSQL —
 * there is no narrative generation and no external model. If the data does not
 * support a statement (e.g. no previous week), the statement is simply not
 * produced rather than guessed.
 */
export type InsightTone = "neutral" | "positive" | "warning" | "critical";

export interface Insight {
  id: string;
  tone: InsightTone;
  text: string;
  /** Optional deep link / filter target the UI can attach to the insight. */
  focus?: { kind: "property" | "issues" | "compliance" | "tasks"; value?: string };
}

export interface InsightInput {
  weekLabel: string;
  properties: Array<{
    code: string;
    name: string;
    completed: number;
    inProcess: number;
    photos: number;
    openIssues: number;
    compliance: ComplianceResult;
    hasReport: boolean;
  }>;
  previous: {
    completed: number | null;
    inProcess: number | null;
    photos: number | null;
    openIssues: number | null;
    compliancePct: number | null;
  };
  current: {
    completed: number;
    inProcess: number;
    photos: number;
    openIssues: number;
    compliancePct: number | null;
  };
  flagged: FlaggedPoint[];
}

/** Builds the portfolio insight list (ordered most→least important). */
export function buildPortfolioInsights(input: InsightInput): Insight[] {
  const out: Insight[] = [];
  const { properties, previous, current, flagged } = input;

  // 1. Concentration of open issues in one property.
  if (current.openIssues > 0) {
    const worst = [...properties].sort((a, b) => b.openIssues - a.openIssues)[0];
    if (worst && worst.openIssues > 0) {
      const share = worst.openIssues / current.openIssues;
      if (properties.length > 1 && share >= 0.5) {
        out.push({
          id: "issue-concentration",
          tone: worst.openIssues >= 3 ? "critical" : "warning",
          text: `${worst.name} contains ${worst.openIssues} of the portfolio's ${current.openIssues} open checklist ${current.openIssues === 1 ? "issue" : "issues"}.`,
          focus: { kind: "property", value: worst.code },
        });
      }
    }
  }

  // 2. Lowest compliance property (only where measured).
  const measured = properties.filter((p) => p.compliance.pct !== null);
  if (measured.length > 1) {
    const lowest = [...measured].sort((a, b) => a.compliance.pct! - b.compliance.pct!)[0]!;
    const highest = [...measured].sort((a, b) => b.compliance.pct! - a.compliance.pct!)[0]!;
    if (lowest.compliance.pct! < highest.compliance.pct!) {
      out.push({
        id: "lowest-compliance",
        tone: lowest.compliance.pct! < 70 ? "warning" : "neutral",
        text: `${lowest.name} has the lowest checklist compliance this week at ${lowest.compliance.pct}% (${lowest.compliance.flagged} flagged of ${lowest.compliance.total} points).`,
        focus: { kind: "compliance", value: lowest.code },
      });
    }
  }

  // 3. In-process movement vs the previous week.
  if (previous.inProcess !== null && previous.inProcess !== current.inProcess) {
    const up = current.inProcess > previous.inProcess;
    out.push({
      id: "in-process-change",
      tone: up ? "warning" : "positive",
      text: `In-process tasks ${up ? "increased" : "fell"} from ${previous.inProcess} to ${current.inProcess} compared with last week.`,
      focus: { kind: "tasks", value: "inProcess" },
    });
  }

  // 4. Compliance movement in percentage points.
  if (previous.compliancePct !== null && current.compliancePct !== null) {
    const pp = current.compliancePct - previous.compliancePct;
    if (pp !== 0) {
      out.push({
        id: "compliance-change",
        tone: pp < 0 ? "warning" : "positive",
        text: `Checklist compliance ${pp > 0 ? "improved" : "dropped"} ${Math.abs(pp)} percentage ${Math.abs(pp) === 1 ? "point" : "points"} versus last week (${previous.compliancePct}% → ${current.compliancePct}%).`,
        focus: { kind: "compliance" },
      });
    }
  }

  // 5. Properties with no published data this week.
  const missing = properties.filter((p) => !p.hasReport && p.compliance.total === 0);
  for (const p of missing) {
    out.push({
      id: `no-data-${p.code}`,
      tone: "warning",
      text: `${p.name} has no published reporting for this period — its figures are excluded from portfolio totals.`,
      focus: { kind: "property", value: p.code },
    });
  }

  // 6. Dominant category among flagged points.
  if (flagged.length >= 3) {
    const byCategory = new Map<string, number>();
    for (const f of flagged) byCategory.set(f.categoryName, (byCategory.get(f.categoryName) ?? 0) + 1);
    const [topCategory, count] = [...byCategory.entries()].sort((a, b) => b[1] - a[1])[0]!;
    const share = Math.round((count / flagged.length) * 100);
    if (share >= 40) {
      out.push({
        id: "category-concentration",
        tone: "warning",
        text: `${topCategory} accounts for ${share}% of currently flagged checklist points.`,
        focus: { kind: "issues" },
      });
    }
  }

  // 7. A genuinely clean week is worth saying.
  if (current.openIssues === 0 && current.compliancePct === 100) {
    out.push({
      id: "clean-week",
      tone: "positive",
      text: "Every published checklist point was clean this week — no open bottlenecks across the portfolio.",
    });
  }

  return out;
}

/** Property-level insights for a single property dashboard. */
export function buildPropertyInsights(input: {
  propertyName: string;
  compliance: ComplianceResult;
  previousCompliancePct: number | null;
  flagged: FlaggedPoint[];
  completed: number;
  inProcess: number;
  previousCompleted: number | null;
  photos: number;
}): Insight[] {
  const out: Insight[] = [];
  const { propertyName, compliance, previousCompliancePct, flagged, completed, inProcess, previousCompleted } =
    input;

  if (compliance.total === 0) {
    out.push({
      id: "no-compliance-data",
      tone: "warning",
      text: `No published checklist entries for ${propertyName} in this reporting period, so compliance cannot be measured.`,
    });
    return out;
  }

  if (previousCompliancePct !== null && compliance.pct !== null && previousCompliancePct !== compliance.pct) {
    const pp = compliance.pct - previousCompliancePct;
    out.push({
      id: "compliance-change",
      tone: pp < 0 ? "warning" : "positive",
      text: `Compliance ${pp > 0 ? "improved" : "dropped"} ${Math.abs(pp)} percentage ${Math.abs(pp) === 1 ? "point" : "points"} versus last week (${previousCompliancePct}% → ${compliance.pct}%).`,
    });
  }

  if (flagged.length > 0) {
    const worst = flagged[0]!;
    out.push({
      id: "worst-issue",
      tone: worst.severity === "CRITICAL" || worst.severity === "HIGH" ? "critical" : "warning",
      text: `Most serious open issue: ${worst.itemName} (${worst.categoryName}), ${worst.severity.toLowerCase()} severity, open ${worst.ageDays === 0 ? "today" : `${worst.ageDays} days`}.`,
      focus: { kind: "issues" },
    });

    const stale = flagged.filter((f) => f.ageDays >= 3).length;
    if (stale > 0) {
      out.push({
        id: "stale-issues",
        tone: "warning",
        text: `${stale} flagged ${stale === 1 ? "point has" : "points have"} been open for three days or more.`,
        focus: { kind: "issues" },
      });
    }

    const noEvidence = flagged.filter((f) => f.evidenceCount === 0).length;
    if (noEvidence > 0) {
      out.push({
        id: "missing-evidence",
        tone: "neutral",
        text: `${noEvidence} flagged ${noEvidence === 1 ? "point has" : "points have"} no evidence photograph attached.`,
        focus: { kind: "issues" },
      });
    }
  }

  if (previousCompleted !== null && completed !== previousCompleted) {
    out.push({
      id: "tasks-change",
      tone: completed >= previousCompleted ? "positive" : "warning",
      text: `${completed} ${completed === 1 ? "task" : "tasks"} completed this week versus ${previousCompleted} last week, with ${inProcess} still in process.`,
      focus: { kind: "tasks" },
    });
  }

  return out;
}
