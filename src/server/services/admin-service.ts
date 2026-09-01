import "server-only";
import { and, asc, count, desc, eq, ne } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/server/db";
import {
  auditLogs,
  checklistEntries,
  properties,
  user as userTable,
  weeklyReports,
} from "@/db/schema";
import { auth } from "@/server/auth/auth";
import { recordAudit } from "@/server/services/audit-service";
import { AuthorizationError } from "@/server/permissions";
import type { SessionUser } from "@/server/auth/session";
import type { PropertyPayload } from "@/lib/validation";
import type { Role } from "@/lib/roles";

// ── Users ───────────────────────────────────────────────────────────────────

export async function listUsers() {
  return db
    .select({
      id: userTable.id,
      name: userTable.name,
      email: userTable.email,
      role: userTable.role,
      banned: userTable.banned,
      createdAt: userTable.createdAt,
      propertyId: userTable.propertyId,
      propertyName: properties.name,
    })
    .from(userTable)
    .leftJoin(properties, eq(properties.id, userTable.propertyId))
    .orderBy(asc(userTable.name));
}

/**
 * Creates a user through the Better Auth admin plugin (requires the calling
 * MANAGER_ADMIN's session), then applies the property assignment.
 */
export async function createUser(
  actor: SessionUser,
  input: { name: string; email: string; password: string; role: Role; propertyId: string | null },
) {
  const created = await auth.api.createUser({
    body: {
      name: input.name,
      email: input.email,
      password: input.password,
      role: input.role,
    },
    headers: await headers(),
  });
  const userId = created.user.id;
  if (input.propertyId) {
    await db.update(userTable).set({ propertyId: input.propertyId }).where(eq(userTable.id, userId));
  }
  await recordAudit(db, {
    actorUserId: actor.id,
    action: "user.created",
    entityType: "user",
    entityId: userId,
    propertyId: input.propertyId,
    afterData: { email: input.email, role: input.role, propertyId: input.propertyId },
  });
  return userId;
}

export async function updateUserRoleAndProperty(
  actor: SessionUser,
  input: { userId: string; role: Role; propertyId: string | null },
) {
  const [before] = await db.select().from(userTable).where(eq(userTable.id, input.userId)).limit(1);
  if (!before) throw new AuthorizationError("User not found");
  if (before.id === actor.id && input.role !== "MANAGER_ADMIN") {
    throw new AuthorizationError("You cannot demote your own account");
  }
  await db
    .update(userTable)
    .set({
      role: input.role,
      propertyId: input.role === "SITE_USER" ? input.propertyId : null,
      updatedAt: new Date(),
    })
    .where(eq(userTable.id, input.userId));
  await recordAudit(db, {
    actorUserId: actor.id,
    action: "user.role_changed",
    entityType: "user",
    entityId: input.userId,
    propertyId: input.propertyId,
    beforeData: { role: before.role, propertyId: before.propertyId },
    afterData: { role: input.role, propertyId: input.role === "SITE_USER" ? input.propertyId : null },
  });
}

export async function setUserDisabled(actor: SessionUser, userId: string, disabled: boolean) {
  if (userId === actor.id) throw new AuthorizationError("You cannot disable your own account");
  const h = await headers();
  if (disabled) {
    await auth.api.banUser({ body: { userId, banReason: "Disabled by administrator" }, headers: h });
  } else {
    await auth.api.unbanUser({ body: { userId }, headers: h });
  }
  await recordAudit(db, {
    actorUserId: actor.id,
    action: disabled ? "user.disabled" : "user.enabled",
    entityType: "user",
    entityId: userId,
  });
}

export async function resetUserPassword(actor: SessionUser, userId: string, newPassword: string) {
  await auth.api.setUserPassword({
    body: { userId, newPassword },
    headers: await headers(),
  });
  // Revoke existing sessions so the new credential takes effect everywhere.
  await auth.api.revokeUserSessions({ body: { userId }, headers: await headers() });
  await recordAudit(db, {
    actorUserId: actor.id,
    action: "user.password_reset",
    entityType: "user",
    entityId: userId,
    metadata: { by: "admin" },
  });
}

// ── Properties ──────────────────────────────────────────────────────────────

export async function listAllProperties() {
  return db.select().from(properties).orderBy(asc(properties.displayOrder), asc(properties.name));
}

export async function createProperty(actor: SessionUser, input: PropertyPayload) {
  const existing = await db.select().from(properties).where(eq(properties.code, input.code)).limit(1);
  if (existing.length > 0) throw new AuthorizationError(`Property code "${input.code}" already exists`);
  const [created] = await db.insert(properties).values(input).returning();
  await recordAudit(db, {
    actorUserId: actor.id,
    action: "property.created",
    entityType: "property",
    entityId: created!.id,
    propertyId: created!.id,
    afterData: input,
  });
  return created!;
}

export async function updateProperty(actor: SessionUser, id: string, input: PropertyPayload) {
  const [before] = await db.select().from(properties).where(eq(properties.id, id)).limit(1);
  if (!before) throw new AuthorizationError("Property not found");
  const codeClash = await db
    .select({ id: properties.id })
    .from(properties)
    .where(and(eq(properties.code, input.code), ne(properties.id, id)))
    .limit(1);
  if (codeClash.length > 0) throw new AuthorizationError(`Property code "${input.code}" already exists`);
  await db
    .update(properties)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(properties.id, id));
  await recordAudit(db, {
    actorUserId: actor.id,
    action: "property.updated",
    entityType: "property",
    entityId: id,
    propertyId: id,
    beforeData: before,
    afterData: input,
  });
}

/**
 * Properties are never hard-deleted (historical records depend on them) —
 * deactivation removes them from navigation, KPIs and entry.
 */
export async function setPropertyActive(actor: SessionUser, id: string, active: boolean) {
  const [before] = await db.select().from(properties).where(eq(properties.id, id)).limit(1);
  if (!before) throw new AuthorizationError("Property not found");
  await db.update(properties).set({ active, updatedAt: new Date() }).where(eq(properties.id, id));
  await recordAudit(db, {
    actorUserId: actor.id,
    action: active ? "property.activated" : "property.deactivated",
    entityType: "property",
    entityId: id,
    propertyId: id,
  });
}

export async function propertyHasRecords(id: string): Promise<boolean> {
  const [a] = await db
    .select({ c: count() })
    .from(checklistEntries)
    .where(eq(checklistEntries.propertyId, id));
  if ((a?.c ?? 0) > 0) return true;
  const [b] = await db.select({ c: count() }).from(weeklyReports).where(eq(weeklyReports.propertyId, id));
  return (b?.c ?? 0) > 0;
}

// ── Audit ───────────────────────────────────────────────────────────────────

export async function listAuditLogs(opts: { page: number; propertyId?: string; action?: string }) {
  const pageSize = 50;
  const where = [
    ...(opts.propertyId ? [eq(auditLogs.propertyId, opts.propertyId)] : []),
    ...(opts.action ? [eq(auditLogs.action, opts.action)] : []),
  ];
  const rows = await db
    .select({
      log: auditLogs,
      actorName: userTable.name,
      propertyName: properties.name,
    })
    .from(auditLogs)
    .leftJoin(userTable, eq(userTable.id, auditLogs.actorUserId))
    .leftJoin(properties, eq(properties.id, auditLogs.propertyId))
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(auditLogs.createdAt))
    .limit(pageSize)
    .offset((opts.page - 1) * pageSize);
  const [total] = await db
    .select({ c: count() })
    .from(auditLogs)
    .where(where.length ? and(...where) : undefined);
  return { rows, total: total?.c ?? 0, pageSize };
}

/** Audit timeline for a single record (shown on review pages). */
export async function auditTimeline(entityType: string, entityId: string) {
  return db
    .select({
      log: auditLogs,
      actorName: userTable.name,
    })
    .from(auditLogs)
    .leftJoin(userTable, eq(userTable.id, auditLogs.actorUserId))
    .where(and(eq(auditLogs.entityType, entityType), eq(auditLogs.entityId, entityId)))
    .orderBy(desc(auditLogs.createdAt))
    .limit(50);
}
