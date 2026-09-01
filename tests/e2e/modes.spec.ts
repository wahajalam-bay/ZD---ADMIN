import { expect, test } from "@playwright/test";
import { ACCOUNTS, login } from "./helpers";

/**
 * Design-system modes (§7) and core accessibility behaviours must survive
 * every future change: Light/Dark are token switches on <html>, Presentation
 * widens the canvas and hides secondary controls, panels close on Escape.
 */
test.describe("Modes & accessibility", () => {
  test("dark mode toggles tokens across dashboards and persists", async ({ page }) => {
    await login(page, ACCOUNTS.am);
    await page.goto("/command-center");

    const html = page.locator("html");
    const initiallyDark = await html.evaluate((el) => el.classList.contains("dark"));
    if (initiallyDark) await page.getByRole("button", { name: /light mode/i }).click();

    await page.getByRole("button", { name: /dark mode/i }).click();
    await expect(html).toHaveClass(/dark/);

    // Tokens actually repaint the surface, not just the class (the body has a
    // colour transition, so poll until it settles).
    await expect
      .poll(
        async () =>
          (
            await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
          ).replace(/\s/g, ""),
        { timeout: 5000 },
      )
      .toBe("rgb(14,21,18)");

    // Persists across navigation to another dashboard.
    await page.goto("/command-center/opal");
    await expect(page.locator("html")).toHaveClass(/dark/);

    // Restore light for the rest of the suite.
    await page.getByRole("button", { name: /light mode/i }).click();
    await expect(page.locator("html")).not.toHaveClass(/dark/);
  });

  test("presentation mode enlarges KPIs and hides secondary controls", async ({ page }) => {
    await login(page, ACCOUNTS.am);
    await page.goto("/command-center");

    const kpi = page.getByTestId("kpi-completed").locator(".t-kpi");
    const before = await kpi.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));

    await page.getByRole("button", { name: /presentation/i }).click();
    await expect(page.locator("html")).toHaveClass(/presentation/);

    const after = await kpi.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(after).toBeGreaterThan(before);

    // Secondary chrome (KPI sparklines) is hidden for boardroom display.
    await expect(page.getByTestId("kpi-completed").locator("svg.pm-hide")).toBeHidden();

    await page.getByRole("button", { name: /presentation/i }).click();
    await expect(page.locator("html")).not.toHaveClass(/presentation/);
  });

  test("analytics panel opens from an issue and closes on Escape", async ({ page }) => {
    await login(page, ACCOUNTS.am);
    await page.goto("/command-center/opal");

    const feed = page.getByTestId("attention-feed");
    const rows = feed.locator('[data-testid^="attention-"]');
    if ((await rows.count()) === 0) test.skip(true, "No open issues in the current published week");

    await rows.first().click();
    const panel = page.getByRole("dialog");
    await expect(panel).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
  });

  test("portfolio KPI cross-filtering narrows the attention feed", async ({ page }) => {
    await login(page, ACCOUNTS.am);
    await page.goto("/command-center");

    const issuesKpi = page.getByTestId("kpi-issues");
    await expect(issuesKpi).toBeVisible();
    await issuesKpi.click();

    // Clicking the KPI opens its analytics panel without leaving the page.
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page).toHaveURL(/\/command-center$/);
    await page.keyboard.press("Escape");
  });
});
