import "server-only";
import { and, asc, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/server/db";
import {
  checklistCategories,
  checklistEntries,
  checklistItems,
  checklistResponsePhotos,
  checklistResponses,
  properties,
  weeklyMedia,
  weeklyReports,
  weeklyTasks,
} from "@/db/schema";
import {
  effectiveSeverity,
  selectBottlenecks,
  PREVIEW_VISIBILITY,
  PUBLISHED_VISIBILITY,
  type ComplianceResult,
  type Severity,
} from "@/lib/compliance";
import { complianceByProperty } from "./checklist-compliance-service";
import { aggregateTaskCounts, taskCompletionPct, totalArea, type TaskCounts } from "@/lib/metrics";
import { addDays, weekEndOf } from "@/lib/week";
import type { WorkflowStatus } from "@/lib/roles";

/**
 * Management KPI services. `statuses` controls visibility: the Command Center
 * defaults to PUBLISHED data; management preview adds APPROVED.
 */
export type VisibleStatuses = WorkflowStatus[];
export const PUBLISHED_ONLY: VisibleStatuses = [...PUBLISHED_VISIBILITY];
export const PREVIEW: VisibleStatuses = [...PREVIEW_VISIBILITY];

export async function listActiveProperties() {
  return db
    .select()
    .from(properties)
    .where(eq(properties.active, true))
    .orderBy(asc(properties.displayOrder), asc(properties.name));
}

export interface PropertyWeekStats {
  propertyId: string;
  tasks: TaskCounts;
  photoCount: number;
  trackingStatus: "ON_TRACK" | "WATCH" | "AT_RISK" | null;
  summary: string | null;
  reportStatus: WorkflowStatus | null;
}

/** Per-property weekly-report stats for one reporting week (single round trips). */
export async function propertyWeekStats(
  weekStart: string,
  statuses: VisibleStatuses,
  propertyIds?: string[],
): Promise<Map<string, PropertyWeekStats>> {
  const reportWhere = [
    eq(weeklyReports.weekStart, weekStart),
    inArray(weeklyReports.workflowStatus, statuses),
    ...(propertyIds ? [inArray(weeklyReports.propertyId, propertyIds)] : []),
  ];
  const reports = await db
    .select({
      id: weeklyReports.id,
      propertyId: weeklyReports.propertyId,
      trackingStatus: weeklyReports.trackingStatus,
      summary: weeklyReports.summary,
      status: weeklyReports.workflowStatus,
    })
    .from(weeklyReports)
    .where(and(...reportWhere));

  const result = new Map<string, PropertyWeekStats>();
  if (reports.length === 0) return result;
  const reportIds = reports.map((r) => r.id);

  const taskRows = await db
    .select({ reportId: weeklyTasks.weeklyReportId, status: weeklyTasks.status })
    .from(weeklyTasks)
    .where(inArray(weeklyTasks.weeklyReportId, reportIds));

  const mediaRows = await db
    .select({ reportId: weeklyMedia.weeklyReportId, c: sql<number>`count(*)::int` })
    .from(weeklyMedia)
    .where(and(inArray(weeklyMedia.weeklyReportId, reportIds), eq(weeklyMedia.mediaType, "IMAGE")))
    .groupBy(weeklyMedia.weeklyReportId);
  const mediaByReport = new Map(mediaRows.map((m) => [m.reportId, m.c]));

  for (const r of reports) {
    const tasks = aggregateTaskCounts(taskRows.filter((t) => t.reportId === r.id));
    result.set(r.propertyId, {
      propertyId: r.propertyId,
      tasks,
      photoCount: mediaByReport.get(r.id) ?? 0,
      trackingStatus: r.trackingStatus,
      summary: r.summary,
      reportStatus: r.status,
    });
  }
  return result;
}

export interface PortfolioMetrics {
  propertyCount: number;
  area: { sum: number; complete: boolean };
  tasks: TaskCounts;
  completionPct: number | null;
  sitePhotos: number;
  perProperty: Array<{
    property: typeof properties.$inferSelect;
    stats: PropertyWeekStats | null;
    compliance: ComplianceResult;
  }>;
}

export async function portfolioMetrics(
  weekStart: string,
  statuses: VisibleStatuses,
): Promise<PortfolioMetrics> {
  const activeProperties = await listActiveProperties();
  const stats = await propertyWeekStats(weekStart, statuses);
  const complianceMap = await complianceByProperty(weekStart, statuses);

  let completed = 0;
  let inProcess = 0;
  let sitePhotos = 0;
  for (const s of stats.values()) {
    completed += s.tasks.completed;
    inProcess += s.tasks.inProcess;
    sitePhotos += s.photoCount;
  }
  const tasks = { completed, inProcess };

  return {
    propertyCount: activeProperties.length,
    area: totalArea(activeProperties),
    tasks,
    completionPct: taskCompletionPct(tasks),
    sitePhotos,
    perProperty: activeProperties.map((p) => ({
      property: p,
      stats: stats.get(p.id) ?? null,
      compliance: complianceMap.get(p.id) ?? { total: 0, clean: 0, flagged: 0, pct: null },
    })),
  };
}

/**
 * Compliance per property — delegates to `checklistComplianceService`, the
 * single server-side source of truth (never computed in components).
 */
export async function complianceForWeek(
  weekStart: string,
  statuses: VisibleStatuses,
  propertyIds?: string[],
): Promise<Map<string, ComplianceResult>> {
  return complianceByProperty(weekStart, statuses, propertyIds);
}

export interface TaskRecord {
  id: string;
  propertyCode: string;
  propertyName: string;
  task: string;
  status: "COMPLETED" | "IN_PROCESS";
  etaDate: string | null;
}

/** Every visible weekly task for a week — powers task drill-down panels. */
export async function taskRecordsForWeek(
  weekStart: string,
  statuses: VisibleStatuses,
  propertyIds?: string[],
): Promise<TaskRecord[]> {
  return db
    .select({
      id: weeklyTasks.id,
      propertyCode: properties.code,
      propertyName: properties.name,
      task: weeklyTasks.task,
      status: weeklyTasks.status,
      etaDate: weeklyTasks.etaDate,
    })
    .from(weeklyTasks)
    .innerJoin(weeklyReports, eq(weeklyReports.id, weeklyTasks.weeklyReportId))
    .innerJoin(properties, eq(properties.id, weeklyReports.propertyId))
    .where(
      and(
        eq(weeklyReports.weekStart, weekStart),
        inArray(weeklyReports.workflowStatus, statuses),
        ...(propertyIds && propertyIds.length > 0
          ? [inArray(weeklyReports.propertyId, propertyIds)]
          : []),
      ),
    )
    .orderBy(asc(properties.displayOrder), asc(weeklyTasks.sortOrder));
}

/** Per-property photo counts for the media drill-down. */
export async function photoCountsByProperty(
  weekStart: string,
  statuses: VisibleStatuses,
): Promise<Array<{ propertyCode: string; propertyName: string; count: number }>> {
  const rows = await db
    .select({
      propertyCode: properties.code,
      propertyName: properties.name,
      count: sql<number>`count(*)::int`,
    })
    .from(weeklyMedia)
    .innerJoin(weeklyReports, eq(weeklyReports.id, weeklyMedia.weeklyReportId))
    .innerJoin(properties, eq(properties.id, weeklyMedia.propertyId))
    .where(
      and(
        eq(weeklyReports.weekStart, weekStart),
        inArray(weeklyReports.workflowStatus, statuses),
        eq(weeklyMedia.mediaType, "IMAGE"),
      ),
    )
    .groupBy(properties.code, properties.name, properties.displayOrder)
    .orderBy(asc(properties.displayOrder));
  return rows;
}

export interface BottleneckRow {
  responseId: string;
  categoryName: string;
  itemName: string;
  issue: string;
  severity: Severity;
  entryDate: string;
  evidence: Array<{
    id: string;
    thumbnailKey: string;
    storageKey: string;
    caption: string;
  }>;
}

/** Live bottleneck table: defect responses from visible entries in the week. */
export async function bottlenecksForProperty(
  propertyId: string,
  weekStart: string,
  statuses: VisibleStatuses,
): Promise<BottleneckRow[]> {
  const weekEnd = weekEndOf(weekStart);
  const rows = await db
    .select({
      responseId: checklistResponses.id,
      op: checklistResponses.op,
      cl: checklistResponses.cl,
      comment: checklistResponses.comment,
      severity: checklistResponses.severity,
      entryDate: checklistEntries.entryDate,
      categoryName: checklistCategories.name,
      itemName: checklistItems.name,
    })
    .from(checklistResponses)
    .innerJoin(checklistEntries, eq(checklistEntries.id, checklistResponses.entryId))
    .innerJoin(checklistCategories, eq(checklistCategories.id, checklistEntries.categoryId))
    .innerJoin(checklistItems, eq(checklistItems.id, checklistResponses.checklistItemId))
    .where(
      and(
        eq(checklistEntries.propertyId, propertyId),
        inArray(checklistEntries.workflowStatus, statuses),
        gte(checklistEntries.entryDate, weekStart),
        lte(checklistEntries.entryDate, weekEnd),
      ),
    );

  const defects = selectBottlenecks(rows);
  if (defects.length === 0) return [];

  const photos = await db
    .select()
    .from(checklistResponsePhotos)
    .where(
      inArray(
        checklistResponsePhotos.checklistResponseId,
        defects.map((d) => d.responseId),
      ),
    );

  return defects.map((d) => ({
    responseId: d.responseId,
    categoryName: d.categoryName,
    itemName: d.itemName,
    issue: d.comment || "Flagged during checks",
    severity: effectiveSeverity(d) ?? "LOW",
    entryDate: d.entryDate,
    evidence: photos
      .filter((p) => p.checklistResponseId === d.responseId)
      .map((p) => ({
        id: p.id,
        thumbnailKey: p.thumbnailKey,
        storageKey: p.storageKey,
        caption: p.caption,
      })),
  }));
}

export interface AttentionItem {
  responseId: string;
  propertyId: string;
  propertyCode: string;
  propertyName: string;
  categoryName: string;
  categoryKey: string;
  itemName: string;
  issue: string;
  severity: Severity;
  entryDate: string;
  /** Whole days since the issue was recorded. */
  ageDays: number;
  evidenceCount: number;
  workflowStatus: WorkflowStatus;
}

/**
 * Portfolio-wide "Attention Required" feed: unresolved checklist defects for
 * the reporting week, most severe first then oldest. Drives the management
 * exception surface on the Portfolio Overview.
 */
export async function attentionFeed(
  weekStart: string,
  statuses: VisibleStatuses,
  opts: { propertyIds?: string[]; limit?: number } = {},
): Promise<AttentionItem[]> {
  const weekEnd = weekEndOf(weekStart);
  const rows = await db
    .select({
      responseId: checklistResponses.id,
      op: checklistResponses.op,
      cl: checklistResponses.cl,
      comment: checklistResponses.comment,
      severity: checklistResponses.severity,
      entryDate: checklistEntries.entryDate,
      workflowStatus: checklistEntries.workflowStatus,
      propertyId: properties.id,
      propertyCode: properties.code,
      propertyName: properties.name,
      categoryName: checklistCategories.name,
      categoryKey: checklistCategories.key,
      itemName: checklistItems.name,
      evidenceCount: sql<number>`(
        select count(*)::int from ${checklistResponsePhotos} p
        where p.checklist_response_id = ${checklistResponses.id}
      )`,
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
        ...(opts.propertyIds ? [inArray(checklistEntries.propertyId, opts.propertyIds)] : []),
      ),
    );

  const today = new Date();
  const defects = selectBottlenecks(rows).map((r) => ({
    responseId: r.responseId,
    propertyId: r.propertyId,
    propertyCode: r.propertyCode,
    propertyName: r.propertyName,
    categoryName: r.categoryName,
    categoryKey: r.categoryKey,
    itemName: r.itemName,
    issue: r.comment || "Flagged during checks",
    severity: effectiveSeverity(r) ?? ("LOW" as Severity),
    entryDate: r.entryDate,
    ageDays: Math.max(
      0,
      Math.round((today.getTime() - new Date(`${r.entryDate}T00:00:00`).getTime()) / 86_400_000),
    ),
    evidenceCount: r.evidenceCount,
    workflowStatus: r.workflowStatus,
  }));

  return opts.limit ? defects.slice(0, opts.limit) : defects;
}

/** Open (defect) issue counts per property for a reporting week. */
export async function openIssueCounts(
  weekStart: string,
  statuses: VisibleStatuses,
): Promise<Map<string, number>> {
  const items = await attentionFeed(weekStart, statuses);
  const map = new Map<string, number>();
  for (const i of items) map.set(i.propertyId, (map.get(i.propertyId) ?? 0) + 1);
  return map;
}

/** Most recent publication timestamp across the portfolio (or one property). */
export async function lastPublishedAt(propertyId?: string): Promise<Date | null> {
  const [report] = await db
    .select({ at: weeklyReports.publishedAt })
    .from(weeklyReports)
    .where(
      and(
        eq(weeklyReports.workflowStatus, "PUBLISHED"),
        ...(propertyId ? [eq(weeklyReports.propertyId, propertyId)] : []),
      ),
    )
    .orderBy(desc(weeklyReports.publishedAt))
    .limit(1);
  const [entry] = await db
    .select({ at: checklistEntries.publishedAt })
    .from(checklistEntries)
    .where(
      and(
        eq(checklistEntries.workflowStatus, "PUBLISHED"),
        ...(propertyId ? [eq(checklistEntries.propertyId, propertyId)] : []),
      ),
    )
    .orderBy(desc(checklistEntries.publishedAt))
    .limit(1);
  const candidates = [report?.at, entry?.at].filter((d): d is Date => Boolean(d));
  if (candidates.length === 0) return null;
  return candidates.sort((a, b) => b.getTime() - a.getTime())[0]!;
}

/** Weekly task-completion series for KPI sparklines (oldest → newest). */
export async function taskTrend(
  weekStart: string,
  statuses: VisibleStatuses,
  weeks = 6,
  propertyId?: string,
): Promise<Array<{ week: string; completed: number; inProcess: number }>> {
  const first = addDays(weekStart, -7 * (weeks - 1));
  const rows = await db
    .select({
      week: weeklyReports.weekStart,
      status: weeklyTasks.status,
      count: sql<number>`count(*)::int`,
    })
    .from(weeklyTasks)
    .innerJoin(weeklyReports, eq(weeklyReports.id, weeklyTasks.weeklyReportId))
    .where(
      and(
        inArray(weeklyReports.workflowStatus, statuses),
        gte(weeklyReports.weekStart, first),
        lte(weeklyReports.weekStart, weekStart),
        ...(propertyId ? [eq(weeklyReports.propertyId, propertyId)] : []),
      ),
    )
    .groupBy(weeklyReports.weekStart, weeklyTasks.status);

  const byWeek = new Map<string, { completed: number; inProcess: number }>();
  for (const r of rows) {
    const cur = byWeek.get(r.week) ?? { completed: 0, inProcess: 0 };
    if (r.status === "COMPLETED") cur.completed += r.count;
    else cur.inProcess += r.count;
    byWeek.set(r.week, cur);
  }
  return Array.from({ length: weeks }, (_, i) => {
    const week = addDays(first, i * 7);
    const v = byWeek.get(week) ?? { completed: 0, inProcess: 0 };
    return { week, ...v };
  });
}

/** Task rows for the property task table (published/preview weekly tasks). */
export async function tasksForProperty(
  propertyId: string,
  weekStart: string,
  statuses: VisibleStatuses,
) {
  return db
    .select({
      id: weeklyTasks.id,
      task: weeklyTasks.task,
      status: weeklyTasks.status,
      etaDate: weeklyTasks.etaDate,
      sortOrder: weeklyTasks.sortOrder,
    })
    .from(weeklyTasks)
    .innerJoin(weeklyReports, eq(weeklyReports.id, weeklyTasks.weeklyReportId))
    .where(
      and(
        eq(weeklyReports.propertyId, propertyId),
        eq(weeklyReports.weekStart, weekStart),
        inArray(weeklyReports.workflowStatus, statuses),
      ),
    )
    .orderBy(asc(weeklyTasks.sortOrder));
}
