import { test, expect } from "@playwright/test";

test.describe("Smoke Tests", () => {
  test("homepage loads and redirects authenticated user", async ({ page }) => {
    await page.goto("/");
    await expect(page).not.toHaveURL(/login/);
    await expect(page.locator("body")).toBeVisible();
  });

  test("sidebar navigation is visible", async ({ page }) => {
    await page.goto("/");
    const sidebar = page.locator("aside, [data-testid='sidebar']").first();
    await expect(sidebar).toBeVisible();
  });

  test("critical pages load without errors", async ({ page }) => {
    const criticalPaths = ["/", "/devices", "/applications", "/files"];
    const errors: string[] = [];

    page.on("pageerror", (error) => {
      errors.push(`${error.message} on ${page.url()}`);
    });

    for (const path of criticalPaths) {
      await page.goto(path);
      await page.waitForLoadState("domcontentloaded");
    }

    expect(errors).toEqual([]);
  });
});
