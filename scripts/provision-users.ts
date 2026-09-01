import "dotenv/config";
import crypto from "node:crypto";

/**
 * Provisions the standard operating account set with generated passwords.
 *
 *   pnpm provision:users                       # manager + one site user per property
 *   pnpm provision:users --domain zameen.com   # custom email domain
 *   pnpm provision:users --with-assistant      # also create the Assistant Manager
 *   pnpm provision:users --reset               # re-issue passwords for existing accounts
 *
 * Passwords are generated here and printed ONCE. They are stored only as a
 * hash — nothing can recover them afterwards, so capture them now and have
 * each holder change their own at first sign-in.
 *
 * Site users are bound to a single property; that binding is enforced on the
 * server for every read and write, not by hiding links in the UI.
 */

/** Readable but strong: 4 words + digits, ~72 bits of entropy. */
const WORDS = [
  "harbor", "lantern", "meadow", "quartz", "cobalt", "juniper", "falcon", "amber",
  "granite", "willow", "cedar", "onyx", "marble", "saffron", "indigo", "basalt",
  "cypress", "topaz", "aspen", "flint", "ivory", "jasper", "larch", "opal",
];

function generatePassword(): string {
  const pick = () => WORDS[crypto.randomInt(0, WORDS.length)]!;
  const word = () => {
    const w = pick();
    return w[0]!.toUpperCase() + w.slice(1);
  };
  return `${word()}-${word()}-${word()}-${crypto.randomInt(100, 1000)}`;
}

interface Spec {
  key: string;
  name: string;
  local: string;
  role: "MANAGER_ADMIN" | "ASSISTANT_MANAGER" | "SITE_USER";
  /** Property code for site users. */
  propertyCode?: string;
}

/**
 * Default set: one manager plus one site user per property. Add the Assistant
 * Manager tier with `--with-assistant` when review duties are split out.
 */
const SPECS: Spec[] = [
  { key: "admin", name: "Manager Admin", local: "manager.admin", role: "MANAGER_ADMIN" },
  { key: "opal", name: "Opal Site User", local: "opal.site", role: "SITE_USER", propertyCode: "opal" },
  { key: "aurum", name: "Aurum Site User", local: "aurum.site", role: "SITE_USER", propertyCode: "aurum" },
  {
    key: "quadrangle",
    name: "Quadrangle Site User",
    local: "quadrangle.site",
    role: "SITE_USER",
    propertyCode: "quadrangle",
  },
];

const ASSISTANT_SPEC: Spec = {
  key: "am",
  name: "Assistant Manager",
  local: "assistant.manager",
  role: "ASSISTANT_MANAGER",
};

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const domain = arg("--domain") ?? "zameen.local";
  const reset = process.argv.includes("--reset");
  const specs = process.argv.includes("--with-assistant") ? [...SPECS, ASSISTANT_SPEC] : SPECS;

  const { db, pool } = await import("@/server/db");
  const { user, account, auditLogs, properties } = await import("@/db/schema");
  const { eq } = await import("drizzle-orm");
  const { hashPassword } = await import("better-auth/crypto");

  const allProperties = await db.select().from(properties);
  const propertyByCode = new Map(allProperties.map((p) => [p.code, p]));

  const issued: Array<{ email: string; role: string; property: string; password: string }> = [];
  const skipped: string[] = [];

  for (const spec of specs) {
    const email = `${spec.local}@${domain}`.toLowerCase();
    const property = spec.propertyCode ? propertyByCode.get(spec.propertyCode) : undefined;
    if (spec.propertyCode && !property) {
      console.warn(`  ! property "${spec.propertyCode}" not found — skipping ${email}`);
      continue;
    }

    const existing = (await db.select().from(user).where(eq(user.email, email)))[0];
    const password = generatePassword();
    const hashed = await hashPassword(password);

    if (existing) {
      if (!reset) {
        skipped.push(email);
        continue;
      }
      await db
        .update(user)
        .set({ role: spec.role, propertyId: property?.id ?? null, banned: false })
        .where(eq(user.id, existing.id));
      await db.update(account).set({ password: hashed }).where(eq(account.userId, existing.id));
      await db.insert(auditLogs).values({
        actorUserId: null,
        action: "user.password_reset",
        entityType: "user",
        entityId: existing.id,
        metadata: { source: "provision-users" },
      });
    } else {
      const id = crypto.randomUUID();
      await db.insert(user).values({
        id,
        name: spec.name,
        email,
        emailVerified: true,
        role: spec.role,
        propertyId: property?.id ?? null,
      });
      await db.insert(account).values({
        id: crypto.randomUUID(),
        accountId: id,
        providerId: "credential",
        issuer: "local:credential",
        userId: id,
        password: hashed,
      });
      await db.insert(auditLogs).values({
        actorUserId: null,
        action: "user.created",
        entityType: "user",
        entityId: id,
        afterData: { email, role: spec.role, propertyId: property?.id ?? null },
        metadata: { source: "provision-users" },
      });
    }

    issued.push({
      email,
      role: spec.role,
      property: property?.name ?? "All properties",
      password,
    });
  }

  await pool.end();

  if (skipped.length > 0) {
    console.log(
      `\nAlready existed, left untouched (re-run with --reset to issue new passwords):\n  ${skipped.join("\n  ")}`,
    );
  }

  if (issued.length === 0) {
    console.log("\nNothing to do.");
    return;
  }

  const pad = (s: string, n: number) => s.padEnd(n);
  console.log("\n┌─ Credentials — shown once, not recoverable ──────────────────────────────┐");
  console.log(
    `  ${pad("EMAIL", 34)}${pad("ROLE", 20)}${pad("SCOPE", 16)}PASSWORD`,
  );
  for (const c of issued) {
    console.log(`  ${pad(c.email, 34)}${pad(c.role, 20)}${pad(c.property, 16)}${c.password}`);
  }
  console.log("└──────────────────────────────────────────────────────────────────────────┘");
  console.log("\nStore these in the team password manager and have each holder change");
  console.log("their own password at first sign-in (Admin → Users → Reset password).");
}

main().catch((err) => {
  console.error("Provisioning failed:", err);
  process.exit(1);
});
