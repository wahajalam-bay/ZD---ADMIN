import "server-only";
import { and, asc, desc, eq, gte, inArray, lte } from "drizzle-orm";
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
} from "@/db/schema";
import { getStorage } from "@/server/storage";
import { buildObjectKey, processImageUpload } from "@/server/storage/images";
import { recordAudit } from "@/server/services/audit-service";
import { AuthorizationError } from "@/server/permissions";
import type { SessionUser } from "@/server/auth/session";
import { canEditSubmission } from "@/lib/roles";
import { weekEndOf } from "@/lib/week";
import type { VisibleStatuses } from "@/server/services/metrics-service";

export interface GalleryPhoto {
  id: string;
  kind: "weekly" | "evidence";
  propertyId: string;
  propertyName: string;
  storageKey: string;
  thumbnailKey: string;
  caption: string;
  context: string;
  date: string;
}

/** Weekly/progress photos for the gallery (published reports by default). */
export async function weeklyPhotosForWeek(
  weekStart: string,
  statuses: VisibleStatuses,
  propertyId?: string,
): Promise<GalleryPhoto[]> {
  const rows = await db
    .select({
      id: weeklyMedia.id,
      propertyId: weeklyMedia.propertyId,
      propertyName: properties.name,
      storageKey: weeklyMedia.storageKey,
      thumbnailKey: weeklyMedia.thumbnailKey,
      caption: weeklyMedia.caption,
      weekStart: weeklyReports.weekStart,
    })
    .from(weeklyMedia)
    .innerJoin(weeklyReports, eq(weeklyReports.id, weeklyMedia.weeklyReportId))
    .innerJoin(properties, eq(properties.id, weeklyMedia.propertyId))
    .where(
      and(
        eq(weeklyReports.weekStart, weekStart),
        inArray(weeklyReports.workflowStatus, statuses),
        eq(weeklyMedia.mediaType, "IMAGE"),
        ...(propertyId ? [eq(weeklyMedia.propertyId, propertyId)] : []),
      ),
    )
    // Deck/document order first (sortOrder), newest uploads last within ties.
    .orderBy(asc(weeklyMedia.sortOrder), asc(weeklyMedia.uploadedAt));

  return rows.map((r) => ({
    id: r.id,
    kind: "weekly" as const,
    propertyId: r.propertyId,
    propertyName: r.propertyName,
    storageKey: r.storageKey,
    thumbnailKey: r.thumbnailKey,
    caption: r.caption || "Progress photo",
    context: `Weekly report · week of ${r.weekStart}`,
    date: r.weekStart,
  }));
}

/** Checklist evidence photos for the gallery — kept visually separate. */
export async function evidencePhotosForWeek(
  weekStart: string,
  statuses: VisibleStatuses,
  propertyId?: string,
): Promise<GalleryPhoto[]> {
  const weekEnd = weekEndOf(weekStart);
  const rows = await db
    .select({
      id: checklistResponsePhotos.id,
      propertyId: checklistResponsePhotos.propertyId,
      propertyName: properties.name,
      storageKey: checklistResponsePhotos.storageKey,
      thumbnailKey: checklistResponsePhotos.thumbnailKey,
      caption: checklistResponsePhotos.caption,
      entryDate: checklistEntries.entryDate,
      categoryName: checklistCategories.name,
      itemName: checklistItems.name,
    })
    .from(checklistResponsePhotos)
    .innerJoin(checklistResponses, eq(checklistResponses.id, checklistResponsePhotos.checklistResponseId))
    .innerJoin(checklistEntries, eq(checklistEntries.id, checklistResponses.entryId))
    .innerJoin(checklistCategories, eq(checklistCategories.id, checklistEntries.categoryId))
    .innerJoin(checklistItems, eq(checklistItems.id, checklistResponses.checklistItemId))
    .innerJoin(properties, eq(properties.id, checklistResponsePhotos.propertyId))
    .where(
      and(
        inArray(checklistEntries.workflowStatus, statuses),
        gte(checklistEntries.entryDate, weekStart),
        lte(checklistEntries.entryDate, weekEnd),
        ...(propertyId ? [eq(checklistResponsePhotos.propertyId, propertyId)] : []),
      ),
    )
    .orderBy(desc(checklistResponsePhotos.uploadedAt));

  return rows.map((r) => ({
    id: r.id,
    kind: "evidence" as const,
    propertyId: r.propertyId,
    propertyName: r.propertyName,
    storageKey: r.storageKey,
    thumbnailKey: r.thumbnailKey,
    caption: r.caption || r.itemName,
    context: `${r.categoryName} · ${r.itemName} · ${r.entryDate}`,
    date: r.entryDate,
  }));
}

// ── Uploads (authorization enforced by callers via property access) ────────

async function loadResponseContext(responseId: string) {
  const rows = await db
    .select({
      response: checklistResponses,
      entry: checklistEntries,
    })
    .from(checklistResponses)
    .innerJoin(checklistEntries, eq(checklistEntries.id, checklistResponses.entryId))
    .where(eq(checklistResponses.id, responseId))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Attaches an evidence photo to its EXACT checklist response. The photo is
 * validated, normalized, thumbnailed and stored under the response's property.
 */
export async function addEvidencePhoto(
  user: SessionUser,
  responseId: string,
  file: { buffer: Buffer; filename: string },
): Promise<{ photoId: string; storageKey: string; thumbnailKey: string }> {
  const ctx = await loadResponseContext(responseId);
  if (!ctx) throw new AuthorizationError("Checklist response not found");
  if (!canEditSubmission(user.role, ctx.entry.workflowStatus)) {
    throw new AuthorizationError("This entry can no longer be modified");
  }

  const processed = await processImageUpload(file.buffer);
  const { key, thumbKey } = buildObjectKey(ctx.entry.propertyId, "checklist");
  const storage = getStorage();
  await storage.put(key, processed.main.buffer, processed.main.contentType);
  await storage.put(thumbKey, processed.thumb.buffer, processed.thumb.contentType);

  const [photo] = await db
    .insert(checklistResponsePhotos)
    .values({
      checklistResponseId: responseId,
      propertyId: ctx.entry.propertyId,
      storageKey: key,
      thumbnailKey: thumbKey,
      originalFilename: file.filename.slice(0, 300),
      mimeType: processed.main.contentType,
      sizeBytes: processed.main.buffer.byteLength,
      width: processed.main.width,
      height: processed.main.height,
      uploadedBy: user.id,
    })
    .returning();

  await recordAudit(db, {
    actorUserId: user.id,
    action: "photo.evidence.added",
    entityType: "checklist_response_photo",
    entityId: photo!.id,
    propertyId: ctx.entry.propertyId,
    metadata: { responseId, storageKey: key },
  });
  return { photoId: photo!.id, storageKey: key, thumbnailKey: thumbKey };
}

export async function deleteEvidencePhoto(user: SessionUser, photoId: string): Promise<{ propertyId: string }> {
  const rows = await db
    .select({ photo: checklistResponsePhotos, entry: checklistEntries })
    .from(checklistResponsePhotos)
    .innerJoin(checklistResponses, eq(checklistResponses.id, checklistResponsePhotos.checklistResponseId))
    .innerJoin(checklistEntries, eq(checklistEntries.id, checklistResponses.entryId))
    .where(eq(checklistResponsePhotos.id, photoId))
    .limit(1);
  const ctx = rows[0];
  if (!ctx) throw new AuthorizationError("Photo not found");
  if (!canEditSubmission(user.role, ctx.entry.workflowStatus)) {
    throw new AuthorizationError("This entry can no longer be modified");
  }

  await db.delete(checklistResponsePhotos).where(eq(checklistResponsePhotos.id, photoId));
  const storage = getStorage();
  await storage.delete(ctx.photo.storageKey);
  await storage.delete(ctx.photo.thumbnailKey);
  await recordAudit(db, {
    actorUserId: user.id,
    action: "photo.evidence.deleted",
    entityType: "checklist_response_photo",
    entityId: photoId,
    propertyId: ctx.entry.propertyId,
    beforeData: { storageKey: ctx.photo.storageKey },
  });
  return { propertyId: ctx.entry.propertyId };
}

export async function addWeeklyPhoto(
  user: SessionUser,
  reportId: string,
  file: { buffer: Buffer; filename: string },
  caption: string,
): Promise<{ mediaId: string; propertyId: string }> {
  const rows = await db.select().from(weeklyReports).where(eq(weeklyReports.id, reportId)).limit(1);
  const report = rows[0];
  if (!report) throw new AuthorizationError("Weekly report not found");
  if (!canEditSubmission(user.role, report.workflowStatus)) {
    throw new AuthorizationError("This weekly report can no longer be modified");
  }

  const processed = await processImageUpload(file.buffer);
  const { key, thumbKey } = buildObjectKey(report.propertyId, "weekly");
  const storage = getStorage();
  await storage.put(key, processed.main.buffer, processed.main.contentType);
  await storage.put(thumbKey, processed.thumb.buffer, processed.thumb.contentType);

  const [media] = await db
    .insert(weeklyMedia)
    .values({
      weeklyReportId: reportId,
      propertyId: report.propertyId,
      mediaType: "IMAGE",
      storageKey: key,
      thumbnailKey: thumbKey,
      originalFilename: file.filename.slice(0, 300),
      mimeType: processed.main.contentType,
      sizeBytes: processed.main.buffer.byteLength,
      width: processed.main.width,
      height: processed.main.height,
      caption,
      uploadedBy: user.id,
    })
    .returning();

  await recordAudit(db, {
    actorUserId: user.id,
    action: "photo.weekly.added",
    entityType: "weekly_media",
    entityId: media!.id,
    propertyId: report.propertyId,
    metadata: { reportId },
  });
  return { mediaId: media!.id, propertyId: report.propertyId };
}

export async function deleteWeeklyPhoto(user: SessionUser, mediaId: string): Promise<{ propertyId: string }> {
  const rows = await db
    .select({ media: weeklyMedia, report: weeklyReports })
    .from(weeklyMedia)
    .innerJoin(weeklyReports, eq(weeklyReports.id, weeklyMedia.weeklyReportId))
    .where(eq(weeklyMedia.id, mediaId))
    .limit(1);
  const ctx = rows[0];
  if (!ctx) throw new AuthorizationError("Media not found");
  if (!canEditSubmission(user.role, ctx.report.workflowStatus)) {
    throw new AuthorizationError("This weekly report can no longer be modified");
  }

  await db.delete(weeklyMedia).where(eq(weeklyMedia.id, mediaId));
  const storage = getStorage();
  await storage.delete(ctx.media.storageKey);
  await storage.delete(ctx.media.thumbnailKey);
  await recordAudit(db, {
    actorUserId: user.id,
    action: "photo.weekly.deleted",
    entityType: "weekly_media",
    entityId: mediaId,
    propertyId: ctx.report.propertyId,
    beforeData: { storageKey: ctx.media.storageKey },
  });
  return { propertyId: ctx.report.propertyId };
}

export async function updateWeeklyPhotoCaption(user: SessionUser, mediaId: string, caption: string) {
  const rows = await db
    .select({ media: weeklyMedia, report: weeklyReports })
    .from(weeklyMedia)
    .innerJoin(weeklyReports, eq(weeklyReports.id, weeklyMedia.weeklyReportId))
    .where(eq(weeklyMedia.id, mediaId))
    .limit(1);
  const ctx = rows[0];
  if (!ctx) throw new AuthorizationError("Media not found");
  if (!canEditSubmission(user.role, ctx.report.workflowStatus)) {
    throw new AuthorizationError("This weekly report can no longer be modified");
  }
  await db.update(weeklyMedia).set({ caption }).where(eq(weeklyMedia.id, mediaId));
  return { propertyId: ctx.report.propertyId };
}
