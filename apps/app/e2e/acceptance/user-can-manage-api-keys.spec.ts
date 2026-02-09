import { test, expect, type Page } from "@playwright/test";
import { SettingsPage } from "../page-objects/settings-page";

/**
 * Acceptance test: User can manage API keys.
 *
 * Full flow:
 * 1. Navigate to dashboard
 * 2. Open settings dialog
 * 3. Navigate to Integrations tab
 * 4. See API Keys section
 * 5. Verify "Create Key" button is available
 */

async function setupApiKeysRoutes(page: Page) {
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
        body: JSON.stringify({
          result: {
            data: {
              json: [
                {
                  id: "key-1",
                  name: "Production Key",
                  keyPrefix: "rk_live_abc1...",
                  isActive: true,
                  totalRequests: 142,
                  lastUsedAt: new Date(
                    Date.now() - 3600000,
                  ).toISOString(),
                  createdAt: new Date(
                    Date.now() - 86400000 * 7,
                  ).toISOString(),
                },
                {
                  id: "key-2",
                  name: "Development Key",
                  keyPrefix: "rk_live_def2...",
                  isActive: false,
                  totalRequests: 8,
                  lastUsedAt: null,
                  createdAt: new Date(
                    Date.now() - 86400000 * 30,
                  ).toISOString(),
                },
              ],
            },
          },
        }),
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
    } else if (url.includes("billing")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ result: { data: { json: null } } }),
      });
    } else if (url.includes("user")) {
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

test.describe("Acceptance: User Can Manage API Keys", () => {
  test("navigates to Integrations tab and sees API Keys section", async ({
    page,
  }) => {
    await setupApiKeysRoutes(page);
    const settingsPage = new SettingsPage(page);
    await settingsPage.navigateTo("/");

    // Open settings directly to the integrations tab
    await settingsPage.openSettingsToTab("integrations");
    await expect(settingsPage.dialog).toBeVisible();

    // Verify the Integrations heading is visible
    const integrationsHeading = settingsPage.dialog.locator("h2, h3", {
      hasText: /integrations/i,
    });
    await expect(integrationsHeading.first()).toBeVisible({
      timeout: 5000,
    });

    // Verify "API Keys" section heading is visible
    const apiKeysHeading = settingsPage.dialog.locator("h3", {
      hasText: /api keys/i,
    });
    await expect(apiKeysHeading.first()).toBeVisible({ timeout: 5000 });
  });

  test("API Keys section shows existing keys from mock data", async ({
    page,
  }) => {
    await setupApiKeysRoutes(page);
    const settingsPage = new SettingsPage(page);
    await settingsPage.navigateTo("/");

    await settingsPage.openSettingsToTab("integrations");
    await expect(settingsPage.dialog).toBeVisible();

    // Wait for API keys to load
    const productionKey = settingsPage.dialog.locator("text=Production Key");
    await expect(productionKey).toBeVisible({ timeout: 5000 });

    // The development key should also be visible
    const developmentKey = settingsPage.dialog.locator(
      "text=Development Key",
    );
    await expect(developmentKey).toBeVisible({ timeout: 5000 });
  });

  test("API Keys section shows active/revoked badges", async ({ page }) => {
    await setupApiKeysRoutes(page);
    const settingsPage = new SettingsPage(page);
    await settingsPage.navigateTo("/");

    await settingsPage.openSettingsToTab("integrations");
    await expect(settingsPage.dialog).toBeVisible();

    // Wait for content to load
    const productionKey = settingsPage.dialog.locator("text=Production Key");
    await expect(productionKey).toBeVisible({ timeout: 5000 });

    // Should show "Active" and "Revoked" badges
    const activeBadge = settingsPage.dialog.locator("text=Active");
    await expect(activeBadge.first()).toBeVisible({ timeout: 3000 });

    const revokedBadge = settingsPage.dialog.locator("text=Revoked");
    await expect(revokedBadge.first()).toBeVisible({ timeout: 3000 });
  });

  test("Create Key button is visible", async ({ page }) => {
    await setupApiKeysRoutes(page);
    const settingsPage = new SettingsPage(page);
    await settingsPage.navigateTo("/");

    await settingsPage.openSettingsToTab("integrations");
    await expect(settingsPage.dialog).toBeVisible();

    // Wait for the section to load
    const apiKeysHeading = settingsPage.dialog.locator("h3", {
      hasText: /api keys/i,
    });
    await expect(apiKeysHeading.first()).toBeVisible({ timeout: 5000 });

    // Create Key button should be visible
    const createKeyButton = settingsPage.dialog.getByRole("button", {
      name: /create key/i,
    });
    await expect(createKeyButton).toBeVisible({ timeout: 3000 });
  });

  test("Webhooks section is also visible in Integrations tab", async ({
    page,
  }) => {
    await setupApiKeysRoutes(page);
    const settingsPage = new SettingsPage(page);
    await settingsPage.navigateTo("/");

    await settingsPage.openSettingsToTab("integrations");
    await expect(settingsPage.dialog).toBeVisible();

    // Webhooks section heading
    const webhooksHeading = settingsPage.dialog.locator("h3", {
      hasText: /webhooks/i,
    });
    await expect(webhooksHeading.first()).toBeVisible({ timeout: 5000 });

    // Add Webhook button
    const addWebhookButton = settingsPage.dialog.getByRole("button", {
      name: /add webhook/i,
    });
    await expect(addWebhookButton).toBeVisible({ timeout: 3000 });
  });
});
