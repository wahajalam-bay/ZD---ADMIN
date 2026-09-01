import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@/db/schema";
import { env } from "@/server/env";

/**
 * Single shared connection pool. In dev, Next.js hot-reload re-evaluates
 * modules — stash the pool on globalThis so connections are not leaked.
 */
const globalForDb = globalThis as unknown as { __zameenPool?: Pool };

const pool =
  globalForDb.__zameenPool ??
  new Pool({
    connectionString: env.DATABASE_URL,
    max: 10,
  });

if (env.NODE_ENV !== "production") globalForDb.__zameenPool = pool;

export const db = drizzle(pool, { schema, casing: "snake_case" });

export type Db = typeof db;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export { pool };
