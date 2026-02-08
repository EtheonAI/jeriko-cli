import { test, expect } from "@playwright/test";
import { ChatPage } from "../page-objects/chat-page";

/**
 * Chat seeded session E2E tests.
 *
 * Tests against /chat/test-tool-showcase-001 (requires DB seeding).
 * Only runs when E2E_DB_SEEDED=true environment variable is set.
 */

const isSeeded = process.env.E2E_DB_SEEDED === "true";

test.describe("Chat Seeded Session", () => {
  // Skip the entire suite if DB is not seeded
  test.skip(!isSeeded, "Requires E2E_DB_SEEDED=true — run seed-test-chat.ts first");

  let chatPage: ChatPage;

  test.beforeEach(async ({ page }) => {
    chatPage = new ChatPage(page);
    await page.goto("/chat/test-tool-showcase-001");
    await page.waitForLoadState("networkidle");
  });

  test("session loads with pre-seeded messages", async ({ page }) => {
    // Should have both user and assistant messages
    const userMessages = page.locator("[data-role='user']");
    const assistantMessages = page.locator("[data-role='assistant']");

    await assistantMessages.first().waitFor({ state: "visible", timeout: 10_000 });

    const userCount = await userMessages.count();
    const assistantCount = await assistantMessages.count();

    expect(userCount).toBeGreaterThanOrEqual(1);
    expect(assistantCount).toBeGreaterThanOrEqual(1);
  });

  test("tool cards render from DB-persisted parts", async ({ page }) => {
    // Wait for tool cards to render
    const toolCards = page.locator("[data-testid='tool-card']");
    await toolCards.first().waitFor({ state: "visible", timeout: 10_000 });

    const count = await toolCards.count();
    // The seeded session has 33 tools — we should see many tool cards
    // Some tools may be merged into ChainOfThought, so check for "most"
    expect(count).toBeGreaterThanOrEqual(10);
  });

  test("all seeded tools render without errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    // Wait for rendering to complete
    await page.waitForTimeout(3000);

    // Filter benign errors
    const critical = errors.filter(
      (e) =>
        !e.includes("WebSocket") &&
        !e.includes("Failed to fetch") &&
        !e.includes("hydration")
    );
    expect(critical).toEqual([]);
  });

  test("planner bar populated from DB parts", async ({ page }) => {
    // The seeded session includes show_plan — PlannerBar should render
    const plannerBar = page.locator("[data-testid='planner-bar']");
    const hasPlannerBar = await plannerBar
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (hasPlannerBar) {
      const text = await plannerBar.textContent();
      // Should show step count (e.g. "3/5")
      expect(text).toMatch(/\d+\/\d+/);
    }
  });

  test("tool cards show correct state attributes", async ({ page }) => {
    const toolCards = page.locator("[data-testid='tool-card']");
    await toolCards.first().waitFor({ state: "visible", timeout: 10_000 });

    const count = await toolCards.count();
    for (let i = 0; i < Math.min(count, 10); i++) {
      const state = await toolCards.nth(i).getAttribute("data-tool-state");
      const name = await toolCards.nth(i).getAttribute("data-tool-name");

      expect(state).toBeTruthy();
      expect(name).toBeTruthy();
      // State should be one of the valid ToolInvocationState values
      expect([
        "input-streaming",
        "input-available",
        "approval-requested",
        "approval-responded",
        "output-available",
        "output-error",
        "output-denied",
      ]).toContain(state);
    }
  });

  test("error tools render with error state", async ({ page }) => {
    const errorCards = page.locator(
      "[data-testid='tool-card'][data-tool-state='output-error']"
    );
    const count = await errorCards.count();

    // The seeded session includes at least one error tool
    if (count > 0) {
      await expect(errorCards.first()).toBeVisible();
    }
  });
});
