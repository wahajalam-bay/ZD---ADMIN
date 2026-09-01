import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/server/auth/auth";
import { isRole, type Role } from "@/lib/roles";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  propertyId: string | null;
  banned: boolean;
}

/**
 * Reads the current session (server-side, database-backed).
 * Cached per-request via React cache().
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;
  const u = session.user as typeof session.user & {
    role?: string | null;
    propertyId?: string | null;
    banned?: boolean | null;
  };
  if (u.banned) return null;
  const role: Role = isRole(u.role) ? u.role : "SITE_USER";
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role,
    propertyId: u.propertyId ?? null,
    banned: Boolean(u.banned),
  };
});

/**
 * Page-level session requirement. Layout guards do not stop a page component
 * from rendering (Next renders them concurrently), so every page that needs a
 * user must resolve it null-safely — a stale cookie yields null here.
 */
export async function requirePageUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}
