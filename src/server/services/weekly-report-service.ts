import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { weeklyMedia, weeklyReports, weeklyTasks } from "@/db/schema";
import { recordAudit } from "@/server/services/audit-service";
import { AuthorizationError } from "@/server/permissions";
import type { SessionUser } from "@/server/auth/session";
import { canEditSubmission, canTransition } from "@/lib/roles";
import type { WeeklyReportPayload } from "@/lib/validation";

export async function getWeeklyReportView(propertyId: string, weekStart: string) {
  const reportRows = await db
    .select()
    .from(weeklyReports)
    .where(and(eq(weeklyReports.propertyId, propertyId), eq(weeklyReports.weekStart, weekStart)))
    .limit(1);
  const report = reportRows[0] ?? null;
  if (!report) return { report: null, tasks: [], media: [] };
  const [tasks, media] = await Promise.all([
    db
      .select()
      .from(weeklyTasks)
      .where(eq(weeklyTasks.weeklyReportId, report.id))
      .orderBy(asc(weeklyTasks.sortOrder)),
    db
      .select()
      .from(weeklyMedia)
      .where(eq(weeklyMedia.weeklyReportId, report.id))
      .orderBy(asc(weeklyMedia.uploadedAt)),
  ]);
  return { report, tasks, media };
}

export async function getWeeklyReportById(id: string) {
  const rows = await db.select().from(weeklyReports).where(eq(weeklyReports.id, id)).limit(1);
  return rows[0] ?? null;
}

/** Creates/updates a weekly report draft (report fields + full task list). */
export async function saveWeeklyDraft(
  user: SessionUser,
  propertyId: string,
  payload: WeeklyReportPayload,
): Promise<{ reportId: string }> {
  return db.transaction(async (tx) => {
    const existing = await tx
      .select()
      .from(weeklyReports)
      .where(
        and(eq(weeklyReports.propertyId, propertyId), eq(weeklyReports.weekStart, payload.weekStart)),
      )
      .limit(1);

    let report = existing[0] ?? null;
    if (report && !canEditSubmission(user.role, report.workflowStatus)) {
      throw new AuthorizationError(
        `This weekly report is ${report.workflowStatus.toLowerCase()} and can no longer be edited`,
      );
    }

    if (!report) {
      const inserted = await tx
        .insert(weeklyReports)
        .values({
          propertyId,
          weekStart: payload.weekStart,
          trackingStatus: payload.trackingStatus,
          summary: payload.summary,
          notes: payload.notes,
          workflowStatus: "DRAFT",
          createdBy: user.id,
        })
        .returning();
      report = inserted[0]!;
      await recordAudit(tx, {
        actorUserId: user.id,
        action: "weekly.created",
        entityType: "weekly_report",
        entityId: report.id,
        propertyId,
        afterData: { weekStart: payload.weekStart },
      });
    } else {
      await tx
        .update(weeklyReports)
        .set({
          trackingStatus: payload.trackingStatus,
          summary: payload.summary,
          notes: payload.notes,
          updatedAt: new Date(),
        })
        .where(eq(weeklyReports.id, report.id));
      await recordAudit(tx, {
        actorUserId: user.id,
        action: "weekly.updated",
        entityType: "weekly_report",
        entityId: report.id,
        propertyId,
      });
    }

    // Replace the task list wholesale (simple + safe at this scale).
    await tx.delete(weeklyTasks).where(eq(weeklyTasks.weeklyReportId, report.id));
    if (payload.tasks.length > 0) {
      await tx.insert(weeklyTasks).values(
        payload.tasks.map((t, i) => ({
          weeklyReportId: report.id,
          propertyId,
          task: t.task,
          status: t.status,
          etaDate: t.etaDate ?? null,
          sortOrder: (i + 1) * 10,
        })),
      );
    }

    return { reportId: report.id };
  });
}

export async function submitWeeklyReport(user: SessionUser, reportId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const report = await getWeeklyReportById(reportId);
    if (!report) throw new AuthorizationError("Weekly report not found");
    if (!canTransition(report.workflowStatus, "SUBMITTED", user.role)) {
      throw new AuthorizationError(`Cannot submit a report in ${report.workflowStatus} state`);
    }
    await tx
      .update(weeklyReports)
      .set({
        workflowStatus: "SUBMITTED",
        submittedBy: user.id,
        submittedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(weeklyReports.id, reportId));
    await recordAudit(tx, {
      actorUserId: user.id,
      action: report.workflowStatus === "RETURNED" ? "weekly.resubmitted" : "weekly.submitted",
      entityType: "weekly_report",
      entityId: reportId,
      propertyId: report.propertyId,
      beforeData: { workflowStatus: report.workflowStatus },
      afterData: { workflowStatus: "SUBMITTED" },
    });
  });
}
