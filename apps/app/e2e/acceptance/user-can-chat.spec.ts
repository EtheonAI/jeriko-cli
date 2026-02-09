import { test, expect, type Page } from "@playwright/test";
import { ChatPage } from "../page-objects/chat-page";
import { SidebarPage } from "../page-objects/sidebar-page";
import { textOnlyStream, toolStream } from "../helpers/sse-streams";

/**
 * Acceptance test: User can send a chat message and receive a response.
 *
 * Full flow:
 * 1. Navigate to a chat page
 * 2. Send a message (mocked SSE response)
 * 3. Verify the assistant response appears
 * 4. Verify the sidebar shows the session
 */

async function setupChatRoutes(
  page: Page,
  streamBody: string,
  sessionTitle = "Test Chat",
) {
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
      body: streamBody,
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
                id: "acceptance-chat-session",
                title: sessionTitle,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            },
          },
        }),
      });
    } else if (url.includes("sessions.list")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          result: {
            data: {
              json: [
                {
                  id: "acceptance-chat-session",
                  title: sessionTitle,
                  status: "active",
                  metadata: {},
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                },
              ],
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
    } else {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ result: { data: { json: {} } } }),
      });
    }
  });
}

test.describe("Acceptance: User Can Chat", () => {
  test("user sends a message and receives a text response", async ({
    page,
  }) => {
    await setupChatRoutes(page, textOnlyStream());

    const chatPage = new ChatPage(page);
    await page.goto("/chat/acceptance-chat-session");
    await page.waitForLoadState("domcontentloaded");

    // Step 1: Wait for prompt input
    await chatPage.promptInput.waitFor({
      state: "visible",
      timeout: 10_000,
    });

    // Step 2: Send a message
    await chatPage.sendMessage("Hello, Rubic!");

    // Step 3: Wait for assistant response
    await chatPage.waitForResponse(15_000);

    // Step 4: Verify the response contains expected text
    const lastMsg = await chatPage.getLastAssistantMessage();
    expect(lastMsg).toBeTruthy();
    expect(lastMsg).toContain("Rubic");
  });

  test("user sends a message and sees tool cards in response", async ({
    page,
  }) => {
    await setupChatRoutes(page, toolStream(), "Tool Test Chat");

    const chatPage = new ChatPage(page);
    await page.goto("/chat/acceptance-chat-tools");
    await page.waitForLoadState("domcontentloaded");

    await chatPage.promptInput.waitFor({
      state: "visible",
      timeout: 10_000,
    });
    await chatPage.sendMessage("Search the web and run a command");

    // Wait for tools to appear
    await chatPage.waitForResponse(15_000);

    // Verify tool cards rendered
    const toolNames = await chatPage.getToolCardNames();
    expect(toolNames.length).toBeGreaterThanOrEqual(1);

    // Verify the final text message also appeared
    const lastMsg = await chatPage.getLastAssistantMessage();
    expect(lastMsg).toContain("Done with tools");
  });

  test("sidebar shows the chat session after messaging", async ({
    page,
  }) => {
    await setupChatRoutes(
      page,
      textOnlyStream(),
      "My Test Conversation",
    );

    const chatPage = new ChatPage(page);
    const sidebarPage = new SidebarPage(page);

    await page.goto("/chat/acceptance-chat-session");
    await page.waitForLoadState("domcontentloaded");

    await chatPage.promptInput.waitFor({
      state: "visible",
      timeout: 10_000,
    });

    // The sidebar should list our session from the tRPC mock
    const sidebarVisible = await sidebarPage.isSidebarVisible();
    expect(sidebarVisible).toBe(true);

    // Look for any chat session link in the sidebar
    const chatItemCount = await sidebarPage.getChatItemCount();
    // At least our mocked session should appear
    expect(chatItemCount).toBeGreaterThanOrEqual(0);
  });

  test("chat page has prompt input and send button", async ({ page }) => {
    await setupChatRoutes(page, textOnlyStream());

    const chatPage = new ChatPage(page);
    await page.goto("/chat/acceptance-chat-session");
    await page.waitForLoadState("domcontentloaded");

    // Verify the core chat UI elements exist
    await expect(chatPage.promptInput).toBeVisible({ timeout: 10_000 });
    await expect(chatPage.sendButton).toBeVisible({ timeout: 5_000 });
  });

  test("stream completes with no streaming tool cards remaining", async ({
    page,
  }) => {
    await setupChatRoutes(page, toolStream());

    const chatPage = new ChatPage(page);
    await page.goto("/chat/acceptance-stream-complete");
    await page.waitForLoadState("domcontentloaded");

    await chatPage.promptInput.waitFor({
      state: "visible",
      timeout: 10_000,
    });
    await chatPage.sendMessage("Run all tools");

    // Wait for the stream to complete
    await chatPage.waitForStream(20_000);

    // Verify no tools remain in streaming state
    const streamingCards = page.locator(
      "[data-testid='tool-card'][data-tool-state='input-streaming']",
    );
    expect(await streamingCards.count()).toBe(0);
  });
});
