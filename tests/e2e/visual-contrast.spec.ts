import { expect, test } from "@playwright/test";
import { ACCOUNTS, login } from "./helpers";

/**
 * Regression guard for a class of silent CSS failures: Tailwind arbitrary
 * values like `bg-[var(--grad-green)]` compile to `background-color`, which is
 * invalid for a gradient, so the element paints nothing and white text lands on
 * a white surface. These tests assert that branded surfaces actually paint.
 */
test.describe("Branded surfaces paint", () => {
  test("login hero renders behind the brand block so the title is readable", async ({ page }) => {
    await page.goto("/login");

    const title = page.getByRole("heading", { name: "Zameen Developments" });
    await expect(title).toBeVisible();

    // The brand title is white; the pixel behind it must be the dark hero.
    const box = (await title.boundingBox())!;
    const behind = await page.evaluate(
      ([x, y]) => {
        const stack = document.elementsFromPoint(x as number, y as number);
        for (const el of stack) {
          const bg = getComputedStyle(el).backgroundColor;
          const img = getComputedStyle(el).backgroundImage;
          if (img && img !== "none") return img;
          if (bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") return bg;
        }
        return "none";
      },
      [box.x + 4, box.y + box.height / 2],
    );
    expect(behind).toMatch(/gradient/);
  });

  test("the primary sign-in button paints its gradient", async ({ page }) => {
    await page.goto("/login");
    const button = page.getByRole("button", { name: "Sign in" });
    const image = await button.evaluate((el) => getComputedStyle(el).backgroundImage);
    expect(image).toMatch(/gradient/);
  });

  test("the active Data Entry tab paints its gradient behind the white label", async ({ page }) => {
    await login(page, ACCOUNTS.opal);
    await page.goto("/entry/opal/checklists");
    const active = page
      .getByLabel("Entry sections")
      .getByRole("link", { name: "Daily Checklists" });
    const image = await active.evaluate((el) => getComputedStyle(el).backgroundImage);
    expect(image).toMatch(/gradient/);
  });

  test("the sidebar avatar paints its gradient rather than showing through", async ({ page }) => {
    await login(page, ACCOUNTS.am);
    await page.goto("/command-center");
    const avatar = page.locator('aside span[class*="rounded-\\[9px\\]"]').first();
    const image = await avatar.evaluate((el) => getComputedStyle(el).backgroundImage);
    expect(image).toMatch(/gradient/);
  });
});
