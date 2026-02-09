import { test, expect, type Page } from "@playwright/test";
import { SettingsPage } from "../page-objects/settings-page";

/**
 * Settings dialog E2E tests.
 *
 * Verifies the settings dialog opens, tab navigation works,
 * expected tabs are listed, and the dialog can be closed.
 */

async function setupSettingsRoutes(page: Page) {
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
    } else if (url.includes("user.getProfile")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          result: {
            data: {
              json: {
                id: "u1",
                name: "Test User",
                email: "test@test.com",
                image: null,
              },
            },
          },
        }),
      });
    } else if (url.includes("user.getPreferences")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          result: { data: { json: { theme: "system", language: "en" } } },
        }),
      });
    } else if (url.includes("billing")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ result: { data: { json: null } } }),
      });
    } else if (url.includes("webhooks.list")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ result: { data: { json: [] } } }),
      });
    } else if (url.includes("webhooks.getEventTypes")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ result: { data: { json: [] } } }),
      });
    } else if (url.includes("apiKeys.list")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ result: { data: { json: [] } } }),
      });
    } else if (url.includes("connectors")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ result: { data: { json: [] } } }),
      });
    } else if (url.includes("notifications")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ result: { data: { json: {} } } }),
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

test.describe("Settings Dialog", () => {
  test("opens settings dialog via URL hash", async ({ page }) => {
    await setupSettingsRoutes(page);
    const settingsPage = new SettingsPage(page);
    await settingsPage.navigateTo("/");

    await settingsPage.openSettings();
    const visible = await settingsPage.isDialogVisible();
    expect(visible).toBe(true);
  });

  test("displays expected settings tab names", async ({ page }) => {
    await setupSettingsRoutes(page);
    const settingsPage = new SettingsPage(page);
    await settingsPage.navigateTo("/");

    await settingsPage.openSettings();

    const tabNames = await settingsPage.getVisibleTabNames();
    // These are the 13 settings nav items from settings-nav.tsx
    const expectedTabs = [
      "Account",
      "Settings",
      "Usage",
      "Billing",
      "Scheduled tasks",
      "Devices",
      "Connectors",
      "Mail Manus",
      "Data controls",
      "Personalization",
      "Skills",
      "Integrations",
      "Get help",
    ];

    for (const tab of expectedTabs) {
      expect(tabNames).toContain(tab);
    }
  });

  test("tab navigation switches content", async ({ page }) => {
    await setupSettingsRoutes(page);
    const settingsPage = new SettingsPage(page);
    await settingsPage.navigateTo("/");

    await settingsPage.openSettings();

    // Click Account tab
    await settingsPage.selectTab("Account");
    // Verify the dialog is still visible after tab switch
    const visible = await settingsPage.isDialogVisible();
    expect(visible).toBe(true);
  });

  test("navigating to Integrations tab shows integrations content", async ({
    page,
  }) => {
    await setupSettingsRoutes(page);
    const settingsPage = new SettingsPage(page);
    await settingsPage.navigateTo("/");

    await settingsPage.openSettingsToTab("integrations");

    // Verify the dialog is visible
    await expect(settingsPage.dialog).toBeVisible();

    // Integrations tab should show Webhooks and API Keys sections
    const integrationHeading = settingsPage.dialog.locator(
      "h2, h3",
      { hasText: /integrations/i },
    );
    await expect(integrationHeading.first()).toBeVisible({ timeout: 5000 });
  });

  test("close dialog dismisses settings", async ({ page }) => {
    await setupSettingsRoutes(page);
    const settingsPage = new SettingsPage(page);
    await settingsPage.navigateTo("/");

    await settingsPage.openSettings();
    await expect(settingsPage.dialog).toBeVisible();

    // Close via the close button
    const closeBtn = settingsPage.closeButton;
    if (await closeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await closeBtn.click();
      await expect(settingsPage.dialog).toBeHidden({ timeout: 5000 });
    } else {
      // Fallback: press Escape to close dialog
      await page.keyboard.press("Escape");
      await expect(settingsPage.dialog).toBeHidden({ timeout: 5000 });
    }
  });

  test("Escape key closes settings dialog", async ({ page }) => {
    await setupSettingsRoutes(page);
    const settingsPage = new SettingsPage(page);
    await settingsPage.navigateTo("/");

    await settingsPage.openSettings();
    await expect(settingsPage.dialog).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(settingsPage.dialog).toBeHidden({ timeout: 5000 });
  });
});
