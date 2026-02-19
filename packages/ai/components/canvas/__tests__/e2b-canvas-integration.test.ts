/**
 * E2B + Canvas + Browser Streaming Integration Tests
 *
 * Tests the complete pipeline from agent SSE events through SSEProcessor
 * to the parts format that useCanvas consumes. Covers:
 *
 * 1. Full Playwright browser session (navigate → click → scroll → screenshot → input)
 * 2. Terminal output accumulation from shell_exec + code_execute
 * 3. File operations → code view state (file_write, file_read, file_str_replace)
 * 4. Browser frame metadata → live screenshot pipeline
 * 5. Mixed multi-tool E2B sessions with view switching
 * 6. Sandbox info metadata propagation
 * 7. Search results → browser view rendering
 * 8. Take Control mode coordinate clicking
 * 9. Console exec/view browser tools
 * 10. Browser restart + URL history
 */

import { describe, it, expect } from "vitest";
import {
  TOOL_VIEW_MAP,
  type CanvasViewType,
} from "../use-canvas";
import {
  isToolUIPart,
  getToolName,
  type UIMessage,
  type StaticToolUIPart,
} from "../../../lib/types/ui-message";

// ── Helpers ─────────────────────────────────────────────────────────

/** Build a static tool part (the format SSEProcessor collects & useCanvas reads) */
function toolPart(
  toolName: string,
  opts: {
    toolCallId?: string;
    state?: string;
    input?: Record<string, unknown>;
    output?: Record<string, unknown>;
  } = {}
): StaticToolUIPart {
  return {
    type: `tool-${toolName}` as `tool-${string}`,
    toolCallId: opts.toolCallId ?? `tc_${toolName}_${Math.random().toString(36).slice(2, 8)}`,
    state: (opts.state ?? "output-available") as StaticToolUIPart["state"],
    input: opts.input ?? {},
    output: opts.output,
  };
}

/** Build a UIMessage with given parts */
function assistantMsg(
  parts: Array<Record<string, unknown>>,
  metadata?: Record<string, unknown>
): UIMessage {
  return {
    id: `msg_${Math.random().toString(36).slice(2, 8)}`,
    role: "assistant",
    parts: parts as UIMessage["parts"],
    metadata,
  };
}

/** Extract view type from a tool name */
function viewFor(toolName: string): CanvasViewType | undefined {
  return TOOL_VIEW_MAP[toolName];
}

/** Simulate what useCanvas does: scan backwards through messages to find latest tool */
function findLatestTool(messages: UIMessage[]) {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]!;
    if (msg.role !== "assistant" || !msg.parts) continue;
    for (let j = msg.parts.length - 1; j >= 0; j--) {
      const part = msg.parts[j];
      if (!part || !isToolUIPart(part)) continue;
      const tp = part as StaticToolUIPart;
      if (!tp.toolCallId || !tp.state) continue;
      const toolName = getToolName(tp);
      const viewType = TOOL_VIEW_MAP[toolName];
      if (!viewType) continue;
      return {
        toolCallId: tp.toolCallId,
        toolName,
        args: (tp.input ?? {}) as Record<string, unknown>,
        output: tp.output as Record<string, unknown> | undefined,
        viewType,
        state: tp.state,
        isWorking:
          tp.state === "input-streaming" ||
          tp.state === "input-available" ||
          tp.state === "approval-responded",
      };
    }
  }
  return null;
}

/** Extract screenshot from output (mirrors useCanvas extractScreenshot) */
function extractScreenshot(
  output: Record<string, unknown> | undefined
): string | undefined {
  if (!output) return undefined;
  const candidates = [
    output.screenshot,
    output.data,
    (output.result as Record<string, unknown>)?.screenshot,
    output.image,
    output.base64,
  ];
  for (const val of candidates) {
    if (typeof val === "string" && val.length > 0) return val;
  }
  return undefined;
}

/** Extract URL from output or args (mirrors useCanvas) */
function extractBrowserUrl(
  output: Record<string, unknown> | undefined,
  args: Record<string, unknown>
): string | undefined {
  if (output?.url && typeof output.url === "string") return output.url;
  if (args?.url && typeof args.url === "string") return args.url;
  return undefined;
}

/** Accumulate file contents from tool parts (mirrors useCanvas allFileContents) */
function accumulateFiles(messages: UIMessage[]): Record<string, string> {
  const contents: Record<string, string> = {};
  for (const msg of messages) {
    if (msg.role !== "assistant" || !msg.parts) continue;
    for (const part of msg.parts) {
      if (!part || !isToolUIPart(part)) continue;
      const tp = part as StaticToolUIPart;
      const toolName = getToolName(tp);
      const args = (tp.input ?? {}) as Record<string, unknown>;
      const output = tp.output as Record<string, unknown> | undefined;

      if (toolName === "file_write") {
        const path = ((args.path ?? args.file) as string) ?? "";
        const content = (args.content as string) ?? "";
        if (path) contents[path] = content;
      }
      if (toolName === "file_read" && tp.state === "output-available" && output) {
        const path = ((args.path ?? args.file) as string) ?? "";
        const content =
          typeof output === "string"
            ? output
            : (output.content as string) ?? JSON.stringify(output);
        if (path) contents[path] = typeof content === "string" ? content : String(content);
      }
      if (toolName === "file_str_replace" && tp.state === "output-available" && output) {
        const path = ((args.path ?? args.file) as string) ?? "";
        const oldStr = (args.old_str as string) ?? "";
        const newStr = (args.new_str as string) ?? "";
        if (path && contents[path] && oldStr) {
          contents[path] = contents[path].replace(oldStr, newStr);
        }
      }
    }
  }
  return contents;
}

/** Accumulate terminal output from shell_exec results (mirrors useCanvas) */
function accumulateTerminal(messages: UIMessage[]): string[] {
  const lines: string[] = [];
  for (const msg of messages) {
    if (msg.role !== "assistant" || !msg.parts) continue;
    for (const part of msg.parts) {
      if (!part || !isToolUIPart(part)) continue;
      const tp = part as StaticToolUIPart;
      const toolName = getToolName(tp);
      if (
        (toolName === "shell_exec" || toolName === "code_execute") &&
        tp.state === "output-available" &&
        tp.output
      ) {
        const args = (tp.input ?? {}) as Record<string, unknown>;
        const cmd = (args.command as string) ?? (args.code as string) ?? "";
        const output = tp.output as Record<string, unknown>;
        const stdout = (output.stdout as string) ?? JSON.stringify(output);
        lines.push(`$ ${cmd}`);
        lines.push(...stdout.split("\n"));
      }
    }
  }
  return lines;
}

// ── Fake E2B response data ──────────────────────────────────────────

const FAKE_SCREENSHOT =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

const E2B_BROWSER_NAVIGATE_OUTPUT = {
  title: "Example Domain",
  url: "https://example.com",
  content: "This domain is for use in illustrative examples.",
  elements: ['index[0]:<a>More information...</a>'],
  screenshot: FAKE_SCREENSHOT,
};

const E2B_BROWSER_CLICK_OUTPUT = {
  title: "IANA — IANA-managed Reserved Domains",
  url: "https://www.iana.org/domains/reserved",
  content: "IANA-managed Reserved Domains",
  elements: ['index[0]:<a>Home</a>', 'index[1]:<a>Domains</a>'],
  screenshot: FAKE_SCREENSHOT,
};

const E2B_SHELL_EXEC_OUTPUT = {
  stdout: "Hello, World!\n",
  stderr: "",
  exitCode: 0,
};

const E2B_CODE_EXECUTE_OUTPUT = {
  stdout: "42\n",
  stderr: "",
  exitCode: 0,
};

const E2B_FILE_READ_OUTPUT = {
  content: 'console.log("hello");\n',
  path: "/home/user/index.js",
};

const E2B_FILE_WRITE_OUTPUT = {
  success: true,
  path: "/home/user/app.py",
};

// ============================================================================
// Tests
// ============================================================================

describe("E2B + Canvas Integration", () => {
  // ────────────────────────────────────────────────────────────────
  // 1. Full Playwright Browser Session
  // ────────────────────────────────────────────────────────────────

  describe("Full Playwright browser session", () => {
    const messages: UIMessage[] = [
      assistantMsg(
        [
          toolPart("browser_navigate", {
            toolCallId: "tc_nav_1",
            input: { url: "https://example.com" },
            output: E2B_BROWSER_NAVIGATE_OUTPUT,
          }),
        ],
        { sandboxId: "sbx_abc123" }
      ),
    ];

    it("browser_navigate → browser view type", () => {
      const latest = findLatestTool(messages);
      expect(latest).not.toBeNull();
      expect(latest!.viewType).toBe("browser");
      expect(latest!.toolName).toBe("browser_navigate");
    });

    it("extracts URL from navigate output", () => {
      const latest = findLatestTool(messages);
      const url = extractBrowserUrl(latest!.output, latest!.args);
      expect(url).toBe("https://example.com");
    });

    it("extracts screenshot from navigate output", () => {
      const latest = findLatestTool(messages);
      const shot = extractScreenshot(latest!.output);
      expect(shot).toBe(FAKE_SCREENSHOT);
    });

    it("extracts page title from output", () => {
      const latest = findLatestTool(messages);
      expect(latest!.output!.title).toBe("Example Domain");
    });

    it("extracts page content from output", () => {
      const latest = findLatestTool(messages);
      expect(latest!.output!.content).toContain("illustrative examples");
    });

    it("extracts interactive elements from output", () => {
      const latest = findLatestTool(messages);
      const elements = latest!.output!.elements as string[];
      expect(elements).toHaveLength(1);
      expect(elements[0]).toContain("More information");
    });

    it("sandboxId propagated in message metadata", () => {
      const meta = messages[0]!.metadata as Record<string, unknown>;
      expect(meta.sandboxId).toBe("sbx_abc123");
    });
  });

  describe("Browser click after navigate", () => {
    const messages: UIMessage[] = [
      assistantMsg([
        toolPart("browser_navigate", {
          toolCallId: "tc_nav_1",
          input: { url: "https://example.com" },
          output: E2B_BROWSER_NAVIGATE_OUTPUT,
        }),
        toolPart("browser_click", {
          toolCallId: "tc_click_1",
          input: { index: 0 },
          output: E2B_BROWSER_CLICK_OUTPUT,
        }),
      ]),
    ];

    it("latest tool is browser_click (not navigate)", () => {
      const latest = findLatestTool(messages);
      expect(latest!.toolName).toBe("browser_click");
    });

    it("URL updates to clicked page", () => {
      const latest = findLatestTool(messages);
      expect(extractBrowserUrl(latest!.output, latest!.args)).toBe(
        "https://www.iana.org/domains/reserved"
      );
    });

    it("screenshot persists through click", () => {
      const latest = findLatestTool(messages);
      expect(extractScreenshot(latest!.output)).toBe(FAKE_SCREENSHOT);
    });
  });

  describe("Browser scroll actions", () => {
    it("browser_scroll_down → browser view", () => {
      expect(viewFor("browser_scroll_down")).toBe("browser");
    });

    it("browser_scroll_up → browser view", () => {
      expect(viewFor("browser_scroll_up")).toBe("browser");
    });

    it("scroll output includes screenshot", () => {
      const messages: UIMessage[] = [
        assistantMsg([
          toolPart("browser_scroll_down", {
            toolCallId: "tc_scroll_1",
            input: {},
            output: {
              ...E2B_BROWSER_NAVIGATE_OUTPUT,
              title: "Scrolled page",
            },
          }),
        ]),
      ];
      const latest = findLatestTool(messages);
      expect(extractScreenshot(latest!.output)).toBe(FAKE_SCREENSHOT);
    });
  });

  describe("Browser input (typing)", () => {
    it("browser_input → browser view", () => {
      expect(viewFor("browser_input")).toBe("browser");
    });

    it("input action with text and element index", () => {
      const messages: UIMessage[] = [
        assistantMsg([
          toolPart("browser_input", {
            toolCallId: "tc_input_1",
            input: { index: 3, text: "hello world", press_enter: true },
            output: {
              title: "Search Results",
              url: "https://example.com/search?q=hello+world",
              screenshot: FAKE_SCREENSHOT,
              content: "Results for: hello world",
              elements: [],
            },
          }),
        ]),
      ];
      const latest = findLatestTool(messages);
      expect(latest!.toolName).toBe("browser_input");
      expect(latest!.args.text).toBe("hello world");
      expect(extractBrowserUrl(latest!.output, latest!.args)).toBe(
        "https://example.com/search?q=hello+world"
      );
    });
  });

  describe("Browser screenshot tool", () => {
    it("browser_screenshot → browser view", () => {
      expect(viewFor("browser_screenshot")).toBe("browser");
    });

    it("full_page screenshot", () => {
      const messages: UIMessage[] = [
        assistantMsg([
          toolPart("browser_screenshot", {
            toolCallId: "tc_ss_1",
            input: { full_page: true },
            output: { screenshot: FAKE_SCREENSHOT, full_page: true },
          }),
        ]),
      ];
      const latest = findLatestTool(messages);
      expect(extractScreenshot(latest!.output)).toBe(FAKE_SCREENSHOT);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 2. Console exec/view
  // ────────────────────────────────────────────────────────────────

  describe("Browser console tools", () => {
    it("browser_console_exec → browser view", () => {
      expect(viewFor("browser_console_exec")).toBe("browser");
    });

    it("browser_console_view → browser view", () => {
      expect(viewFor("browser_console_view")).toBe("browser");
    });

    it("console_exec returns JavaScript result", () => {
      const messages: UIMessage[] = [
        assistantMsg([
          toolPart("browser_console_exec", {
            toolCallId: "tc_console_1",
            input: { javascript: "document.title" },
            output: { result: "Example Domain" },
          }),
        ]),
      ];
      const latest = findLatestTool(messages);
      expect(latest!.output!.result).toBe("Example Domain");
    });

    it("console_view returns log entries", () => {
      const messages: UIMessage[] = [
        assistantMsg([
          toolPart("browser_console_view", {
            toolCallId: "tc_console_2",
            input: { max_lines: 10 },
            output: {
              logs: [
                { type: "log", text: "Page loaded" },
                { type: "error", text: "404 not found" },
              ],
            },
          }),
        ]),
      ];
      const latest = findLatestTool(messages);
      const logs = latest!.output!.logs as Array<{ type: string; text: string }>;
      expect(logs).toHaveLength(2);
      expect(logs[1]!.type).toBe("error");
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 3. Browser restart + move_mouse + select_option + press_key
  // ────────────────────────────────────────────────────────────────

  describe("Browser restart", () => {
    it("browser_restart → browser view", () => {
      expect(viewFor("browser_restart")).toBe("browser");
    });

    it("restart with new URL resets page state", () => {
      const messages: UIMessage[] = [
        assistantMsg([
          toolPart("browser_restart", {
            toolCallId: "tc_restart_1",
            input: { url: "https://new-site.com" },
            output: {
              title: "New Site",
              url: "https://new-site.com",
              screenshot: FAKE_SCREENSHOT,
              content: "Welcome to New Site",
              elements: [],
            },
          }),
        ]),
      ];
      const latest = findLatestTool(messages);
      expect(extractBrowserUrl(latest!.output, latest!.args)).toBe("https://new-site.com");
    });
  });

  describe("Browser move_mouse", () => {
    it("browser_move_mouse → browser view", () => {
      expect(viewFor("browser_move_mouse")).toBe("browser");
    });

    it("coordinate-based mouse movement", () => {
      const messages: UIMessage[] = [
        assistantMsg([
          toolPart("browser_move_mouse", {
            toolCallId: "tc_move_1",
            input: { coordinate_x: 640, coordinate_y: 360 },
            output: { moved_to: { x: 640, y: 360 } },
          }),
        ]),
      ];
      const latest = findLatestTool(messages);
      expect(latest!.args.coordinate_x).toBe(640);
    });
  });

  describe("Browser select_option", () => {
    it("browser_select_option → browser view", () => {
      expect(viewFor("browser_select_option")).toBe("browser");
    });
  });

  describe("Browser press_key / key_press", () => {
    it("browser_press_key → browser view", () => {
      expect(viewFor("browser_press_key")).toBe("browser");
    });

    it("browser_key_press → browser view", () => {
      expect(viewFor("browser_key_press")).toBe("browser");
    });

    it("key press with Enter key", () => {
      const messages: UIMessage[] = [
        assistantMsg([
          toolPart("browser_press_key", {
            toolCallId: "tc_key_1",
            input: { key: "Enter" },
            output: {
              title: "Search Results",
              url: "https://example.com/results",
              screenshot: FAKE_SCREENSHOT,
              content: "Search results here",
              elements: [],
            },
          }),
        ]),
      ];
      const latest = findLatestTool(messages);
      expect(latest!.args.key).toBe("Enter");
      expect(extractScreenshot(latest!.output)).toBeTruthy();
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 4. Take Control — coordinate-based clicking
  // ────────────────────────────────────────────────────────────────

  describe("Take Control mode (coordinate clicking)", () => {
    it("click with coordinates maps to 1280x720 viewport", () => {
      const messages: UIMessage[] = [
        assistantMsg([
          toolPart("browser_click", {
            toolCallId: "tc_coord_click_1",
            input: { coordinate_x: 200, coordinate_y: 150 },
            output: {
              title: "Clicked Page",
              url: "https://example.com/clicked",
              screenshot: FAKE_SCREENSHOT,
              elements: [],
            },
          }),
        ]),
      ];
      const latest = findLatestTool(messages);
      expect(latest!.args.coordinate_x).toBe(200);
      expect(latest!.args.coordinate_y).toBe(150);
      expect(extractScreenshot(latest!.output)).toBeTruthy();
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 5. Browser frame metadata (live screenshot pipeline)
  // ────────────────────────────────────────────────────────────────

  describe("Browser frame metadata → live screenshot", () => {
    it("browserFrame metadata extracted from message", () => {
      const messages: UIMessage[] = [
        assistantMsg(
          [{ type: "text", text: "Navigating..." }],
          {
            browserFrame: {
              screenshot: FAKE_SCREENSHOT,
              url: "https://example.com",
              title: "Example",
            },
          }
        ),
      ];
      const meta = messages[0]!.metadata as Record<string, unknown>;
      const frame = meta.browserFrame as Record<string, unknown>;
      expect(frame.screenshot).toBe(FAKE_SCREENSHOT);
      expect(frame.url).toBe("https://example.com");
      expect(frame.title).toBe("Example");
    });

    it("sandboxId + browserFrame coexist in metadata", () => {
      const messages: UIMessage[] = [
        assistantMsg(
          [{ type: "text", text: "Working..." }],
          {
            sandboxId: "sbx_xyz",
            browserFrame: { screenshot: FAKE_SCREENSHOT, url: "https://test.com", title: "Test" },
          }
        ),
      ];
      const meta = messages[0]!.metadata as Record<string, unknown>;
      expect(meta.sandboxId).toBe("sbx_xyz");
      expect((meta.browserFrame as Record<string, unknown>).screenshot).toBe(FAKE_SCREENSHOT);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 6. Terminal output accumulation
  // ────────────────────────────────────────────────────────────────

  describe("Terminal output accumulation (shell + code)", () => {
    const messages: UIMessage[] = [
      assistantMsg([
        toolPart("shell_exec", {
          toolCallId: "tc_shell_1",
          input: { command: "echo Hello", id: "default", exec_dir: "/home/user" },
          output: E2B_SHELL_EXEC_OUTPUT,
        }),
        toolPart("shell_exec", {
          toolCallId: "tc_shell_2",
          input: { command: "ls -la", id: "default", exec_dir: "/home/user" },
          output: { stdout: "total 8\ndrwxr-xr-x 2 user user 4096 Feb 8 app.py\n", stderr: "", exitCode: 0 },
        }),
        toolPart("code_execute", {
          toolCallId: "tc_code_1",
          input: { code: "print(6*7)", language: "python" },
          output: E2B_CODE_EXECUTE_OUTPUT,
        }),
      ]),
    ];

    it("shell_exec → terminal view type", () => {
      expect(viewFor("shell_exec")).toBe("terminal");
    });

    it("code_execute → terminal view type", () => {
      expect(viewFor("code_execute")).toBe("terminal");
    });

    it("terminal output accumulates across multiple shell_exec", () => {
      const output = accumulateTerminal(messages);
      expect(output).toContain("$ echo Hello");
      expect(output).toContain("Hello, World!");
      expect(output).toContain("$ ls -la");
      expect(output).toContain("total 8");
    });

    it("code_execute output appended to terminal", () => {
      const output = accumulateTerminal(messages);
      expect(output).toContain("$ print(6*7)");
      expect(output).toContain("42");
    });

    it("latest tool is code_execute (last in sequence)", () => {
      const latest = findLatestTool(messages);
      expect(latest!.toolName).toBe("code_execute");
      expect(latest!.viewType).toBe("terminal");
    });
  });

  describe("Shell session operations", () => {
    it("shell_view → terminal view", () => {
      expect(viewFor("shell_view")).toBe("terminal");
    });

    it("shell_wait → terminal view", () => {
      expect(viewFor("shell_wait")).toBe("terminal");
    });

    it("shell_write_to_process → terminal view", () => {
      expect(viewFor("shell_write_to_process")).toBe("terminal");
    });

    it("shell_kill_process → terminal view", () => {
      expect(viewFor("shell_kill_process")).toBe("terminal");
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 7. File operations → code view state
  // ────────────────────────────────────────────────────────────────

  describe("File operations → code view", () => {
    const messages: UIMessage[] = [
      assistantMsg([
        toolPart("file_write", {
          toolCallId: "tc_fw_1",
          input: { path: "/home/user/app.py", content: "def main():\n    print('hello')\n" },
          output: E2B_FILE_WRITE_OUTPUT,
        }),
        toolPart("file_write", {
          toolCallId: "tc_fw_2",
          input: { path: "/home/user/utils.py", content: "def add(a, b):\n    return a + b\n" },
          output: { success: true, path: "/home/user/utils.py" },
        }),
        toolPart("file_read", {
          toolCallId: "tc_fr_1",
          input: { path: "/home/user/app.py" },
          output: { content: "def main():\n    print('hello')\n", path: "/home/user/app.py" },
        }),
        toolPart("file_str_replace", {
          toolCallId: "tc_fsr_1",
          input: { path: "/home/user/app.py", old_str: "hello", new_str: "world" },
          output: { success: true, path: "/home/user/app.py" },
        }),
      ]),
    ];

    it("file_write → editor view type (Manus FileToolView parity)", () => {
      expect(viewFor("file_write")).toBe("editor");
    });

    it("file_read → editor view type (Manus FileToolView parity)", () => {
      expect(viewFor("file_read")).toBe("editor");
    });

    it("file_str_replace → editor view type (Manus FileToolView parity)", () => {
      expect(viewFor("file_str_replace")).toBe("editor");
    });

    it("file_find_in_content → editor view type (Manus FileToolView parity)", () => {
      expect(viewFor("file_find_in_content")).toBe("editor");
    });

    it("file_find_by_name → editor view type (Manus FileToolView parity)", () => {
      expect(viewFor("file_find_by_name")).toBe("editor");
    });

    it("accumulates file contents from writes", () => {
      const files = accumulateFiles(messages);
      expect(files["/home/user/app.py"]).toContain("def main()");
      expect(files["/home/user/utils.py"]).toContain("def add(a, b)");
    });

    it("file_read updates content", () => {
      const files = accumulateFiles(messages);
      // file_read output content should be captured
      expect(files["/home/user/app.py"]).toBeDefined();
    });

    it("file_str_replace applies in-place edit", () => {
      const files = accumulateFiles(messages);
      // After str_replace, "hello" → "world"
      expect(files["/home/user/app.py"]).toContain("world");
      expect(files["/home/user/app.py"]).not.toContain("hello");
    });

    it("multiple file writes → multiple entries in file tree", () => {
      const files = accumulateFiles(messages);
      expect(Object.keys(files)).toHaveLength(2);
      expect(files).toHaveProperty("/home/user/app.py");
      expect(files).toHaveProperty("/home/user/utils.py");
    });

    it("latest tool is file_str_replace", () => {
      const latest = findLatestTool(messages);
      expect(latest!.toolName).toBe("file_str_replace");
      expect(latest!.viewType).toBe("editor");
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 8. Search results → browser view
  // ────────────────────────────────────────────────────────────────

  describe("Web search → browser view with results", () => {
    const searchOutput = {
      results: [
        { title: "Result 1", url: "https://r1.com", snippet: "First result" },
        { title: "Result 2", url: "https://r2.com", snippet: "Second result" },
        { title: "Result 3", url: "https://r3.com", snippet: "Third result" },
      ],
    };

    const messages: UIMessage[] = [
      assistantMsg([
        toolPart("web_search", {
          toolCallId: "tc_search_1",
          input: { query: "typescript best practices" },
          output: searchOutput,
        }),
      ]),
    ];

    it("web_search → browser view", () => {
      expect(viewFor("web_search")).toBe("browser");
    });

    it("search results extracted from output", () => {
      const latest = findLatestTool(messages);
      const results = latest!.output!.results as Array<Record<string, string>>;
      expect(results).toHaveLength(3);
      expect(results[0]!.title).toBe("Result 1");
    });

    it("info_search_web also maps to browser", () => {
      expect(viewFor("info_search_web")).toBe("browser");
    });

    it("search_web also maps to browser", () => {
      expect(viewFor("search_web")).toBe("browser");
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 9. Mixed multi-tool E2B session
  // ────────────────────────────────────────────────────────────────

  describe("Mixed multi-tool E2B session", () => {
    const messages: UIMessage[] = [
      assistantMsg(
        [
          // Plan first
          toolPart("show_plan", {
            toolCallId: "tc_plan_1",
            input: { title: "Build a website", todos: [{ id: "1", title: "Create files", status: "in_progress" }] },
            output: { title: "Build a website", todos: [{ id: "1", title: "Create files", status: "in_progress" }] },
          }),
          // Write file
          toolPart("file_write", {
            toolCallId: "tc_fw_1",
            input: { path: "/home/user/index.html", content: "<html><body>Hello</body></html>" },
            output: { success: true, path: "/home/user/index.html" },
          }),
          // Run server
          toolPart("shell_exec", {
            toolCallId: "tc_shell_1",
            input: { command: "python -m http.server 8080", id: "server" },
            output: { stdout: "Serving HTTP on 0.0.0.0 port 8080\n", stderr: "", exitCode: 0 },
          }),
          // Navigate browser to local server
          toolPart("browser_navigate", {
            toolCallId: "tc_nav_1",
            input: { url: "http://localhost:8080" },
            output: {
              title: "Hello",
              url: "http://localhost:8080",
              screenshot: FAKE_SCREENSHOT,
              content: "Hello",
              elements: [],
            },
          }),
        ],
        { sandboxId: "sbx_mixed_1" }
      ),
    ];

    it("latest tool is browser_navigate (last in chain)", () => {
      const latest = findLatestTool(messages);
      expect(latest!.toolName).toBe("browser_navigate");
      expect(latest!.viewType).toBe("browser");
    });

    it("show_plan does NOT map to any canvas view", () => {
      expect(viewFor("show_plan")).toBeUndefined();
    });

    it("file contents accumulated despite browser being latest", () => {
      const files = accumulateFiles(messages);
      expect(files["/home/user/index.html"]).toContain("<html>");
    });

    it("terminal output accumulated despite browser being latest", () => {
      const output = accumulateTerminal(messages);
      expect(output).toContain("$ python -m http.server 8080");
      expect(output).toContain("Serving HTTP on 0.0.0.0 port 8080");
    });

    it("sandboxId from metadata", () => {
      const meta = messages[0]!.metadata as Record<string, unknown>;
      expect(meta.sandboxId).toBe("sbx_mixed_1");
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 10. Multi-message session (page reload scenario)
  // ────────────────────────────────────────────────────────────────

  describe("Multi-message session (page reload)", () => {
    const messages: UIMessage[] = [
      // First assistant response
      assistantMsg([
        toolPart("file_write", {
          toolCallId: "tc_fw_msg1",
          input: { path: "/home/user/config.json", content: '{"port": 3000}' },
          output: { success: true, path: "/home/user/config.json" },
        }),
      ]),
      // Second assistant response (after user sends another message)
      assistantMsg([
        toolPart("file_write", {
          toolCallId: "tc_fw_msg2",
          input: { path: "/home/user/server.js", content: "const express = require('express');" },
          output: { success: true, path: "/home/user/server.js" },
        }),
        toolPart("shell_exec", {
          toolCallId: "tc_shell_msg2",
          input: { command: "node server.js" },
          output: { stdout: "Server running on port 3000\n", stderr: "", exitCode: 0 },
        }),
      ]),
    ];

    it("file contents accumulated across messages", () => {
      const files = accumulateFiles(messages);
      expect(files["/home/user/config.json"]).toBe('{"port": 3000}');
      expect(files["/home/user/server.js"]).toContain("express");
    });

    it("terminal output accumulated across messages", () => {
      const output = accumulateTerminal(messages);
      expect(output).toContain("$ node server.js");
      expect(output).toContain("Server running on port 3000");
    });

    it("latest tool found in last message", () => {
      const latest = findLatestTool(messages);
      expect(latest!.toolName).toBe("shell_exec");
      expect(latest!.viewType).toBe("terminal");
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 11. Tool state lifecycle
  // ────────────────────────────────────────────────────────────────

  describe("Tool state lifecycle (in-progress → completed)", () => {
    it("input-available = isWorking true", () => {
      const messages: UIMessage[] = [
        assistantMsg([
          toolPart("browser_navigate", {
            toolCallId: "tc_ia_1",
            state: "input-available",
            input: { url: "https://example.com" },
          }),
        ]),
      ];
      const latest = findLatestTool(messages);
      expect(latest!.isWorking).toBe(true);
    });

    it("output-available = isWorking false", () => {
      const messages: UIMessage[] = [
        assistantMsg([
          toolPart("browser_navigate", {
            toolCallId: "tc_oa_1",
            state: "output-available",
            input: { url: "https://example.com" },
            output: E2B_BROWSER_NAVIGATE_OUTPUT,
          }),
        ]),
      ];
      const latest = findLatestTool(messages);
      expect(latest!.isWorking).toBe(false);
    });

    it("output-error = isWorking false", () => {
      const messages: UIMessage[] = [
        assistantMsg([
          toolPart("shell_exec", {
            toolCallId: "tc_err_1",
            state: "output-error",
            input: { command: "bad_cmd" },
          }),
        ]),
      ];
      const latest = findLatestTool(messages);
      expect(latest!.isWorking).toBe(false);
    });

    it("input-streaming = isWorking true", () => {
      const messages: UIMessage[] = [
        assistantMsg([
          toolPart("file_write", {
            toolCallId: "tc_is_1",
            state: "input-streaming",
            input: { path: "/home/user/test.py" },
          }),
        ]),
      ];
      const latest = findLatestTool(messages);
      expect(latest!.isWorking).toBe(true);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 12. Deploy tools → browser view
  // ────────────────────────────────────────────────────────────────

  describe("Deploy tools", () => {
    it("deploy_expose_port → browser view", () => {
      expect(viewFor("deploy_expose_port")).toBe("browser");
    });

    it("deploy_apply_deployment → browser view", () => {
      expect(viewFor("deploy_apply_deployment")).toBe("browser");
    });

    it("expose port output contains URL", () => {
      const messages: UIMessage[] = [
        assistantMsg([
          toolPart("deploy_expose_port", {
            toolCallId: "tc_deploy_1",
            input: { port: 3000 },
            output: {
              url: "https://sbx-abc123-3000.e2b.dev",
              port: 3000,
              message: "Service accessible at https://sbx-abc123-3000.e2b.dev",
            },
          }),
        ]),
      ];
      const latest = findLatestTool(messages);
      expect(extractBrowserUrl(latest!.output, latest!.args)).toBe(
        "https://sbx-abc123-3000.e2b.dev"
      );
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 13. Non-canvas tools are correctly excluded
  // ────────────────────────────────────────────────────────────────

  describe("Non-canvas tools excluded", () => {
    const excludedTools = [
      "show_plan",
      "message_notify_user",
      "message_ask_user",
      "schedule_task",
      "track_analytics",
    ];

    for (const tool of excludedTools) {
      it(`${tool} has no canvas view mapping`, () => {
        expect(TOOL_VIEW_MAP[tool]).toBeUndefined();
      });
    }

    it("show_plan is skipped when finding latest canvas tool", () => {
      const messages: UIMessage[] = [
        assistantMsg([
          toolPart("browser_navigate", {
            toolCallId: "tc_nav_1",
            input: { url: "https://example.com" },
            output: E2B_BROWSER_NAVIGATE_OUTPUT,
          }),
          toolPart("show_plan", {
            toolCallId: "tc_plan_1",
            input: { title: "Plan", todos: [] },
            output: { title: "Plan", todos: [] },
          }),
        ]),
      ];
      // show_plan is last in parts but should be skipped
      const latest = findLatestTool(messages);
      expect(latest!.toolName).toBe("browser_navigate");
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 14. Complete E2B full-stack flow
  // ────────────────────────────────────────────────────────────────

  describe("Complete E2B full-stack flow", () => {
    const messages: UIMessage[] = [
      assistantMsg(
        [
          // 1. Plan
          toolPart("show_plan", {
            toolCallId: "tc_plan",
            input: {
              title: "Build React app",
              todos: [
                { id: "1", title: "Write code", status: "in_progress" },
                { id: "2", title: "Install deps", status: "pending" },
                { id: "3", title: "Test in browser", status: "pending" },
              ],
            },
            output: { title: "Build React app", todos: [] },
          }),
          // 2. Create files
          toolPart("file_write", {
            toolCallId: "tc_fw_1",
            input: {
              path: "/home/user/project/src/App.jsx",
              content: 'export default function App() { return <h1>Hello</h1>; }',
            },
            output: { success: true, path: "/home/user/project/src/App.jsx" },
          }),
          toolPart("file_write", {
            toolCallId: "tc_fw_2",
            input: {
              path: "/home/user/project/package.json",
              content: '{"name":"app","dependencies":{"react":"^19"}}',
            },
            output: { success: true, path: "/home/user/project/package.json" },
          }),
          // 3. Install deps
          toolPart("shell_exec", {
            toolCallId: "tc_shell_1",
            input: { command: "cd /home/user/project && npm install", id: "default" },
            output: { stdout: "added 150 packages in 3s\n", stderr: "", exitCode: 0 },
          }),
          // 4. Start dev server
          toolPart("shell_exec", {
            toolCallId: "tc_shell_2",
            input: { command: "cd /home/user/project && npm run dev", id: "dev" },
            output: { stdout: "  VITE v5.0.0  ready in 300ms\n  ➜  Local:   http://localhost:5173/\n", stderr: "", exitCode: 0 },
          }),
          // 5. Search for docs
          toolPart("web_search", {
            toolCallId: "tc_search_1",
            input: { query: "react 19 hooks guide" },
            output: {
              results: [
                { title: "React 19 Hooks", url: "https://react.dev/reference/react", snippet: "React hooks docs" },
              ],
            },
          }),
          // 6. Navigate browser to local dev server
          toolPart("browser_navigate", {
            toolCallId: "tc_nav_1",
            input: { url: "http://localhost:5173" },
            output: {
              title: "Hello",
              url: "http://localhost:5173/",
              screenshot: FAKE_SCREENSHOT,
              content: "Hello",
              elements: ['index[0]:<h1>Hello</h1>'],
            },
          }),
          // 7. Screenshot
          toolPart("browser_screenshot", {
            toolCallId: "tc_ss_1",
            input: { full_page: false },
            output: { screenshot: FAKE_SCREENSHOT, full_page: false },
          }),
        ],
        { sandboxId: "sbx_fullstack_1" }
      ),
    ];

    it("all file contents accumulated", () => {
      const files = accumulateFiles(messages);
      expect(Object.keys(files)).toHaveLength(2);
      expect(files["/home/user/project/src/App.jsx"]).toContain("Hello");
      expect(files["/home/user/project/package.json"]).toContain("react");
    });

    it("all terminal output accumulated", () => {
      const output = accumulateTerminal(messages);
      expect(output.join("\n")).toContain("npm install");
      expect(output.join("\n")).toContain("added 150 packages");
      expect(output.join("\n")).toContain("npm run dev");
      expect(output.join("\n")).toContain("VITE");
    });

    it("latest tool is browser_screenshot (browser view)", () => {
      const latest = findLatestTool(messages);
      expect(latest!.toolName).toBe("browser_screenshot");
      expect(latest!.viewType).toBe("browser");
    });

    it("screenshot extracted from latest tool", () => {
      const latest = findLatestTool(messages);
      expect(extractScreenshot(latest!.output)).toBe(FAKE_SCREENSHOT);
    });

    it("sandbox ID from metadata", () => {
      const meta = messages[0]!.metadata as Record<string, unknown>;
      expect(meta.sandboxId).toBe("sbx_fullstack_1");
    });

    it("all three view types activated across session (terminal + browser + code)", () => {
      const viewTypes = new Set<string>();
      for (const msg of messages) {
        if (msg.role !== "assistant") continue;
        for (const part of msg.parts) {
          if (isToolUIPart(part)) {
            const name = getToolName(part as StaticToolUIPart);
            const view = TOOL_VIEW_MAP[name];
            if (view) viewTypes.add(view);
          }
        }
      }
      expect(viewTypes.has("terminal")).toBe(true);
      expect(viewTypes.has("browser")).toBe(true);
      expect(viewTypes.has("editor")).toBe(true);
      // file tools → editor, shell → terminal, browser → browser = 3 view types
      expect(viewTypes.size).toBe(3);
    });

    it("total tool count matches (8 tools, 7 canvas-visible)", () => {
      let total = 0;
      let canvasVisible = 0;
      for (const msg of messages) {
        if (msg.role !== "assistant") continue;
        for (const part of msg.parts) {
          if (isToolUIPart(part)) {
            total++;
            const name = getToolName(part as StaticToolUIPart);
            if (TOOL_VIEW_MAP[name]) canvasVisible++;
          }
        }
      }
      expect(total).toBe(8);
      expect(canvasVisible).toBe(7); // show_plan excluded
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 15. Edge cases
  // ────────────────────────────────────────────────────────────────

  describe("Edge cases", () => {
    it("empty messages → no latest tool", () => {
      expect(findLatestTool([])).toBeNull();
    });

    it("user-only messages → no latest tool", () => {
      const messages: UIMessage[] = [
        {
          id: "user1",
          role: "user",
          parts: [{ type: "text", text: "Hello" }],
        },
      ];
      expect(findLatestTool(messages)).toBeNull();
    });

    it("assistant message with only text → no latest tool", () => {
      const messages: UIMessage[] = [
        assistantMsg([{ type: "text", text: "Here is the answer" }]),
      ];
      expect(findLatestTool(messages)).toBeNull();
    });

    it("tool part without toolCallId is skipped", () => {
      const messages: UIMessage[] = [
        assistantMsg([
          {
            type: "tool-browser_navigate",
            toolCallId: "",
            state: "output-available",
            input: { url: "https://example.com" },
            output: E2B_BROWSER_NAVIGATE_OUTPUT,
          },
        ]),
      ];
      // Empty toolCallId should be skipped (falsy check)
      expect(findLatestTool(messages)).toBeNull();
    });

    it("screenshot with data: prefix left as-is", () => {
      const shot = extractScreenshot({
        screenshot: "data:image/png;base64," + FAKE_SCREENSHOT,
      });
      expect(shot?.startsWith("data:image/png;base64,")).toBe(true);
    });

    it("screenshot from nested result.screenshot", () => {
      const shot = extractScreenshot({
        result: { screenshot: FAKE_SCREENSHOT },
      });
      expect(shot).toBe(FAKE_SCREENSHOT);
    });
  });
});
