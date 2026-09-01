import { expect, test } from "@playwright/test";
import { ACCOUNTS, expectToast, login } from "./helpers";

/** Manager/Admin: create a site user, assign property, disable, audit trail. */
test("manager creates, assigns and disables a site user with audit records", async ({ page }) => {
  const email = `e2e.user.${Date.now()}@zameen.local`;

  await login(page, ACCOUNTS.admin);
  await page.goto("/admin/users");
  await expect(page.getByTestId("users-table")).toBeVisible();

  // Create a new Aurum site user.
  await page.getByTestId("create-user-open").click();
  await page.getByTestId("cu-name").fill("E2E Test Site User");
  await page.getByTestId("cu-email").fill(email);
  await page.getByTestId("cu-password").fill("E2ePassword123!");
  await page.getByTestId("cu-role").selectOption("SITE_USER");
  await page.getByTestId("cu-property").selectOption({ label: "Aurum" });
  await page.getByTestId("cu-submit").click();
  await expectToast(page, "created");

  const row = page.getByTestId(`user-row-${email}`);
  await expect(row).toBeVisible();
  await expect(row).toContainText("Aurum");
  await expect(row).toContainText("Site User");

  // New user can sign in and is confined to Aurum.
  const userContext = await page.context().browser()!.newContext();
  const userPage = await userContext.newPage();
  await userPage.goto("/login");
  await userPage.getByLabel("Email").fill(email);
  await userPage.getByLabel("Password").fill("E2ePassword123!");
  await userPage.getByRole("button", { name: "Sign in" }).click();
  await userPage.waitForURL((u) => !u.pathname.startsWith("/login"));
  await userPage.goto("/entry");
  await userPage.waitForURL(/\/entry\/aurum/);
  await userPage.goto("/entry/opal");
  await expect(userPage.getByTestId("access-denied")).toBeVisible();
  await userContext.close();

  // Disable the account through the row's ⋯ action menu.
  page.once("dialog", (d) => d.accept());
  await page.getByTestId(`user-actions-${email}`).click();
  await page.getByRole("menuitem", { name: "Disable account" }).click();
  await expectToast(page, "disabled");
  await expect(row).toContainText("Disabled");

  // Disabled user can no longer sign in.
  const disabledContext = await page.context().browser()!.newContext();
  const disabledPage = await disabledContext.newPage();
  await disabledPage.goto("/login");
  await disabledPage.getByLabel("Email").fill(email);
  await disabledPage.getByLabel("Password").fill("E2ePassword123!");
  await disabledPage.getByRole("button", { name: "Sign in" }).click();
  await expect(disabledPage.getByRole("alert")).toBeVisible();
  await disabledContext.close();

  // Audit log recorded both actions (rendered as human sentences).
  await page.goto("/admin/audit?action=user.created");
  await expect(page.getByTestId("audit-table")).toContainText(email);
  await page.goto("/admin/audit?action=user.disabled");
  await expect(page.getByTestId("audit-table")).toContainText("Disabled a user");
});
