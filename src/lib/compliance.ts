/**
 * Checklist compliance + bottleneck business rules (pure, unit-tested).
 *
 * The reference Command Center computes compliance as
 *   pct = round(clean / total * 100)
 * over "clean" vs "flagged" checklist units. In the static deck those units
 * were slide pages; the live equivalent is the published checklist ENTRY
 * (one property + category + day). See docs/decisions.md → "Checklist
 * compliance formula".
 *
 * A CHECK response is an issue when it has a defect comment OR when the item
 * was not completed for both OP (opening) and CL (closing) — the reference
 * bottlenecks explicitly flag blank/unchecked sheets as issues.
 * LOG categories have no item rows and therefore cannot flag.
 */

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

/** Defect = an explicitly described issue (drives the bottleneck table). */
export function responseIsDefect(r: ResponseLike): boolean {
  return r.comment.trim() !== "" || r.severity != null;
}

/** Issue = defect OR incomplete OP/CL marks (drives compliance). */
export function responseHasIssue(r: ResponseLike): boolean {
  return responseIsDefect(r) || !(r.op && r.cl);
}

export function entryIsFlagged(responses: ResponseLike[]): boolean {
  return responses.some(responseHasIssue);
}

export interface ComplianceResult {
  total: number;
  clean: number;
  flagged: number;
  /** null when there is nothing published to measure (no divide-by-zero). */
  pct: number | null;
}

export function computeCompliance(entries: Array<{ responses: ResponseLike[] }>): ComplianceResult {
  const total = entries.length;
  const flagged = entries.filter((e) => entryIsFlagged(e.responses)).length;
  const clean = total - flagged;
  return { total, clean, flagged, pct: total === 0 ? null : Math.round((clean / total) * 100) };
}

/**
 * Severity was not captured by the reference Data Entry Engine; it appears
 * only in Command Center sample rows (Low/Medium/High). Production adds an
 * explicit selector (Low/Medium/High/Critical) on defect rows; a defect
 * without a chosen severity defaults to LOW. Recorded in docs/decisions.md.
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

/** Bottleneck rows: defects only, most severe first, then most recent. */
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
