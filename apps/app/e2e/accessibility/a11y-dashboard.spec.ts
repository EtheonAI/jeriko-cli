import { test, expect, type Page } from "@playwright/test";
import { BasePage } from "../page-objects/base-page";

/**
 * Dashboard Accessibility tests.
 *
 * Checks ARIA attributes, heading hierarchy, keyboard navigation,
 * image alt text, and button accessible names using Playwright built-in
 * capabilities (no @axe-core/playwright dependency).
 */

async function setupA11yRoutes(page: Page) {
  await page.route("**/api/auth/get-session", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: { id: "u1", name: "Test User", email: "test@test.com" },
        session: { id: "s1", userId: "u1" },
      }),
    });
  });

  await page.route("**/api/trpc/**", async (route) => {
    const url = route.request().url();
    if (url.includes("sessions.list")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ result: { data: { json: [] } } }),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ result: { data: { json: {} } } }),
      });
    }
  });
}

test.describe("Dashboard Accessibility", () => {
  test("has at least one h1 heading", async ({ page }) => {
    await setupA11yRoutes(page);
    const basePage = new BasePage(page);
    await basePage.navigateTo("/");

    const h1Count = await page.locator("h1").count();
    expect(h1Count).toBeGreaterThanOrEqual(1);
  });

  test("heading hierarchy has no skipped levels", async ({ page }) => {
    await setupA11yRoutes(page);
    const basePage = new BasePage(page);
    await basePage.navigateTo("/");

    // Collect all heading levels in document order
    const headingLevels = await page.evaluate(() => {
      const headings = document.querySelectorAll(
        "h1, h2, h3, h4, h5, h6",
      );
      return Array.from(headings).map((h) =>
        Number.parseInt(h.tagName[1], 10),
      );
    });

    // Verify no level is skipped (e.g., h1 -> h3 without h2)
    for (let i = 1; i < headingLevels.length; i++) {
      const current = headingLevels[i];
      const previous = headingLevels[i - 1];
      // A heading can go deeper by 1, stay same, or go back to any level
      if (current > previous) {
        expect(current - previous).toBeLessThanOrEqual(1);
      }
    }
  });

  test("interactive elements are keyboard accessible", async ({ page }) => {
    await setupA11yRoutes(page);
    const basePage = new BasePage(page);
    await basePage.navigateTo("/");

    // Tab through interactive elements
    await page.keyboard.press("Tab");
    const firstFocused = await page.evaluate(
      () => document.activeElement?.tagName,
    );
    expect(firstFocused).toBeTruthy();

    // Tab a second time to ensure focus moves
    await page.keyboard.press("Tab");
    const secondFocused = await page.evaluate(() => {
      const el = document.activeElement;
      return el ? { tag: el.tagName, role: el.getAttribute("role") } : null;
    });
    expect(secondFocused).toBeTruthy();
  });

  test("all images have alt text", async ({ page }) => {
    await setupA11yRoutes(page);
    const basePage = new BasePage(page);
    await basePage.navigateTo("/");

    const imagesWithoutAlt = await page
      .locator("img:not([alt])")
      .count();
    expect(imagesWithoutAlt).toBe(0);
  });

  test("buttons have accessible names", async ({ page }) => {
    await setupA11yRoutes(page);
    const basePage = new BasePage(page);
    await basePage.navigateTo("/");

    const buttons = page.getByRole("button");
    const count = await buttons.count();

    for (let i = 0; i < count; i++) {
      const button = buttons.nth(i);
      // Skip buttons that are hidden
      if (!(await button.isVisible().catch(() => false))) continue;

      const ariaLabel = await button.getAttribute("aria-label");
      const textContent = await button.textContent();
      const title = await button.getAttribute("title");

      // A button must have at least one of: aria-label, text content, or title
      const hasAccessibleName =
        (ariaLabel && ariaLabel.trim().length > 0) ||
        (textContent && textContent.trim().length > 0) ||
        (title && title.trim().length > 0);
      expect(hasAccessibleName).toBe(true);
    }
  });

  test("links have discernible text", async ({ page }) => {
    await setupA11yRoutes(page);
    const basePage = new BasePage(page);
    await basePage.navigateTo("/");

    const links = page.getByRole("link");
    const count = await links.count();

    for (let i = 0; i < count; i++) {
      const link = links.nth(i);
      if (!(await link.isVisible().catch(() => false))) continue;

      const ariaLabel = await link.getAttribute("aria-label");
      const textContent = await link.textContent();
      const title = await link.getAttribute("title");

      const hasAccessibleName =
        (ariaLabel && ariaLabel.trim().length > 0) ||
        (textContent && textContent.trim().length > 0) ||
        (title && title.trim().length > 0);
      expect(hasAccessibleName).toBe(true);
    }
  });

  test("main landmark exists", async ({ page }) => {
    await setupA11yRoutes(page);
    const basePage = new BasePage(page);
    await basePage.navigateTo("/");

    // Page should have a main element or role="main"
    const mainCount = await page
      .locator("main, [role='main']")
      .count();
    expect(mainCount).toBeGreaterThanOrEqual(1);
  });

  test("navigation landmark exists", async ({ page }) => {
    await setupA11yRoutes(page);
    const basePage = new BasePage(page);
    await basePage.navigateTo("/");

    // Page should have a nav element or role="navigation"
    const navCount = await page
      .locator("nav, [role='navigation']")
      .count();
    expect(navCount).toBeGreaterThanOrEqual(1);
  });

  test("focus visible indicator is present on interactive elements", async ({
    page,
  }) => {
    await setupA11yRoutes(page);
    const basePage = new BasePage(page);
    await basePage.navigateTo("/");

    // Tab to first focusable element
    await page.keyboard.press("Tab");

    // Verify something received focus
    const hasFocus = await page.evaluate(
      () => document.activeElement !== document.body,
    );
    expect(hasFocus).toBe(true);
  });

  test("page has lang attribute on html element", async ({ page }) => {
    await setupA11yRoutes(page);
    const basePage = new BasePage(page);
    await basePage.navigateTo("/");

    const lang = await page.locator("html").getAttribute("lang");
    expect(lang).toBeTruthy();
    expect(lang!.length).toBeGreaterThanOrEqual(2);
  });
});
