import { headers } from "next/headers";
import { auditLogs } from "@/db/schema";
import type { Db, Tx } from "@/server/db";

export interface AuditEvent {
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  propertyId?: string | null;
  beforeData?: unknown;
  afterData?: unknown;
  metadata?: Record<string, unknown>;
}

/** Best-effort request context (absent in scripts/seeds). */
async function requestContext(): Promise<{ ip: string | null; userAgent: string | null }> {
  try {
    const h = await headers();
    const fwd = h.get("x-forwarded-for");
    return {
      ip: fwd ? (fwd.split(",")[0]?.trim() ?? null) : null,
      userAgent: h.get("user-agent")?.slice(0, 512) ?? null,
    };
  } catch {
    return { ip: null, userAgent: null };
  }
}

/**
 * Inserts an immutable audit record. Call inside the same transaction as the
 * mutation it describes so audit + change commit atomically.
 */
export async function recordAudit(dbOrTx: Db | Tx, event: AuditEvent): Promise<void> {
  const ctx = await requestContext();
  await dbOrTx.insert(auditLogs).values({
    actorUserId: event.actorUserId,
    action: event.action,
    entityType: event.entityType,
    entityId: event.entityId ?? null,
    propertyId: event.propertyId ?? null,
    beforeData: event.beforeData ?? null,
    afterData: event.afterData ?? null,
    metadata: event.metadata ?? null,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
}
