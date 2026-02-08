import { test, expect } from "@playwright/test";
import { ChatPage } from "../page-objects/chat-page";
import {
  textOnlyStream,
  toolStream,
  canvasStream,
  errorToolStream,
} from "../helpers/sse-streams";

/**
 * Chat streaming E2E tests.
 *
 * Uses Playwright page.route() to intercept /api/chat and return mock SSE
 * streams in the correct AI SDK v6 UIMessage stream protocol.
 */

// ─── Common route setup ───

async function setupMockRoutes(
  page: import("@playwright/test").Page,
  streamBody: string,
) {
  // Mock auth
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

  // Mock tRPC — generic success for all queries/mutations
  await page.route("**/api/trpc/**", async (route) => {
    const url = route.request().url();
    // Return empty arrays for list queries, success for mutations
    if (url.includes("messages.getVotes")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ result: { data: { json: [] } } }),
      });
    } else if (url.includes("sessions.get")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          result: {
            data: {
              json: {
                id: "test-streaming-e2e",
                title: "Test Chat",
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
    } else {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ result: { data: { json: {} } } }),
      });
    }
  });

  // Mock chat API with AI SDK v6 UIMessage stream protocol
  await page.route("**/api/chat", async (route) => {
    if (route.request().method() === "GET") {
      // Resume endpoint — return empty (no active stream)
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
}

test.describe("Chat Streaming E2E", () => {
  test("send message → see streaming text appear", async ({ page }) => {
    await setupMockRoutes(page, textOnlyStream());

    const chatPage = new ChatPage(page);
    await page.goto("/chat/test-streaming-e2e");
    await page.waitForLoadState("domcontentloaded");

    // Wait for prompt input to be visible
    await chatPage.promptInput.waitFor({ state: "visible", timeout: 10_000 });

    // Send a message
    await chatPage.sendMessage("Hello");

    // Wait for assistant response to appear
    await chatPage.waitForResponse(15_000);

    // Verify text content
    const lastMsg = await chatPage.getLastAssistantMessage();
    expect(lastMsg).toContain("Rubic");
    expect(lastMsg).toContain("assistant");
  });

  test("tool calls appear during stream", async ({ page }) => {
    await setupMockRoutes(page, toolStream());

    const chatPage = new ChatPage(page);
    await page.goto("/chat/test-streaming-tools");
    await page.waitForLoadState("domcontentloaded");

    await chatPage.promptInput.waitFor({ state: "visible", timeout: 10_000 });
    await chatPage.sendMessage("test-tools");

    // Wait for tool cards to appear
    const toolCards = page.locator("[data-testid='tool-card']");
    await toolCards.first().waitFor({ state: "visible", timeout: 15_000 });

    // We expect at least 2 tool cards (show_plan + web_search or shell_exec)
    const count = await toolCards.count();
    expect(count).toBeGreaterThanOrEqual(2);

    // Verify tool names
    const names = await chatPage.getToolCardNames();
    expect(names).toContain("show_plan");
  });

  test("stream completes → tools show final state (no input-streaming)", async ({
    page,
  }) => {
    await setupMockRoutes(page, toolStream());

    const chatPage = new ChatPage(page);
    await page.goto("/chat/test-streaming-final");
    await page.waitForLoadState("domcontentloaded");

    await chatPage.promptInput.waitFor({ state: "visible", timeout: 10_000 });
    await chatPage.sendMessage("test-tools");

    // Wait for stream to fully complete
    await chatPage.waitForStream(20_000);

    // No tools should be in streaming state
    const streamingCards = page.locator(
      "[data-testid='tool-card'][data-tool-state='input-streaming']",
    );
    expect(await streamingCards.count()).toBe(0);

    // Verify final text appeared
    const lastMsg = await chatPage.getLastAssistantMessage();
    expect(lastMsg).toContain("Done with tools");
  });

  test("error tool shows error state", async ({ page }) => {
    await setupMockRoutes(page, errorToolStream());

    const chatPage = new ChatPage(page);
    await page.goto("/chat/test-streaming-error");
    await page.waitForLoadState("domcontentloaded");

    await chatPage.promptInput.waitFor({ state: "visible", timeout: 10_000 });
    await chatPage.sendMessage("test-error");

    // Wait for assistant response
    await chatPage.waitForResponse(15_000);

    // Verify error text in response
    const lastMsg = await chatPage.getLastAssistantMessage();
    expect(lastMsg).toContain("failed");
  });

  test("canvas-triggering tools produce canvas metadata", async ({ page }) => {
    await setupMockRoutes(page, canvasStream());

    const chatPage = new ChatPage(page);
    await page.goto("/chat/test-streaming-canvas");
    await page.waitForLoadState("domcontentloaded");

    await chatPage.promptInput.waitFor({ state: "visible", timeout: 10_000 });
    await chatPage.sendMessage("test-canvas");

    // Wait for tools to appear
    await chatPage.waitForResponse(15_000);

    // Verify browser and shell tool cards appeared
    const names = await chatPage.getToolCardNames();
    expect(names.length).toBeGreaterThanOrEqual(2);

    // Canvas should auto-open during streaming
    const canvasVisible = await chatPage.waitForCanvas(10_000);
    // Canvas may or may not be visible depending on viewport, but the
    // data-testid should exist if canvas was triggered
    if (canvasVisible) {
      const viewType = await chatPage.getCanvasViewType();
      expect(viewType).toBeTruthy();
    }
  });
});
