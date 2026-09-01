import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins";
import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements } from "better-auth/plugins/admin/access";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { account, session, user, verification } from "@/db/schema";

/**
 * Access-control roles for the Better Auth admin plugin. Only MANAGER_ADMIN
 * receives the plugin's user-administration permissions; the application's
 * own RBAC (src/lib/roles + src/server/permissions) governs everything else.
 */
const ac = createAccessControl({ ...defaultStatements });
const acRoles = {
  SITE_USER: ac.newRole({}),
  ASSISTANT_MANAGER: ac.newRole({}),
  MANAGER_ADMIN: ac.newRole({ ...adminAc.statements }),
};

/**
 * Better Auth server instance.
 * - email/password sign-in with server-side database sessions
 * - public sign-up disabled: accounts are created by MANAGER_ADMIN only
 * - admin plugin powers user administration (create, ban/disable, set
 *   password, set role); its endpoints require an authenticated
 *   MANAGER_ADMIN session — nothing privileged is exposed to browsers.
 */
export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [env.APP_URL],
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user, session, account, verification },
  }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 10,
  },
  user: {
    additionalFields: {
      propertyId: {
        type: "string",
        required: false,
        // Never accepted from client input; set only via admin server actions.
        input: false,
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24,
  },
  plugins: [
    admin({
      ac,
      roles: acRoles,
      defaultRole: "SITE_USER",
      adminRoles: ["MANAGER_ADMIN"],
    }),
    // Must be last: lets Server Actions set auth cookies in Next.js.
    nextCookies(),
  ],
});

export type AuthSession = typeof auth.$Infer.Session;
