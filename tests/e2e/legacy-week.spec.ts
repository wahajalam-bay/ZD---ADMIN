import { expect, test } from "@playwright/test";
import { ACCOUNTS, login } from "./helpers";

const WEEK = "2026-08-17";

/**
 * The legacy Command Center deck ("Week of 20 Aug 2026") is merged into the
 * tool verbatim. These tests assert the merged week renders the deck's own
 * figures and text, so a regression in the reporting-week pipeline is caught
 * against a known, externally-verifiable dataset.
 */
test.describe.serial("Legacy Command Center week", () => {
  test("portfolio shows the deck's 15 completed / 9 in process", async ({ page }) => {
    await login(page, ACCOUNTS.am);
    await page.goto(`/command-center?week=${WEEK}`);

    await expect(page.getByTestId("kpi-completed").locator(".t-kpi")).toHaveText("15");
    await expect(page.getByTestId("kpi-in-process").locator(".t-kpi")).toHaveText("9");
    await expect(page.getByTestId("kpi-photos").locator(".t-kpi")).toHaveText("146");
    // 12 flagged checklist points across the portfolio, exactly as the deck listed.
    await expect(page.getByTestId("kpi-issues").locator(".t-kpi")).toHaveText("12");
  });

  test("each property card carries the deck's task split", async ({ page }) => {
    await login(page, ACCOUNTS.am);
    await page.goto(`/command-center?week=${WEEK}`);

    const expected = [
      { code: "opal", completed: "9", inProcess: "3", photos: "45" },
      { code: "aurum", completed: "3", inProcess: "2", photos: "42" },
      { code: "quadrangle", completed: "3", inProcess: "4", photos: "59" },
    ];
    for (const e of expected) {
      await expect(page.getByTestId(`stat-completed-${e.code}`)).toContainText(e.completed);
      await expect(page.getByTestId(`stat-in-process-${e.code}`)).toContainText(e.inProcess);
      await expect(page.getByTestId(`stat-photos-${e.code}`)).toContainText(e.photos);
    }
  });

  test("Opal's task table lists the deck's tasks verbatim", async ({ page }) => {
    await login(page, ACCOUNTS.am);
    await page.goto(`/command-center/opal?week=${WEEK}`);

    const table = page.getByTestId("task-table");
    await expect(table.locator("tbody tr")).toHaveCount(12);
    await expect(table).toContainText("B1 interior paint work has been completed");
    await expect(table).toContainText(
      "The cracked cargo elevator supporting pulley has been removed and sent for replacement",
    );
    await expect(table).toContainText("ACB breaker replacement");
    // dd-MM-yyyy, exactly as the deck printed it.
    await expect(table).toContainText("12-08-2026");
  });

  test("Aurum's bottleneck table carries the deck's issues and severities", async ({ page }) => {
    await login(page, ACCOUNTS.am);
    await page.goto(`/command-center/aurum?week=${WEEK}`);

    const table = page.getByTestId("bottleneck-table");
    await expect(table.locator("tbody tr")).toHaveCount(6);
    await expect(table).toContainText('"2-3 cameras faulty" noted daily Mon-Sun');
    await expect(table).toContainText("Next visit date and notes still blank (recurring)");
    await expect(table).toContainText("Date field left blank (recurring)");
    await expect(table).toContainText("High");
    await expect(table).toContainText("Low");
  });

  test("Quadrangle's summary is the deck's PropOne paragraph", async ({ page }) => {
    await login(page, ACCOUNTS.am);
    await page.goto(`/command-center/quadrangle?week=${WEEK}`);
    await expect(page.getByText(/17 work orders \(14 completed, 3 rejected\)/)).toBeVisible();
    await expect(page.getByText(/11 snooker bookings, all attended/)).toBeVisible();
  });
});
