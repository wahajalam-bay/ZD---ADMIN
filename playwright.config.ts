import { defineConfig } from "@playwright/test";

/**
 * E2E suite. Requires the database to be seeded with demo data:
 *   pnpm db:migrate && pnpm db:seed:demo
 * The dev server is started automatically (or reused when already running).
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  use: {
    baseURL: "http://localhost:3000",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000/api/health",
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
