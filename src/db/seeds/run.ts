import "dotenv/config";

/**
 * Seed entrypoint.
 *   pnpm db:seed        → baseline (portfolio + 22 checklist definitions)
 *   pnpm db:seed:demo   → baseline + clearly-labeled DEMO development data
 *   pnpm db:seed:legacy → baseline + the legacy Command Center week, verbatim
 *
 * dotenv must load before any module that reads process.env, hence the
 * dynamic import below.
 */
async function main() {
  const demo = process.argv.includes("--demo");
  const legacy = process.argv.includes("--legacy");
  const { runBaselineSeed } = await import("./baseline");
  await runBaselineSeed();
  if (demo) {
    const { runDemoSeed } = await import("./demo");
    await runDemoSeed();
  }
  if (legacy) {
    const { runLegacySeed } = await import("./legacy-command-center");
    await runLegacySeed();
  }
  const { pool } = await import("@/server/db");
  await pool.end();
  console.log("Seeding complete.");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
