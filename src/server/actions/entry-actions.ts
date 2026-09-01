"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  requireAuthenticatedUser,
  requirePropertyAccess,
  requirePropertyByCode,
} from "@/server/permissions";
import {
  checklistEntryPayload,
  weeklyReportPayload,
  captionSchema,
  uuidSchema,
} from "@/lib/validation";
import {
  loadEntryOrThrow,
  saveEntryDraft,
  submitEntry,
} from "@/server/services/checklist-service";
import {
  getWeeklyReportById,
  saveWeeklyDraft,
  submitWeeklyReport,
} from "@/server/services/weekly-report-service";
import {
  addEvidencePhoto,
  addWeeklyPhoto,
  deleteEvidencePhoto,
  deleteWeeklyPhoto,
  updateWeeklyPhotoCaption,
} from "@/server/services/media-service";
import { MAX_UPLOAD_BYTES } from "@/server/storage/images";
import { runAction, type ActionResult } from "./action-result";

function revalidateEntry(code: string) {
  revalidatePath(`/entry/${code}`, "layout");
  revalidatePath("/review", "layout");
}

export async function saveChecklistDraftAction(
  propertyCode: string,
  rawPayload: unknown,
): Promise<ActionResult<{ entryId: string; responseIds: Record<string, string> }>> {
  return runAction(async () => {
    const { property, user } = await requirePropertyByCode(propertyCode);
    const payload = checklistEntryPayload.parse(rawPayload);
    const result = await saveEntryDraft(user, property.id, payload);
    revalidateEntry(property.code);
    return { entryId: result.entryId, responseIds: result.responseIds };
  });
}

export async function submitChecklistAction(
  propertyCode: string,
  rawPayload: unknown,
): Promise<ActionResult<{ entryId: string }>> {
  return runAction(async () => {
    const { property, user } = await requirePropertyByCode(propertyCode);
    const payload = checklistEntryPayload.parse(rawPayload);
    const { entryId } = await saveEntryDraft(user, property.id, payload);
    await submitEntry(user, entryId);
    revalidateEntry(property.code);
    return { entryId };
  });
}

export async function saveWeeklyDraftAction(
  propertyCode: string,
  rawPayload: unknown,
): Promise<ActionResult<{ reportId: string }>> {
  return runAction(async () => {
    const { property, user } = await requirePropertyByCode(propertyCode);
    const payload = weeklyReportPayload.parse(rawPayload);
    const result = await saveWeeklyDraft(user, property.id, payload);
    revalidateEntry(property.code);
    return result;
  });
}

export async function submitWeeklyAction(
  propertyCode: string,
  rawPayload: unknown,
): Promise<ActionResult<{ reportId: string }>> {
  return runAction(async () => {
    const { property, user } = await requirePropertyByCode(propertyCode);
    const payload = weeklyReportPayload.parse(rawPayload);
    const { reportId } = await saveWeeklyDraft(user, property.id, payload);
    await submitWeeklyReport(user, reportId);
    revalidateEntry(property.code);
    return { reportId };
  });
}

async function fileFromForm(formData: FormData): Promise<{ buffer: Buffer; filename: string }> {
  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("No file provided");
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("File exceeds the 12 MB limit");
  const buffer = Buffer.from(await file.arrayBuffer());
  return { buffer, filename: file.name || "upload.jpg" };
}

/** Uploads evidence to an EXACT checklist response (photo ↔ point linkage). */
export async function uploadEvidenceAction(
  responseId: string,
  formData: FormData,
): Promise<ActionResult<{ photoId: string; url: string; thumbUrl: string }>> {
  return runAction(async () => {
    const user = await requireAuthenticatedUser();
    uuidSchema.parse(responseId);
    const file = await fileFromForm(formData);
    // Property authorization happens against the response's real property —
    // a forged responseId for another property fails inside the service via
    // the access check below.
    const { db } = await import("@/server/db");
    const { checklistResponses, checklistEntries } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    const rows = await db
      .select({ propertyId: checklistEntries.propertyId })
      .from(checklistResponses)
      .innerJoin(checklistEntries, eq(checklistEntries.id, checklistResponses.entryId))
      .where(eq(checklistResponses.id, responseId))
      .limit(1);
    if (!rows[0]) throw new Error("Checklist response not found");
    await requirePropertyAccess(rows[0].propertyId);
    const result = await addEvidencePhoto(user, responseId, file);
    revalidatePath("/entry", "layout");
    return {
      photoId: result.photoId,
      url: `/api/media/${result.storageKey}`,
      thumbUrl: `/api/media/${result.thumbnailKey}`,
    };
  });
}

export async function deleteEvidenceAction(photoId: string): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const user = await requireAuthenticatedUser();
    uuidSchema.parse(photoId);
    const { db } = await import("@/server/db");
    const { checklistResponsePhotos } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    const rows = await db
      .select({ propertyId: checklistResponsePhotos.propertyId })
      .from(checklistResponsePhotos)
      .where(eq(checklistResponsePhotos.id, photoId))
      .limit(1);
    if (!rows[0]) throw new Error("Photo not found");
    await requirePropertyAccess(rows[0].propertyId);
    await deleteEvidencePhoto(user, photoId);
    revalidatePath("/entry", "layout");
    return undefined;
  });
}

export async function uploadWeeklyMediaAction(
  reportId: string,
  formData: FormData,
): Promise<ActionResult<{ mediaId: string }>> {
  return runAction(async () => {
    const user = await requireAuthenticatedUser();
    uuidSchema.parse(reportId);
    const report = await getWeeklyReportById(reportId);
    if (!report) throw new Error("Weekly report not found");
    await requirePropertyAccess(report.propertyId);
    const file = await fileFromForm(formData);
    const caption = captionSchema.parse(formData.get("caption") ?? "");
    const result = await addWeeklyPhoto(user, reportId, file, caption);
    revalidatePath("/entry", "layout");
    return { mediaId: result.mediaId };
  });
}

export async function deleteWeeklyMediaAction(mediaId: string): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const user = await requireAuthenticatedUser();
    uuidSchema.parse(mediaId);
    const { db } = await import("@/server/db");
    const { weeklyMedia } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    const rows = await db
      .select({ propertyId: weeklyMedia.propertyId })
      .from(weeklyMedia)
      .where(eq(weeklyMedia.id, mediaId))
      .limit(1);
    if (!rows[0]) throw new Error("Media not found");
    await requirePropertyAccess(rows[0].propertyId);
    await deleteWeeklyPhoto(user, mediaId);
    revalidatePath("/entry", "layout");
    return undefined;
  });
}

export async function updateWeeklyCaptionAction(
  mediaId: string,
  caption: string,
): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const user = await requireAuthenticatedUser();
    uuidSchema.parse(mediaId);
    const parsedCaption = captionSchema.parse(caption);
    const { db } = await import("@/server/db");
    const { weeklyMedia } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    const rows = await db
      .select({ propertyId: weeklyMedia.propertyId })
      .from(weeklyMedia)
      .where(eq(weeklyMedia.id, mediaId))
      .limit(1);
    if (!rows[0]) throw new Error("Media not found");
    await requirePropertyAccess(rows[0].propertyId);
    await updateWeeklyPhotoCaption(user, mediaId, parsedCaption);
    revalidatePath("/entry", "layout");
    return undefined;
  });
}

/** Guard used by checklist submit to re-check property on an existing entry. */
export async function assertEntryAccess(entryId: string): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    z.string().uuid().parse(entryId);
    const entry = await loadEntryOrThrow(entryId);
    await requirePropertyAccess(entry.propertyId);
    return undefined;
  });
}
