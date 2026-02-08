import { http, HttpResponse } from "msw";
import {
  createMockSessionList,
  createMockSession,
  createMockConversation,
  createMockAgent,
  createMockAgentTask,
} from "../factories";

const API_BASE = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

// ─── SSE Stream Generators ───

function sseEvent(data: object | string): string {
  return `data: ${typeof data === "string" ? data : JSON.stringify(data)}\n\n`;
}

/** Simple text-only SSE stream */
function generateTextSSEStream(): string {
  return [
    sseEvent({ type: "content", content: "Hello" }),
    sseEvent({ type: "content", content: " — I'm Rubic" }),
    sseEvent({ type: "content", content: ". How can I help?" }),
    sseEvent("[DONE]"),
  ].join("");
}

/** SSE stream with show_plan + 5 tools + text */
function generateToolSSEStream(): string {
  return [
    // Planning
    sseEvent({
      type: "tool_start",
      toolCallId: "tc_plan",
      tool: "show_plan",
      input: {
        title: "Build React App",
        todos: [
          { id: "s1", label: "Research frameworks", status: "in_progress" },
          { id: "s2", label: "Set up project", status: "pending" },
          { id: "s3", label: "Write components", status: "pending" },
          { id: "s4", label: "Add tests", status: "pending" },
          { id: "s5", label: "Deploy", status: "pending" },
        ],
      },
    }),
    sseEvent({
      type: "tool_result",
      toolCallId: "tc_plan",
      tool: "show_plan",
      success: true,
      result: {
        title: "Build React App",
        todos: [
          { id: "s1", label: "Research frameworks", status: "completed" },
          { id: "s2", label: "Set up project", status: "in_progress" },
          { id: "s3", label: "Write components", status: "pending" },
          { id: "s4", label: "Add tests", status: "pending" },
          { id: "s5", label: "Deploy", status: "pending" },
        ],
      },
    }),

    // Web search
    sseEvent({
      type: "tool_start",
      toolCallId: "tc_search",
      tool: "web_search",
      input: { query: "best React frameworks 2026" },
    }),
    sseEvent({
      type: "tool_result",
      toolCallId: "tc_search",
      tool: "web_search",
      success: true,
      result: {
        results: [
          {
            title: "React 19 Guide",
            url: "https://react.dev",
            snippet: "Learn about React 19",
          },
        ],
      },
    }),

    // Shell exec
    sseEvent({
      type: "tool_start",
      toolCallId: "tc_shell",
      tool: "shell_exec",
      input: { command: "npx create-react-app my-app" },
    }),
    sseEvent({
      type: "tool_result",
      toolCallId: "tc_shell",
      tool: "shell_exec",
      success: true,
      result: { stdout: "Success! Created my-app", exit_code: 0 },
    }),

    // File write
    sseEvent({
      type: "tool_start",
      toolCallId: "tc_file",
      tool: "file_write",
      input: { path: "/app/src/App.tsx", content: "export default function App() { return <div>Hello</div> }" },
    }),
    sseEvent({
      type: "tool_result",
      toolCallId: "tc_file",
      tool: "file_write",
      success: true,
      result: { success: true, path: "/app/src/App.tsx" },
    }),

    // Code execute
    sseEvent({
      type: "tool_start",
      toolCallId: "tc_code",
      tool: "code_execute",
      input: { language: "python", code: "print('test')" },
    }),
    sseEvent({
      type: "tool_result",
      toolCallId: "tc_code",
      tool: "code_execute",
      success: true,
      result: { stdout: "test\n", exit_code: 0 },
    }),

    // Source URL
    sseEvent({
      type: "source_url",
      url: "https://react.dev",
      title: "React Documentation",
    }),

    // Final text
    sseEvent({ type: "content", content: "I've set up a React 19 app for you!" }),
    sseEvent("[DONE]"),
  ].join("");
}

/** SSE stream with an error tool result */
function generateErrorToolSSEStream(): string {
  return [
    sseEvent({
      type: "tool_start",
      toolCallId: "tc_err",
      tool: "code_execute",
      input: { code: "1/0" },
    }),
    sseEvent({
      type: "tool_result",
      toolCallId: "tc_err",
      tool: "code_execute",
      success: false,
      result: { error: "ZeroDivisionError: division by zero" },
    }),
    sseEvent({
      type: "content",
      content: "The code execution failed. Let me fix that.",
    }),
    sseEvent("[DONE]"),
  ].join("");
}

/** SSE stream with browser_navigate + screenshot */
function generateBrowserSSEStream(): string {
  // A 1x1 transparent PNG in base64
  const tinyPng =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
  return [
    sseEvent({
      type: "sandbox_info",
      sandboxId: "sb_test_123",
    }),
    sseEvent({
      type: "tool_start",
      toolCallId: "tc_browser",
      tool: "browser_navigate",
      input: { url: "https://example.com" },
    }),
    sseEvent({
      type: "browser_frame",
      screenshot: tinyPng,
      url: "https://example.com",
      title: "Example Domain",
    }),
    sseEvent({
      type: "tool_result",
      toolCallId: "tc_browser",
      tool: "browser_navigate",
      success: true,
      result: {
        url: "https://example.com",
        title: "Example Domain",
        screenshot: tinyPng,
      },
    }),
    sseEvent({
      type: "content",
      content: "I've navigated to example.com.",
    }),
    sseEvent("[DONE]"),
  ].join("");
}

/** SSE stream with all 33 tools (agent SSE format for MSW handlers) */
function generateAllToolsSSEStream(): string {
  const tinyPng =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
  let n = 0;
  const tc = () => `tc_all_${++n}`;

  const tool = (name: string, input: unknown, result: unknown, success = true) => [
    sseEvent({ type: "tool_start", toolCallId: tc(), tool: name, input }),
    sseEvent({ type: "tool_result", toolCallId: `tc_all_${n}`, tool: name, success, result }),
  ];

  return [
    // 1. show_plan
    ...tool("show_plan",
      { title: "All Tools Demo", todos: [{ id: "t1", label: "Run all tools", status: "in_progress" }] },
      { title: "All Tools Demo", todos: [{ id: "t1", label: "Run all tools", status: "completed" }] }),
    // 2. web_search
    ...tool("web_search", { query: "AI tools 2026" },
      { results: [{ title: "AI Tools Guide", url: "https://example.com/ai", snippet: "Top AI tools" }] }),
    // 3. code_execute
    ...tool("code_execute", { code: "print('hello')", language: "python" }, { stdout: "hello\n", exit_code: 0 }),
    // 4. shell_exec
    ...tool("shell_exec", { command: "ls -la" }, { stdout: "total 42\ndrwxr-xr-x 5 user staff", exit_code: 0 }),
    // 5. shell_view
    ...tool("shell_view", { id: "sh1" }, { stdout: "session output", exit_code: 0 }),
    // 6. shell_wait
    ...tool("shell_wait", { id: "sh1", timeout: 5 }, { stdout: "done", exit_code: 0 }),
    // 7. shell_write_to_process
    ...tool("shell_write_to_process", { id: "sh1", input: "yes\n" }, { success: true }),
    // 8. shell_kill_process
    ...tool("shell_kill_process", { id: "sh1" }, { success: true }),
    // 9. file_read
    ...tool("file_read", { path: "/app/src/index.ts" }, { content: "console.log('hello');", path: "/app/src/index.ts" }),
    // 10. file_write
    ...tool("file_write", { path: "/app/src/App.tsx", content: "export default () => <div/>" }, { success: true, path: "/app/src/App.tsx" }),
    // 11. file_str_replace
    ...tool("file_str_replace", { path: "/app/src/App.tsx", old_str: "div", new_str: "main" }, { success: true }),
    // 12. file_find_in_content
    ...tool("file_find_in_content", { pattern: "import", path: "/app/src" },
      { matches: [{ path: "/app/src/index.ts", line: 1, content: "import React" }] }),
    // 13. file_find_by_name
    ...tool("file_find_by_name", { pattern: "*.tsx", path: "/app/src" }, { files: ["/app/src/App.tsx"] }),
    // 14. browser_navigate
    sseEvent({ type: "sandbox_info", sandboxId: "sb_all_tools" }),
    ...tool("browser_navigate", { url: "https://example.com" },
      { url: "https://example.com", title: "Example", screenshot: tinyPng }),
    sseEvent({ type: "browser_frame", screenshot: tinyPng, url: "https://example.com", title: "Example" }),
    // 15. browser_view
    ...tool("browser_view", {}, { url: "https://example.com", title: "Example", screenshot: tinyPng }),
    // 16. browser_click
    ...tool("browser_click", { coordinate: [640, 360] }, { url: "https://example.com", screenshot: tinyPng }),
    // 17. browser_input
    ...tool("browser_input", { coordinate: [400, 300], text: "hello" }, { url: "https://example.com", screenshot: tinyPng }),
    // 18. browser_scroll_up
    ...tool("browser_scroll_up", { pixels: 300 }, { url: "https://example.com", screenshot: tinyPng }),
    // 19. browser_scroll_down
    ...tool("browser_scroll_down", { pixels: 300 }, { url: "https://example.com", screenshot: tinyPng }),
    // 20. browser_move_mouse
    ...tool("browser_move_mouse", { coordinate: [500, 400] }, { url: "https://example.com", screenshot: tinyPng }),
    // 21. browser_press_key
    ...tool("browser_press_key", { key: "Enter" }, { url: "https://example.com", screenshot: tinyPng }),
    // 22. browser_select_option
    ...tool("browser_select_option", { coordinate: [400, 300], value: "opt1" }, { url: "https://example.com", screenshot: tinyPng }),
    // 23. browser_console_exec
    ...tool("browser_console_exec", { code: "document.title" }, { result: "Example Domain" }),
    // 24. browser_console_view
    ...tool("browser_console_view", {}, { logs: ["[log] Page loaded"] }),
    // 25. browser_screenshot
    ...tool("browser_screenshot", {}, { screenshot: tinyPng }),
    // 26. browser_restart
    ...tool("browser_restart", {}, { success: true }),
    // 27. generate_image
    ...tool("generate_image", { prompt: "A sunset" }, { url: `data:image/png;base64,${tinyPng}`, alt: "A sunset" }),
    // 28. deploy_expose_port
    ...tool("deploy_expose_port", { port: 3000 }, { url: "https://sb-test.e2b.dev:3000", port: 3000 }),
    // 29. deploy_apply_deployment
    ...tool("deploy_apply_deployment", { type: "static", path: "/dist" }, { url: "https://app.rubic.dev" }),
    // 30. message_notify_user
    ...tool("message_notify_user", { text: "Task done!" }, { delivered: true }),
    // 31. message_ask_user
    ...tool("message_ask_user", { question: "Continue?" }, { response: "Yes" }),
    // 32. schedule_recurring_task
    ...tool("schedule_recurring_task", { name: "Daily report", cron: "0 9 * * *" }, { id: "sched-1" }),
    // 33. check_outcomes
    ...tool("check_outcomes", { taskId: "t-123" }, { outcomes: [{ metric: "accuracy", value: 0.95 }] }),
    // Source + final text
    sseEvent({ type: "source_url", url: "https://playwright.dev", title: "Playwright Docs" }),
    sseEvent({ type: "content", content: "All 33 tools executed!" }),
    sseEvent("[DONE]"),
  ].join("");
}

/** SSE stream with a quota error mid-stream */
function generateQuotaErrorSSEStream(): string {
  return [
    sseEvent({ type: "content", content: "Starting..." }),
    sseEvent({
      type: "error",
      error: { message: "You exceeded your current quota" },
    }),
    sseEvent("[DONE]"),
  ].join("");
}

/**
 * MSW handlers for Rubic API simulation.
 * Use in tests, Storybook, and development without backend.
 */
export const handlers = [
  // ─── Health ───
  http.get(`${API_BASE}/api/health`, () => {
    return HttpResponse.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: 12345,
    });
  }),

  // ─── Sessions (tRPC-like REST simulation) ───
  http.get(`${API_BASE}/api/trpc/sessions.list*`, () => {
    const sessions = createMockSessionList(8);
    return HttpResponse.json({
      result: { data: { json: sessions } },
    });
  }),

  http.get(`${API_BASE}/api/trpc/sessions.get*`, ({ request }) => {
    const url = new URL(request.url);
    const input = url.searchParams.get("input");
    const parsed = input ? JSON.parse(input) : {};
    const session = createMockSession({ id: parsed?.json?.id ?? "s1" });
    return HttpResponse.json({
      result: { data: { json: session } },
    });
  }),

  http.post(`${API_BASE}/api/trpc/sessions.create*`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    const session = createMockSession({
      title: (body as any)?.json?.title ?? null,
    });
    return HttpResponse.json({
      result: { data: { json: session } },
    });
  }),

  http.post(`${API_BASE}/api/trpc/sessions.delete*`, () => {
    return HttpResponse.json({
      result: { data: { json: { success: true } } },
    });
  }),

  // ─── Messages ───
  http.get(`${API_BASE}/api/trpc/messages.list*`, ({ request }) => {
    const url = new URL(request.url);
    const input = url.searchParams.get("input");
    const parsed = input ? JSON.parse(input) : {};
    const messages = createMockConversation(
      parsed?.json?.sessionId ?? "s1",
      3
    );
    return HttpResponse.json({
      result: { data: { json: messages } },
    });
  }),

  http.post(`${API_BASE}/api/trpc/messages.send*`, async ({ request }) => {
    const body = (await request.json()) as any;
    return HttpResponse.json({
      result: {
        data: {
          json: {
            id: `m-${Date.now()}`,
            sessionId: body?.json?.sessionId,
            role: "user",
            content: body?.json?.content,
            parts: null,
            metadata: null,
            createdAt: new Date().toISOString(),
          },
        },
      },
    });
  }),

  // ─── Agents ───
  http.get(`${API_BASE}/api/trpc/agents.list*`, () => {
    const agents = [createMockAgent({ type: "orchestrator", status: "idle" })];
    return HttpResponse.json({
      result: { data: { json: agents } },
    });
  }),

  http.get(`${API_BASE}/api/trpc/agents.tasks*`, () => {
    const tasks = [
      createMockAgentTask({ status: "completed", title: "Analyzed requirements" }),
      createMockAgentTask({ status: "in_progress", title: "Writing code" }),
      createMockAgentTask({ status: "pending", title: "Run tests" }),
    ];
    return HttpResponse.json({
      result: { data: { json: tasks } },
    });
  }),

  // ─── Chat (SSE streaming simulation) ───
  http.post(`${API_BASE}/api/chat`, async ({ request }) => {
    let body: { messages?: Array<{ content?: string }> } = {};
    try {
      body = (await request.json()) as typeof body;
    } catch {
      // body may not be JSON
    }

    // Route based on last user message content
    const lastMessage = body.messages?.[body.messages.length - 1];
    const prompt = (lastMessage?.content ?? "").toLowerCase();

    let streamContent: string;
    if (prompt.includes("test-all-tools")) {
      streamContent = generateAllToolsSSEStream();
    } else if (prompt.includes("test-tools")) {
      streamContent = generateToolSSEStream();
    } else if (prompt.includes("test-error")) {
      streamContent = generateErrorToolSSEStream();
    } else if (prompt.includes("test-browser")) {
      streamContent = generateBrowserSSEStream();
    } else if (prompt.includes("test-quota")) {
      streamContent = generateQuotaErrorSSEStream();
    } else {
      streamContent = generateTextSSEStream();
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        // Split into individual SSE events and emit with delays
        const events = streamContent.split("\n\n").filter(Boolean);
        let i = 0;
        const interval = setInterval(() => {
          if (i >= events.length) {
            clearInterval(interval);
            controller.close();
            return;
          }
          controller.enqueue(encoder.encode(events[i] + "\n\n"));
          i++;
        }, 50);
      },
    });

    return new HttpResponse(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }),

  // ─── Files ───
  http.get(`${API_BASE}/api/trpc/files.list*`, () => {
    return HttpResponse.json({
      result: { data: { json: [] } },
    });
  }),

  // ─── Connectors ───
  http.get(`${API_BASE}/api/trpc/connectors.list*`, () => {
    return HttpResponse.json({
      result: { data: { json: [] } },
    });
  }),

  // ─── Auth ───
  http.get(`${API_BASE}/api/auth/get-session`, () => {
    return HttpResponse.json({
      user: {
        id: "test-user-id",
        name: "Test User",
        email: "test@rubic.dev",
        image: null,
        emailVerified: true,
      },
      session: {
        id: "test-session-id",
        userId: "test-user-id",
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      },
    });
  }),
];

// ─── Exported stream generators (for Playwright E2E tests) ───
export {
  generateTextSSEStream,
  generateToolSSEStream,
  generateErrorToolSSEStream,
  generateBrowserSSEStream,
  generateQuotaErrorSSEStream,
  generateAllToolsSSEStream,
};
