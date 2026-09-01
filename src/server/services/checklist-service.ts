import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/server/db";
import {
  checklistCategories,
  checklistEntries,
  checklistFieldDefinitions,
  checklistFieldValues,
  checklistItems,
  checklistResponsePhotos,
  checklistResponses,
} from "@/db/schema";
import { recordAudit } from "@/server/services/audit-service";
import { AuthorizationError } from "@/server/permissions";
import type { SessionUser } from "@/server/auth/session";
import { canEditSubmission, canTransition, type WorkflowStatus } from "@/lib/roles";
import type { ChecklistEntryPayload } from "@/lib/validation";

export async function listCategories() {
  return db
    .select()
    .from(checklistCategories)
    .where(eq(checklistCategories.active, true))
    .orderBy(asc(checklistCategories.sortOrder));
}

export async function getCategoryByKey(key: string) {
  const rows = await db
    .select()
    .from(checklistCategories)
    .where(and(eq(checklistCategories.key, key), eq(checklistCategories.active, true)))
    .limit(1);
  return rows[0] ?? null;
}

/** Category board for one property + date: every category with entry status. */
export async function getChecklistBoard(propertyId: string, date: string) {
  const categories = await listCategories();
  const entries = await db
    .select({
      id: checklistEntries.id,
      categoryId: checklistEntries.categoryId,
      workflowStatus: checklistEntries.workflowStatus,
    })
    .from(checklistEntries)
    .where(and(eq(checklistEntries.propertyId, propertyId), eq(checklistEntries.entryDate, date)));
  const byCategory = new Map(entries.map((e) => [e.categoryId, e]));
  return categories.map((c) => ({
    category: c,
    entry: byCategory.get(c.id) ?? null,
  }));
}

export interface EntryView {
  category: typeof checklistCategories.$inferSelect;
  items: Array<typeof checklistItems.$inferSelect>;
  fieldDefs: Array<typeof checklistFieldDefinitions.$inferSelect>;
  entry: typeof checklistEntries.$inferSelect | null;
  values: Record<string, string>;
  responses: Map<
    string,
    typeof checklistResponses.$inferSelect & {
      photos: Array<typeof checklistResponsePhotos.$inferSelect>;
    }
  >;
}

export async function getEntryView(
  propertyId: string,
  categoryKey: string,
  date: string,
): Promise<EntryView | null> {
  const category = await getCategoryByKey(categoryKey);
  if (!category) return null;

  const [items, fieldDefs, entryRows] = await Promise.all([
    db
      .select()
      .from(checklistItems)
      .where(and(eq(checklistItems.categoryId, category.id), eq(checklistItems.active, true)))
      .orderBy(asc(checklistItems.sortOrder)),
    db
      .select()
      .from(checklistFieldDefinitions)
      .where(eq(checklistFieldDefinitions.categoryId, category.id))
      .orderBy(asc(checklistFieldDefinitions.sortOrder)),
    db
      .select()
      .from(checklistEntries)
      .where(
        and(
          eq(checklistEntries.propertyId, propertyId),
          eq(checklistEntries.categoryId, category.id),
          eq(checklistEntries.entryDate, date),
        ),
      )
      .limit(1),
  ]);

  const entry = entryRows[0] ?? null;
  const values: Record<string, string> = {};
  const responses: EntryView["responses"] = new Map();

  if (entry) {
    const [valueRows, responseRows] = await Promise.all([
      db.select().from(checklistFieldValues).where(eq(checklistFieldValues.entryId, entry.id)),
      db.select().from(checklistResponses).where(eq(checklistResponses.entryId, entry.id)),
    ]);
    for (const v of valueRows) values[v.fieldDefinitionId] = v.value;
    const photoRows = responseRows.length
      ? await db
          .select()
          .from(checklistResponsePhotos)
          .where(
            inArray(
              checklistResponsePhotos.checklistResponseId,
              responseRows.map((r) => r.id),
            ),
          )
      : [];
    for (const r of responseRows) {
      responses.set(r.checklistItemId, {
        ...r,
        photos: photoRows.filter((p) => p.checklistResponseId === r.id),
      });
    }
  }

  return { category, items, fieldDefs, entry, values, responses };
}

async function loadEntryOrThrow(entryId: string) {
  const rows = await db.select().from(checklistEntries).where(eq(checklistEntries.id, entryId)).limit(1);
  const entry = rows[0];
  if (!entry) throw new AuthorizationError("Entry not found");
  return entry;
}

/**
 * Creates/updates a draft entry (field values + item responses + sign-offs).
 * Authorization (property access) must already be established by the caller;
 * this enforces workflow-state edit rules and writes atomically.
 */
export async function saveEntryDraft(
  user: SessionUser,
  propertyId: string,
  payload: ChecklistEntryPayload,
): Promise<{ entryId: string; status: WorkflowStatus; responseIds: Record<string, string> }> {
  return db.transaction(async (tx) => {
    const existing = await tx
      .select()
      .from(checklistEntries)
      .where(
        and(
          eq(checklistEntries.propertyId, propertyId),
          eq(checklistEntries.categoryId, payload.categoryId),
          eq(checklistEntries.entryDate, payload.entryDate),
        ),
      )
      .limit(1);

    let entry = existing[0] ?? null;
    if (entry && !canEditSubmission(user.role, entry.workflowStatus)) {
      throw new AuthorizationError(
        `This entry is ${entry.workflowStatus.toLowerCase()} and can no longer be edited`,
      );
    }

    if (!entry) {
      const inserted = await tx
        .insert(checklistEntries)
        .values({
          propertyId,
          categoryId: payload.categoryId,
          entryDate: payload.entryDate,
          workflowStatus: "DRAFT",
          createdBy: user.id,
          signDutyTechnician: payload.signDutyTechnician,
          signAmAdmin: payload.signAmAdmin,
          signManagerAdmin: payload.signManagerAdmin,
        })
        .returning();
      entry = inserted[0]!;
      await recordAudit(tx, {
        actorUserId: user.id,
        action: "checklist.created",
        entityType: "checklist_entry",
        entityId: entry.id,
        propertyId,
        afterData: { categoryId: payload.categoryId, entryDate: payload.entryDate },
      });
    } else {
      await tx
        .update(checklistEntries)
        .set({
          signDutyTechnician: payload.signDutyTechnician,
          signAmAdmin: payload.signAmAdmin,
          signManagerAdmin: payload.signManagerAdmin,
          updatedAt: new Date(),
        })
        .where(eq(checklistEntries.id, entry.id));
      await recordAudit(tx, {
        actorUserId: user.id,
        action: "checklist.updated",
        entityType: "checklist_entry",
        entityId: entry.id,
        propertyId,
      });
    }

    // Validate field definitions belong to this category (no forged ids).
    const defs = await tx
      .select({ id: checklistFieldDefinitions.id })
      .from(checklistFieldDefinitions)
      .where(eq(checklistFieldDefinitions.categoryId, payload.categoryId));
    const defIds = new Set(defs.map((d) => d.id));
    for (const [defId, value] of Object.entries(payload.fields)) {
      if (!defIds.has(defId)) continue;
      await tx
        .insert(checklistFieldValues)
        .values({ entryId: entry.id, fieldDefinitionId: defId, value })
        .onConflictDoUpdate({
          target: [checklistFieldValues.entryId, checklistFieldValues.fieldDefinitionId],
          set: { value },
        });
    }

    // Validate items belong to this category (no forged ids).
    const items = await tx
      .select({ id: checklistItems.id })
      .from(checklistItems)
      .where(eq(checklistItems.categoryId, payload.categoryId));
    const itemIds = new Set(items.map((i) => i.id));
    for (const r of payload.responses) {
      if (!itemIds.has(r.checklistItemId)) continue;
      await tx
        .insert(checklistResponses)
        .values({
          entryId: entry.id,
          checklistItemId: r.checklistItemId,
          op: r.op,
          cl: r.cl,
          comment: r.comment,
          severity: r.severity ?? null,
        })
        .onConflictDoUpdate({
          target: [checklistResponses.entryId, checklistResponses.checklistItemId],
          set: {
            op: r.op,
            cl: r.cl,
            comment: r.comment,
            severity: r.severity ?? null,
            updatedAt: new Date(),
          },
        });
    }

    const savedResponses = await tx
      .select({ id: checklistResponses.id, checklistItemId: checklistResponses.checklistItemId })
      .from(checklistResponses)
      .where(eq(checklistResponses.entryId, entry.id));
    const responseIds: Record<string, string> = {};
    for (const r of savedResponses) responseIds[r.checklistItemId] = r.id;

    return { entryId: entry.id, status: entry.workflowStatus, responseIds };
  });
}

/** DRAFT/RETURNED → SUBMITTED (site users and management). */
export async function submitEntry(user: SessionUser, entryId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const entry = await loadEntryOrThrow(entryId);
    if (!canTransition(entry.workflowStatus, "SUBMITTED", user.role)) {
      throw new AuthorizationError(
        `Cannot submit an entry in ${entry.workflowStatus} state`,
      );
    }
    await tx
      .update(checklistEntries)
      .set({
        workflowStatus: "SUBMITTED",
        submittedBy: user.id,
        submittedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(checklistEntries.id, entryId));
    await recordAudit(tx, {
      actorUserId: user.id,
      action: entry.workflowStatus === "RETURNED" ? "checklist.resubmitted" : "checklist.submitted",
      entityType: "checklist_entry",
      entityId: entryId,
      propertyId: entry.propertyId,
      beforeData: { workflowStatus: entry.workflowStatus },
      afterData: { workflowStatus: "SUBMITTED" },
    });
  });
}

export { loadEntryOrThrow };
