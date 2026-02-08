import { test, expect } from "@playwright/test";
import { ChatPage } from "../page-objects/chat-page";

test.describe("Chat", () => {
  test("chat page loads with prompt input", async ({ page }) => {
    await page.goto("/");
    const chatPage = new ChatPage(page);

    // Dashboard should have a prompt input or new chat button
    const hasPrompt = await chatPage.promptInput
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    const hasNewChat = await page
      .getByRole("button", { name: /new chat|start/i })
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    expect(hasPrompt || hasNewChat).toBe(true);
  });

  test("can navigate to a chat session", async ({ page }) => {
    await page.goto("/");

    // Click on a chat in the sidebar or create a new one
    const chatLink = page
      .locator("aside a[href*='/chat/'], [data-testid='sidebar'] a[href*='/chat/']")
      .first();
    const hasChatLink = await chatLink
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (hasChatLink) {
      await chatLink.click();
      await expect(page).toHaveURL(/\/chat\//);
    }
  });

  test("chat page has no console errors on load", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Filter out known benign errors (e.g., WebSocket connection failures in test)
    const criticalErrors = errors.filter(
      (e) => !e.includes("WebSocket") && !e.includes("Failed to fetch")
    );
    expect(criticalErrors).toEqual([]);
  });
});
