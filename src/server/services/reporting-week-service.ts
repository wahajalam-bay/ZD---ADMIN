import "server-only";
import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { checklistEntries, weeklyReports } from "@/db/schema";
import { currentWeekStart, isIsoDate, weekStartOf } from "@/lib/week";

export type WeekDataState = "PUBLISHED" | "PREVIEW" | "NO_DATA";

/**
 * The dashboard's default reporting week = the most recent week that has any
 * PUBLISHED weekly report or checklist entry; falls back to the current week.
 */
export async function latestPublishedWeek(): Promise<string> {
  const [reportWeek] = await db
    .select({ w: weeklyReports.weekStart })
    .from(weeklyReports)
    .where(eq(weeklyReports.workflowStatus, "PUBLISHED"))
    .orderBy(desc(weeklyReports.weekStart))
    .limit(1);

  const [entryWeek] = await db
    .select({
      w: sql<string>`to_char(date_trunc('week', ${checklistEntries.entryDate}::date), 'YYYY-MM-DD')`,
    })
    .from(checklistEntries)
    .where(eq(checklistEntries.workflowStatus, "PUBLISHED"))
    .orderBy(desc(checklistEntries.entryDate))
    .limit(1);

  const candidates = [reportWeek?.w, entryWeek?.w].filter((w): w is string => Boolean(w));
  if (candidates.length === 0) return currentWeekStart();
  return candidates.sort().at(-1)!;
}

/** Distinct weeks (desc) that hold any submitted-or-later data, for the selector. */
export async function listKnownWeeks(limit = 16): Promise<string[]> {
  const reportWeeks = await db
    .selectDistinct({ w: weeklyReports.weekStart })
    .from(weeklyReports)
    .orderBy(desc(weeklyReports.weekStart))
    .limit(limit);
  const entryWeeks = await db
    .selectDistinct({
      w: sql<string>`to_char(date_trunc('week', ${checklistEntries.entryDate}::date), 'YYYY-MM-DD')`,
    })
    .from(checklistEntries)
    .limit(limit);
  const all = new Set<string>([
    ...reportWeeks.map((r) => r.w),
    ...entryWeeks.map((r) => r.w),
    currentWeekStart(),
  ]);
  return [...all].sort().reverse().slice(0, limit);
}

/** Sanitizes a ?week= query param into a Monday, or falls back. */
export async function resolveSelectedWeek(param: string | undefined): Promise<string> {
  if (param && isIsoDate(param)) return weekStartOf(param);
  return latestPublishedWeek();
}

/**
 * Data state of a week: PUBLISHED (published data exists), PREVIEW (approved
 * but unpublished data exists — visible to management preview only), NO_DATA.
 */
export async function weekDataState(weekStart: string, propertyId?: string): Promise<WeekDataState> {
  const filters = propertyId ? [eq(weeklyReports.propertyId, propertyId)] : [];
  const [published] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(weeklyReports)
    .where(and(eq(weeklyReports.weekStart, weekStart), eq(weeklyReports.workflowStatus, "PUBLISHED"), ...filters));

  const entryFilters = propertyId ? [eq(checklistEntries.propertyId, propertyId)] : [];
  const [publishedEntries] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(checklistEntries)
    .where(
      and(
        sql`date_trunc('week', ${checklistEntries.entryDate}::date) = ${weekStart}::date`,
        eq(checklistEntries.workflowStatus, "PUBLISHED"),
        ...entryFilters,
      ),
    );
  if ((published?.c ?? 0) > 0 || (publishedEntries?.c ?? 0) > 0) return "PUBLISHED";

  const [approved] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(weeklyReports)
    .where(and(eq(weeklyReports.weekStart, weekStart), eq(weeklyReports.workflowStatus, "APPROVED"), ...filters));
  const [approvedEntries] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(checklistEntries)
    .where(
      and(
        sql`date_trunc('week', ${checklistEntries.entryDate}::date) = ${weekStart}::date`,
        eq(checklistEntries.workflowStatus, "APPROVED"),
        ...entryFilters,
      ),
    );
  if ((approved?.c ?? 0) > 0 || (approvedEntries?.c ?? 0) > 0) return "PREVIEW";
  return "NO_DATA";
}

export { isNotNull };
