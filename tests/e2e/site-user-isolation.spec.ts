import { expect, test } from "@playwright/test";
import { ACCOUNTS, login } from "./helpers";

/**
 * SECURITY: server-side property isolation and privilege boundaries.
 * These assertions exercise the real server guards — not hidden links.
 */
test.describe("Site user isolation (Opal)", () => {
  test("site user lands on their own property and cannot reach others", async ({ page }) => {
    await login(page, ACCOUNTS.opal);

    // Landing redirects into the assigned property — no property chooser.
    await page.goto("/entry");
    await page.waitForURL(/\/entry\/opal/);
    await expect(page.getByTestId("entry-property-name")).toHaveText("Opal");

    // Forged URL: another property's entry area → server-rendered denial.
    await page.goto("/entry/aurum");
    await expect(page.getByTestId("access-denied")).toBeVisible();
    await page.goto("/entry/quadrangle");
    await expect(page.getByTestId("access-denied")).toBeVisible();
    await page.goto("/entry/aurum/checklists");
    await expect(page.getByTestId("access-denied")).toBeVisible();
    await page.goto("/entry/aurum/weekly");
    await expect(page.getByTestId("access-denied")).toBeVisible();
  });

  test("site user cannot access management or admin surfaces", async ({ page }) => {
    await login(page, ACCOUNTS.opal);
    for (const path of ["/command-center", "/command-center/opal", "/review", "/admin/users", "/admin/audit", "/admin/integrations", "/admin/properties"]) {
      await page.goto(path);
      await expect(page.getByTestId("access-denied"), `${path} must be denied`).toBeVisible();
    }
  });

  test("site user cannot call privileged auth-admin endpoints (vertical escalation)", async ({
    page,
  }) => {
    await login(page, ACCOUNTS.opal);
    // Attempt to promote self / create users via the Better Auth admin API.
    const setRole = await page.request.post("/api/auth/admin/set-role", {
      data: { userId: "self", role: "MANAGER_ADMIN" },
    });
    expect(setRole.ok()).toBeFalsy();
    const createUser = await page.request.post("/api/auth/admin/create-user", {
      data: {
        email: "hacker@zameen.local",
        password: "hacked12345",
        name: "Hacker",
        role: "MANAGER_ADMIN",
      },
    });
    expect(createUser.ok()).toBeFalsy();
    const listUsers = await page.request.post("/api/auth/admin/list-users", { data: {} });
    expect(listUsers.ok()).toBeFalsy();
  });

  test("site user cannot fetch another property's media objects", async ({ page, browser }) => {
    // Grab a real Aurum media URL as management first.
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await login(adminPage, ACCOUNTS.am);
    await adminPage.goto("/command-center/aurum");
    const src = await adminPage
      .locator('img[src^="/api/media/"]')
      .first()
      .getAttribute("src");
    await adminContext.close();
    expect(src).toBeTruthy();

    await login(page, ACCOUNTS.opal);
    const res = await page.request.get(src!);
    expect(res.status()).toBe(403);
  });

  test("assistant manager can access all properties; admin area stays closed", async ({ page }) => {
    await login(page, ACCOUNTS.am);
    for (const code of ["opal", "aurum", "quadrangle"]) {
      await page.goto(`/entry/${code}`);
      await expect(page.getByTestId("entry-property-name")).toBeVisible();
      await page.goto(`/command-center/${code}`);
      await expect(page.getByTestId(`property-dashboard-${code}`)).toBeVisible();
    }
    await page.goto("/admin/users");
    await expect(page.getByTestId("access-denied")).toBeVisible();
  });
});
