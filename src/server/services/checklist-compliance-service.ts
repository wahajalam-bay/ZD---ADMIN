import "server-only";
import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "@/server/db";
import {
  checklistCategories,
  checklistEntries,
  checklistItems,
  checklistResponsePhotos,
  checklistResponses,
  properties,
} from "@/db/schema";
import {
  computeCompliance,
  effectiveSeverity,
  groupCompliance,
  responseIsDefect,
  EMPTY_COMPLIANCE,
  type ComplianceResult,
  type Severity,
} from "@/lib/compliance";
import { addDays, weekEndOf } from "@/lib/week";
import type { WorkflowStatus } from "@/lib/roles";

/**
 * Checklist compliance — the single server-side source of truth.
 *
 * Compliance is ALWAYS derived from checklist records entered through the Data
 * Entry Engine: property + reporting week + visible checklist entries + their
 * responses. No dashboard component may compute or hard-code a percentage.
 *
 * Visibility is controlled by `statuses`:
 *   Published mode → ["PUBLISHED"]              (official reporting)
 *   Approved preview → ["PUBLISHED","APPROVED"] (management preview only)
 * Drafts, submitted and returned work are never counted in either mode.
 */
export type VisibleStatuses = WorkflowStatus[];

export interface CompliancePoint {
  responseId: string;
  propertyId: string;
  propertyCode: string;
  propertyName: string;
  categoryId: string;
  categoryKey: string;
  categoryName: string;
  itemName: string;
  entryId: string;
  entryDate: string;
  workflowStatus: WorkflowStatus;
  op: boolean;
  cl: boolean;
  comment: string;
  severity: Severity | null;
  evidenceCount: number;
}

/** Every applicable checklist point for a week, with its property/category. */
export async function compliancePoints(
  weekStart: string,
  statuses: VisibleStatuses,
  propertyIds?: string[],
): Promise<CompliancePoint[]> {
  if (statuses.length === 0) return [];
  const weekEnd = weekEndOf(weekStart);

  const rows = await db
    .select({
      responseId: checklistResponses.id,
      op: checklistResponses.op,
      cl: checklistResponses.cl,
      comment: checklistResponses.comment,
      severity: checklistResponses.severity,
      entryId: checklistEntries.id,
      entryDate: checklistEntries.entryDate,
      workflowStatus: checklistEntries.workflowStatus,
      propertyId: properties.id,
      propertyCode: properties.code,
      propertyName: properties.name,
      categoryId: checklistCategories.id,
      categoryKey: checklistCategories.key,
      categoryName: checklistCategories.name,
      itemName: checklistItems.name,
    })
    .from(checklistResponses)
    .innerJoin(checklistEntries, eq(checklistEntries.id, checklistResponses.entryId))
    .innerJoin(properties, eq(properties.id, checklistEntries.propertyId))
    .innerJoin(checklistCategories, eq(checklistCategories.id, checklistEntries.categoryId))
    .innerJoin(checklistItems, eq(checklistItems.id, checklistResponses.checklistItemId))
    .where(
      and(
        inArray(checklistEntries.workflowStatus, statuses),
        gte(checklistEntries.entryDate, weekStart),
        lte(checklistEntries.entryDate, weekEnd),
        ...(propertyIds && propertyIds.length > 0
          ? [inArray(checklistEntries.propertyId, propertyIds)]
          : []),
      ),
    );

  if (rows.length === 0) return [];

  // Evidence counts in one round trip (no N+1).
  const photoRows = await db
    .select({
      responseId: checklistResponsePhotos.checklistResponseId,
      id: checklistResponsePhotos.id,
    })
    .from(checklistResponsePhotos)
    .where(
      inArray(
        checklistResponsePhotos.checklistResponseId,
        rows.map((r) => r.responseId),
      ),
    );
  const evidence = new Map<string, number>();
  for (const p of photoRows) evidence.set(p.responseId, (evidence.get(p.responseId) ?? 0) + 1);

  return rows.map((r) => ({ ...r, evidenceCount: evidence.get(r.responseId) ?? 0 }));
}

/** Compliance per property for one reporting week. */
export async function complianceByProperty(
  weekStart: string,
  statuses: VisibleStatuses,
  propertyIds?: string[],
): Promise<Map<string, ComplianceResult>> {
  const points = await compliancePoints(weekStart, statuses, propertyIds);
  return groupCompliance(points, (p) => p.propertyId);
}

/** Portfolio-wide compliance (all visible properties) for one week. */
export async function portfolioCompliance(
  weekStart: string,
  statuses: VisibleStatuses,
): Promise<ComplianceResult> {
  const points = await compliancePoints(weekStart, statuses);
  return computeCompliance(points);
}

export interface CategoryCompliance extends ComplianceResult {
  categoryKey: string;
  categoryName: string;
}

/** Compliance per checklist category, worst first (drill-down level 3). */
export async function complianceByCategory(
  weekStart: string,
  statuses: VisibleStatuses,
  propertyIds?: string[],
): Promise<CategoryCompliance[]> {
  const points = await compliancePoints(weekStart, statuses, propertyIds);
  const names = new Map(points.map((p) => [p.categoryKey, p.categoryName]));
  return [...groupCompliance(points, (p) => p.categoryKey).entries()]
    .map(([categoryKey, result]) => ({
      categoryKey,
      categoryName: names.get(categoryKey) ?? categoryKey,
      ...result,
    }))
    .sort((a, b) => (a.pct ?? 101) - (b.pct ?? 101));
}

export interface FlaggedPoint {
  responseId: string;
  propertyCode: string;
  propertyName: string;
  categoryName: string;
  itemName: string;
  issue: string;
  severity: Severity;
  entryDate: string;
  ageDays: number;
  evidenceCount: number;
  workflowStatus: WorkflowStatus;
}

/** Flagged points (drill-down level 4), most severe then oldest. */
export async function flaggedPoints(
  weekStart: string,
  statuses: VisibleStatuses,
  propertyIds?: string[],
): Promise<FlaggedPoint[]> {
  const points = await compliancePoints(weekStart, statuses, propertyIds);
  const today = new Date();
  return points
    .filter(responseIsDefect)
    .map((p) => ({
      responseId: p.responseId,
      propertyCode: p.propertyCode,
      propertyName: p.propertyName,
      categoryName: p.categoryName,
      itemName: p.itemName,
      issue: p.comment || "Flagged during checks",
      severity: effectiveSeverity(p) ?? ("LOW" as Severity),
      entryDate: p.entryDate,
      ageDays: Math.max(
        0,
        Math.round((today.getTime() - new Date(`${p.entryDate}T00:00:00`).getTime()) / 86_400_000),
      ),
      evidenceCount: p.evidenceCount,
      workflowStatus: p.workflowStatus,
    }))
    .sort((a, b) => {
      const rank = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 } as const;
      if (rank[b.severity] !== rank[a.severity]) return rank[b.severity] - rank[a.severity];
      return b.entryDate.localeCompare(a.entryDate);
    });
}

/** Checklist points flagged most often in the week (repeat offenders). */
export async function mostFlaggedPoints(
  weekStart: string,
  statuses: VisibleStatuses,
  propertyIds?: string[],
  limit = 5,
): Promise<Array<{ itemName: string; categoryName: string; count: number }>> {
  const points = await compliancePoints(weekStart, statuses, propertyIds);
  const counts = new Map<string, { itemName: string; categoryName: string; count: number }>();
  for (const p of points.filter(responseIsDefect)) {
    const key = `${p.categoryKey}:${p.itemName}`;
    const cur = counts.get(key) ?? { itemName: p.itemName, categoryName: p.categoryName, count: 0 };
    cur.count += 1;
    counts.set(key, cur);
  }
  return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, limit);
}

export interface ComplianceSnapshot {
  current: ComplianceResult;
  previous: ComplianceResult;
  /** Change in PERCENTAGE POINTS, null when either week has no data. */
  deltaPp: number | null;
}

/** Compliance for a week plus the comparable previous week (for the KPI). */
export async function complianceSnapshot(
  weekStart: string,
  statuses: VisibleStatuses,
  propertyIds?: string[],
): Promise<ComplianceSnapshot> {
  const [currentPoints, previousPoints] = await Promise.all([
    compliancePoints(weekStart, statuses, propertyIds),
    compliancePoints(addDays(weekStart, -7), statuses, propertyIds),
  ]);
  const current = currentPoints.length ? computeCompliance(currentPoints) : EMPTY_COMPLIANCE;
  const previous = previousPoints.length ? computeCompliance(previousPoints) : EMPTY_COMPLIANCE;
  return {
    current,
    previous,
    deltaPp:
      current.pct !== null && previous.pct !== null ? current.pct - previous.pct : null,
  };
}
