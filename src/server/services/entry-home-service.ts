import "server-only";
import { and, count, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "@/server/db";
import {
  auditLogs,
  checklistCategories,
  checklistEntries,
  user as userTable,
  weeklyReports,
} from "@/db/schema";
import { currentWeekStart, todayStr, weekEndOf } from "@/lib/week";

export interface PropertyEntryStatus {
  propertyId: string;
  filedToday: number;
  draftToday: number;
  categoriesTotal: number;
  pendingReview: number;
  returned: number;
  weeklyStatus: string | null;
}

/**
 * Operational status for every property — powers the management Data Entry
 * landing cards (today's checklist progress, pending review, weekly state).
 */
export async function entryStatusForProperties(
  propertyIds: string[],
): Promise<Map<string, PropertyEntryStatus>> {
  const result = new Map<string, PropertyEntryStatus>();
  if (propertyIds.length === 0) return result;

  const today = todayStr();
  const weekStart = currentWeekStart();

  const [categoriesTotal] = await db
    .select({ c: count() })
    .from(checklistCategories)
    .where(eq(checklistCategories.active, true));
  const total = categoriesTotal?.c ?? 0;

  const todayRows = await db
    .select({
      propertyId: checklistEntries.propertyId,
      status: checklistEntries.workflowStatus,
      c: count(),
    })
    .from(checklistEntries)
    .where(
      and(inArray(checklistEntries.propertyId, propertyIds), eq(checklistEntries.entryDate, today)),
    )
    .groupBy(checklistEntries.propertyId, checklistEntries.workflowStatus);

  const pendingRows = await db
    .select({ propertyId: checklistEntries.propertyId, c: count() })
    .from(checklistEntries)
    .where(
      and(
        inArray(checklistEntries.propertyId, propertyIds),
        eq(checklistEntries.workflowStatus, "SUBMITTED"),
      ),
    )
    .groupBy(checklistEntries.propertyId);

  const returnedRows = await db
    .select({ propertyId: checklistEntries.propertyId, c: count() })
    .from(checklistEntries)
    .where(
      and(
        inArray(checklistEntries.propertyId, propertyIds),
        eq(checklistEntries.workflowStatus, "RETURNED"),
      ),
    )
    .groupBy(checklistEntries.propertyId);

  const weeklyRows = await db
    .select({ propertyId: weeklyReports.propertyId, status: weeklyReports.workflowStatus })
    .from(weeklyReports)
    .where(
      and(inArray(weeklyReports.propertyId, propertyIds), eq(weeklyReports.weekStart, weekStart)),
    );

  for (const propertyId of propertyIds) {
    const mine = todayRows.filter((r) => r.propertyId === propertyId);
    const filed = mine
      .filter((r) => ["SUBMITTED", "APPROVED", "PUBLISHED"].includes(r.status))
      .reduce((a, b) => a + b.c, 0);
    result.set(propertyId, {
      propertyId,
      filedToday: filed,
      draftToday: mine.find((r) => r.status === "DRAFT")?.c ?? 0,
      categoriesTotal: total,
      pendingReview: pendingRows.find((r) => r.propertyId === propertyId)?.c ?? 0,
      returned: returnedRows.find((r) => r.propertyId === propertyId)?.c ?? 0,
      weeklyStatus: weeklyRows.find((r) => r.propertyId === propertyId)?.status ?? null,
    });
  }
  return result;
}

/** Site-team landing stats for one property (today + current reporting week). */
export async function entryHomeStats(propertyId: string) {
  const today = todayStr();
  const weekStart = currentWeekStart();
  const weekEnd = weekEndOf(weekStart);

  const [categoriesTotal] = await db
    .select({ c: count() })
    .from(checklistCategories)
    .where(eq(checklistCategories.active, true));

  const todayEntries = await db
    .select({ status: checklistEntries.workflowStatus, c: count() })
    .from(checklistEntries)
    .where(and(eq(checklistEntries.propertyId, propertyId), eq(checklistEntries.entryDate, today)))
    .groupBy(checklistEntries.workflowStatus);

  const [returnedCount] = await db
    .select({ c: count() })
    .from(checklistEntries)
    .where(
      and(
        eq(checklistEntries.propertyId, propertyId),
        eq(checklistEntries.workflowStatus, "RETURNED"),
        gte(checklistEntries.entryDate, weekStart),
        lte(checklistEntries.entryDate, weekEnd),
      ),
    );

  const weeklyRows = await db
    .select()
    .from(weeklyReports)
    .where(and(eq(weeklyReports.propertyId, propertyId), eq(weeklyReports.weekStart, weekStart)))
    .limit(1);

  const recentActivity = await db
    .select({ log: auditLogs, actorName: userTable.name })
    .from(auditLogs)
    .leftJoin(userTable, eq(userTable.id, auditLogs.actorUserId))
    .where(eq(auditLogs.propertyId, propertyId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(8);

  const statusCount = (s: string) => todayEntries.find((e) => e.status === s)?.c ?? 0;
  const filedToday =
    statusCount("SUBMITTED") + statusCount("APPROVED") + statusCount("PUBLISHED");

  return {
    today,
    weekStart,
    categoriesTotal: categoriesTotal?.c ?? 0,
    filedToday,
    draftToday: statusCount("DRAFT"),
    returnedThisWeek: returnedCount?.c ?? 0,
    weeklyReport: weeklyRows[0] ?? null,
    recentActivity,
  };
}
