import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/server/db";

export const dynamic = "force-dynamic";

/** Minimal health endpoint: app liveness + database connectivity. No internals. */
export async function GET() {
  let database = false;
  try {
    await db.execute(sql`select 1`);
    database = true;
  } catch {
    database = false;
  }
  return NextResponse.json(
    { status: database ? "ok" : "degraded", database },
    { status: database ? 200 : 503 },
  );
}
