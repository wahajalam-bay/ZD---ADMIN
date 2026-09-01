import "dotenv/config";
import fs from "node:fs";
import path from "node:path";

/**
 * DEVELOPER MIGRATION SCRIPT — imports the legacy site photos embedded as
 * base64 inside the reference Command Center HTML into real object storage.
 *
 *   pnpm import:reference-photos [--publish]
 *
 * - Extracts the `IMG` (filename → data URI) and `SITE_PHOTOS`
 *   (site → [{file, title, slide_no}]) constants from the reference file.
 * - Every image goes through the production upload pipeline (sharp
 *   validation, re-encode, thumbnail) and lands in object storage; the
 *   database stores keys + metadata only — never base64.
 * - Photos attach to each property's CURRENT-week weekly report as weekly
 *   progress media, with the reference title as caption.
 * - Sets the property hero image from the reference hero photos.
 * - Idempotent: photos already imported (matched by original filename per
 *   property) are skipped.
 * - `--publish`: if a target weekly report is not yet published, it is
 *   approved+published (audited) so the imported photos are immediately
 *   visible on the Command Center.
 */

const REFERENCE_FILE = "reference/Zameen_Admin_Properties_Command_Center (1).html";
const HEROES: Record<string, string> = {
  OPAL: "OPAL_s03_1.jpg",
  AURUM: "AURUM_s29_1.jpg",
  QUADRANGLE: "QUADRANGLE_s47_1.jpg",
};

function extractJsonConst(html: string, name: string): string {
  const line = html.split("\n").find((l) => l.startsWith(`const ${name} = `));
  if (!line) throw new Error(`Could not find "const ${name} = " in ${REFERENCE_FILE}`);
  return line.slice(`const ${name} = `.length).replace(/;\s*$/, "");
}

async function main() {
  const publish = process.argv.includes("--publish");

  const { db, pool } = await import("@/server/db");
  const { properties, weeklyReports, weeklyMedia, user, auditLogs } = await import("@/db/schema");
  const { and, eq } = await import("drizzle-orm");
  const { getStorage } = await import("@/server/storage");
  const { processImageUpload, buildObjectKey } = await import("@/server/storage/images");
  const { currentWeekStart } = await import("@/lib/week");

  const htmlPath = path.resolve(REFERENCE_FILE);
  if (!fs.existsSync(htmlPath)) throw new Error(`Reference file not found: ${htmlPath}`);
  console.log(`Reading ${REFERENCE_FILE} …`);
  const html = fs.readFileSync(htmlPath, "utf8");

  const IMG: Record<string, string> = JSON.parse(extractJsonConst(html, "IMG"));
  const SITE_PHOTOS: Record<string, Array<{ file: string; title: string; slide_no: number }>> =
    JSON.parse(extractJsonConst(html, "SITE_PHOTOS"));

  const week = currentWeekStart();
  const storage = getStorage();

  const managers = await db.select().from(user).where(eq(user.role, "MANAGER_ADMIN"));
  const fallbackUploader = managers[0];
  if (!fallbackUploader) throw new Error("No MANAGER_ADMIN user found — seed users first.");
  const reviewers = await db.select().from(user).where(eq(user.role, "ASSISTANT_MANAGER"));
  const reviewer = reviewers[0] ?? fallbackUploader;

  let totalImported = 0;
  let totalSkipped = 0;

  for (const [siteKey, photos] of Object.entries(SITE_PHOTOS)) {
    const code = siteKey.toLowerCase();
    const [property] = await db.select().from(properties).where(eq(properties.code, code));
    if (!property) {
      console.warn(`  ! No property with code "${code}" — skipping ${photos.length} photos`);
      continue;
    }

    // Target: the current reporting week's report (created as draft if absent).
    let [report] = await db
      .select()
      .from(weeklyReports)
      .where(and(eq(weeklyReports.propertyId, property.id), eq(weeklyReports.weekStart, week)));
    const siteUsers = await db.select().from(user).where(eq(user.propertyId, property.id));
    const uploader = siteUsers[0] ?? fallbackUploader;
    if (!report) {
      const inserted = await db
        .insert(weeklyReports)
        .values({
          propertyId: property.id,
          weekStart: week,
          summary: "Imported reference site photos.",
          notes: "Created by the reference-photo import script.",
          workflowStatus: "DRAFT",
          createdBy: uploader.id,
        })
        .returning();
      report = inserted[0]!;
      console.log(`  + created ${property.name} weekly report for ${week} (DRAFT)`);
    }

    const existingRows = await db
      .select({ originalFilename: weeklyMedia.originalFilename, storageKey: weeklyMedia.storageKey })
      .from(weeklyMedia)
      .where(eq(weeklyMedia.propertyId, property.id));
    const existingByFilename = new Map(existingRows.map((r) => [r.originalFilename, r.storageKey]));

    let imported = 0;
    for (const photo of photos) {
      if (existingByFilename.has(photo.file)) {
        totalSkipped++;
        continue;
      }
      const dataUri = IMG[photo.file];
      if (!dataUri?.startsWith("data:image/")) {
        console.warn(`  ! ${photo.file}: no embedded image data — skipped`);
        continue;
      }
      const base64 = dataUri.slice(dataUri.indexOf(",") + 1);
      const buffer = Buffer.from(base64, "base64");
      try {
        const processed = await processImageUpload(buffer);
        const { key, thumbKey } = buildObjectKey(property.id, "weekly");
        await storage.put(key, processed.main.buffer, processed.main.contentType);
        await storage.put(thumbKey, processed.thumb.buffer, processed.thumb.contentType);
        await db.insert(weeklyMedia).values({
          weeklyReportId: report.id,
          propertyId: property.id,
          mediaType: "IMAGE",
          storageKey: key,
          thumbnailKey: thumbKey,
          originalFilename: photo.file,
          mimeType: processed.main.contentType,
          sizeBytes: processed.main.buffer.byteLength,
          width: processed.main.width,
          height: processed.main.height,
          caption: photo.title,
          uploadedBy: uploader.id,
        });
        existingByFilename.set(photo.file, key);
        imported++;
      } catch (err) {
        console.warn(`  ! ${photo.file}: ${String(err)} — skipped`);
      }
    }
    totalImported += imported;
    console.log(`  ${property.name}: imported ${imported}/${photos.length} photos`);

    // Hero image from the reference hero photo.
    const heroKey = existingByFilename.get(HEROES[siteKey] ?? "");
    if (heroKey && !property.heroImageKey) {
      await db.update(properties).set({ heroImageKey: heroKey, updatedAt: new Date() }).where(eq(properties.id, property.id));
      console.log(`  ${property.name}: hero image set (${HEROES[siteKey]})`);
    }

    if (imported > 0) {
      await db.insert(auditLogs).values({
        actorUserId: uploader.id,
        action: "photo.weekly.added",
        entityType: "weekly_report",
        entityId: report.id,
        propertyId: property.id,
        metadata: { source: "reference-photo-import", imported, weekStart: week },
      });
    }

    // Optionally publish the target report so photos are visible immediately.
    if (publish && report.workflowStatus !== "PUBLISHED") {
      const now = new Date();
      const before = report.workflowStatus;
      await db
        .update(weeklyReports)
        .set({
          workflowStatus: "PUBLISHED",
          submittedBy: report.submittedBy ?? uploader.id,
          submittedAt: report.submittedAt ?? now,
          reviewedBy: reviewer.id,
          reviewedAt: now,
          approvedBy: report.approvedBy ?? reviewer.id,
          approvedAt: report.approvedAt ?? now,
          publishedBy: reviewer.id,
          publishedAt: now,
          updatedAt: now,
        })
        .where(eq(weeklyReports.id, report.id));
      await db.insert(auditLogs).values({
        actorUserId: reviewer.id,
        action: "weekly.published",
        entityType: "weekly_report",
        entityId: report.id,
        propertyId: property.id,
        beforeData: { workflowStatus: before },
        afterData: { workflowStatus: "PUBLISHED" },
        metadata: { source: "reference-photo-import --publish" },
      });
      console.log(`  ${property.name}: weekly report ${week} published (was ${before})`);
    }
  }

  console.log(`Done. Imported ${totalImported} photos, skipped ${totalSkipped} already present.`);
  await pool.end();
}

main().catch((err) => {
  console.error("Reference photo import failed:", err);
  process.exit(1);
});
