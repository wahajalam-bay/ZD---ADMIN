import "dotenv/config";

/**
 * Seed entrypoint.
 *   pnpm db:seed        → baseline (9 properties + checklist definitions)
 *   pnpm db:seed:demo   → baseline + clearly-labeled DEMO development data
 *
 * dotenv must load before any module that reads process.env, hence the
 * dynamic import below.
 */
async function main() {
  const demo = process.argv.includes("--demo");
  const { runBaselineSeed } = await import("./baseline");
  await runBaselineSeed();
  if (demo) {
    const { runDemoSeed } = await import("./demo");
    await runDemoSeed();
  }
  const { pool } = await import("@/server/db");
  await pool.end();
  console.log("Seeding complete.");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
