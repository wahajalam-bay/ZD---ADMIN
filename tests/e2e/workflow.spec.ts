import { expect, test, type Page } from "@playwright/test";
import path from "node:path";
import { ACCOUNTS, expectToast, login, uniquePastDate, weekStartOf } from "./helpers";

/**
 * Full operational journey:
 *   Site user: checklist entry (OP/CL, defect + severity, EXACT-POINT photo) → submit
 *   AM: return → site user amends + resubmits → AM approves → publishes
 *   Command Center: bottleneck row shows the exact evidence photo; an
 *   unrelated issue in the same week does NOT show that photo.
 *   Weekly report: draft → submit → approve → publish → task table + summary live.
 */
const entryDate = uniquePastDate();
const week = weekStartOf(entryDate);
const FIXTURE = path.join(__dirname, "fixtures", "evidence.jpg");
const DEFECT_TEXT = `E2E: emergency stop unresponsive (${entryDate})`;
const CLEAN_ISSUE_TEXT = `E2E: generator room camera loose mount (${entryDate})`;
const TASK_TEXT = `E2E task: replace diesel gauge (${entryDate})`;
const SUMMARY_TEXT = `E2E weekly summary for ${week}`;

let uploadedThumbSrc: string | null = null;

test.describe.configure({ mode: "serial" });

async function acceptNextConfirm(page: Page) {
  page.once("dialog", (d) => d.accept());
}

test("site user files a checklist with defect + exact-point evidence and submits", async ({
  page,
}) => {
  await login(page, ACCOUNTS.opal);
  await page.goto(`/entry/opal/checklists/genset_operational?date=${entryDate}`);
  await expect(page.getByTestId("entry-table")).toBeVisible();

  // Mark every row OP+CL complete.
  const rowCount = await page.locator('[data-testid^="item-row-"]').count();
  for (let i = 0; i < rowCount; i++) {
    const row = page.getByTestId(`item-row-${i}`);
    await row.locator('input[type="checkbox"]').nth(0).check();
    await row.locator('input[type="checkbox"]').nth(1).check();
  }

  // Row 11 = "Emergency Stop Functional": defect + HIGH severity + photo.
  const defectRow = page.getByTestId("item-row-11");
  await expect(defectRow).toContainText("Emergency Stop Functional");
  await defectRow.locator('input[placeholder="Defect / comment"]').fill(DEFECT_TEXT);
  await defectRow.locator("select").selectOption("HIGH");

  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByTestId("photo-btn-11").click(),
  ]);
  await chooser.setFiles(FIXTURE);
  await expectToast(page, "Evidence photo attached");
  const thumb = defectRow.locator('img[src^="/api/media/"]').first();
  await expect(thumb).toBeVisible();
  uploadedThumbSrc = await thumb.getAttribute("src");
  expect(uploadedThumbSrc).toContain("/api/media/properties/");

  // Row 1 = "Generator Room Camera": unrelated defect WITHOUT a photo.
  const otherRow = page.getByTestId("item-row-1");
  await otherRow.locator('input[placeholder="Defect / comment"]').fill(CLEAN_ISSUE_TEXT);
  await otherRow.locator("select").selectOption("MEDIUM");

  // Sign-off + save draft.
  await page.getByLabel("Duty Electrician / Technician Sign").fill("E2E Technician");
  await page.getByTestId("save-draft").click();
  await expectToast(page, "Draft saved");

  // Submit for review.
  await acceptNextConfirm(page);
  await page.getByTestId("submit-entry").click();
  await expectToast(page, "Submitted for review");
});

test("site user files and submits the weekly report for the same week", async ({ page }) => {
  await login(page, ACCOUNTS.opal);
  await page.goto(`/entry/opal/weekly?week=${week}`);
  await expect(page.getByTestId("weekly-report-form")).toBeVisible();

  await page.getByRole("radio", { name: "Watch" }).click();
  await page.getByLabel("One-line summary (shown on the dashboard)").fill(SUMMARY_TEXT);
  await page.getByTestId("add-task").click();
  await page.getByLabel("Task 1 description").fill(TASK_TEXT);
  await page.getByLabel("Task 1 status").selectOption("IN_PROCESS");
  await page.getByTestId("weekly-save-draft").click();
  await expectToast(page, "Draft saved");

  await acceptNextConfirm(page);
  await page.getByTestId("weekly-submit").click();
  await expectToast(page, "submitted for review");
});

test("AM returns the checklist; site user amends and resubmits", async ({ page }) => {
  await login(page, ACCOUNTS.am);
  await page.goto(`/review?type=checklist&week=${week}`);
  const row = page.locator("tr").filter({ hasText: "Generator Checklist" }).filter({ hasText: entryDate });
  await expect(row.first()).toBeVisible();
  await row.first().getByRole("link", { name: "Open →" }).click();
  await expect(page.getByTestId("review-checklist-detail")).toBeVisible();
  await expect(page.getByText(DEFECT_TEXT)).toBeVisible();

  await page.getByTestId("return-btn").click();
  await page.getByTestId("return-reason-input").fill("E2E: please double-check the emergency stop reading");
  await page.getByTestId("return-confirm").click();
  await expectToast(page, "Returned to the site team");

  // Site user sees the return reason and can amend + resubmit.
  await page.context().clearCookies();
  await login(page, ACCOUNTS.opal);
  await page.goto(`/entry/opal/checklists/genset_operational?date=${entryDate}`);
  await expect(page.getByTestId("return-reason")).toContainText("double-check the emergency stop");
  await page.getByTestId("item-row-11").locator('input[placeholder="Defect / comment"]').fill(`${DEFECT_TEXT} — re-verified`);
  page.once("dialog", (d) => d.accept());
  await page.getByTestId("submit-entry").click();
  await expectToast(page, "Submitted for review");
});

test("AM approves and publishes checklist + weekly report", async ({ page }) => {
  await login(page, ACCOUNTS.am);

  // Checklist: approve then publish.
  await page.goto(`/review?type=checklist&week=${week}`);
  await page
    .locator("tr")
    .filter({ hasText: "Generator Checklist" })
    .filter({ hasText: entryDate })
    .first()
    .getByRole("link", { name: "Open →" })
    .click();
  await page.getByTestId("approve-btn").click();
  await expectToast(page, "Submission approved");
  await page.getByTestId("publish-btn").click();
  await expectToast(page, "Published");

  // Weekly report: approve then publish.
  await page.goto(`/review?type=weekly&week=${week}`);
  await page
    .locator("tr")
    .filter({ hasText: "Weekly Report" })
    .filter({ hasText: week })
    .first()
    .getByRole("link", { name: "Open →" })
    .click();
  await expect(page.getByTestId("review-weekly-detail")).toBeVisible();
  await page.getByTestId("approve-btn").click();
  await expectToast(page, "Submission approved");
  await page.getByTestId("publish-btn").click();
  await expectToast(page, "Published");
});

test("Command Center shows published data with EXACT evidence linkage", async ({ page }) => {
  await login(page, ACCOUNTS.am);
  await page.goto(`/command-center/opal?week=${week}`);
  await expect(page.getByTestId("property-dashboard-opal")).toBeVisible();

  // Published weekly data: summary + task table row.
  await expect(page.getByText(SUMMARY_TEXT)).toBeVisible();
  await expect(page.getByTestId("task-table")).toContainText(TASK_TEXT);

  // Bottlenecks: both defects appear.
  const bottleneckTable = page.getByTestId("bottleneck-table");
  const defectRow = bottleneckTable.locator("tr").filter({ hasText: "Emergency Stop Functional" });
  await expect(defectRow).toContainText("re-verified");
  await expect(defectRow).toContainText("High");
  const unrelatedRow = bottleneckTable.locator("tr").filter({ hasText: "Generator Room Camera" });
  await expect(unrelatedRow).toContainText(CLEAN_ISSUE_TEXT);

  // EXACT photo linkage: the defect row opens the uploaded photo…
  const evidenceButton = defectRow.locator('button[data-testid^="evidence-btn-"]');
  await expect(evidenceButton).toContainText("1 photo");
  await evidenceButton.click();
  const lightboxImg = page.locator('div[role="dialog"] img[src^="/api/media/"]');
  await expect(lightboxImg).toBeVisible();
  const mainSrc = await lightboxImg.getAttribute("src");
  // Thumb key = "<key>-thumb.jpg" of the main key — same random object id.
  const objectId = uploadedThumbSrc!.replace("-thumb", "");
  expect(mainSrc).toBe(objectId);
  await page.keyboard.press("Escape");

  // …and the unrelated issue has NO evidence attached to it.
  await expect(unrelatedRow.locator('button[data-testid^="evidence-btn-"]')).toHaveCount(0);
  await expect(unrelatedRow).toContainText("—");

  // Compliance donut reflects live entries for this week (1 flagged of 1).
  await expect(page.getByText("Checklist Compliance — Opal")).toBeVisible();
});
