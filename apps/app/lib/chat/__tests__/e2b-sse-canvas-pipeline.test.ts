/**
 * E2B SSE → Canvas Pipeline Integration Tests
 *
 * Tests the full flow: Agent SSE events → SSEProcessor → collected parts →
 * format compatible with useCanvas hook.
 *
 * This verifies that parts produced by SSEProcessor match exactly what
 * useCanvas expects for state extraction (browser, terminal, code views).
 *
 * Scenarios:
 * 1. Full E2B browser session (sandbox_info → navigate → click → screenshot)
 * 2. Full E2B terminal session (shell_exec × N → code_execute)
 * 3. Full E2B file/IDE session (file_write → file_read → file_str_replace)
 * 4. Browser frame metadata pipeline (live screenshots)
 * 5. Mixed session with all view types
 * 6. Error handling (failed tools, missing sandbox)
 * 7. Playwright-specific browser actions (all 13 browser tools)
 */

import { describe, it, expect, beforeEach } from "vitest";
import { SSEProcessor } from "../sse-processor";

// ── Helpers ─────────────────────────────────────────────────────────

function sseChunk(data: object | string): string {
  return `data: ${typeof data === "string" ? data : JSON.stringify(data)}\n\n`;
}

function parseSSE(output: string): Array<Record<string, unknown>> {
  return output
    .split("\n\n")
    .filter((line) => line.startsWith("data: "))
    .map((line) => {
      try {
        return JSON.parse(line.slice(6));
      } catch {
        return null;
      }
    })
    .filter(Boolean) as Array<Record<string, unknown>>;
}

function processAll(
  processor: SSEProcessor,
  events: object[]
): Array<Record<string, unknown>> {
  return events.flatMap((e) => parseSSE(processor.process(sseChunk(e))));
}

/** Extract tool parts from collected parts */
function toolParts(parts: Record<string, unknown>[]) {
  return parts.filter((p) => typeof p.type === "string" && (p.type as string).startsWith("tool-"));
}

// ── Fake E2B data ───────────────────────────────────────────────────

const FAKE_SCREENSHOT =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

// ============================================================================

describe("E2B SSE → Canvas Pipeline", () => {
  let processor: SSEProcessor;

  beforeEach(() => {
    processor = new SSEProcessor();
  });

  // ────────────────────────────────────────────────────────────────
  // 1. Full E2B Browser Session
  // ────────────────────────────────────────────────────────────────

  describe("Full E2B browser session", () => {
    it("sandbox_info → navigate → click → screenshot produces correct parts", () => {
      const events = [
        { type: "sandbox_info", sandboxId: "sbx_test_1" },
        {
          type: "tool_start",
          toolCallId: "tc_nav",
          tool: "browser_navigate",
          input: { url: "https://example.com" },
        },
        {
          type: "tool_result",
          toolCallId: "tc_nav",
          tool: "browser_navigate",
          success: true,
          result: {
            title: "Example Domain",
            url: "https://example.com",
            screenshot: FAKE_SCREENSHOT,
            content: "This is an example.",
            elements: ['index[0]:<a>More info</a>'],
          },
        },
        {
          type: "tool_start",
          toolCallId: "tc_click",
          tool: "browser_click",
          input: { index: 0 },
        },
        {
          type: "tool_result",
          toolCallId: "tc_click",
          tool: "browser_click",
          success: true,
          result: {
            title: "IANA Domains",
            url: "https://www.iana.org/domains/reserved",
            screenshot: FAKE_SCREENSHOT,
            elements: [],
          },
        },
        {
          type: "tool_start",
          toolCallId: "tc_ss",
          tool: "browser_screenshot",
          input: { full_page: true },
        },
        {
          type: "tool_result",
          toolCallId: "tc_ss",
          tool: "browser_screenshot",
          success: true,
          result: { screenshot: FAKE_SCREENSHOT, full_page: true },
        },
        { type: "content", content: "I've navigated and taken a screenshot." },
      ];

      const chunks = processAll(processor, events);
      const { parts } = processor.finalize();
      const tools = toolParts(parts);

      // 3 tool parts
      expect(tools).toHaveLength(3);
      expect(tools[0]!.type).toBe("tool-browser_navigate");
      expect(tools[1]!.type).toBe("tool-browser_click");
      expect(tools[2]!.type).toBe("tool-browser_screenshot");

      // Navigate part has output with screenshot + URL
      expect(tools[0]!.state).toBe("output-available");
      const navOutput = tools[0]!.output as Record<string, unknown>;
      expect(navOutput.url).toBe("https://example.com");
      expect(navOutput.screenshot).toBe(FAKE_SCREENSHOT);
      expect(navOutput.title).toBe("Example Domain");

      // Click part has updated URL
      const clickOutput = tools[1]!.output as Record<string, unknown>;
      expect(clickOutput.url).toBe("https://www.iana.org/domains/reserved");

      // Screenshot part has screenshot
      const ssOutput = tools[2]!.output as Record<string, unknown>;
      expect(ssOutput.screenshot).toBe(FAKE_SCREENSHOT);

      // sandbox_info emitted as message-metadata
      const metaChunks = chunks.filter((c) => c.type === "message-metadata");
      expect(metaChunks.length).toBeGreaterThanOrEqual(1);
      const sandboxMeta = metaChunks.find(
        (c) => (c.messageMetadata as Record<string, unknown>)?.sandboxId === "sbx_test_1"
      );
      expect(sandboxMeta).toBeDefined();
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 2. All 13+ browser tool events
  // ────────────────────────────────────────────────────────────────

  describe("All Playwright browser tool events", () => {
    const browserTools = [
      { tool: "browser_navigate", input: { url: "https://test.com" } },
      { tool: "browser_view", input: {} },
      { tool: "browser_click", input: { index: 0 } },
      { tool: "browser_input", input: { index: 1, text: "hello", press_enter: true } },
      { tool: "browser_scroll_up", input: {} },
      { tool: "browser_scroll_down", input: {} },
      { tool: "browser_move_mouse", input: { coordinate_x: 100, coordinate_y: 200 } },
      { tool: "browser_press_key", input: { key: "Enter" } },
      { tool: "browser_select_option", input: { index: 0, option: 2 } },
      { tool: "browser_console_exec", input: { javascript: "document.title" } },
      { tool: "browser_console_view", input: { max_lines: 10 } },
      { tool: "browser_screenshot", input: { full_page: false } },
      { tool: "browser_restart", input: { url: "https://new.com" } },
    ];

    for (const { tool, input } of browserTools) {
      it(`${tool} → tool-${tool} part with correct format`, () => {
        const proc = new SSEProcessor();
        const toolCallId = `tc_${tool}`;

        processAll(proc, [
          { type: "tool_start", toolCallId, tool, input },
          {
            type: "tool_result",
            toolCallId,
            tool,
            success: true,
            result: { screenshot: FAKE_SCREENSHOT, url: "https://result.com" },
          },
        ]);

        const { parts } = proc.finalize();
        const tools = toolParts(parts);
        expect(tools).toHaveLength(1);
        expect(tools[0]!.type).toBe(`tool-${tool}`);
        expect(tools[0]!.toolCallId).toBe(toolCallId);
        expect(tools[0]!.state).toBe("output-available");
        expect(tools[0]!.input).toEqual(input);

        const output = tools[0]!.output as Record<string, unknown>;
        expect(output.screenshot).toBe(FAKE_SCREENSHOT);
      });
    }
  });

  // ────────────────────────────────────────────────────────────────
  // 3. Full E2B Terminal Session
  // ────────────────────────────────────────────────────────────────

  describe("Full E2B terminal session", () => {
    it("shell_exec × 2 + code_execute → 3 terminal tool parts", () => {
      const events = [
        { type: "sandbox_info", sandboxId: "sbx_term_1" },
        {
          type: "tool_start",
          toolCallId: "tc_sh1",
          tool: "shell_exec",
          input: { command: "echo hello", id: "default" },
        },
        {
          type: "tool_result",
          toolCallId: "tc_sh1",
          tool: "shell_exec",
          success: true,
          result: { stdout: "hello\n", stderr: "", exitCode: 0 },
        },
        {
          type: "tool_start",
          toolCallId: "tc_sh2",
          tool: "shell_exec",
          input: { command: "ls -la", id: "default" },
        },
        {
          type: "tool_result",
          toolCallId: "tc_sh2",
          tool: "shell_exec",
          success: true,
          result: {
            stdout: "total 4\n-rw-r--r-- 1 user user 0 Feb 8 test.py\n",
            stderr: "",
            exitCode: 0,
          },
        },
        {
          type: "tool_start",
          toolCallId: "tc_code1",
          tool: "code_execute",
          input: { code: "print(2+2)", language: "python" },
        },
        {
          type: "tool_result",
          toolCallId: "tc_code1",
          tool: "code_execute",
          success: true,
          result: { stdout: "4\n", stderr: "", exitCode: 0 },
        },
        { type: "content", content: "Commands executed successfully." },
      ];

      processAll(processor, events);
      const { parts } = processor.finalize();
      const tools = toolParts(parts);

      expect(tools).toHaveLength(3);
      expect(tools[0]!.type).toBe("tool-shell_exec");
      expect(tools[1]!.type).toBe("tool-shell_exec");
      expect(tools[2]!.type).toBe("tool-code_execute");

      // Each has output with stdout
      for (const t of tools) {
        expect(t.state).toBe("output-available");
        const output = t.output as Record<string, unknown>;
        expect(output).toHaveProperty("stdout");
      }

      // Verify stdout contents
      expect((tools[0]!.output as Record<string, unknown>).stdout).toBe("hello\n");
      expect((tools[2]!.output as Record<string, unknown>).stdout).toBe("4\n");
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 4. Full E2B File/IDE Session
  // ────────────────────────────────────────────────────────────────

  describe("Full E2B file/IDE session", () => {
    it("file_write → file_read → file_str_replace → correct code parts", () => {
      const events = [
        {
          type: "tool_start",
          toolCallId: "tc_fw",
          tool: "file_write",
          input: { path: "/home/user/app.py", content: "def main():\n    print('hello')\n" },
        },
        {
          type: "tool_result",
          toolCallId: "tc_fw",
          tool: "file_write",
          success: true,
          result: { success: true, path: "/home/user/app.py" },
        },
        {
          type: "tool_start",
          toolCallId: "tc_fr",
          tool: "file_read",
          input: { path: "/home/user/app.py" },
        },
        {
          type: "tool_result",
          toolCallId: "tc_fr",
          tool: "file_read",
          success: true,
          result: { content: "def main():\n    print('hello')\n", path: "/home/user/app.py" },
        },
        {
          type: "tool_start",
          toolCallId: "tc_fsr",
          tool: "file_str_replace",
          input: { path: "/home/user/app.py", old_str: "hello", new_str: "world" },
        },
        {
          type: "tool_result",
          toolCallId: "tc_fsr",
          tool: "file_str_replace",
          success: true,
          result: { success: true, path: "/home/user/app.py" },
        },
      ];

      processAll(processor, events);
      const { parts } = processor.finalize();
      const tools = toolParts(parts);

      expect(tools).toHaveLength(3);
      expect(tools[0]!.type).toBe("tool-file_write");
      expect(tools[1]!.type).toBe("tool-file_read");
      expect(tools[2]!.type).toBe("tool-file_str_replace");

      // file_write has input with content (for useCanvas to extract)
      const writeInput = tools[0]!.input as Record<string, unknown>;
      expect(writeInput.path).toBe("/home/user/app.py");
      expect(writeInput.content).toContain("def main()");

      // file_read has output with content
      const readOutput = tools[1]!.output as Record<string, unknown>;
      expect(readOutput.content).toContain("def main()");

      // file_str_replace has input with old_str and new_str
      const replaceInput = tools[2]!.input as Record<string, unknown>;
      expect(replaceInput.old_str).toBe("hello");
      expect(replaceInput.new_str).toBe("world");
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 5. File find operations
  // ────────────────────────────────────────────────────────────────

  describe("File find operations", () => {
    it("file_find_in_content produces code tool part", () => {
      const events = [
        {
          type: "tool_start",
          toolCallId: "tc_fic",
          tool: "file_find_in_content",
          input: { file: "/home/user/app.py", regex: "def .*:" },
        },
        {
          type: "tool_result",
          toolCallId: "tc_fic",
          tool: "file_find_in_content",
          success: true,
          result: {
            file: "/home/user/app.py",
            regex: "def .*:",
            matches: [{ line: 1, content: "def main():" }],
            count: 1,
          },
        },
      ];

      processAll(processor, events);
      const { parts } = processor.finalize();
      const tools = toolParts(parts);

      expect(tools).toHaveLength(1);
      expect(tools[0]!.type).toBe("tool-file_find_in_content");
      const output = tools[0]!.output as Record<string, unknown>;
      expect(output.count).toBe(1);
    });

    it("file_find_by_name produces code tool part", () => {
      const events = [
        {
          type: "tool_start",
          toolCallId: "tc_fbn",
          tool: "file_find_by_name",
          input: { path: "/home/user", glob: "*.py" },
        },
        {
          type: "tool_result",
          toolCallId: "tc_fbn",
          tool: "file_find_by_name",
          success: true,
          result: {
            path: "/home/user",
            glob: "*.py",
            files: ["/home/user/app.py", "/home/user/utils.py"],
            count: 2,
          },
        },
      ];

      processAll(processor, events);
      const { parts } = processor.finalize();
      const tools = toolParts(parts);

      expect(tools).toHaveLength(1);
      expect(tools[0]!.type).toBe("tool-file_find_by_name");
      const output = tools[0]!.output as Record<string, unknown>;
      expect(output.count).toBe(2);
      expect((output.files as string[]).length).toBe(2);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 6. Browser frame metadata pipeline
  // ────────────────────────────────────────────────────────────────

  describe("Browser frame metadata (live screenshots)", () => {
    it("browser_frame → message-metadata with browserFrame", () => {
      const chunks = processAll(processor, [
        {
          type: "browser_frame",
          screenshot: FAKE_SCREENSHOT,
          url: "https://example.com",
          title: "Example",
        },
      ]);

      const metaChunks = chunks.filter((c) => c.type === "message-metadata");
      expect(metaChunks).toHaveLength(1);

      const meta = metaChunks[0]!.messageMetadata as Record<string, unknown>;
      const frame = meta.browserFrame as Record<string, unknown>;
      expect(frame.screenshot).toBe(FAKE_SCREENSHOT);
      expect(frame.url).toBe("https://example.com");
      expect(frame.title).toBe("Example");
    });

    it("multiple browser frames emit multiple metadata events", () => {
      const chunks = processAll(processor, [
        {
          type: "browser_frame",
          screenshot: FAKE_SCREENSHOT,
          url: "https://page1.com",
          title: "Page 1",
        },
        {
          type: "browser_frame",
          screenshot: FAKE_SCREENSHOT,
          url: "https://page2.com",
          title: "Page 2",
        },
      ]);

      const metaChunks = chunks.filter((c) => c.type === "message-metadata");
      expect(metaChunks).toHaveLength(2);
    });

    it("browser_frame without URL still has screenshot", () => {
      const chunks = processAll(processor, [
        { type: "browser_frame", screenshot: FAKE_SCREENSHOT },
      ]);

      const meta = chunks.find((c) => c.type === "message-metadata");
      const frame = (meta!.messageMetadata as Record<string, unknown>).browserFrame as Record<string, unknown>;
      expect(frame.screenshot).toBe(FAKE_SCREENSHOT);
      expect(frame.url).toBe("");
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 7. Sandbox info propagation
  // ────────────────────────────────────────────────────────────────

  describe("Sandbox info propagation", () => {
    it("sandbox_info → message-metadata with sandboxId", () => {
      const chunks = processAll(processor, [
        { type: "sandbox_info", sandboxId: "sbx_abc123" },
      ]);

      const metaChunks = chunks.filter((c) => c.type === "message-metadata");
      expect(metaChunks).toHaveLength(1);
      const meta = metaChunks[0]!.messageMetadata as Record<string, unknown>;
      expect(meta.sandboxId).toBe("sbx_abc123");
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 8. Mixed session with all view types
  // ────────────────────────────────────────────────────────────────

  describe("Mixed session — all view types", () => {
    it("file + shell + browser tools produce parts for all views", () => {
      const events = [
        { type: "sandbox_info", sandboxId: "sbx_mixed" },
        // Code view
        {
          type: "tool_start",
          toolCallId: "tc_fw",
          tool: "file_write",
          input: { path: "/app.js", content: "console.log('hi')" },
        },
        {
          type: "tool_result",
          toolCallId: "tc_fw",
          tool: "file_write",
          success: true,
          result: { success: true },
        },
        // Terminal view
        {
          type: "tool_start",
          toolCallId: "tc_sh",
          tool: "shell_exec",
          input: { command: "node app.js" },
        },
        {
          type: "tool_result",
          toolCallId: "tc_sh",
          tool: "shell_exec",
          success: true,
          result: { stdout: "hi\n", stderr: "", exitCode: 0 },
        },
        // Browser view
        {
          type: "tool_start",
          toolCallId: "tc_nav",
          tool: "browser_navigate",
          input: { url: "http://localhost:3000" },
        },
        {
          type: "tool_result",
          toolCallId: "tc_nav",
          tool: "browser_navigate",
          success: true,
          result: { url: "http://localhost:3000", screenshot: FAKE_SCREENSHOT },
        },
        { type: "content", content: "Done!" },
      ];

      processAll(processor, events);
      const { parts } = processor.finalize();
      const tools = toolParts(parts);

      expect(tools).toHaveLength(3);
      expect(tools[0]!.type).toBe("tool-file_write");
      expect(tools[1]!.type).toBe("tool-shell_exec");
      expect(tools[2]!.type).toBe("tool-browser_navigate");

      // All have output-available state
      for (const t of tools) {
        expect(t.state).toBe("output-available");
      }

      // Text part also collected
      const textParts = parts.filter((p) => p.type === "text");
      expect(textParts).toHaveLength(1);
      expect((textParts[0] as Record<string, unknown>).text).toBe("Done!");
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 9. Error handling
  // ────────────────────────────────────────────────────────────────

  describe("Error handling", () => {
    it("failed tool → output-error state in part", () => {
      const events = [
        {
          type: "tool_start",
          toolCallId: "tc_fail",
          tool: "shell_exec",
          input: { command: "bad_command" },
        },
        {
          type: "tool_result",
          toolCallId: "tc_fail",
          tool: "shell_exec",
          success: false,
          result: { error: "Command not found: bad_command" },
        },
      ];

      processAll(processor, events);
      const { parts } = processor.finalize();
      const tools = toolParts(parts);

      expect(tools).toHaveLength(1);
      expect(tools[0]!.state).toBe("output-error");
    });

    it("tool failure emits tool-output-error SSE event", () => {
      const chunks = processAll(processor, [
        {
          type: "tool_start",
          toolCallId: "tc_fail2",
          tool: "file_read",
          input: { path: "/nonexistent" },
        },
        {
          type: "tool_result",
          toolCallId: "tc_fail2",
          tool: "file_read",
          success: false,
          result: { error: "File not found" },
        },
      ]);

      const errorChunk = chunks.find((c) => c.type === "tool-output-error");
      expect(errorChunk).toBeDefined();
      expect(errorChunk!.toolCallId).toBe("tc_fail2");
      expect(errorChunk!.errorText).toBe("File not found");
    });

    it("missing sandbox error in tool result", () => {
      const events = [
        {
          type: "tool_start",
          toolCallId: "tc_nosb",
          tool: "browser_navigate",
          input: { url: "https://example.com" },
        },
        {
          type: "tool_result",
          toolCallId: "tc_nosb",
          tool: "browser_navigate",
          success: false,
          result: { error: "No sandbox available. Browser tools require a sandbox." },
        },
      ];

      processAll(processor, events);
      const { parts } = processor.finalize();
      const tools = toolParts(parts);
      expect(tools[0]!.state).toBe("output-error");
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 10. Tool-output-available strict schema (NO toolName)
  // ────────────────────────────────────────────────────────────────

  describe("Strict AI SDK v6 schema compliance", () => {
    it("tool-output-available never contains toolName", () => {
      const chunks = processAll(processor, [
        {
          type: "tool_start",
          toolCallId: "tc_strict",
          tool: "browser_navigate",
          input: { url: "https://example.com" },
        },
        {
          type: "tool_result",
          toolCallId: "tc_strict",
          tool: "browser_navigate",
          success: true,
          result: { url: "https://example.com", screenshot: FAKE_SCREENSHOT },
        },
      ]);

      const outputChunks = chunks.filter((c) => c.type === "tool-output-available");
      expect(outputChunks).toHaveLength(1);
      expect(outputChunks[0]).not.toHaveProperty("toolName");
      expect(outputChunks[0]!.toolCallId).toBe("tc_strict");
    });

    it("tool-input-start and tool-input-available contain toolName", () => {
      const chunks = processAll(processor, [
        {
          type: "tool_start",
          toolCallId: "tc_input",
          tool: "shell_exec",
          input: { command: "echo test" },
        },
      ]);

      const inputStart = chunks.find((c) => c.type === "tool-input-start");
      const inputAvail = chunks.find((c) => c.type === "tool-input-available");
      expect(inputStart).toBeDefined();
      expect(inputStart!.toolName).toBe("shell_exec");
      expect(inputAvail).toBeDefined();
      expect(inputAvail!.toolName).toBe("shell_exec");
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 11. show_plan tool (no canvas, but parts collected)
  // ────────────────────────────────────────────────────────────────

  describe("show_plan tool (non-canvas)", () => {
    it("show_plan produces tool-show_plan part", () => {
      processAll(processor, [
        {
          type: "tool_start",
          toolCallId: "tc_plan",
          tool: "show_plan",
          input: {
            title: "Build website",
            todos: [
              { id: "1", title: "Create files", status: "in_progress" },
              { id: "2", title: "Deploy", status: "pending" },
            ],
          },
        },
        {
          type: "tool_result",
          toolCallId: "tc_plan",
          tool: "show_plan",
          success: true,
          result: {
            title: "Build website",
            todos: [
              { id: "1", title: "Create files", status: "in_progress" },
              { id: "2", title: "Deploy", status: "pending" },
            ],
          },
        },
      ]);

      const { parts } = processor.finalize();
      const tools = toolParts(parts);
      expect(tools).toHaveLength(1);
      expect(tools[0]!.type).toBe("tool-show_plan");
      expect(tools[0]!.state).toBe("output-available");

      const output = tools[0]!.output as Record<string, unknown>;
      expect(output.title).toBe("Build website");
      expect((output.todos as Array<Record<string, unknown>>)).toHaveLength(2);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 12. Communication tools
  // ────────────────────────────────────────────────────────────────

  describe("Communication tools (non-canvas)", () => {
    it("message_notify_user produces part but not canvas-mapped", () => {
      processAll(processor, [
        {
          type: "tool_start",
          toolCallId: "tc_notify",
          tool: "message_notify_user",
          input: { text: "Task complete!" },
        },
        {
          type: "tool_result",
          toolCallId: "tc_notify",
          tool: "message_notify_user",
          success: true,
          result: { sent: true },
        },
      ]);

      const { parts } = processor.finalize();
      const tools = toolParts(parts);
      expect(tools).toHaveLength(1);
      expect(tools[0]!.type).toBe("tool-message_notify_user");
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 13. Web search → browser view parts
  // ────────────────────────────────────────────────────────────────

  describe("Web search → browser parts", () => {
    it("web_search produces tool-web_search part with results", () => {
      processAll(processor, [
        {
          type: "tool_start",
          toolCallId: "tc_ws",
          tool: "web_search",
          input: { query: "react hooks" },
        },
        {
          type: "tool_result",
          toolCallId: "tc_ws",
          tool: "web_search",
          success: true,
          result: {
            results: [
              { title: "React Hooks", url: "https://react.dev", snippet: "Official docs" },
              { title: "Tutorial", url: "https://tutorial.com", snippet: "Learn React" },
            ],
          },
        },
      ]);

      const { parts } = processor.finalize();
      const tools = toolParts(parts);
      expect(tools).toHaveLength(1);
      expect(tools[0]!.type).toBe("tool-web_search");
      const output = tools[0]!.output as Record<string, unknown>;
      expect((output.results as Array<unknown>)).toHaveLength(2);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 14. Finalize closes all open parts
  // ────────────────────────────────────────────────────────────────

  describe("Finalize closes all open parts", () => {
    it("open text part closed on finalize", () => {
      processAll(processor, [
        { type: "content", content: "Hello " },
        { type: "content", content: "world!" },
      ]);

      const { parts, closingSSE } = processor.finalize();
      const textParts = parts.filter((p) => p.type === "text");
      expect(textParts).toHaveLength(1);
      expect((textParts[0] as Record<string, unknown>).text).toBe("Hello world!");

      // closingSSE should contain text-end
      expect(closingSSE).toContain("text-end");
    });

    it("open reasoning closed on finalize", () => {
      processAll(processor, [
        { type: "reasoning", content: "Thinking..." },
        { type: "reasoning", content: " about this..." },
      ]);

      const { parts, closingSSE } = processor.finalize();
      const reasoningParts = parts.filter((p) => p.type === "reasoning");
      expect(reasoningParts).toHaveLength(1);
      expect((reasoningParts[0] as Record<string, unknown>).text).toBe("Thinking... about this...");
      expect(closingSSE).toContain("reasoning-end");
    });

    it("open step closed on finalize", () => {
      processAll(processor, [
        {
          type: "tool_start",
          toolCallId: "tc_open",
          tool: "shell_exec",
          input: { command: "echo" },
        },
      ]);

      const { closingSSE } = processor.finalize();
      expect(closingSSE).toContain("finish-step");
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 15. Complete E2B full-stack pipeline
  // ────────────────────────────────────────────────────────────────

  describe("Complete E2B full-stack pipeline", () => {
    it("sandbox_info + plan + files + shell + browser + text → correct parts", () => {
      const events = [
        { type: "sandbox_info", sandboxId: "sbx_fullstack" },
        // Plan
        {
          type: "tool_start",
          toolCallId: "tc_plan",
          tool: "show_plan",
          input: { title: "Build app", todos: [{ id: "1", title: "Code", status: "in_progress" }] },
        },
        {
          type: "tool_result",
          toolCallId: "tc_plan",
          tool: "show_plan",
          success: true,
          result: { title: "Build app", todos: [] },
        },
        // File write
        {
          type: "tool_start",
          toolCallId: "tc_fw",
          tool: "file_write",
          input: { path: "/app.py", content: "print('hi')" },
        },
        {
          type: "tool_result",
          toolCallId: "tc_fw",
          tool: "file_write",
          success: true,
          result: { success: true },
        },
        // Shell
        {
          type: "tool_start",
          toolCallId: "tc_sh",
          tool: "shell_exec",
          input: { command: "python app.py" },
        },
        {
          type: "tool_result",
          toolCallId: "tc_sh",
          tool: "shell_exec",
          success: true,
          result: { stdout: "hi\n", exitCode: 0 },
        },
        // Browser
        {
          type: "tool_start",
          toolCallId: "tc_nav",
          tool: "browser_navigate",
          input: { url: "http://localhost:8080" },
        },
        {
          type: "browser_frame",
          screenshot: FAKE_SCREENSHOT,
          url: "http://localhost:8080",
          title: "App",
        },
        {
          type: "tool_result",
          toolCallId: "tc_nav",
          tool: "browser_navigate",
          success: true,
          result: { url: "http://localhost:8080", screenshot: FAKE_SCREENSHOT, title: "App" },
        },
        // Final text
        { type: "content", content: "All done! Your app is running." },
      ];

      const chunks = processAll(processor, events);
      const { parts } = processor.finalize();

      // Count part types
      const tools = toolParts(parts);
      const texts = parts.filter((p) => p.type === "text");

      expect(tools).toHaveLength(4); // plan, file, shell, browser
      expect(texts).toHaveLength(1);
      expect((texts[0] as Record<string, unknown>).text).toBe("All done! Your app is running.");

      // Verify tool order
      expect(tools[0]!.type).toBe("tool-show_plan");
      expect(tools[1]!.type).toBe("tool-file_write");
      expect(tools[2]!.type).toBe("tool-shell_exec");
      expect(tools[3]!.type).toBe("tool-browser_navigate");

      // Verify metadata events
      const metaChunks = chunks.filter((c) => c.type === "message-metadata");
      // At least sandbox_info + browser_frame
      expect(metaChunks.length).toBeGreaterThanOrEqual(2);

      // Verify sandbox_info
      const sbMeta = metaChunks.find(
        (c) => (c.messageMetadata as Record<string, unknown>)?.sandboxId
      );
      expect(sbMeta).toBeDefined();

      // Verify browser_frame
      const bfMeta = metaChunks.find(
        (c) => (c.messageMetadata as Record<string, unknown>)?.browserFrame
      );
      expect(bfMeta).toBeDefined();
    });
  });
});
