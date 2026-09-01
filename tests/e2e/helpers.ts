import { expect, type Page } from "@playwright/test";

export const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD ?? "ZameenDev!2026";

export const ACCOUNTS = {
  opal: "opal.site@zameen.local",
  aurum: "aurum.site@zameen.local",
  am: "assistant.manager@zameen.local",
  admin: "manager.admin@zameen.local",
} as const;

export async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20_000 });
}

export async function logout(page: Page) {
  await page.context().clearCookies();
}

export async function expectToast(page: Page, text: string | RegExp) {
  await expect(page.locator('[role="status"]').filter({ hasText: text }).first()).toBeVisible({
    timeout: 20_000,
  });
}

/** Deterministic-per-run past date that never collides with seeded data. */
export function uniquePastDate(): string {
  const daysBack = 30 + (Date.now() % 500);
  const d = new Date(Date.now() - daysBack * 86_400_000);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function weekStartOf(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const diff = (d.getUTCDay() + 6) % 7;
  const monday = new Date(d.getTime() - diff * 86_400_000);
  return monday.toISOString().slice(0, 10);
}
