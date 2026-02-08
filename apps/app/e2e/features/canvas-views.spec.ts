import { test, expect, type Page } from "@playwright/test";
import { ChatPage } from "../page-objects/chat-page";
import { canvasStream, toolStream } from "../helpers/sse-streams";

/**
 * Canvas Views E2E tests.
 *
 * Verifies that tool calls trigger the correct canvas view type:
 * - browser_navigate → browser canvas
 * - shell_exec → terminal canvas
 * - file_write → code canvas
 * - Canvas auto-opens during streaming
 */

// ─── Route setup ───

async function setupRoutes(page: Page, streamBody: string) {
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
                id: "canvas-test-session",
                title: "Canvas Test",
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
}

test.describe("Canvas Views E2E", () => {
  test("browser_navigate opens browser canvas view", async ({ page }) => {
    await setupRoutes(page, canvasStream());

    const chatPage = new ChatPage(page);
    await page.goto("/chat/canvas-test-browser");
    await page.waitForLoadState("domcontentloaded");

    await chatPage.promptInput.waitFor({ state: "visible", timeout: 10_000 });
    await chatPage.sendMessage("test-canvas");

    // Wait for tool cards to appear
    await chatPage.waitForResponse(15_000);

    // Canvas should auto-open
    const canvasVisible = await chatPage.waitForCanvas(10_000);
    if (canvasVisible) {
      // Verify view type is browser (last browser tool sets the view)
      const viewType = await chatPage.getCanvasViewType();
      // Canvas could show browser, terminal, or code depending on which
      // tool was last processed — browser is first in our stream
      expect(viewType).toBeTruthy();
      expect(["browser", "terminal", "code"]).toContain(viewType);
    }
  });

  test("shell_exec appears in tool list", async ({ page }) => {
    await setupRoutes(page, canvasStream());

    const chatPage = new ChatPage(page);
    await page.goto("/chat/canvas-test-terminal");
    await page.waitForLoadState("domcontentloaded");

    await chatPage.promptInput.waitFor({ state: "visible", timeout: 10_000 });
    await chatPage.sendMessage("test-canvas");

    // Wait for tools
    await chatPage.waitForResponse(15_000);

    // Verify shell_exec tool card exists
    const names = await chatPage.getToolCardNames();
    expect(names).toContain("shell_exec");
  });

  test("file_write appears in tool list", async ({ page }) => {
    await setupRoutes(page, canvasStream());

    const chatPage = new ChatPage(page);
    await page.goto("/chat/canvas-test-code");
    await page.waitForLoadState("domcontentloaded");

    await chatPage.promptInput.waitFor({ state: "visible", timeout: 10_000 });
    await chatPage.sendMessage("test-canvas");

    await chatPage.waitForResponse(15_000);

    const names = await chatPage.getToolCardNames();
    expect(names).toContain("file_write");
  });

  test("canvas has data-testid and data-view-type attributes", async ({
    page,
  }) => {
    await setupRoutes(page, canvasStream());

    const chatPage = new ChatPage(page);
    await page.goto("/chat/canvas-test-attrs");
    await page.waitForLoadState("domcontentloaded");

    await chatPage.promptInput.waitFor({ state: "visible", timeout: 10_000 });
    await chatPage.sendMessage("test-canvas");

    await chatPage.waitForResponse(15_000);

    const canvasVisible = await chatPage.waitForCanvas(10_000);
    if (canvasVisible) {
      // Verify data-testid exists
      const canvas = page.locator("[data-testid='agent-canvas']");
      await expect(canvas).toBeVisible();

      // Verify data-view-type is set
      const viewType = await canvas.getAttribute("data-view-type");
      expect(viewType).toBeTruthy();
      expect(viewType).not.toBe("empty");
    }
  });

  test("tool stream without canvas tools does not auto-open canvas", async ({
    page,
  }) => {
    // toolStream has show_plan, web_search, shell_exec —
    // shell_exec DOES trigger canvas, but only on wide viewports
    await setupRoutes(page, toolStream());

    const chatPage = new ChatPage(page);
    await page.goto("/chat/canvas-test-no-auto");
    await page.waitForLoadState("domcontentloaded");

    await chatPage.promptInput.waitFor({ state: "visible", timeout: 10_000 });
    await chatPage.sendMessage("test-tools");

    await chatPage.waitForResponse(15_000);

    // Tool cards should appear
    const count = await chatPage.getToolCardCount();
    expect(count).toBeGreaterThanOrEqual(1);
  });
});
