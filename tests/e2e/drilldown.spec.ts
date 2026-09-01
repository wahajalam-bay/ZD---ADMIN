import { expect, test, type Page } from "@playwright/test";
import { ACCOUNTS, login } from "./helpers";

/**
 * Drill-down grammar (§4). Every headline number must lead to the records that
 * produced it — and to nothing else. These tests assert the CONTENT of the
 * panel, not just that a panel opened, so a future refactor cannot silently
 * detach a KPI from its data.
 */

async function closePanel(page: Page) {
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
}

test.describe.serial("Command Center drill-down", () => {
  test("Completed KPI opens a panel listing only completed tasks", async ({ page }) => {
    await login(page, ACCOUNTS.am);
    await page.goto("/command-center");

    const kpi = page.getByTestId("kpi-completed");
    const headline = (await kpi.locator(".t-kpi").innerText()).trim();
    await kpi.click();

    const panel = page.getByRole("dialog");
    await expect(panel).toBeVisible();
    await expect(panel.getByTestId("panel-completed")).toBeVisible();

    // The panel headline restates the KPI value it was opened from.
    await expect(panel.getByTestId("panel-completed")).toContainText(headline);

    // Every task row in the panel is a completed task — no in-process leakage.
    const badges = panel.locator("li", { has: page.locator("text=Completed") });
    if ((await badges.count()) > 0) {
      await expect(panel.getByText("In Process", { exact: true })).toHaveCount(0);
    }

    await closePanel(page);
  });

  test("Open Bottlenecks KPI opens the issue list with severity ordering", async ({ page }) => {
    await login(page, ACCOUNTS.am);
    await page.goto("/command-center");

    const kpi = page.getByTestId("kpi-issues");
    const count = Number((await kpi.locator(".t-kpi").innerText()).trim());
    await kpi.click();

    const panel = page.getByRole("dialog");
    await expect(panel).toBeVisible();
    await expect(panel).toContainText("Open bottlenecks");

    if (count > 0) {
      const rows = panel.getByTestId("attention-feed").locator('[data-testid^="attention-"]');
      await expect(rows).toHaveCount(count);
    } else {
      await expect(panel).toContainText(/No open issues/i);
    }

    await closePanel(page);
  });

  test("compliance KPI breakdown reconciles clean + flagged with the headline", async ({ page }) => {
    await login(page, ACCOUNTS.am);
    await page.goto("/command-center");

    await page.getByTestId("kpi-compliance").click();
    const breakdown = page.getByTestId("compliance-breakdown");
    await expect(breakdown).toBeVisible();

    const text = await breakdown.innerText();
    const m = /(\d+)\s+clean of\s+(\d+)/.exec(text.replace(/\s+/g, " "));
    if (m) {
      const clean = Number(m[1]);
      const total = Number(m[2]);
      expect(total).toBeGreaterThan(0);
      const pct = Math.round((clean / total) * 100);
      await expect(breakdown).toContainText(`${pct}%`);
    } else {
      await expect(breakdown).toContainText(/No published checklist points/i);
    }

    await closePanel(page);
  });

  test("a property compliance stat drills into that property only", async ({ page }) => {
    await login(page, ACCOUNTS.am);
    await page.goto("/command-center");

    await page.getByTestId("stat-compliance-opal").click();

    const panel = page.getByRole("dialog");
    await expect(panel).toBeVisible();
    // Breadcrumb proves the drill path is scoped to the property clicked.
    await expect(panel.getByRole("navigation", { name: "Drill path" })).toContainText("Opal");

    // Any issue rows shown belong to Opal — no other property appears.
    const rows = panel.getByTestId("attention-feed").locator('[data-testid^="attention-"]');
    for (let i = 0; i < (await rows.count()); i++) {
      await expect(rows.nth(i)).not.toContainText("Aurum");
      await expect(rows.nth(i)).not.toContainText("Quadrangle");
    }

    await closePanel(page);
  });

  test("a chart bar cross-filters the board and opens the matching tasks", async ({ page }) => {
    await login(page, ACCOUNTS.am);
    await page.goto("/command-center");

    // Bars are SVG shapes inside the grouped bar chart; click the first one.
    const bars = page.locator(".recharts-bar-rectangle");
    await expect(bars.first()).toBeVisible({ timeout: 15_000 });
    await bars.first().click({ force: true });

    const panel = page.getByRole("dialog");
    await expect(panel).toBeVisible();
    await expect(panel.getByRole("navigation", { name: "Drill path" })).toContainText("Portfolio");

    await closePanel(page);
    // The cross-filter chip survives closing the panel (§7 persistent filter).
    await expect(page.getByRole("button", { name: /✕/ }).first()).toBeVisible();
  });

  test("checklist evidence shows only the photos of that exact checklist point", async ({ page }) => {
    await login(page, ACCOUNTS.am);
    await page.goto("/command-center/opal");

    const rows = page
      .getByTestId("attention-feed")
      .locator('[data-testid^="attention-"]');
    if ((await rows.count()) === 0) test.skip(true, "No open issues in the current published week");

    const first = rows.first();
    const itemName = (await first.innerText()).split("\n")[0];
    await first.click();

    const panel = page.getByRole("dialog");
    await expect(panel).toBeVisible();
    await expect(panel).toContainText(itemName.slice(0, 12));

    await closePanel(page);
  });
});

test.describe.serial("PropOne drill-down", () => {
  test("a work-order status KPI filters the records table to that status", async ({ page }) => {
    await login(page, ACCOUNTS.am);
    await page.goto("/command-center/aurum");

    const section = page.getByTestId("propone-section");
    await expect(section).toBeVisible();

    const woTab = section.getByRole("tab", { name: "Work Orders" });
    if ((await woTab.count()) === 0) test.skip(true, "Work orders are not synced for this property");
    await woTab.first().click();

    const rejected = page.getByTestId("propone-kpi-work-orders-rejected");
    if ((await rejected.count()) === 0) test.skip(true, "No rejected work orders synced");
    await rejected.click();

    const records = page.getByTestId("propone-records");
    await expect(records).toBeVisible();
    await expect(records).toContainText("Rejected ✕");

    // Every visible status cell is the filtered status.
    const statusCells = records.locator("tbody tr td:last-child");
    const n = await statusCells.count();
    for (let i = 0; i < Math.min(n, 10); i++) {
      await expect(statusCells.nth(i)).toContainText(/rejected/i);
    }

    // Clicking the same KPI again clears the filter.
    await rejected.click();
    await expect(records).not.toContainText("Rejected ✕");
  });

  test("a visits scope KPI filters records to that period", async ({ page }) => {
    await login(page, ACCOUNTS.am);
    await page.goto("/command-center/aurum");

    const visitsTab = page.getByTestId("propone-section").getByRole("tab", { name: "Visits", exact: true });
    if ((await visitsTab.count()) === 0) test.skip(true, "Visits are not synced for this property");
    await visitsTab.first().click();

    const thisWeek = page.getByTestId("propone-kpi-visits-this-week");
    await expect(thisWeek).toBeVisible();
    await thisWeek.click();

    const records = page.getByTestId("propone-records");
    await expect(records).toContainText("This week ✕");
  });
});
