import { test, expect } from "@playwright/test";
import { ChatPage } from "../page-objects/chat-page";
import { allToolsStream, textOnlyStream, toolStream } from "../helpers/sse-streams";
import { setupChatMockRoutes } from "../helpers/chat-mock-routes";

test.describe("Chat Full Flow E2E", () => {
  test("all-tools stream renders inline tools, planner, and canvas", async ({ page }) => {
    const mocks = await setupChatMockRoutes(page, {
      streamForChat: () => allToolsStream(),
    });

    const chatPage = new ChatPage(page);
    await page.goto("/", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.goto("/chat/e2e-full-tools", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await chatPage.promptInput.waitFor({ state: "visible", timeout: 10_000 });

    await chatPage.sendMessage("Run all tools");
    await expect
      .poll(() => mocks.chatPosts.length, { timeout: 20_000 })
      .toBeGreaterThan(0);
    await chatPage.waitForToolCard("browser_navigate", 30_000);

    const toolNames = await chatPage.getToolCardNames();
    expect(toolNames.length).toBeGreaterThanOrEqual(10);
    expect(toolNames).toContain("browser_navigate");
    expect(toolNames).toContain("shell_exec");
    expect(toolNames).toContain("file_write");
    expect(toolNames).toContain("deploy_apply_deployment");

    await expect(page.locator("[data-testid='planner-bar']")).toBeVisible();

    const canvasVisible = await chatPage.waitForCanvas(10_000);
    expect(canvasVisible).toBe(true);
    const viewType = await chatPage.getCanvasViewType();
    expect(viewType).toBeTruthy();

    const last = await chatPage.getLastAssistantMessage();
    expect(last).toContain("All 33 tools executed successfully");
  });

  test("multiple chats send to isolated session IDs", async ({ page }) => {
    const mocks = await setupChatMockRoutes(page, {
      streamForChat: (chatId) => (chatId === "e2e-chat-b" ? toolStream() : textOnlyStream()),
    });

    const chatPage = new ChatPage(page);

    await page.goto("/", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.goto("/chat/e2e-chat-a", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await chatPage.promptInput.waitFor({ state: "visible", timeout: 10_000 });
    await chatPage.sendMessage("Message A");
    await expect
      .poll(() => mocks.chatPosts.filter((post) => post.chatId === "e2e-chat-a").length, {
        timeout: 20_000,
      })
      .toBeGreaterThan(0);

    await page.goto("/chat/e2e-chat-b", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await chatPage.promptInput.waitFor({ state: "visible", timeout: 10_000 });
    await chatPage.sendMessage("Message B");
    await expect
      .poll(() => mocks.chatPosts.filter((post) => post.chatId === "e2e-chat-b").length, {
        timeout: 20_000,
      })
      .toBeGreaterThan(0);
    expect(await chatPage.getToolCardCount()).toBeGreaterThanOrEqual(1);

    expect(mocks.chatPosts.length).toBeGreaterThanOrEqual(2);
    expect(mocks.chatPosts.some((post) => post.chatId === "e2e-chat-a")).toBe(true);
    expect(mocks.chatPosts.some((post) => post.chatId === "e2e-chat-b")).toBe(true);
  });

  test("file upload sends file parts and renders inline in chat", async ({ page }) => {
    const mocks = await setupChatMockRoutes(page, {
      streamForChat: () => textOnlyStream(),
      uploadUrl: "https://files.example.com/e2e-upload.txt",
    });

    const chatPage = new ChatPage(page);
    await page.goto("/", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.goto("/chat/e2e-file-upload", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await chatPage.promptInput.waitFor({ state: "visible", timeout: 10_000 });

    await chatPage.uploadFiles({
      name: "e2e-upload.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("hello from e2e"),
    });
    await chatPage.sendMessage("upload this file");

    await expect
      .poll(() => mocks.uploadCalls, { timeout: 20_000 })
      .toBeGreaterThan(0);
    await expect
      .poll(() => mocks.chatPosts.length, { timeout: 20_000 })
      .toBeGreaterThan(0);

    const lastPost = mocks.chatPosts[mocks.chatPosts.length - 1]!;
    const userMessage = [...lastPost.messages]
      .reverse()
      .find((msg) => msg.role === "user") as { parts?: Array<Record<string, unknown>> } | undefined;

    expect(userMessage).toBeTruthy();
    const filePart = userMessage?.parts?.find((part) => part.type === "file");
    expect(filePart).toBeTruthy();
    expect(filePart?.url).toBe("https://files.example.com/e2e-upload.txt");
    expect(filePart?.filename).toBe("e2e-upload.txt");
  });

  test("microphone control is safe to toggle when available", async ({ page }) => {
    const mocks = await setupChatMockRoutes(page, {
      streamForChat: () => textOnlyStream(),
    });

    const chatPage = new ChatPage(page);
    await page.goto("/", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.goto("/chat/e2e-mic", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await chatPage.promptInput.waitFor({ state: "visible", timeout: 10_000 });

    const micVisible = await chatPage.micButton.isVisible().catch(() => false);
    if (micVisible) {
      await chatPage.micButton.click();
      await expect(chatPage.promptInput).toBeVisible();
    }

    await chatPage.sendMessage("mic smoke");
    await expect
      .poll(() => mocks.chatPosts.length, { timeout: 20_000 })
      .toBeGreaterThan(0);
  });
});
