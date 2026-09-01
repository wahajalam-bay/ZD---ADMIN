/**
 * Checklist compliance + bottleneck business rules (pure, unit-tested).
 *
 * AUTHORITY (re-verified against the source artifacts):
 * - `Admin_Data_Entry_Engine.html` defines NO compliance/score logic at all.
 * - `Zameen_Admin_Properties_Command_Center (1).html` defines only the SHAPE
 *   of the metric: `pct = round(clean / total * 100)` with clean/flagged/total
 *   supplied as static sample values — no derivation rule exists.
 * - OP / CL are the opening and closing checks (confirmed by items such as
 *   "Time (Opening & Closing)"). They are NOT pass/fail marks, so an unticked
 *   OP or CL is NOT treated as non-compliance.
 *
 * Therefore compliance is measured over CHECKLIST POINTS (responses belonging
 * to visible checklist entries), and a point is flagged only when the site
 * team recorded an actual issue (defect comment and/or severity).
 * See docs/decisions.md → "Checklist compliance formula".
 */

import type { WorkflowStatus } from "./roles";

/**
 * Which workflow states may be counted. Draft, submitted and returned work is
 * NEVER measured: an unfinished sheet must not move a management number.
 */
export const PUBLISHED_VISIBILITY: readonly WorkflowStatus[] = ["PUBLISHED"];
/** Management preview adds APPROVED — approved-but-unpublished, never drafts. */
export const PREVIEW_VISIBILITY: readonly WorkflowStatus[] = ["PUBLISHED", "APPROVED"];

export function isVisibleForReporting(
  status: WorkflowStatus,
  statuses: readonly WorkflowStatus[],
): boolean {
  return statuses.includes(status);
}

export const SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const SEVERITY_LABELS: Record<Severity, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  CRITICAL: "Critical",
};

const SEVERITY_RANK: Record<Severity, number> = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };

export interface ResponseLike {
  op: boolean;
  cl: boolean;
  comment: string;
  severity?: Severity | null;
}

/**
 * A point is FLAGGED when an issue was explicitly recorded — a defect comment
 * and/or a severity. This is the single definition used by both compliance and
 * the bottleneck feed, so the two can never disagree.
 */
export function responseIsDefect(r: ResponseLike): boolean {
  return r.comment.trim() !== "" || r.severity != null;
}

/** Alias kept for call-sites that read better as "has an issue". */
export const responseHasIssue = responseIsDefect;

export interface ComplianceResult {
  /** Applicable checklist points measured. */
  total: number;
  clean: number;
  flagged: number;
  /** null when there is nothing published to measure (no divide-by-zero). */
  pct: number | null;
}

export const EMPTY_COMPLIANCE: ComplianceResult = { total: 0, clean: 0, flagged: 0, pct: null };

/**
 * Compliance over checklist POINTS: `round(clean / applicable * 100)`.
 * Callers pass only responses from visible (published, or approved in preview
 * mode) entries — drafts, submitted and returned work never reach here.
 */
export function computeCompliance(responses: ResponseLike[]): ComplianceResult {
  const total = responses.length;
  const flagged = responses.filter(responseIsDefect).length;
  const clean = total - flagged;
  return { total, clean, flagged, pct: total === 0 ? null : Math.round((clean / total) * 100) };
}

/**
 * Groups checklist points by an arbitrary key (property, category, …) and
 * computes compliance for each group. Shared by every server aggregation so a
 * per-property figure can never drift from the portfolio figure.
 */
export function groupCompliance<T extends ResponseLike>(
  points: T[],
  keyOf: (p: T) => string,
): Map<string, ComplianceResult> {
  const grouped = new Map<string, T[]>();
  for (const p of points) {
    const key = keyOf(p);
    const list = grouped.get(key);
    if (list) list.push(p);
    else grouped.set(key, [p]);
  }
  const out = new Map<string, ComplianceResult>();
  for (const [key, list] of grouped) out.set(key, computeCompliance(list));
  return out;
}

/** Change between two rates expressed in PERCENTAGE POINTS (never "%"). */
export function complianceDeltaPp(
  current: number | null,
  previous: number | null,
): number | null {
  if (current === null || previous === null) return null;
  return current - previous;
}

/**
 * Severity was not captured by the reference Data Entry Engine; production
 * adds an explicit selector on defect rows. A defect without a chosen severity
 * defaults to LOW. Healthy points never carry a severity.
 */
export function effectiveSeverity(r: ResponseLike): Severity | null {
  if (!responseIsDefect(r)) return null;
  return r.severity ?? "LOW";
}

export function severityRank(s: Severity): number {
  return SEVERITY_RANK[s];
}

export interface BottleneckCandidate extends ResponseLike {
  entryDate: string;
}

/** Bottleneck rows: flagged points only, most severe first, then most recent. */
export function selectBottlenecks<T extends BottleneckCandidate>(rows: T[]): T[] {
  return rows
    .filter(responseIsDefect)
    .sort((a, b) => {
      const sa = severityRank(effectiveSeverity(a) ?? "LOW");
      const sb = severityRank(effectiveSeverity(b) ?? "LOW");
      if (sb !== sa) return sb - sa;
      return b.entryDate.localeCompare(a.entryDate);
    });
}
