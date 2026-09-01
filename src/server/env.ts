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
  STORAGE_DRIVER: z.enum(["s3", "local"]).default("local"),
  STORAGE_LOCAL_PATH: z.string().default(".data/storage"),
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default("us-east-1"),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_FORCE_PATH_STYLE: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  SEED_DEMO_PASSWORD: z.string().optional(),
  PROPONE_MODE: z.enum(["file", "api"]).default("file"),
  PROPONE_API_BASE_URL: z.string().optional(),
  PROPONE_API_TOKEN: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

export const env = parsed.data;

if (env.STORAGE_DRIVER === "s3") {
  const missing = (["S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"] as const).filter(
    (k) => !env[k],
  );
  if (missing.length > 0) {
    throw new Error(`STORAGE_DRIVER=s3 requires: ${missing.join(", ")}`);
  }
}

if (env.STORAGE_DRIVER === "local" && env.NODE_ENV === "production") {
  console.warn(
    "[env] STORAGE_DRIVER=local is a development fallback. Use an S3-compatible store in production.",
  );
}
