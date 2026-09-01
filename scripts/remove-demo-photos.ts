import "dotenv/config";

/**
 * Removes the SYNTHETIC demo placeholder images created by `pnpm db:seed:demo`
 * (colored "DEMO" rectangles), keeping real photos (e.g. the imported
 * reference library) untouched. Deletes both database rows and the underlying
 * storage objects, with an audit record.
 *
 *   pnpm remove:demo-photos
 *
 * Identification: demo weekly media carries captions starting "DEMO"; demo
 * checklist evidence was stored with originalFilename "demo-evidence.jpg".
 */
async function main() {
  const { db, pool } = await import("@/server/db");
  const { weeklyMedia, checklistResponsePhotos, auditLogs } = await import("@/db/schema");
  const { ilike, eq } = await import("drizzle-orm");
  const { getStorage } = await import("@/server/storage");

  const storage = getStorage();

  const demoWeekly = await db.select().from(weeklyMedia).where(ilike(weeklyMedia.caption, "DEMO%"));
  const demoEvidence = await db
    .select()
    .from(checklistResponsePhotos)
    .where(eq(checklistResponsePhotos.originalFilename, "demo-evidence.jpg"));

  console.log(
    `Found ${demoWeekly.length} demo weekly photos and ${demoEvidence.length} demo evidence photos.`,
  );

  for (const m of demoWeekly) {
    await db.delete(weeklyMedia).where(eq(weeklyMedia.id, m.id));
    await storage.delete(m.storageKey);
    await storage.delete(m.thumbnailKey);
  }
  for (const p of demoEvidence) {
    await db.delete(checklistResponsePhotos).where(eq(checklistResponsePhotos.id, p.id));
    await storage.delete(p.storageKey);
    await storage.delete(p.thumbnailKey);
  }

  if (demoWeekly.length + demoEvidence.length > 0) {
    await db.insert(auditLogs).values({
      actorUserId: null,
      action: "photo.demo.purged",
      entityType: "media",
      metadata: {
        source: "remove-demo-photos",
        weeklyRemoved: demoWeekly.length,
        evidenceRemoved: demoEvidence.length,
      },
    });
  }

  console.log(
    `Removed ${demoWeekly.length} weekly + ${demoEvidence.length} evidence demo photos (rows + objects).`,
  );
  await pool.end();
}

main().catch((err) => {
  console.error("Demo photo removal failed:", err);
  process.exit(1);
});
