import path from "node:path";
import { z } from "zod";

/**
 * Server-only environment configuration, validated once at startup.
 * Never import this module from a Client Component.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  BETTER_AUTH_SECRET: z.string().min(16, "BETTER_AUTH_SECRET must be at least 16 characters"),
  BETTER_AUTH_URL: z.string().url().default("http://localhost:3000"),
  /**
   * Where checklist evidence and progress photographs are written. In
   * production this MUST be a mounted volume that outlives the container —
   * the default points inside the working directory for local development.
   */
  STORAGE_MEDIA_PATH: z.string().default(".data/storage"),
  SEED_DEMO_PASSWORD: z.string().optional(),
  PROPONE_MODE: z.enum(["file", "api", "redshift"]).default("file"),
  PROPONE_API_BASE_URL: z.string().optional(),
  PROPONE_API_TOKEN: z.string().optional(),
  /** Redshift (PropOne Pakistan warehouse) — postgres-wire connection URL. */
  PROPONE_REDSHIFT_URL: z.string().optional(),
  PROPONE_REDSHIFT_SCHEMA: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

export const env = parsed.data;

/**
 * `next build` runs with NODE_ENV=production but no real runtime configuration,
 * so runtime-only guards must not fire while collecting page data.
 */
const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";

/**
 * Media lives on a mounted disk volume. In production a relative path almost
 * always means "inside the container", which is lost on the next deploy — so
 * refuse to start rather than silently accept photographs that will vanish.
 */
if (!isBuildPhase && env.NODE_ENV === "production" && !path.isAbsolute(env.STORAGE_MEDIA_PATH)) {
  throw new Error(
    `STORAGE_MEDIA_PATH must be an absolute path to a persistent volume in production (got "${env.STORAGE_MEDIA_PATH}").`,
  );
}

if (!isBuildPhase && env.NODE_ENV === "production" && env.BETTER_AUTH_URL.startsWith("http://")) {
  console.warn(
    "[env] BETTER_AUTH_URL is not HTTPS. Session cookies will not be marked Secure — terminate TLS in front of the app.",
  );
}
