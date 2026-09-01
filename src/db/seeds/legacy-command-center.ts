/**
 * LEGACY MERGE runner — writes the legacy Command Center week into PostgreSQL.
 * The data itself (and the rationale for every mapping decision) lives in
 * ./legacy-data so it can be unit-tested without a database connection.
 */
import { and, eq, gte, lte } from "drizzle-orm";
import { db } from "@/server/db";
import {
  checklistCategories,
  checklistEntries,
  checklistItems,
  checklistFieldDefinitions,
  checklistResponses,
  properties,
  weeklyMedia,
  weeklyReports,
  weeklyTasks,
  user as userTable,
} from "@/db/schema";
import { fieldKeyFromLabel } from "./checklist-definitions";
import {
  DECK_CATEGORIES,
  LEGACY_BOTTLENECKS,
  LEGACY_SUMMARIES,
  LEGACY_TASKS,
  LEGACY_WEEK_END,
  LEGACY_WEEK_START,
  SHEET_POINT,
  SHEET_POINT_CATEGORIES,
  trackingFromCompletion,
} from "./legacy-data";

export * from "./legacy-data";

// ── Seed runner ─────────────────────────────────────────────────────────────

export async function runLegacySeed({ movePhotos = true } = {}) {
  const actor = (
    await db.select({ id: userTable.id }).from(userTable).orderBy(userTable.createdAt).limit(1)
  )[0];
  if (!actor) throw new Error("No user exists — run the admin bootstrap or demo seed first.");

  console.log(`Merging the legacy Command Center week (${LEGACY_WEEK_START})…`);

  // 1 ── deck-sourced checklist categories -----------------------------------
  for (const def of DECK_CATEGORIES) {
    let category = (
      await db.select().from(checklistCategories).where(eq(checklistCategories.key, def.key))
    )[0];
    if (!category) {
      category = (
        await db
          .insert(checklistCategories)
          .values({ key: def.key, name: def.name, type: def.type, sortOrder: def.sortOrder })
          .returning()
      )[0]!;
      console.log(`  + deck category ${def.name}`);
    }
    const existingItems = await db
      .select({ name: checklistItems.name })
      .from(checklistItems)
      .where(eq(checklistItems.categoryId, category.id));
    const have = new Set(existingItems.map((i) => i.name));
    const toAdd = def.items.filter((n) => !have.has(n));
    if (toAdd.length > 0) {
      await db.insert(checklistItems).values(
        toAdd.map((name, j) => ({
          categoryId: category.id,
          name,
          sortOrder: (def.items.indexOf(name) + 1) * 10 + j,
        })),
      );
    }
    const existingFields = await db
      .select({ key: checklistFieldDefinitions.key })
      .from(checklistFieldDefinitions)
      .where(eq(checklistFieldDefinitions.categoryId, category.id));
    if (existingFields.length === 0) {
      await db.insert(checklistFieldDefinitions).values(
        def.topFields.map((label, j) => ({
          categoryId: category.id,
          key: fieldKeyFromLabel(label),
          label,
          fieldType: "text",
          required: false,
          sortOrder: (j + 1) * 10,
        })),
      );
    }
  }

  // 2 ── sheet-level point on the engine categories that need it -------------
  for (const key of SHEET_POINT_CATEGORIES) {
    const category = (
      await db.select().from(checklistCategories).where(eq(checklistCategories.key, key))
    )[0];
    if (!category) continue;
    const existing = await db
      .select({ name: checklistItems.name })
      .from(checklistItems)
      .where(eq(checklistItems.categoryId, category.id));
    if (existing.some((i) => i.name === SHEET_POINT)) continue;
    await db
      .insert(checklistItems)
      .values({ categoryId: category.id, name: SHEET_POINT, sortOrder: 9999 });
    console.log(`  + "${SHEET_POINT}" point on ${key}`);
  }

  const allProperties = await db.select().from(properties);
  const byCode = new Map(allProperties.map((p) => [p.code, p]));

  // 3 ── weekly reports, summaries and tasks ---------------------------------
  for (const [code, tasks] of Object.entries(LEGACY_TASKS)) {
    const property = byCode.get(code);
    if (!property) {
      console.warn(`  ! property ${code} not found — skipped`);
      continue;
    }
    const completed = tasks.filter((t) => t.status === "COMPLETED").length;
    const inProcess = tasks.length - completed;

    let report = (
      await db
        .select()
        .from(weeklyReports)
        .where(
          and(
            eq(weeklyReports.propertyId, property.id),
            eq(weeklyReports.weekStart, LEGACY_WEEK_START),
          ),
        )
    )[0];

    const values = {
      propertyId: property.id,
      weekStart: LEGACY_WEEK_START,
      summary: LEGACY_SUMMARIES[code] ?? "",
      trackingStatus: trackingFromCompletion(completed, inProcess),
      workflowStatus: "PUBLISHED" as const,
      createdBy: actor.id,
      submittedBy: actor.id,
      submittedAt: new Date(`${LEGACY_WEEK_END}T12:00:00Z`),
      approvedBy: actor.id,
      approvedAt: new Date(`${LEGACY_WEEK_END}T13:00:00Z`),
      publishedBy: actor.id,
      publishedAt: new Date(`${LEGACY_WEEK_END}T13:30:00Z`),
    };

    if (!report) {
      report = (await db.insert(weeklyReports).values(values).returning())[0]!;
      console.log(`  + weekly report ${property.name} ${LEGACY_WEEK_START}`);
    } else {
      await db.update(weeklyReports).set(values).where(eq(weeklyReports.id, report.id));
    }

    // Tasks are replaced wholesale so a re-run stays exactly the deck's list.
    await db.delete(weeklyTasks).where(eq(weeklyTasks.weeklyReportId, report.id));
    await db.insert(weeklyTasks).values(
      tasks.map((t, i) => ({
        propertyId: property.id,
        weeklyReportId: report.id,
        task: t.task,
        status: t.status,
        etaDate: t.etaDate,
        sortOrder: (i + 1) * 10,
      })),
    );
    console.log(`    ${tasks.length} tasks (${completed} completed, ${inProcess} in process)`);

    // 4 ── reference photographs belong to THIS week -------------------------
    if (movePhotos) {
      const moved = await db
        .update(weeklyMedia)
        .set({ weeklyReportId: report.id })
        .where(eq(weeklyMedia.propertyId, property.id))
        .returning({ id: weeklyMedia.id });
      if (moved.length > 0) console.log(`    ${moved.length} reference photos re-dated to this week`);
    }
  }

  // 5 ── checklist entries + the 12 deck bottlenecks --------------------------
  const categories = await db.select().from(checklistCategories);
  const categoryByKey = new Map(categories.map((c) => [c.key, c]));
  const items = await db.select().from(checklistItems);

  const neededEntries = new Map<string, { propertyId: string; categoryId: string; date: string }>();
  for (const b of LEGACY_BOTTLENECKS) {
    const property = byCode.get(b.property);
    const category = categoryByKey.get(b.categoryKey);
    if (!property || !category) continue;
    neededEntries.set(`${property.id}:${category.id}:${b.entryDate}`, {
      propertyId: property.id,
      categoryId: category.id,
      date: b.entryDate,
    });
  }

  const entryIds = new Map<string, string>();
  for (const [key, spec] of neededEntries) {
    let entry = (
      await db
        .select()
        .from(checklistEntries)
        .where(
          and(
            eq(checklistEntries.propertyId, spec.propertyId),
            eq(checklistEntries.categoryId, spec.categoryId),
            eq(checklistEntries.entryDate, spec.date),
          ),
        )
    )[0];
    if (!entry) {
      entry = (
        await db
          .insert(checklistEntries)
          .values({
            propertyId: spec.propertyId,
            categoryId: spec.categoryId,
            entryDate: spec.date,
            workflowStatus: "PUBLISHED",
            signDutyTechnician: "Duty Technician",
            signAmAdmin: "A.M Admin",
            // The deck records a blank FM/Manager sign-off for these sheets.
            signManagerAdmin: "",
            createdBy: actor.id,
            submittedBy: actor.id,
            submittedAt: new Date(`${spec.date}T17:00:00Z`),
            approvedBy: actor.id,
            approvedAt: new Date(`${LEGACY_WEEK_END}T13:00:00Z`),
            publishedBy: actor.id,
            publishedAt: new Date(`${LEGACY_WEEK_END}T13:30:00Z`),
          })
          .returning()
      )[0]!;
    }
    entryIds.set(key, entry.id);

    // Every point of the sheet is recorded; only the deck's issues are flagged.
    const categoryItems = items.filter((i) => i.categoryId === spec.categoryId);
    const existing = await db
      .select({ checklistItemId: checklistResponses.checklistItemId })
      .from(checklistResponses)
      .where(eq(checklistResponses.entryId, entry.id));
    const have = new Set(existing.map((r) => r.checklistItemId));
    const missing = categoryItems.filter((i) => !have.has(i.id));
    if (missing.length > 0) {
      await db.insert(checklistResponses).values(
        missing.map((i) => ({
          entryId: entry.id,
          checklistItemId: i.id,
          op: true,
          cl: true,
          comment: "",
        })),
      );
    }
  }

  let flagged = 0;
  for (const b of LEGACY_BOTTLENECKS) {
    const property = byCode.get(b.property);
    const category = categoryByKey.get(b.categoryKey);
    if (!property || !category) continue;
    const item = items.find((i) => i.categoryId === category.id && i.name === b.itemName);
    if (!item) {
      console.warn(`  ! point "${b.itemName}" not found on ${b.categoryKey} — skipped`);
      continue;
    }
    const entryId = entryIds.get(`${property.id}:${category.id}:${b.entryDate}`);
    if (!entryId) continue;
    await db
      .update(checklistResponses)
      .set({ comment: b.issue, severity: b.severity, op: true, cl: false })
      .where(
        and(
          eq(checklistResponses.entryId, entryId),
          eq(checklistResponses.checklistItemId, item.id),
        ),
      );
    flagged += 1;
  }
  console.log(`  ${flagged} legacy bottlenecks recorded against real checklist points`);

  // 6 ── report what the merged week now computes ----------------------------
  const points = await db
    .select({
      name: properties.name,
      comment: checklistResponses.comment,
      severity: checklistResponses.severity,
    })
    .from(checklistResponses)
    .innerJoin(checklistEntries, eq(checklistEntries.id, checklistResponses.entryId))
    .innerJoin(properties, eq(properties.id, checklistEntries.propertyId))
    .where(
      and(
        eq(checklistEntries.workflowStatus, "PUBLISHED"),
        gte(checklistEntries.entryDate, LEGACY_WEEK_START),
        lte(checklistEntries.entryDate, LEGACY_WEEK_END),
      ),
    );
  const byName = new Map<string, { total: number; flagged: number }>();
  for (const p of points) {
    const cur = byName.get(p.name) ?? { total: 0, flagged: 0 };
    cur.total += 1;
    if (p.comment.trim() !== "" || p.severity !== null) cur.flagged += 1;
    byName.set(p.name, cur);
  }
  console.log("\n  Recomputed compliance for the merged week (point-based, see decisions.md §1):");
  for (const [name, v] of byName) {
    const clean = v.total - v.flagged;
    console.log(
      `    ${name.padEnd(12)} ${clean}/${v.total} clean · ${v.flagged} flagged · ${Math.round((clean / v.total) * 100)}%`,
    );
  }
  console.log("Legacy merge done.");
}
