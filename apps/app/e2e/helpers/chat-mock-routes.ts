import type { Page } from "@playwright/test";

export interface CapturedChatPost {
  chatId: string;
  body: Record<string, unknown>;
  messages: Array<Record<string, unknown>>;
}

export interface ChatMockState {
  chatPosts: CapturedChatPost[];
  uploadCalls: number;
}

export interface SetupChatMockRoutesOptions {
  streamForChat?: (chatId: string, body: Record<string, unknown>) => string;
  uploadUrl?: string;
}

function resolveChatId(body: Record<string, unknown>): string {
  const chatId = body.chatId;
  const id = body.id;
  const metadata = body.metadata as { sessionId?: string } | undefined;

  if (typeof chatId === "string" && chatId.length > 0) return chatId;
  if (typeof id === "string" && id.length > 0) return id;
  if (typeof metadata?.sessionId === "string" && metadata.sessionId.length > 0) {
    return metadata.sessionId;
  }
  return "unknown-chat";
}

export async function setupChatMockRoutes(
  page: Page,
  options: SetupChatMockRoutesOptions = {},
): Promise<ChatMockState> {
  const state: ChatMockState = {
    chatPosts: [],
    uploadCalls: 0,
  };

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

  await page.route("**/api/files/upload", async (route) => {
    state.uploadCalls += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        url: options.uploadUrl ?? "https://files.example.com/e2e-upload.txt",
      }),
    });
  });

  await page.route("**/api/chat", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ status: 204 });
      return;
    }

    let body: Record<string, unknown> = {};
    try {
      body = (await route.request().postDataJSON()) as Record<string, unknown>;
    } catch {
      body = {};
    }

    const chatId = resolveChatId(body);
    const messages = Array.isArray(body.messages)
      ? (body.messages as Array<Record<string, unknown>>)
      : [];

    state.chatPosts.push({
      chatId,
      body,
      messages,
    });

    const streamBody = options.streamForChat?.(chatId, body) ?? "";
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

  return state;
}
