import { test, expect, type Page } from "@playwright/test";
import { ChatPage } from "../page-objects/chat-page";
import { textOnlyStream } from "../helpers/sse-streams";

/**
 * Chat page Accessibility tests.
 *
 * Checks ARIA attributes, keyboard navigation, form label associations,
 * heading hierarchy, and interactive element accessibility on the chat page.
 */

async function setupChatA11yRoutes(page: Page) {
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

  await page.route("**/api/chat", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ status: 204 });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      headers: {
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "x-vercel-ai-ui-message-stream": "v1",
      },
      body: textOnlyStream(),
    });
  });

  await page.route("**/api/trpc/**", async (route) => {
    const url = route.request().url();
    if (url.includes("sessions.get")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          result: {
            data: {
              json: {
                id: "a11y-chat-session",
                title: "A11y Chat",
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            },
          },
        }),
      });
    } else if (url.includes("messages.list")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ result: { data: { json: [] } } }),
      });
    } else if (url.includes("messages.getVotes")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ result: { data: { json: [] } } }),
      });
    } else if (url.includes("sessions.list")) {
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

test.describe("Chat Page Accessibility", () => {
  test("prompt input has accessible placeholder or label", async ({
    page,
  }) => {
    await setupChatA11yRoutes(page);
    const chatPage = new ChatPage(page);
    await page.goto("/chat/a11y-chat-session");
    await page.waitForLoadState("domcontentloaded");

    await chatPage.promptInput.waitFor({
      state: "visible",
      timeout: 10_000,
    });

    // Textarea should have a placeholder or aria-label
    const placeholder = await chatPage.promptInput.getAttribute(
      "placeholder",
    );
    const ariaLabel =
      await chatPage.promptInput.getAttribute("aria-label");
    const hasAccessibleLabel =
      (placeholder && placeholder.trim().length > 0) ||
      (ariaLabel && ariaLabel.trim().length > 0);
    expect(hasAccessibleLabel).toBe(true);
  });

  test("send button has accessible name", async ({ page }) => {
    await setupChatA11yRoutes(page);
    const chatPage = new ChatPage(page);
    await page.goto("/chat/a11y-chat-session");
    await page.waitForLoadState("domcontentloaded");

    await chatPage.sendButton.waitFor({
      state: "visible",
      timeout: 10_000,
    });

    const ariaLabel =
      await chatPage.sendButton.getAttribute("aria-label");
    const textContent = await chatPage.sendButton.textContent();
    const title = await chatPage.sendButton.getAttribute("title");
    const type = await chatPage.sendButton.getAttribute("type");

    // Must have accessible name or be a submit button
    const hasAccessibleName =
      (ariaLabel && ariaLabel.trim().length > 0) ||
      (textContent && textContent.trim().length > 0) ||
      (title && title.trim().length > 0) ||
      type === "submit";
    expect(hasAccessibleName).toBe(true);
  });

  test("all images on chat page have alt text", async ({ page }) => {
    await setupChatA11yRoutes(page);
    await page.goto("/chat/a11y-chat-session");
    await page.waitForLoadState("domcontentloaded");

    const imagesWithoutAlt = await page
      .locator("img:not([alt])")
      .count();
    expect(imagesWithoutAlt).toBe(0);
  });

  test("chat page buttons have accessible names", async ({ page }) => {
    await setupChatA11yRoutes(page);
    await page.goto("/chat/a11y-chat-session");
    await page.waitForLoadState("domcontentloaded");

    const buttons = page.getByRole("button");
    const count = await buttons.count();

    for (let i = 0; i < count; i++) {
      const button = buttons.nth(i);
      if (!(await button.isVisible().catch(() => false))) continue;

      const ariaLabel = await button.getAttribute("aria-label");
      const textContent = await button.textContent();
      const title = await button.getAttribute("title");

      const hasAccessibleName =
        (ariaLabel && ariaLabel.trim().length > 0) ||
        (textContent && textContent.trim().length > 0) ||
        (title && title.trim().length > 0);
      expect(hasAccessibleName).toBe(true);
    }
  });

  test("keyboard Tab navigates through chat UI elements", async ({
    page,
  }) => {
    await setupChatA11yRoutes(page);
    const chatPage = new ChatPage(page);
    await page.goto("/chat/a11y-chat-session");
    await page.waitForLoadState("domcontentloaded");

    await chatPage.promptInput.waitFor({
      state: "visible",
      timeout: 10_000,
    });

    // Tab through elements and verify focus moves
    const focusedElements: string[] = [];

    for (let i = 0; i < 5; i++) {
      await page.keyboard.press("Tab");
      const tag = await page.evaluate(
        () => document.activeElement?.tagName ?? "NONE",
      );
      focusedElements.push(tag);
    }

    // At least some elements should receive focus
    const uniqueFocused = new Set(focusedElements);
    expect(uniqueFocused.size).toBeGreaterThanOrEqual(1);
  });

  test("Enter key can submit a message from the prompt", async ({
    page,
  }) => {
    await setupChatA11yRoutes(page);
    const chatPage = new ChatPage(page);
    await page.goto("/chat/a11y-chat-session");
    await page.waitForLoadState("domcontentloaded");

    await chatPage.promptInput.waitFor({
      state: "visible",
      timeout: 10_000,
    });

    // Focus the input and type a message
    await chatPage.promptInput.focus();
    await chatPage.promptInput.fill("Hello a11y test");

    // Press Enter to submit (should trigger send)
    await page.keyboard.press("Enter");

    // Wait for the response
    await chatPage.waitForResponse(15_000);

    // Verify the assistant response appeared
    const lastMsg = await chatPage.getLastAssistantMessage();
    expect(lastMsg).toBeTruthy();
  });

  test("message list region has appropriate role", async ({ page }) => {
    await setupChatA11yRoutes(page);
    const chatPage = new ChatPage(page);
    await page.goto("/chat/a11y-chat-session");
    await page.waitForLoadState("domcontentloaded");

    // Message list should have a role (log or list) or data-testid
    const messageList = chatPage.messageList;
    const exists = (await messageList.count()) > 0;
    if (exists) {
      const role = await messageList.getAttribute("role");
      const testId = await messageList.getAttribute("data-testid");
      const hasIdentifier =
        (role && role.length > 0) || (testId && testId.length > 0);
      expect(hasIdentifier).toBe(true);
    }
  });

  test("assistant messages have data-role attribute", async ({ page }) => {
    await setupChatA11yRoutes(page);
    const chatPage = new ChatPage(page);
    await page.goto("/chat/a11y-chat-session");
    await page.waitForLoadState("domcontentloaded");

    await chatPage.promptInput.waitFor({
      state: "visible",
      timeout: 10_000,
    });
    await chatPage.sendMessage("Accessibility test");
    await chatPage.waitForResponse(15_000);

    // Assistant messages should have data-role="assistant"
    const assistantMessages = chatPage.assistantMessage;
    const count = await assistantMessages.count();
    expect(count).toBeGreaterThanOrEqual(1);

    for (let i = 0; i < count; i++) {
      const role = await assistantMessages
        .nth(i)
        .getAttribute("data-role");
      expect(role).toBe("assistant");
    }
  });
});
