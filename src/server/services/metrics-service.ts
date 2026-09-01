import "server-only";
import { and, asc, eq, gte, inArray, lte, sql } from "drizzle-orm";
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
  computeCompliance,
  effectiveSeverity,
  selectBottlenecks,
  type ComplianceResult,
  type Severity,
} from "@/lib/compliance";
import { aggregateTaskCounts, taskCompletionPct, totalArea, type TaskCounts } from "@/lib/metrics";
import { weekEndOf } from "@/lib/week";
import type { WorkflowStatus } from "@/lib/roles";

/**
 * Management KPI services. `statuses` controls visibility: the Command Center
 * defaults to PUBLISHED data; management preview adds APPROVED.
 */
export type VisibleStatuses = WorkflowStatus[];
export const PUBLISHED_ONLY: VisibleStatuses = ["PUBLISHED"];
export const PREVIEW: VisibleStatuses = ["PUBLISHED", "APPROVED"];

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
  const complianceMap = await complianceForWeek(weekStart, statuses);

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

/** Compliance per property for a week, computed from published entries. */
export async function complianceForWeek(
  weekStart: string,
  statuses: VisibleStatuses,
  propertyIds?: string[],
): Promise<Map<string, ComplianceResult>> {
  const weekEnd = weekEndOf(weekStart);
  const entries = await db
    .select({ id: checklistEntries.id, propertyId: checklistEntries.propertyId })
    .from(checklistEntries)
    .where(
      and(
        inArray(checklistEntries.workflowStatus, statuses),
        gte(checklistEntries.entryDate, weekStart),
        lte(checklistEntries.entryDate, weekEnd),
        ...(propertyIds ? [inArray(checklistEntries.propertyId, propertyIds)] : []),
      ),
    );

  const result = new Map<string, ComplianceResult>();
  if (entries.length === 0) return result;

  const responses = await db
    .select({
      entryId: checklistResponses.entryId,
      op: checklistResponses.op,
      cl: checklistResponses.cl,
      comment: checklistResponses.comment,
      severity: checklistResponses.severity,
    })
    .from(checklistResponses)
    .where(
      inArray(
        checklistResponses.entryId,
        entries.map((e) => e.id),
      ),
    );
  const byEntry = new Map<string, typeof responses>();
  for (const r of responses) {
    const list = byEntry.get(r.entryId) ?? [];
    list.push(r);
    byEntry.set(r.entryId, list);
  }

  const byProperty = new Map<string, Array<{ responses: typeof responses }>>();
  for (const e of entries) {
    const list = byProperty.get(e.propertyId) ?? [];
    list.push({ responses: byEntry.get(e.id) ?? [] });
    byProperty.set(e.propertyId, list);
  }
  for (const [propertyId, list] of byProperty) {
    result.set(propertyId, computeCompliance(list));
  }
  return result;
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
