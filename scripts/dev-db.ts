/**
 * Local development database WITHOUT Docker.
 *
 * Boots a real PostgreSQL 18 server (embedded-postgres binaries) on port 5544
 * with credentials matching .env's DATABASE_URL. The documented team-standard
 * path is `docker compose up -d postgres minio`; this script is the fallback
 * for machines without Docker (see README).
 *
 * Usage: pnpm db:dev   (keeps running; Ctrl+C to stop)
 */
import EmbeddedPostgres from "embedded-postgres";
import fs from "node:fs";
import path from "node:path";

const DATA_DIR = path.resolve(".data/pg");
const PORT = 5544;
const USER = "zameen";
const PASSWORD = "zameen";
const DATABASE = "zameen_admin";

async function main() {
  const isNew = !fs.existsSync(path.join(DATA_DIR, "PG_VERSION"));
  const pg = new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    user: USER,
    password: PASSWORD,
    port: PORT,
    persistent: true,
  });

  if (isNew) {
    console.log("Initializing PostgreSQL 18 cluster at", DATA_DIR);
    await pg.initialise();
  }
  console.log(`Starting PostgreSQL on 127.0.0.1:${PORT} …`);
  await pg.start();

  if (isNew) {
    await pg.createDatabase(DATABASE);
    console.log(`Created database "${DATABASE}".`);
  }

  console.log(`Ready: postgres://${USER}:*****@127.0.0.1:${PORT}/${DATABASE}`);
  console.log("Press Ctrl+C to stop.");

  const stop = async () => {
    console.log("\nStopping PostgreSQL …");
    await pg.stop();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
