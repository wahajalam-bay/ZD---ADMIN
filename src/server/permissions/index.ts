import "server-only";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { properties } from "@/db/schema";
import { getSessionUser, type SessionUser } from "@/server/auth/session";
import {
  canAccessProperty,
  canAdministerUsers,
  canManageIntegrations,
  canManageProperties,
  canPublish,
  canReview,
  canViewAllProperties,
  type Role,
} from "@/lib/roles";

/**
 * Authoritative server-side authorization boundary.
 * Every property-sensitive read/write goes through these guards — never trust
 * client-supplied property ids, codes, or workflow states.
 */

export class AuthenticationError extends Error {
  readonly status = 401;
  constructor(message = "Authentication required") {
    super(message);
    this.name = "AuthenticationError";
  }
}

export class AuthorizationError extends Error {
  readonly status = 403;
  constructor(message = "You do not have access to this resource") {
    super(message);
    this.name = "AuthorizationError";
  }
}

export async function requireAuthenticatedUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new AuthenticationError();
  return user;
}

export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const user = await requireAuthenticatedUser();
  if (!roles.includes(user.role)) {
    throw new AuthorizationError(`Requires role: ${roles.join(" or ")}`);
  }
  return user;
}

export async function requireReviewer(): Promise<SessionUser> {
  const user = await requireAuthenticatedUser();
  if (!canReview(user.role)) throw new AuthorizationError("Review permissions required");
  return user;
}

export async function requirePublisher(): Promise<SessionUser> {
  const user = await requireAuthenticatedUser();
  if (!canPublish(user.role)) throw new AuthorizationError("Publish permissions required");
  return user;
}

export async function requireUserAdmin(): Promise<SessionUser> {
  const user = await requireAuthenticatedUser();
  if (!canAdministerUsers(user.role)) {
    throw new AuthorizationError("User administration requires Manager/Admin");
  }
  return user;
}

export async function requirePropertyAdmin(): Promise<SessionUser> {
  const user = await requireAuthenticatedUser();
  if (!canManageProperties(user.role)) {
    throw new AuthorizationError("Property administration requires Manager/Admin");
  }
  return user;
}

export async function requireIntegrationAdmin(): Promise<SessionUser> {
  const user = await requireAuthenticatedUser();
  if (!canManageIntegrations(user.role)) {
    throw new AuthorizationError("Integration administration requires Manager/Admin");
  }
  return user;
}

/**
 * Asserts the current user may access `propertyId`. Site users are restricted
 * to their single assigned property; management roles see the portfolio.
 */
export async function requirePropertyAccess(propertyId: string): Promise<SessionUser> {
  const user = await requireAuthenticatedUser();
  if (!canAccessProperty(user, propertyId)) {
    throw new AuthorizationError("You do not have access to this property");
  }
  return user;
}

/** Returns "all" for management roles, else the site user's property ids. */
export async function getAuthorizedPropertyIds(): Promise<"all" | string[]> {
  const user = await requireAuthenticatedUser();
  if (canViewAllProperties(user.role)) return "all";
  return user.propertyId ? [user.propertyId] : [];
}

export const getPropertyByCode = cache(async (code: string) => {
  const rows = await db
    .select()
    .from(properties)
    .where(eq(properties.code, code.toLowerCase()))
    .limit(1);
  return rows[0] ?? null;
});

/**
 * Resolves a property by URL code AND asserts access + active status.
 * Used by every /entry and /command-center property page and action.
 */
export async function requirePropertyByCode(code: string) {
  const property = await getPropertyByCode(code);
  if (!property || !property.active) {
    throw new AuthorizationError("Unknown or inactive property");
  }
  const user = await requirePropertyAccess(property.id);
  return { property, user };
}
