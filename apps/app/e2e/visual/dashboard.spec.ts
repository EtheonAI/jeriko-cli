import { test, expect, type Page } from "@playwright/test";
import { BasePage } from "../page-objects/base-page";
import { SidebarPage } from "../page-objects/sidebar-page";

/**
 * Visual regression tests for the dashboard.
 *
 * Uses Playwright's toHaveScreenshot() with maxDiffPixels tolerance
 * to catch unintended visual changes. Screenshots are stored in
 * e2e/visual/dashboard.spec.ts-snapshots/ and committed to git.
 *
 * Run `pnpm test:e2e --project visual-regression --update-snapshots`
 * to create/update baseline screenshots.
 */

async function setupVisualRoutes(page: Page) {
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
        body: JSON.stringify({
          result: {
            data: {
              json: [
                {
                  id: "vis-session-1",
                  title: "Visual Regression Chat",
                  status: "active",
                  metadata: {},
                  createdAt: "2026-02-01T12:00:00.000Z",
                  updatedAt: "2026-02-01T12:00:00.000Z",
                },
                {
                  id: "vis-session-2",
                  title: "Another Chat",
                  status: "active",
                  metadata: {},
                  createdAt: "2026-01-28T12:00:00.000Z",
                  updatedAt: "2026-01-28T12:00:00.000Z",
                },
              ],
            },
          },
        }),
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

test.describe("Visual Regression: Dashboard", () => {
  test("dashboard full page screenshot", async ({ page }) => {
    await setupVisualRoutes(page);
    const basePage = new BasePage(page);
    await basePage.navigateTo("/");

    // Wait for content to settle
    await page.waitForLoadState("networkidle");

    // Mask dynamic content that changes between runs (timestamps, etc.)
    await expect(page).toHaveScreenshot("dashboard-full.png", {
      maxDiffPixels: 500,
      mask: [
        // Mask any relative-time elements that may change
        page.locator("time, [data-testid='relative-time']"),
      ],
    });
  });

  test("sidebar screenshot", async ({ page }) => {
    await setupVisualRoutes(page);
    const sidebarPage = new SidebarPage(page);
    await sidebarPage.navigateTo("/");

    await page.waitForLoadState("networkidle");

    // Take a screenshot of just the sidebar
    const sidebar = sidebarPage.sidebarRoot;
    if (await sidebar.isVisible()) {
      await expect(sidebar).toHaveScreenshot("sidebar.png", {
        maxDiffPixels: 300,
        mask: [
          sidebar.locator("time, [data-testid='relative-time']"),
        ],
      });
    }
  });

  test("dashboard hero section screenshot", async ({ page }) => {
    await setupVisualRoutes(page);
    const basePage = new BasePage(page);
    await basePage.navigateTo("/");

    await page.waitForLoadState("networkidle");

    // Screenshot the main content area (hero text + chat input)
    const main = page.locator("main").first();
    if (await main.isVisible()) {
      await expect(main).toHaveScreenshot("dashboard-hero.png", {
        maxDiffPixels: 300,
      });
    }
  });

  test("dashboard header screenshot", async ({ page }) => {
    await setupVisualRoutes(page);
    const basePage = new BasePage(page);
    await basePage.navigateTo("/");

    await page.waitForLoadState("networkidle");

    const header = basePage.header;
    if (await header.isVisible()) {
      await expect(header).toHaveScreenshot("dashboard-header.png", {
        maxDiffPixels: 200,
      });
    }
  });
});
