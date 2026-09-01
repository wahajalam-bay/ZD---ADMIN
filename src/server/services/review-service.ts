import "server-only";
import { and, count, desc, eq, gte, inArray, lte, sql, type SQL } from "drizzle-orm";
import { db } from "@/server/db";
import {
  checklistCategories,
  checklistEntries,
  checklistResponsePhotos,
  checklistResponses,
  properties,
  user as userTable,
  weeklyMedia,
  weeklyReports,
  weeklyTasks,
} from "@/db/schema";
import { recordAudit } from "@/server/services/audit-service";
import { AuthorizationError } from "@/server/permissions";
import type { SessionUser } from "@/server/auth/session";
import { canTransition, type WorkflowStatus } from "@/lib/roles";
import { weekEndOf } from "@/lib/week";

export type SubmissionKind = "checklist" | "weekly";

export interface ReviewQueueFilters {
  propertyId?: string;
  type?: SubmissionKind;
  status?: WorkflowStatus;
  categoryKey?: string;
  week?: string;
  page: number;
}

export interface ReviewQueueItem {
  kind: SubmissionKind;
  id: string;
  propertyId: string;
  propertyName: string;
  title: string;
  dateLabel: string;
  status: WorkflowStatus;
  submittedByName: string | null;
  submittedAt: Date | null;
  issueCount: number;
  evidenceCount: number;
}

const PAGE_SIZE = 25;

export async function getReviewQueue(filters: ReviewQueueFilters): Promise<{
  items: ReviewQueueItem[];
  total: number;
  pageSize: number;
}> {
  const status = filters.status ?? "SUBMITTED";
  const items: ReviewQueueItem[] = [];
  let total = 0;

  if (filters.type !== "weekly") {
    const where: SQL[] = [eq(checklistEntries.workflowStatus, status)];
    if (filters.propertyId) where.push(eq(checklistEntries.propertyId, filters.propertyId));
    if (filters.week) {
      where.push(gte(checklistEntries.entryDate, filters.week));
      where.push(lte(checklistEntries.entryDate, weekEndOf(filters.week)));
    }
    if (filters.categoryKey) where.push(eq(checklistCategories.key, filters.categoryKey));

    const issueCountSql = sql<number>`(
      select count(*)::int from ${checklistResponses} r
      where r.entry_id = ${checklistEntries.id}
        and (r.comment <> '' or r.severity is not null or not (r.op and r.cl))
    )`;
    const evidenceCountSql = sql<number>`(
      select count(*)::int from ${checklistResponsePhotos} p
      join ${checklistResponses} r on r.id = p.checklist_response_id
      where r.entry_id = ${checklistEntries.id}
    )`;

    const rows = await db
      .select({
        id: checklistEntries.id,
        propertyId: checklistEntries.propertyId,
        propertyName: properties.name,
        categoryName: checklistCategories.name,
        entryDate: checklistEntries.entryDate,
        status: checklistEntries.workflowStatus,
        submittedAt: checklistEntries.submittedAt,
        submittedByName: userTable.name,
        issueCount: issueCountSql,
        evidenceCount: evidenceCountSql,
      })
      .from(checklistEntries)
      .innerJoin(properties, eq(properties.id, checklistEntries.propertyId))
      .innerJoin(checklistCategories, eq(checklistCategories.id, checklistEntries.categoryId))
      .leftJoin(userTable, eq(userTable.id, checklistEntries.submittedBy))
      .where(and(...where))
      .orderBy(desc(checklistEntries.submittedAt), desc(checklistEntries.updatedAt));

    total += rows.length;
    for (const r of rows) {
      items.push({
        kind: "checklist",
        id: r.id,
        propertyId: r.propertyId,
        propertyName: r.propertyName,
        title: r.categoryName,
        dateLabel: r.entryDate,
        status: r.status,
        submittedByName: r.submittedByName,
        submittedAt: r.submittedAt,
        issueCount: r.issueCount,
        evidenceCount: r.evidenceCount,
      });
    }
  }

  if (filters.type !== "checklist" && !filters.categoryKey) {
    const where: SQL[] = [eq(weeklyReports.workflowStatus, status)];
    if (filters.propertyId) where.push(eq(weeklyReports.propertyId, filters.propertyId));
    if (filters.week) where.push(eq(weeklyReports.weekStart, filters.week));

    const taskCountSql = sql<number>`(
      select count(*)::int from ${weeklyTasks} t where t.weekly_report_id = ${weeklyReports.id}
    )`;
    const mediaCountSql = sql<number>`(
      select count(*)::int from ${weeklyMedia} m where m.weekly_report_id = ${weeklyReports.id}
    )`;

    const rows = await db
      .select({
        id: weeklyReports.id,
        propertyId: weeklyReports.propertyId,
        propertyName: properties.name,
        weekStart: weeklyReports.weekStart,
        status: weeklyReports.workflowStatus,
        submittedAt: weeklyReports.submittedAt,
        submittedByName: userTable.name,
        taskCount: taskCountSql,
        mediaCount: mediaCountSql,
      })
      .from(weeklyReports)
      .innerJoin(properties, eq(properties.id, weeklyReports.propertyId))
      .leftJoin(userTable, eq(userTable.id, weeklyReports.submittedBy))
      .where(and(...where))
      .orderBy(desc(weeklyReports.submittedAt), desc(weeklyReports.updatedAt));

    total += rows.length;
    for (const r of rows) {
      items.push({
        kind: "weekly",
        id: r.id,
        propertyId: r.propertyId,
        propertyName: r.propertyName,
        title: "Weekly Report",
        dateLabel: `Week of ${r.weekStart}`,
        status: r.status,
        submittedByName: r.submittedByName,
        submittedAt: r.submittedAt,
        issueCount: r.taskCount,
        evidenceCount: r.mediaCount,
      });
    }
  }

  items.sort((a, b) => (b.submittedAt?.getTime() ?? 0) - (a.submittedAt?.getTime() ?? 0));
  const start = (filters.page - 1) * PAGE_SIZE;
  return { items: items.slice(start, start + PAGE_SIZE), total, pageSize: PAGE_SIZE };
}

// ── Workflow transitions (transactional, audited) ───────────────────────────

type Kind = SubmissionKind;

async function loadSubmission(kind: Kind, id: string) {
  if (kind === "checklist") {
    const rows = await db.select().from(checklistEntries).where(eq(checklistEntries.id, id)).limit(1);
    return rows[0] ?? null;
  }
  const rows = await db.select().from(weeklyReports).where(eq(weeklyReports.id, id)).limit(1);
  return rows[0] ?? null;
}

function tableFor(kind: Kind) {
  return kind === "checklist" ? checklistEntries : weeklyReports;
}

function entityTypeFor(kind: Kind) {
  return kind === "checklist" ? "checklist_entry" : "weekly_report";
}

export async function returnSubmission(
  user: SessionUser,
  kind: Kind,
  id: string,
  reason: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    const current = await loadSubmission(kind, id);
    if (!current) throw new AuthorizationError("Submission not found");
    if (!canTransition(current.workflowStatus, "RETURNED", user.role)) {
      throw new AuthorizationError(
        `Cannot return a submission in ${current.workflowStatus} state`,
      );
    }
    const table = tableFor(kind);
    await tx
      .update(table)
      .set({
        workflowStatus: "RETURNED",
        returnedBy: user.id,
        returnedAt: new Date(),
        returnReason: reason,
        reviewedBy: user.id,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(table.id, id));
    await recordAudit(tx, {
      actorUserId: user.id,
      action: `${kind}.returned`,
      entityType: entityTypeFor(kind),
      entityId: id,
      propertyId: current.propertyId,
      beforeData: { workflowStatus: current.workflowStatus },
      afterData: { workflowStatus: "RETURNED", reason },
    });
  });
}

export async function approveSubmission(
  user: SessionUser,
  kind: Kind,
  id: string,
  note: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    const current = await loadSubmission(kind, id);
    if (!current) throw new AuthorizationError("Submission not found");
    if (!canTransition(current.workflowStatus, "APPROVED", user.role)) {
      throw new AuthorizationError(
        `Cannot approve a submission in ${current.workflowStatus} state`,
      );
    }
    const table = tableFor(kind);
    await tx
      .update(table)
      .set({
        workflowStatus: "APPROVED",
        approvedBy: user.id,
        approvedAt: new Date(),
        reviewedBy: user.id,
        reviewedAt: new Date(),
        reviewNotes: note || current.reviewNotes,
        updatedAt: new Date(),
      })
      .where(eq(table.id, id));
    await recordAudit(tx, {
      actorUserId: user.id,
      action: `${kind}.approved`,
      entityType: entityTypeFor(kind),
      entityId: id,
      propertyId: current.propertyId,
      beforeData: { workflowStatus: current.workflowStatus },
      afterData: { workflowStatus: "APPROVED", note },
    });
  });
}

export async function publishSubmission(user: SessionUser, kind: Kind, id: string): Promise<void> {
  await db.transaction(async (tx) => {
    const current = await loadSubmission(kind, id);
    if (!current) throw new AuthorizationError("Submission not found");
    if (!canTransition(current.workflowStatus, "PUBLISHED", user.role)) {
      throw new AuthorizationError(
        `Cannot publish a submission in ${current.workflowStatus} state`,
      );
    }
    const table = tableFor(kind);
    await tx
      .update(table)
      .set({
        workflowStatus: "PUBLISHED",
        publishedBy: user.id,
        publishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(table.id, id));
    await recordAudit(tx, {
      actorUserId: user.id,
      action: `${kind}.published`,
      entityType: entityTypeFor(kind),
      entityId: id,
      propertyId: current.propertyId,
      beforeData: { workflowStatus: current.workflowStatus },
      afterData: { workflowStatus: "PUBLISHED" },
    });
  });
}

/**
 * Weekly property publication batch: publishes every APPROVED checklist entry
 * in the reporting week plus the APPROVED weekly report, atomically.
 */
export async function publishWeekForProperty(
  user: SessionUser,
  propertyId: string,
  weekStart: string,
): Promise<{ published: number }> {
  const weekEnd = weekEndOf(weekStart);
  return db.transaction(async (tx) => {
    const entryRows = await tx
      .select({ id: checklistEntries.id })
      .from(checklistEntries)
      .where(
        and(
          eq(checklistEntries.propertyId, propertyId),
          eq(checklistEntries.workflowStatus, "APPROVED"),
          gte(checklistEntries.entryDate, weekStart),
          lte(checklistEntries.entryDate, weekEnd),
        ),
      );
    let published = 0;
    if (entryRows.length > 0) {
      await tx
        .update(checklistEntries)
        .set({
          workflowStatus: "PUBLISHED",
          publishedBy: user.id,
          publishedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          inArray(
            checklistEntries.id,
            entryRows.map((r) => r.id),
          ),
        );
      published += entryRows.length;
    }

    const reportRows = await tx
      .select({ id: weeklyReports.id })
      .from(weeklyReports)
      .where(
        and(
          eq(weeklyReports.propertyId, propertyId),
          eq(weeklyReports.weekStart, weekStart),
          eq(weeklyReports.workflowStatus, "APPROVED"),
        ),
      );
    if (reportRows.length > 0) {
      await tx
        .update(weeklyReports)
        .set({
          workflowStatus: "PUBLISHED",
          publishedBy: user.id,
          publishedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(weeklyReports.id, reportRows[0]!.id));
      published += reportRows.length;
    }

    await recordAudit(tx, {
      actorUserId: user.id,
      action: "publication.week",
      entityType: "publication_batch",
      entityId: `${propertyId}:${weekStart}`,
      propertyId,
      metadata: { weekStart, published },
    });

    return { published };
  });
}

/** Queue counts per workflow state — drives the review segmented control. */
export async function reviewQueueCounts(): Promise<Record<WorkflowStatus, number>> {
  const entryRows = await db
    .select({ status: checklistEntries.workflowStatus, c: count() })
    .from(checklistEntries)
    .groupBy(checklistEntries.workflowStatus);
  const reportRows = await db
    .select({ status: weeklyReports.workflowStatus, c: count() })
    .from(weeklyReports)
    .groupBy(weeklyReports.workflowStatus);

  const totals: Record<WorkflowStatus, number> = {
    DRAFT: 0,
    SUBMITTED: 0,
    RETURNED: 0,
    APPROVED: 0,
    PUBLISHED: 0,
  };
  for (const r of [...entryRows, ...reportRows]) totals[r.status] += r.c;
  return totals;
}

/** Counts of pending review items (for nav badges). */
export async function countPendingReview(): Promise<number> {
  const [a] = await db
    .select({ c: count() })
    .from(checklistEntries)
    .where(eq(checklistEntries.workflowStatus, "SUBMITTED"));
  const [b] = await db
    .select({ c: count() })
    .from(weeklyReports)
    .where(eq(weeklyReports.workflowStatus, "SUBMITTED"));
  return (a?.c ?? 0) + (b?.c ?? 0);
}
