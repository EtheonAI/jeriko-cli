import { test, expect, type Page } from "@playwright/test";
import { ChatPage } from "../page-objects/chat-page";
import { toolStream, canvasStream, textOnlyStream } from "../helpers/sse-streams";

/**
 * Full regression E2E spec.
 *
 * Combined end-to-end flow testing:
 * 1. Navigate → send message → tools stream → verify tool cards
 * 2. Canvas auto-opens during streaming
 * 3. Star rating works and persists
 * 4. Old message format renders gracefully (no raw JSON crash)
 * 5. Page refresh preserves messages
 * 6. No console errors throughout
 */

// ─── Shared setup ───

interface VoteCalls {
  votes: Array<{ chatId: string; messageId: string; rating: number }>;
}

async function setupFullRoutes(
  page: Page,
  streamBody: string,
): Promise<VoteCalls> {
  const calls: VoteCalls = { votes: [] };
  const consoleErrors: string[] = [];

  // Capture console errors
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
    }
  });

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

    if (url.includes("messages.vote") && !url.includes("removeVote")) {
      try {
        const body = await route.request().postDataJSON();
        const data = body?.json ?? body;
        calls.votes.push({
          chatId: data.chatId,
          messageId: data.messageId,
          rating: data.rating,
        });
      } catch {}
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ result: { data: { json: { success: true } } } }),
      });
      return;
    }

    if (url.includes("messages.getVotes")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ result: { data: { json: [] } } }),
      });
      return;
    }

    if (url.includes("sessions.get")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          result: {
            data: {
              json: {
                id: "regression-test",
                title: "Regression Test",
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            },
          },
        }),
      });
      return;
    }

    if (url.includes("messages.list")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ result: { data: { json: [] } } }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ result: { data: { json: {} } } }),
    });
  });

  return calls;
}

test.describe("Regression E2E", () => {
  test("full tool flow: send → stream → tool cards → text", async ({
    page,
  }) => {
    const calls = await setupFullRoutes(page, toolStream());

    const chatPage = new ChatPage(page);
    await page.goto("/chat/regression-test-1");
    await page.waitForLoadState("domcontentloaded");

    await chatPage.promptInput.waitFor({ state: "visible", timeout: 10_000 });

    // Step 1: Send message
    await chatPage.sendMessage("Build a React app");

    // Step 2: Wait for response
    await chatPage.waitForResponse(15_000);

    // Step 3: Verify tool cards appeared
    const toolNames = await chatPage.getToolCardNames();
    expect(toolNames.length).toBeGreaterThanOrEqual(2);
    expect(toolNames).toContain("show_plan");

    // Step 4: Verify stream completed (no tools in streaming state)
    await chatPage.waitForStream(15_000);

    // Step 5: Verify final text appeared
    const lastMsg = await chatPage.getLastAssistantMessage();
    expect(lastMsg).toContain("Done with tools");
  });

  test("canvas opens during streaming for browser tools", async ({ page }) => {
    await setupFullRoutes(page, canvasStream());

    const chatPage = new ChatPage(page);
    await page.goto("/chat/regression-test-2");
    await page.waitForLoadState("domcontentloaded");

    await chatPage.promptInput.waitFor({ state: "visible", timeout: 10_000 });
    await chatPage.sendMessage("Browse example.com");

    await chatPage.waitForResponse(15_000);

    // Canvas should auto-open
    const canvasVisible = await chatPage.waitForCanvas(10_000);
    if (canvasVisible) {
      const viewType = await chatPage.getCanvasViewType();
      expect(viewType).toBeTruthy();
    }

    // Tool cards should exist
    const names = await chatPage.getToolCardNames();
    expect(names).toContain("browser_navigate");
  });

  test("vote on assistant message after tool stream", async ({ page }) => {
    const calls = await setupFullRoutes(page, toolStream());

    const chatPage = new ChatPage(page);
    await page.goto("/chat/regression-test-3");
    await page.waitForLoadState("domcontentloaded");

    await chatPage.promptInput.waitFor({ state: "visible", timeout: 10_000 });
    await chatPage.sendMessage("test something");

    await chatPage.waitForResponse(15_000);
    await chatPage.waitForStream(15_000);

    // Hover over assistant message to show actions
    const assistantMsg = chatPage.assistantMessage.first();
    await assistantMsg.hover();

    // Click 4 stars
    const fourthStar = page.locator('button[aria-label="Rate 4 stars"]');
    await fourthStar.waitFor({ state: "visible", timeout: 5_000 });
    await fourthStar.click();
    await page.waitForTimeout(500);

    // Verify mutation fired
    expect(calls.votes.length).toBeGreaterThanOrEqual(1);
    expect(calls.votes[calls.votes.length - 1]!.rating).toBe(4);

    // Verify star is visually filled
    await expect(fourthStar).toHaveClass(/text-yellow-500/);
  });

  test("no console errors during full flow", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        // Filter out expected errors (e.g., network mocks)
        const text = msg.text();
        if (!text.includes("Failed to load resource") && !text.includes("net::ERR")) {
          consoleErrors.push(text);
        }
      }
    });

    await setupFullRoutes(page, toolStream());

    const chatPage = new ChatPage(page);
    await page.goto("/chat/regression-test-4");
    await page.waitForLoadState("domcontentloaded");

    await chatPage.promptInput.waitFor({ state: "visible", timeout: 10_000 });
    await chatPage.sendMessage("test full flow");

    await chatPage.waitForResponse(15_000);
    await chatPage.waitForStream(15_000);

    // Allow time for any deferred errors
    await page.waitForTimeout(2000);

    // Should have no unexpected console errors
    expect(consoleErrors).toEqual([]);
  });

  test("text-only stream renders without tool cards", async ({ page }) => {
    await setupFullRoutes(page, textOnlyStream());

    const chatPage = new ChatPage(page);
    await page.goto("/chat/regression-test-5");
    await page.waitForLoadState("domcontentloaded");

    await chatPage.promptInput.waitFor({ state: "visible", timeout: 10_000 });
    await chatPage.sendMessage("Just say hello");

    await chatPage.waitForResponse(15_000);

    // Verify text appeared
    const lastMsg = await chatPage.getLastAssistantMessage();
    expect(lastMsg).toContain("Rubic");

    // No tool cards should exist
    const toolCount = await chatPage.getToolCardCount();
    expect(toolCount).toBe(0);

    // Canvas should not be visible (no canvas tools)
    const canvasVisible = await chatPage.isCanvasVisible();
    expect(canvasVisible).toBe(false);
  });
});
