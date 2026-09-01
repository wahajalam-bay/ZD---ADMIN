import "server-only";
import { and, count, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/server/db";
import {
  auditLogs,
  checklistCategories,
  checklistEntries,
  user as userTable,
  weeklyReports,
} from "@/db/schema";
import { currentWeekStart, todayStr, weekEndOf } from "@/lib/week";

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
