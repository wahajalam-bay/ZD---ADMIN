import "dotenv/config";
import crypto from "node:crypto";

/**
 * One-off production bootstrap: creates the first MANAGER_ADMIN account.
 *
 * Usage:
 *   ADMIN_EMAIL=ops@company.com ADMIN_NAME="Ops Manager" ADMIN_PASSWORD='...' pnpm bootstrap:admin
 *
 * Idempotent: refuses to touch an existing email. All later account management
 * happens in the UI at Admin → Users.
 */
async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const name = process.env.ADMIN_NAME?.trim() || "Manager Admin";
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.error("Set ADMIN_EMAIL and ADMIN_PASSWORD environment variables.");
    process.exit(1);
  }
  if (password.length < 10) {
    console.error("ADMIN_PASSWORD must be at least 10 characters.");
    process.exit(1);
  }

  const { db, pool } = await import("@/server/db");
  const { user, account, auditLogs } = await import("@/db/schema");
  const { eq } = await import("drizzle-orm");
  const { hashPassword } = await import("better-auth/crypto");

  const existing = await db.select().from(user).where(eq(user.email, email));
  if (existing.length > 0) {
    console.error(`A user with email ${email} already exists — nothing done.`);
    await pool.end();
    process.exit(1);
  }

  const id = crypto.randomUUID();
  await db.insert(user).values({
    id,
    name,
    email,
    emailVerified: true,
    role: "MANAGER_ADMIN",
  });
  await db.insert(account).values({
    id: crypto.randomUUID(),
    accountId: id,
    providerId: "credential",
    issuer: "local:credential",
    userId: id,
    password: await hashPassword(password),
  });
  await db.insert(auditLogs).values({
    actorUserId: null,
    action: "user.created",
    entityType: "user",
    entityId: id,
    afterData: { email, role: "MANAGER_ADMIN" },
    metadata: { source: "bootstrap-admin" },
  });
  await pool.end();
  console.log(`Manager/Admin created: ${email}`);
  console.log("Sign in and manage further accounts at /admin/users.");
}

main().catch((err) => {
  console.error("Bootstrap failed:", err);
  process.exit(1);
});
