"use client";

import { createAuthClient } from "better-auth/react";
import { adminClient } from "better-auth/client/plugins";

/**
 * Browser-side Better Auth client. Only ever calls the public /api/auth
 * endpoints — privileged operations are guarded server-side by the admin
 * plugin (MANAGER_ADMIN session required).
 */
export const authClient = createAuthClient({
  plugins: [adminClient()],
});
