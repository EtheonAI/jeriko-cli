/**
 * AI SDK v6 UIMessage stream protocol generators for E2E tests.
 *
 * DefaultChatTransport expects these SSE events:
 *   text-start/delta/end, reasoning-start/delta/end,
 *   tool-input-start/available, tool-output-available/error,
 *   start-step/finish-step, source-url, message-metadata, start, finish
 *
 * Each event is a single SSE line: `data: <json>\n\n`
 */

// ─── SSE line formatter ───

export function sse(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

// ─── Reusable protocol event builders ───

function startEvent(messageId = "msg-e2e-1"): string {
  return sse({ type: "start", messageId });
}

function finishEvent(messageId = "msg-e2e-1"): string {
  return sse({ type: "finish", messageId, finishReason: "stop" });
}

function startStep(messageId = "msg-e2e-1"): string {
  return sse({ type: "start-step", messageId });
}

function finishStep(messageId = "msg-e2e-1"): string {
  return sse({ type: "finish-step", messageId, finishReason: "stop" });
}

function textDelta(text: string): string {
  return [
    sse({ type: "text-start" }),
    sse({ type: "text-delta", textDelta: text }),
    sse({ type: "text-end" }),
  ].join("");
}

function toolCall(
  toolCallId: string,
  toolName: string,
  input: unknown,
  output: unknown,
  isError = false,
): string {
  const events: string[] = [];
  events.push(sse({
    type: "tool-input-start",
    toolCallId,
    toolName,
  }));
  events.push(sse({
    type: "tool-input-available",
    toolCallId,
    toolName,
    input,
  }));
  if (isError) {
    events.push(sse({
      type: "tool-output-error",
      toolCallId,
      toolName,
      errorText: typeof output === "string" ? output : JSON.stringify(output),
    }));
  } else {
    events.push(sse({
      type: "tool-output-available",
      toolCallId,
      toolName,
      output,
    }));
  }
  return events.join("");
}

function sourceUrl(url: string, title: string): string {
  return sse({
    type: "source-url",
    sourceId: `src-${Date.now()}`,
    url,
    title,
  });
}

function messageMetadata(messageId: string, metadata: unknown): string {
  return sse({ type: "message-metadata", messageId, metadata });
}

// ─── Stream Generators ───

/** Simple text-only stream: start → step → text → finish */
export function textOnlyStream(): string {
  return [
    startEvent(),
    startStep(),
    textDelta("Hello! I'm Rubic, your AI assistant. How can I help you today?"),
    finishStep(),
    finishEvent(),
  ].join("");
}

/** Stream with show_plan + web_search + shell_exec tools */
export function toolStream(): string {
  return [
    startEvent(),
    startStep(),
    // show_plan
    toolCall("tc-plan", "show_plan", {
      title: "E2E Test Plan",
      todos: [
        { id: "s1", label: "Search the web", status: "in_progress" },
        { id: "s2", label: "Execute command", status: "pending" },
      ],
    }, {
      title: "E2E Test Plan",
      todos: [
        { id: "s1", label: "Search the web", status: "completed" },
        { id: "s2", label: "Execute command", status: "in_progress" },
      ],
    }),
    // web_search
    toolCall("tc-search", "web_search", { query: "playwright e2e testing" }, {
      results: [
        { title: "Playwright Docs", url: "https://playwright.dev", snippet: "End-to-end testing framework" },
      ],
    }),
    // shell_exec
    toolCall("tc-shell", "shell_exec", { command: "npm test" }, {
      stdout: "All tests passed\n",
      exit_code: 0,
    }),
    textDelta("Done with tools! All steps completed."),
    finishStep(),
    finishEvent(),
  ].join("");
}

/** Stream with browser, terminal, and code tools + metadata for canvas */
export function canvasStream(): string {
  const tinyPng = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
  const msgId = "msg-canvas-1";

  return [
    sse({ type: "start", messageId: msgId }),
    sse({ type: "start-step", messageId: msgId }),
    // sandbox_info as metadata
    messageMetadata(msgId, { sandboxId: "sb-e2e-123" }),
    // browser_navigate
    toolCall("tc-browser", "browser_navigate", { url: "https://example.com" }, {
      url: "https://example.com",
      title: "Example Domain",
      screenshot: tinyPng,
    }),
    // browser_frame as metadata
    messageMetadata(msgId, {
      browserFrame: { screenshot: tinyPng, url: "https://example.com", title: "Example Domain" },
    }),
    // shell_exec
    toolCall("tc-term", "shell_exec", { command: "echo 'hello world'" }, {
      stdout: "hello world\n",
      exit_code: 0,
    }),
    // file_write
    toolCall("tc-file", "file_write", {
      path: "/app/src/App.tsx",
      content: "export default function App() { return <div>Hello</div> }",
    }, {
      success: true,
      path: "/app/src/App.tsx",
    }),
    textDelta("Canvas operations complete."),
    sse({ type: "finish-step", messageId: msgId }),
    sse({ type: "finish", messageId: msgId, finishReason: "stop" }),
  ].join("");
}

/** Stream with a tool that errors */
export function errorToolStream(): string {
  return [
    startEvent(),
    startStep(),
    toolCall("tc-err", "code_execute", { code: "1/0", language: "python" },
      "ZeroDivisionError: division by zero", true),
    textDelta("The code execution failed. Let me fix that."),
    finishStep(),
    finishEvent(),
  ].join("");
}

/** Simple text stream for vote testing — produces two assistant messages worth of content */
export function voteTestStream(): string {
  return [
    startEvent("msg-vote-1"),
    startStep("msg-vote-1"),
    textDelta("This is a response you can rate with stars."),
    finishStep("msg-vote-1"),
    finishEvent("msg-vote-1"),
  ].join("");
}

/**
 * All 33 tools in correct AI SDK v6 UIMessage stream protocol.
 * Each tool gets a proper input-start → input-available → output-available cycle.
 */
export function allToolsStream(): string {
  const tinyPng = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
  const msgId = "msg-all-tools-1";
  let counter = 0;
  const tc = () => `tc-all-${++counter}`;

  return [
    sse({ type: "start", messageId: msgId }),
    sse({ type: "start-step", messageId: msgId }),

    // 1. show_plan
    toolCall(tc(), "show_plan", {
      title: "All 33 Tools Demo",
      todos: [
        { id: "t1", label: "Run all tools", status: "in_progress" },
        { id: "t2", label: "Verify output", status: "pending" },
      ],
    }, {
      title: "All 33 Tools Demo",
      todos: [
        { id: "t1", label: "Run all tools", status: "completed" },
        { id: "t2", label: "Verify output", status: "completed" },
      ],
    }),

    // 2. web_search
    toolCall(tc(), "web_search", { query: "AI tools 2026" }, {
      results: [{ title: "AI Tools Guide", url: "https://example.com/ai", snippet: "Top AI tools" }],
    }),

    // 3. code_execute
    toolCall(tc(), "code_execute", { code: "print('hello')", language: "python" }, {
      stdout: "hello\n", exit_code: 0,
    }),

    // 4-8. Shell tools
    toolCall(tc(), "shell_exec", { command: "ls -la" }, { stdout: "total 42\ndrwxr-xr-x 5 user staff 160", exit_code: 0 }),
    toolCall(tc(), "shell_view", { id: "sh1" }, { stdout: "output from session", exit_code: 0 }),
    toolCall(tc(), "shell_wait", { id: "sh1", timeout: 5 }, { stdout: "done waiting", exit_code: 0 }),
    toolCall(tc(), "shell_write_to_process", { id: "sh1", input: "yes\n" }, { success: true }),
    toolCall(tc(), "shell_kill_process", { id: "sh1" }, { success: true }),

    // 9-13. File tools
    toolCall(tc(), "file_read", { path: "/app/src/index.ts" }, { content: "console.log('hello');", path: "/app/src/index.ts" }),
    toolCall(tc(), "file_write", { path: "/app/src/App.tsx", content: "export default () => <div/>" }, { success: true, path: "/app/src/App.tsx" }),
    toolCall(tc(), "file_str_replace", { path: "/app/src/App.tsx", old_str: "div", new_str: "main" }, { success: true, path: "/app/src/App.tsx" }),
    toolCall(tc(), "file_find_in_content", { pattern: "import", path: "/app/src" }, { matches: [{ path: "/app/src/index.ts", line: 1, content: "import React from 'react'" }] }),
    toolCall(tc(), "file_find_by_name", { pattern: "*.tsx", path: "/app/src" }, { files: ["/app/src/App.tsx", "/app/src/index.tsx"] }),

    // 14-26. Browser tools
    toolCall(tc(), "browser_navigate", { url: "https://example.com" }, { url: "https://example.com", title: "Example", screenshot: tinyPng }),
    toolCall(tc(), "browser_view", {}, { url: "https://example.com", title: "Example", screenshot: tinyPng }),
    toolCall(tc(), "browser_click", { coordinate: [640, 360] }, { url: "https://example.com", screenshot: tinyPng }),
    toolCall(tc(), "browser_input", { coordinate: [400, 300], text: "hello" }, { url: "https://example.com", screenshot: tinyPng }),
    toolCall(tc(), "browser_scroll_up", { pixels: 300 }, { url: "https://example.com", screenshot: tinyPng }),
    toolCall(tc(), "browser_scroll_down", { pixels: 300 }, { url: "https://example.com", screenshot: tinyPng }),
    toolCall(tc(), "browser_move_mouse", { coordinate: [500, 400] }, { url: "https://example.com", screenshot: tinyPng }),
    toolCall(tc(), "browser_press_key", { key: "Enter" }, { url: "https://example.com", screenshot: tinyPng }),
    toolCall(tc(), "browser_select_option", { coordinate: [400, 300], value: "option1" }, { url: "https://example.com", screenshot: tinyPng }),
    toolCall(tc(), "browser_console_exec", { code: "document.title" }, { result: "Example Domain" }),
    toolCall(tc(), "browser_console_view", {}, { logs: ["[log] Page loaded"] }),
    toolCall(tc(), "browser_screenshot", {}, { screenshot: tinyPng }),
    toolCall(tc(), "browser_restart", {}, { success: true }),

    // 27. generate_image
    toolCall(tc(), "generate_image", { prompt: "A sunset over mountains" }, {
      url: `data:image/png;base64,${tinyPng}`,
      alt: "A sunset over mountains",
    }),

    // 28-29. Deploy
    toolCall(tc(), "deploy_expose_port", { port: 3000, protocol: "http" }, { url: "https://sb-e2e.e2b.dev:3000", port: 3000 }),
    toolCall(tc(), "deploy_apply_deployment", { type: "static", path: "/dist" }, { url: "https://app.rubic.dev", type: "static" }),

    // 30-31. Communication
    toolCall(tc(), "message_notify_user", { text: "Task completed successfully!" }, { delivered: true }),
    toolCall(tc(), "message_ask_user", { question: "Should I continue?" }, { response: "Yes, please continue." }),

    // 32. Schedule
    toolCall(tc(), "schedule_recurring_task", { name: "Daily report", cron: "0 9 * * *" }, { id: "sched-1", name: "Daily report" }),

    // 33. Analytics
    toolCall(tc(), "check_outcomes", { taskId: "t-123" }, { outcomes: [{ metric: "accuracy", value: 0.95 }] }),

    // Source
    sourceUrl("https://playwright.dev", "Playwright Documentation"),

    textDelta("All 33 tools executed successfully!"),
    sse({ type: "finish-step", messageId: msgId }),
    sse({ type: "finish", messageId: msgId, finishReason: "stop" }),
  ].join("");
}
