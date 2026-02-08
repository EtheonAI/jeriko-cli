import { test, expect, type Page, type Route } from "@playwright/test";
import { ChatPage } from "../page-objects/chat-page";
import { voteTestStream } from "../helpers/sse-streams";

/**
 * Votes E2E tests.
 *
 * Verifies 5-star rating UI on assistant messages:
 * - Stars render on hover
 * - Click star → tRPC messages.vote mutation fires
 * - Same star click → messages.removeVote mutation fires (toggle off)
 * - Ratings load from DB on page load
 * - Changing rating works (e.g., 3→5)
 */

// ─── Route setup with vote interception ───

interface VoteCalls {
  votes: Array<{ chatId: string; messageId: string; rating: number }>;
  removals: Array<{ chatId: string; messageId: string }>;
}

async function setupVoteRoutes(
  page: Page,
  existingVotes: Array<{ messageId: string; rating: number }> = [],
): Promise<VoteCalls> {
  const calls: VoteCalls = { votes: [], removals: [] };

  // Auth
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

  // Chat stream
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
      body: voteTestStream(),
    });
  });

  // tRPC routes
  await page.route("**/api/trpc/**", async (route) => {
    const url = route.request().url();

    // Intercept getVotes query
    if (url.includes("messages.getVotes")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ result: { data: { json: existingVotes } } }),
      });
      return;
    }

    // Intercept vote mutation
    if (url.includes("messages.vote") && !url.includes("removeVote")) {
      try {
        const body = await route.request().postDataJSON();
        const data = body?.json ?? body;
        calls.votes.push({
          chatId: data.chatId,
          messageId: data.messageId,
          rating: data.rating,
        });
      } catch {
        // POST body might not be JSON
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ result: { data: { json: { success: true } } } }),
      });
      return;
    }

    // Intercept removeVote mutation
    if (url.includes("messages.removeVote")) {
      try {
        const body = await route.request().postDataJSON();
        const data = body?.json ?? body;
        calls.removals.push({
          chatId: data.chatId,
          messageId: data.messageId,
        });
      } catch {
        // POST body might not be JSON
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ result: { data: { json: { success: true } } } }),
      });
      return;
    }

    // Session/message queries
    if (url.includes("sessions.get")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          result: {
            data: {
              json: {
                id: "vote-test-session",
                title: "Vote Test",
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

    // Default
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ result: { data: { json: {} } } }),
    });
  });

  return calls;
}

test.describe("Votes E2E", () => {
  test("star rating buttons render on assistant messages", async ({ page }) => {
    await setupVoteRoutes(page);

    const chatPage = new ChatPage(page);
    await page.goto("/chat/vote-test-1");
    await page.waitForLoadState("domcontentloaded");

    await chatPage.promptInput.waitFor({ state: "visible", timeout: 10_000 });
    await chatPage.sendMessage("Hello");
    await chatPage.waitForResponse(15_000);

    // Hover over the assistant message to show action bar
    const assistantMsg = chatPage.assistantMessage.first();
    await assistantMsg.hover();

    // Should see 5 star buttons
    const stars = page.locator("button[aria-label*='Rate']");
    await stars.first().waitFor({ state: "visible", timeout: 5_000 });
    expect(await stars.count()).toBe(5);

    // Verify aria-labels
    for (let i = 1; i <= 5; i++) {
      const label = `Rate ${i} star${i > 1 ? "s" : ""}`;
      await expect(page.locator(`button[aria-label="${label}"]`)).toBeVisible();
    }
  });

  test("clicking star sends vote mutation", async ({ page }) => {
    const calls = await setupVoteRoutes(page);

    const chatPage = new ChatPage(page);
    await page.goto("/chat/vote-test-2");
    await page.waitForLoadState("domcontentloaded");

    await chatPage.promptInput.waitFor({ state: "visible", timeout: 10_000 });
    await chatPage.sendMessage("Hello");
    await chatPage.waitForResponse(15_000);

    // Hover and click 4 stars
    const assistantMsg = chatPage.assistantMessage.first();
    await assistantMsg.hover();

    const fourthStar = page.locator('button[aria-label="Rate 4 stars"]');
    await fourthStar.waitFor({ state: "visible", timeout: 5_000 });
    await fourthStar.click();

    // Wait for mutation to fire
    await page.waitForTimeout(500);

    // Verify vote mutation was called with rating 4
    expect(calls.votes.length).toBeGreaterThanOrEqual(1);
    const lastVote = calls.votes[calls.votes.length - 1]!;
    expect(lastVote.rating).toBe(4);

    // Verify star is visually filled (has text-yellow-500)
    await expect(fourthStar).toHaveClass(/text-yellow-500/);
  });

  test("clicking same star toggles off (removes vote)", async ({ page }) => {
    const calls = await setupVoteRoutes(page);

    const chatPage = new ChatPage(page);
    await page.goto("/chat/vote-test-3");
    await page.waitForLoadState("domcontentloaded");

    await chatPage.promptInput.waitFor({ state: "visible", timeout: 10_000 });
    await chatPage.sendMessage("Hello");
    await chatPage.waitForResponse(15_000);

    const assistantMsg = chatPage.assistantMessage.first();
    await assistantMsg.hover();

    const thirdStar = page.locator('button[aria-label="Rate 3 stars"]');
    await thirdStar.waitFor({ state: "visible", timeout: 5_000 });

    // Click to set rating
    await thirdStar.click();
    await page.waitForTimeout(300);
    expect(calls.votes.length).toBe(1);

    // Click again to toggle off
    await thirdStar.click();
    await page.waitForTimeout(300);
    expect(calls.removals.length).toBe(1);
  });

  test("existing votes pre-fill on page load", async ({ page }) => {
    // Setup with existing vote — rating 3 for a known message
    const existingVotes = [{ messageId: "msg-vote-1", rating: 3 }];
    await setupVoteRoutes(page, existingVotes);

    const chatPage = new ChatPage(page);
    await page.goto("/chat/vote-test-4");
    await page.waitForLoadState("domcontentloaded");

    await chatPage.promptInput.waitFor({ state: "visible", timeout: 10_000 });
    await chatPage.sendMessage("Hello");
    await chatPage.waitForResponse(15_000);

    // Hover to reveal stars
    const assistantMsg = chatPage.assistantMessage.first();
    await assistantMsg.hover();

    // Stars 1-3 should be filled (text-yellow-500)
    const stars = page.locator("button[aria-label*='Rate']");
    await stars.first().waitFor({ state: "visible", timeout: 5_000 });

    // The third star should be filled
    const thirdStar = page.locator('button[aria-label="Rate 3 stars"]');
    await expect(thirdStar).toHaveClass(/text-yellow-500/);

    // The fourth star should NOT be filled
    const fourthStar = page.locator('button[aria-label="Rate 4 stars"]');
    await expect(fourthStar).not.toHaveClass(/text-yellow-500/);
  });

  test("change rating from 3 to 5", async ({ page }) => {
    const calls = await setupVoteRoutes(page);

    const chatPage = new ChatPage(page);
    await page.goto("/chat/vote-test-5");
    await page.waitForLoadState("domcontentloaded");

    await chatPage.promptInput.waitFor({ state: "visible", timeout: 10_000 });
    await chatPage.sendMessage("Hello");
    await chatPage.waitForResponse(15_000);

    const assistantMsg = chatPage.assistantMessage.first();
    await assistantMsg.hover();

    // Click 3 stars first
    const thirdStar = page.locator('button[aria-label="Rate 3 stars"]');
    await thirdStar.waitFor({ state: "visible", timeout: 5_000 });
    await thirdStar.click();
    await page.waitForTimeout(300);

    // Now change to 5 stars
    const fifthStar = page.locator('button[aria-label="Rate 5 stars"]');
    await fifthStar.click();
    await page.waitForTimeout(300);

    // Both vote calls should have been made
    expect(calls.votes.length).toBe(2);
    expect(calls.votes[0]!.rating).toBe(3);
    expect(calls.votes[1]!.rating).toBe(5);

    // Fifth star should be filled
    await expect(fifthStar).toHaveClass(/text-yellow-500/);
  });
});
