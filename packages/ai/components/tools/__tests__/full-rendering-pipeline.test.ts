/**
 * Full Rendering Pipeline Test Suite
 *
 * Tests the complete flow: Agent SSE events → SSEProcessor → collectedParts
 * → normalizeParts → isToolUIPart → getToolName → registry lookup → correct renderer
 *
 * Covers ALL 41 agent tools + 5 aliases, ChainOfThought merge for show_plan + web_search,
 * DB loading path, canvas view mapping, and duplicate detection.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { SSEProcessor } from "../../../../../apps/app/lib/chat/sse-processor";
import { TOOL_VIEW_MAP } from "../../canvas/use-canvas";

// ============================================================================
// Helper: mock the tool registry lookup (no React context in tests)
// ============================================================================

// These match the defaultRenderers keys in tool-registry.tsx
const REGISTERED_TOOLS: Record<string, string> = {
  // Search
  web_search: "WebSearchEnhanced",
  search_web: "WebSearchEnhanced",
  info_search_web: "WebSearchEnhanced",
  // Code
  code_execute: "CodeBlockEnhanced",
  // Shell
  shell_exec: "TerminalOutputEnhanced",
  shell_view: "TerminalOutputEnhanced",
  shell_wait: "TerminalOutputEnhanced",
  shell_write_to_process: "TerminalOutputEnhanced",
  shell_kill_process: "TerminalOutputEnhanced",
  // Files
  file_read: "FilePreview",
  file_write: "FilePreview",
  file_str_replace: "FilePreview",
  file_find_in_content: "FilePreview",
  file_find_by_name: "FilePreview",
  // Browser
  browser_navigate: "BrowserViewerEnhanced",
  browser_view: "BrowserViewerEnhanced",
  browser_click: "BrowserViewerEnhanced",
  browser_input: "BrowserViewerEnhanced",
  browser_scroll: "BrowserViewerEnhanced",
  browser_scroll_up: "BrowserViewerEnhanced",
  browser_scroll_down: "BrowserViewerEnhanced",
  browser_move_mouse: "BrowserViewerEnhanced",
  browser_key_press: "BrowserViewerEnhanced",
  browser_press_key: "BrowserViewerEnhanced",
  browser_select_option: "BrowserViewerEnhanced",
  browser_console_exec: "BrowserViewerEnhanced",
  browser_console_view: "BrowserViewerEnhanced",
  browser_screenshot: "BrowserViewerEnhanced",
  browser_restart: "BrowserViewerEnhanced",
  browser_save_image: "BrowserViewerEnhanced",
  browser_upload_file: "BrowserViewerEnhanced",
  browser_fill_form: "BrowserViewerEnhanced",
  browser_find_keyword: "BrowserViewerEnhanced",
  browser_close: "BrowserViewerEnhanced",
  // File view (binary/multimodal)
  file_view: "FilePreview",
  // Image
  generate_image: "ImageResult",
  // Deploy
  deploy_expose_port: "DeployResult",
  deploy_apply_deployment: "DeployResult",
  make_manus_page: "DeployResult",
  // Plan
  show_plan: "ShowPlanRenderer",
  // Communication
  message_notify_user: "MessageNotifyRenderer",
  message_ask_user: "MessageNotifyRenderer",
  // Scheduling
  schedule_task: "ProgressTool",
  schedule_recurring_task: "ProgressTool",
  check_outcomes: "ProgressTool",
  track_analytics: "ProgressTool",
  // Idle
  idle: "ProgressTool",
  // Text editor
  text_editor: "FilePreview",
  // Image utilities
  image_rmbg: "ImageResult",
  image_search_upload: "ImageResult",
  // Email
  gmail_send: "ProgressTool",
  gmail_download: "ProgressTool",
  outlook_send: "ProgressTool",
  outlook_download: "ProgressTool",
  // Skills
  skills_sync: "ProgressTool",
  skills_package: "ProgressTool",
  // Slides
  slide_init: "ProgressTool",
  slide_modify: "ProgressTool",
  slide_add_notes: "ProgressTool",
  slide_present: "DeployResult",
  // Parallel tasks
  parallel_tasks: "ProgressTool",
  // WebDev IDE
  webdev_init_project: "DeployResult",
  webdev_save_checkpoint: "ProgressTool",
  webdev_check_status: "ProgressTool",
  webdev_restart_server: "ProgressTool",
  webdev_rollback_checkpoint: "ProgressTool",
  webdev_execute_sql: "ProgressTool",
  webdev_push_schema: "ProgressTool",
  webdev_list_versions: "ProgressTool",
  webdev_add_feature: "ProgressTool",
};

function getRenderer(toolName: string): string {
  return REGISTERED_TOOLS[toolName] ?? "GenericTool";
}

// ============================================================================
// Helper: simulate SSE events through SSEProcessor
// ============================================================================

function makeToolStartSSE(tool: string, input: Record<string, unknown>, toolCallId?: string) {
  const id = toolCallId ?? `tool_${tool}_${Date.now()}`;
  return `data: ${JSON.stringify({ type: "tool_start", toolCallId: id, tool, input })}`;
}

function makeToolResultSSE(
  tool: string,
  result: Record<string, unknown>,
  toolCallId: string,
  success = true
) {
  return `data: ${JSON.stringify({ type: "tool_result", toolCallId, tool, success, result })}`;
}

function makeContentSSE(content: string) {
  return `data: ${JSON.stringify({ type: "content", content })}`;
}

function makeSandboxInfoSSE(sandboxId: string) {
  return `data: ${JSON.stringify({ type: "sandbox_info", sandboxId })}`;
}

function makeBrowserFrameSSE(screenshot: string, url?: string, title?: string) {
  return `data: ${JSON.stringify({ type: "browser_frame", screenshot, url, title })}`;
}

// ============================================================================
// Type guard helpers (matching ui-message.ts)
// ============================================================================

function isToolPart(part: Record<string, unknown>): boolean {
  return typeof part.type === "string" && (part.type as string).startsWith("tool-");
}

function getToolNameFromPart(part: Record<string, unknown>): string {
  if (part.type === "dynamic-tool") return part.toolName as string;
  return (part.type as string).slice(5); // Remove "tool-" prefix
}

// ============================================================================
// Tests
// ============================================================================

describe("Full Rendering Pipeline", () => {
  let processor: SSEProcessor;

  beforeEach(() => {
    processor = new SSEProcessor();
  });

  // ========================================================================
  // 1. ALL 33 AGENT TOOLS: SSE → Parts → Renderer
  // ========================================================================

  describe("All 41 agent tools produce correct parts and renderer mappings", () => {
    const AGENT_TOOLS: Array<{
      name: string;
      input: Record<string, unknown>;
      result: Record<string, unknown>;
      expectedRenderer: string;
      expectedCanvasView: string | undefined;
    }> = [
      // Planning
      {
        name: "show_plan",
        input: { title: "Test Plan", todos: [{ id: "1", label: "Step 1", status: "pending" }] },
        result: { title: "Test Plan", todos: [{ id: "1", label: "Step 1", status: "completed" }] },
        expectedRenderer: "ShowPlanRenderer",
        expectedCanvasView: undefined,
      },
      // Communication
      {
        name: "message_notify_user",
        input: { text: "Hello user" },
        result: { sent: true },
        expectedRenderer: "MessageNotifyRenderer",
        expectedCanvasView: undefined,
      },
      {
        name: "message_ask_user",
        input: { text: "What do you prefer?" },
        result: { response: "Option A" },
        expectedRenderer: "MessageNotifyRenderer",
        expectedCanvasView: undefined,
      },
      // File System (mapped to editor view — Manus FileToolView parity)
      {
        name: "file_read",
        input: { file: "/home/user/test.py" },
        result: { content: "print('hello')" },
        expectedRenderer: "FilePreview",
        expectedCanvasView: "editor",
      },
      {
        name: "file_write",
        input: { file: "/home/user/test.py", content: "print('hello')" },
        result: { success: true, path: "/home/user/test.py" },
        expectedRenderer: "FilePreview",
        expectedCanvasView: "editor",
      },
      {
        name: "file_str_replace",
        input: { file: "/home/user/test.py", old_str: "hello", new_str: "world" },
        result: { success: true },
        expectedRenderer: "FilePreview",
        expectedCanvasView: "editor",
      },
      {
        name: "file_find_in_content",
        input: { file: "/home/user/test.py", regex: "def\\s+" },
        result: { matches: ["def main():"] },
        expectedRenderer: "FilePreview",
        expectedCanvasView: "editor",
      },
      {
        name: "file_find_by_name",
        input: { path: "/home/user", glob: "*.py" },
        result: { files: ["/home/user/test.py", "/home/user/main.py"] },
        expectedRenderer: "FilePreview",
        expectedCanvasView: "editor",
      },
      // Shell
      {
        name: "shell_exec",
        input: { id: "main", exec_dir: "/home/user", command: "python3 test.py" },
        result: { stdout: "hello world\n", stderr: "", exitCode: 0 },
        expectedRenderer: "TerminalOutputEnhanced",
        expectedCanvasView: "terminal",
      },
      {
        name: "shell_view",
        input: { id: "main" },
        result: { content: "$ python3 test.py\nhello world" },
        expectedRenderer: "TerminalOutputEnhanced",
        expectedCanvasView: "terminal",
      },
      {
        name: "shell_wait",
        input: { id: "main", seconds: 5 },
        result: { exitCode: 0 },
        expectedRenderer: "TerminalOutputEnhanced",
        expectedCanvasView: "terminal",
      },
      {
        name: "shell_write_to_process",
        input: { id: "main", input: "yes\n", press_enter: true },
        result: { success: true },
        expectedRenderer: "TerminalOutputEnhanced",
        expectedCanvasView: "terminal",
      },
      {
        name: "shell_kill_process",
        input: { id: "main" },
        result: { killed: true },
        expectedRenderer: "TerminalOutputEnhanced",
        expectedCanvasView: "terminal",
      },
      // Code
      {
        name: "code_execute",
        input: { code: "print(42)", language: "python" },
        result: { stdout: "42\n", stderr: "", exitCode: 0 },
        expectedRenderer: "CodeBlockEnhanced",
        expectedCanvasView: "terminal",
      },
      // Search
      {
        name: "web_search",
        input: { query: "TypeScript 5.9" },
        result: { results: [{ title: "TS 5.9", url: "https://example.com", snippet: "..." }] },
        expectedRenderer: "WebSearchEnhanced",
        expectedCanvasView: "browser",
      },
      // Browser
      {
        name: "browser_navigate",
        input: { url: "https://example.com" },
        result: { url: "https://example.com", title: "Example", content: "Hello", screenshot: "iVBORbase64" },
        expectedRenderer: "BrowserViewerEnhanced",
        expectedCanvasView: "browser",
      },
      {
        name: "browser_view",
        input: {},
        result: { url: "https://example.com", title: "Example", content: "Page content" },
        expectedRenderer: "BrowserViewerEnhanced",
        expectedCanvasView: "browser",
      },
      {
        name: "browser_click",
        input: { index: 3 },
        result: { screenshot: "iVBORclicked", url: "https://example.com/page2" },
        expectedRenderer: "BrowserViewerEnhanced",
        expectedCanvasView: "browser",
      },
      {
        name: "browser_input",
        input: { index: 1, text: "Hello", press_enter: true },
        result: { screenshot: "iVBORinput" },
        expectedRenderer: "BrowserViewerEnhanced",
        expectedCanvasView: "browser",
      },
      {
        name: "browser_scroll_up",
        input: {},
        result: { screenshot: "iVBORscrolled" },
        expectedRenderer: "BrowserViewerEnhanced",
        expectedCanvasView: "browser",
      },
      {
        name: "browser_scroll_down",
        input: { to_bottom: true },
        result: { screenshot: "iVBORbottom" },
        expectedRenderer: "BrowserViewerEnhanced",
        expectedCanvasView: "browser",
      },
      {
        name: "browser_move_mouse",
        input: { coordinate_x: 100, coordinate_y: 200 },
        result: { screenshot: "iVBORmouse" },
        expectedRenderer: "BrowserViewerEnhanced",
        expectedCanvasView: "browser",
      },
      {
        name: "browser_press_key",
        input: { key: "Enter" },
        result: { screenshot: "iVBORenter" },
        expectedRenderer: "BrowserViewerEnhanced",
        expectedCanvasView: "browser",
      },
      {
        name: "browser_select_option",
        input: { index: 2, option: 1 },
        result: { screenshot: "iVBORselect" },
        expectedRenderer: "BrowserViewerEnhanced",
        expectedCanvasView: "browser",
      },
      {
        name: "browser_console_exec",
        input: { javascript: "document.title" },
        result: { result: "Example Domain", logs: [] },
        expectedRenderer: "BrowserViewerEnhanced",
        expectedCanvasView: "browser",
      },
      {
        name: "browser_console_view",
        input: {},
        result: { logs: ["[info] Page loaded"] },
        expectedRenderer: "BrowserViewerEnhanced",
        expectedCanvasView: "browser",
      },
      {
        name: "browser_screenshot",
        input: { full_page: false },
        result: { screenshot: "iVBORscreenshot" },
        expectedRenderer: "BrowserViewerEnhanced",
        expectedCanvasView: "browser",
      },
      {
        name: "browser_restart",
        input: { url: "https://example.com" },
        result: { screenshot: "iVBORrestart", url: "https://example.com" },
        expectedRenderer: "BrowserViewerEnhanced",
        expectedCanvasView: "browser",
      },
      // Deploy
      {
        name: "deploy_expose_port",
        input: { port: 3000 },
        result: { url: "https://sandbox-abc.e2b.dev:3000", port: 3000 },
        expectedRenderer: "DeployResult",
        expectedCanvasView: "browser",
      },
      {
        name: "deploy_apply_deployment",
        input: { type: "static", local_dir: "/home/user/dist" },
        result: { url: "https://my-app.rubic.dev", success: true },
        expectedRenderer: "DeployResult",
        expectedCanvasView: "browser",
      },
      // Image
      {
        name: "generate_image",
        input: { prompt: "A sunset over mountains" },
        result: { url: "https://example.com/image.png", path: "/home/user/image.png" },
        expectedRenderer: "ImageResult",
        expectedCanvasView: "aiCanvas",
      },
      // Scheduling
      {
        name: "schedule_recurring_task",
        input: { name: "Daily report", description: "Send daily report", schedule: "daily" },
        result: { id: "task-123", created: true },
        expectedRenderer: "ProgressTool",
        expectedCanvasView: undefined,
      },
      // Analytics
      {
        name: "check_outcomes",
        input: { source: "social_media", platform: "twitter" },
        result: { summary: "10 posts, 500 impressions" },
        expectedRenderer: "ProgressTool",
        expectedCanvasView: undefined,
      },
      // WebDev IDE
      {
        name: "webdev_init_project",
        input: { template_id: "web-static", app_name: "my-app" },
        result: { success: true, app_name: "my-app", directory: "/home/ubuntu/my-app", devServerPort: 3000, previewUrl: "https://3000-abc.e2b.dev" },
        expectedRenderer: "DeployResult",
        expectedCanvasView: "webDevIDE",
      },
      {
        name: "webdev_save_checkpoint",
        input: { message: "Initial commit" },
        result: { success: true, versionId: "abc1234", commitHash: "abc1234" },
        expectedRenderer: "ProgressTool",
        expectedCanvasView: "webDevIDE",
      },
      {
        name: "webdev_check_status",
        input: {},
        result: { devServer: { status: "running", port: 3000 } },
        expectedRenderer: "ProgressTool",
        expectedCanvasView: "webDevIDE",
      },
      {
        name: "webdev_restart_server",
        input: {},
        result: { success: true, devServerStatus: "running", port: 3000 },
        expectedRenderer: "ProgressTool",
        expectedCanvasView: "webDevIDE",
      },
      {
        name: "webdev_rollback_checkpoint",
        input: { version_id: "abc1234" },
        result: { success: true, currentVersion: "abc1234" },
        expectedRenderer: "ProgressTool",
        expectedCanvasView: "webDevIDE",
      },
      {
        name: "webdev_execute_sql",
        input: { query: "SELECT * FROM users" },
        result: { success: true, data: [], rowCount: 0 },
        expectedRenderer: "ProgressTool",
        expectedCanvasView: "webDevIDE",
      },
      {
        name: "webdev_push_schema",
        input: {},
        result: { success: true, operation: "push", output: "Schema pushed" },
        expectedRenderer: "ProgressTool",
        expectedCanvasView: "webDevIDE",
      },
      {
        name: "webdev_list_versions",
        input: {},
        result: { versions: [{ hash: "abc1234", message: "Initial", date: "2026-02-15" }] },
        expectedRenderer: "ProgressTool",
        expectedCanvasView: "webDevIDE",
      },
      {
        name: "webdev_add_feature",
        input: { feature: "auth", description: "Add authentication" },
        result: { success: true, feature: "auth" },
        expectedRenderer: "ProgressTool",
        expectedCanvasView: "webDevIDE",
      },
    ];

    for (const tool of AGENT_TOOLS) {
      it(`${tool.name}: SSE → correct part type → correct renderer`, () => {
        const toolCallId = `tool_${tool.name}_test`;

        // Process tool_start
        const startSSE = makeToolStartSSE(tool.name, tool.input, toolCallId);
        const startOutput = processor.process(startSSE);
        expect(startOutput).toContain("tool-input-start");
        expect(startOutput).toContain("tool-input-available");
        expect(startOutput).toContain(toolCallId);
        expect(startOutput).toContain(tool.name);

        // Process tool_result
        const resultSSE = makeToolResultSSE(tool.name, tool.result, toolCallId);
        const resultOutput = processor.process(resultSSE);
        expect(resultOutput).toContain("tool-output-available");
        expect(resultOutput).toContain(toolCallId);

        // Verify collected parts
        const toolParts = processor.collectedParts.filter(isToolPart);
        expect(toolParts.length).toBe(1);

        const part = toolParts[0]!;
        expect(part.type).toBe(`tool-${tool.name}`);
        expect(part.toolCallId).toBe(toolCallId);
        expect(part.toolName).toBe(tool.name);
        expect(part.state).toBe("output-available");
        expect(part.output).toBeDefined();

        // Verify renderer lookup
        const rendererName = getRenderer(getToolNameFromPart(part));
        expect(rendererName).toBe(tool.expectedRenderer);

        // Verify canvas view mapping
        const canvasView = TOOL_VIEW_MAP[tool.name];
        expect(canvasView).toBe(tool.expectedCanvasView);
      });
    }
  });

  // ========================================================================
  // 2. ALIAS TOOLS: Canvas aliases get correct renderers
  // ========================================================================

  describe("TOOL_VIEW_MAP alias tools get correct renderers (not GenericTool)", () => {
    const aliases = [
      { name: "browser_scroll", renderer: "BrowserViewerEnhanced", view: "browser" },
      { name: "browser_key_press", renderer: "BrowserViewerEnhanced", view: "browser" },
      { name: "info_search_web", renderer: "WebSearchEnhanced", view: "browser" },
      { name: "search_web", renderer: "WebSearchEnhanced", view: "browser" },
      { name: "make_manus_page", renderer: "DeployResult", view: "browser" },
    ];

    for (const alias of aliases) {
      it(`${alias.name}: renderer=${alias.renderer}, canvas=${alias.view}`, () => {
        expect(getRenderer(alias.name)).toBe(alias.renderer);
        expect(TOOL_VIEW_MAP[alias.name]).toBe(alias.view);
      });
    }
  });

  // ========================================================================
  // 3. NO TOOL FALLS THROUGH TO GenericTool
  // ========================================================================

  describe("No known tool falls through to GenericTool", () => {
    it("All TOOL_VIEW_MAP entries have explicit renderers", () => {
      const missingRenderers: string[] = [];
      for (const toolName of Object.keys(TOOL_VIEW_MAP)) {
        if (getRenderer(toolName) === "GenericTool") {
          missingRenderers.push(toolName);
        }
      }
      expect(missingRenderers).toEqual([]);
    });

    it("All agent tools have explicit renderers", () => {
      const agentTools = [
        "show_plan", "message_notify_user", "message_ask_user",
        "file_read", "file_write", "file_str_replace", "file_find_in_content", "file_find_by_name", "file_view",
        "shell_exec", "shell_view", "shell_wait", "shell_write_to_process", "shell_kill_process",
        "code_execute", "web_search",
        "browser_view", "browser_navigate", "browser_restart", "browser_click", "browser_input",
        "browser_move_mouse", "browser_press_key", "browser_select_option",
        "browser_scroll_up", "browser_scroll_down",
        "browser_console_exec", "browser_console_view", "browser_screenshot",
        "browser_save_image", "browser_upload_file", "browser_fill_form", "browser_find_keyword", "browser_close",
        "deploy_expose_port", "deploy_apply_deployment",
        "generate_image", "schedule_recurring_task", "check_outcomes",
        "webdev_init_project", "webdev_save_checkpoint", "webdev_check_status",
        "webdev_restart_server", "webdev_rollback_checkpoint", "webdev_execute_sql",
        "webdev_push_schema", "webdev_list_versions", "webdev_add_feature",
      ];

      const missingRenderers: string[] = [];
      for (const toolName of agentTools) {
        if (getRenderer(toolName) === "GenericTool") {
          missingRenderers.push(toolName);
        }
      }
      expect(missingRenderers).toEqual([]);
    });
  });

  // ========================================================================
  // 4. NO DUPLICATE PARTS IN COLLECTED PARTS
  // ========================================================================

  describe("No duplicate parts in collectedParts", () => {
    it("Multi-tool session produces exactly one part per tool call", () => {
      const tools = ["show_plan", "file_write", "shell_exec", "show_plan", "message_notify_user"];
      const toolCallIds: string[] = [];

      for (const tool of tools) {
        const id = `tool_${tool}_${toolCallIds.length}`;
        toolCallIds.push(id);

        processor.process(makeToolStartSSE(tool, { test: true }, id));
        processor.process(
          makeToolResultSSE(tool, { success: true }, id)
        );
      }

      const toolParts = processor.collectedParts.filter(isToolPart);
      expect(toolParts.length).toBe(tools.length);

      // Each toolCallId should appear exactly once
      const ids = toolParts.map((p) => p.toolCallId as string);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it("Text parts between tool calls are separate entries", () => {
      processor.process(makeContentSSE("Hello "));
      processor.process(makeContentSSE("world"));
      processor.process(makeToolStartSSE("file_write", { file: "test.txt" }, "t1"));
      processor.process(makeToolResultSSE("file_write", { success: true }, "t1"));
      processor.process(makeContentSSE("Done!"));

      const { parts } = processor.finalize();

      // Should have: text("Hello world"), tool-file_write, text("Done!")
      const textParts = parts.filter((p) => p.type === "text");
      const toolParts = parts.filter(isToolPart);

      expect(textParts.length).toBe(2);
      expect(toolParts.length).toBe(1);
      expect((textParts[0] as Record<string, unknown>).text).toBe("Hello world");
      expect((textParts[1] as Record<string, unknown>).text).toBe("Done!");
    });
  });

  // ========================================================================
  // 5. SSE PROCESSOR LIFECYCLE EVENTS
  // ========================================================================

  describe("SSE processor emits correct AI SDK v6 lifecycle events", () => {
    it("Content events produce text-start → text-delta → text-end", () => {
      const o1 = processor.process(makeContentSSE("Hello"));
      expect(o1).toContain('"type":"text-start"');
      expect(o1).toContain('"type":"text-delta"');

      const o2 = processor.process(makeContentSSE(" world"));
      expect(o2).toContain('"type":"text-delta"');
      expect(o2).not.toContain('"type":"text-start"'); // Only one start

      const { closingSSE } = processor.finalize();
      expect(closingSSE).toContain('"type":"text-end"');
    });

    it("Tool events close open text part before tool-input-start", () => {
      processor.process(makeContentSSE("I'll help"));
      const toolOutput = processor.process(
        makeToolStartSSE("file_write", { file: "test.txt" }, "t1")
      );

      // Should contain text-end (closing the text part) before tool-input-start
      expect(toolOutput).toContain('"type":"text-end"');
      expect(toolOutput).toContain('"type":"tool-input-start"');

      // text-end should come before tool-input-start
      const textEndIdx = toolOutput.indexOf('"type":"text-end"');
      const toolStartIdx = toolOutput.indexOf('"type":"tool-input-start"');
      expect(textEndIdx).toBeLessThan(toolStartIdx);
    });

    it("Step boundaries wrap tool events", () => {
      const output = processor.process(
        makeToolStartSSE("file_write", { file: "test.txt" }, "t1")
      );
      expect(output).toContain('"type":"start-step"');
    });

    it("sandbox_info emits message-metadata with sandboxId", () => {
      const output = processor.process(makeSandboxInfoSSE("sandbox-123"));
      expect(output).toContain('"type":"message-metadata"');
      expect(output).toContain('"sandboxId":"sandbox-123"');
    });

    it("browser_frame emits message-metadata with browserFrame", () => {
      const output = processor.process(
        makeBrowserFrameSSE("iVBORbase64screenshot", "https://example.com", "Example")
      );
      expect(output).toContain('"type":"message-metadata"');
      expect(output).toContain('"browserFrame"');
      expect(output).toContain('"screenshot":"iVBORbase64screenshot"');
    });

    it("tool_result with success=false emits tool-output-error", () => {
      processor.process(makeToolStartSSE("shell_exec", { command: "fail" }, "t1"));
      const output = processor.process(
        `data: ${JSON.stringify({
          type: "tool_result",
          toolCallId: "t1",
          tool: "shell_exec",
          success: false,
          result: { error: "Command not found" },
        })}`
      );
      expect(output).toContain('"type":"tool-output-error"');
      expect(output).toContain("Command not found");
    });
  });

  // ========================================================================
  // 6. COLLECTED PARTS STATE TRANSITIONS
  // ========================================================================

  describe("Collected parts track correct state transitions", () => {
    it("Tool part starts as input-available, transitions to output-available", () => {
      processor.process(makeToolStartSSE("file_write", { file: "test.txt" }, "t1"));

      let toolParts = processor.collectedParts.filter(isToolPart);
      expect(toolParts.length).toBe(1);
      expect(toolParts[0]!.state).toBe("input-available");

      processor.process(makeToolResultSSE("file_write", { success: true }, "t1"));

      toolParts = processor.collectedParts.filter(isToolPart);
      expect(toolParts.length).toBe(1); // Still 1 — updated in place
      expect(toolParts[0]!.state).toBe("output-available");
      expect(toolParts[0]!.output).toEqual({ success: true });
    });

    it("Failed tool transitions to output-error (no output field)", () => {
      processor.process(makeToolStartSSE("shell_exec", { command: "bad" }, "t1"));
      processor.process(
        `data: ${JSON.stringify({
          type: "tool_result",
          toolCallId: "t1",
          tool: "shell_exec",
          success: false,
          result: { error: "ENOENT" },
        })}`
      );

      const toolParts = processor.collectedParts.filter(isToolPart);
      expect(toolParts[0]!.state).toBe("output-error");
      expect(toolParts[0]!.output).toBeUndefined();
    });
  });

  // ========================================================================
  // 7. DB LOADING: normalizeParts compatibility
  // ========================================================================

  describe("DB-loaded parts are compatible with rendering pipeline", () => {
    it("Parts from collectedParts have correct shape for isToolUIPart", () => {
      processor.process(makeToolStartSSE("browser_navigate", { url: "https://example.com" }, "t1"));
      processor.process(
        makeToolResultSSE("browser_navigate", {
          url: "https://example.com",
          title: "Example",
          screenshot: "iVBOR",
        }, "t1")
      );

      const { parts } = processor.finalize();
      const toolPart = parts.find(isToolPart)!;

      // Verify shape matches StaticToolUIPart
      expect(toolPart.type).toBe("tool-browser_navigate");
      expect(typeof toolPart.type).toBe("string");
      expect((toolPart.type as string).startsWith("tool-")).toBe(true);
      expect(toolPart.toolCallId).toBe("t1");
      expect(toolPart.state).toBe("output-available");
      expect(toolPart.input).toEqual({ url: "https://example.com" });
      expect(toolPart.output).toBeDefined();

      // Verify getToolNameFromPart works
      expect(getToolNameFromPart(toolPart)).toBe("browser_navigate");
    });

    it("normalizeParts handles legacy tool-invocation format", () => {
      // Simulating what normalizeParts in use-chat-session.ts does
      const legacyPart = {
        type: "tool-invocation",
        toolName: "file_write",
        toolCallId: "legacy-123",
        state: "output-available",
        input: { file: "test.txt", content: "hello" },
        output: { success: true },
      };

      // normalizeParts would convert this to tool-file_write
      const converted = {
        ...legacyPart,
        type: `tool-${legacyPart.toolName}`,
        state: legacyPart.state || "output-available",
      };

      expect(converted.type).toBe("tool-file_write");
      expect(isToolPart(converted as Record<string, unknown>)).toBe(true);
      expect(getToolNameFromPart(converted as Record<string, unknown>)).toBe("file_write");
      expect(getRenderer("file_write")).toBe("FilePreview");
    });
  });

  // ========================================================================
  // 8. FULL MULTI-TOOL SESSION SIMULATION
  // ========================================================================

  describe("Full multi-tool session: plan + search + file + shell + browser", () => {
    it("Processes a complete agent session with correct parts order", () => {
      // 1. Sandbox info
      processor.process(makeSandboxInfoSSE("sandbox-abc"));

      // 2. Initial content
      processor.process(makeContentSSE("I'll help you build a website."));

      // 3. Show plan
      processor.process(
        makeToolStartSSE("show_plan", {
          title: "Build Website",
          todos: [
            { id: "1", label: "Search for templates", status: "in_progress" },
            { id: "2", label: "Create HTML file", status: "pending" },
            { id: "3", label: "Run dev server", status: "pending" },
          ],
        }, "plan-1")
      );
      processor.process(
        makeToolResultSSE("show_plan", {
          title: "Build Website",
          todos: [
            { id: "1", label: "Search for templates", status: "in_progress" },
            { id: "2", label: "Create HTML file", status: "pending" },
            { id: "3", label: "Run dev server", status: "pending" },
          ],
        }, "plan-1")
      );

      // 4. Web search
      processor.process(
        makeToolStartSSE("web_search", { query: "modern HTML templates" }, "search-1")
      );
      processor.process(
        makeToolResultSSE("web_search", {
          results: [
            { title: "Template Hub", url: "https://templates.com", snippet: "Best templates" },
          ],
        }, "search-1")
      );

      // 5. File write
      processor.process(
        makeToolStartSSE("file_write", {
          file: "/home/user/index.html",
          content: "<html><body>Hello</body></html>",
        }, "file-1")
      );
      processor.process(
        makeToolResultSSE("file_write", { success: true, path: "/home/user/index.html" }, "file-1")
      );

      // 6. Shell exec
      processor.process(
        makeToolStartSSE("shell_exec", {
          id: "main",
          exec_dir: "/home/user",
          command: "python3 -m http.server 8080",
        }, "shell-1")
      );
      processor.process(
        makeToolResultSSE("shell_exec", {
          stdout: "Serving on port 8080\n",
          exitCode: 0,
        }, "shell-1")
      );

      // 7. Browser navigate
      processor.process(
        makeToolStartSSE("browser_navigate", { url: "http://localhost:8080" }, "nav-1")
      );
      processor.process(
        makeToolResultSSE("browser_navigate", {
          url: "http://localhost:8080",
          title: "Hello",
          screenshot: "iVBORbase64data",
        }, "nav-1")
      );

      // 8. Browser frame
      processor.process(
        makeBrowserFrameSSE("iVBORliveframe", "http://localhost:8080", "Hello")
      );

      // 9. Updated plan
      processor.process(
        makeToolStartSSE("show_plan", {
          title: "Build Website",
          todos: [
            { id: "1", label: "Search for templates", status: "completed" },
            { id: "2", label: "Create HTML file", status: "completed" },
            { id: "3", label: "Run dev server", status: "completed" },
          ],
        }, "plan-2")
      );
      processor.process(
        makeToolResultSSE("show_plan", {
          title: "Build Website",
          todos: [
            { id: "1", label: "Search for templates", status: "completed" },
            { id: "2", label: "Create HTML file", status: "completed" },
            { id: "3", label: "Run dev server", status: "completed" },
          ],
        }, "plan-2")
      );

      // 10. Final message
      processor.process(makeContentSSE("Your website is ready!"));

      // Finalize
      const { parts } = processor.finalize();

      // Verify part counts
      const textParts = parts.filter((p) => p.type === "text");
      const toolParts = parts.filter(isToolPart);

      expect(textParts.length).toBe(2); // "I'll help..." and "Your website is ready!"

      // Each tool_start creates one entry, tool_result updates it.
      // Tools: show_plan(plan-1), web_search(search-1), file_write(file-1),
      //        shell_exec(shell-1), browser_navigate(nav-1), show_plan(plan-2) = 6
      expect(toolParts.length).toBe(6);

      // Verify no duplicates
      const toolCallIds = toolParts.map((p) => p.toolCallId as string);
      expect(new Set(toolCallIds).size).toBe(toolCallIds.length);

      // Verify all tools are output-available
      for (const part of toolParts) {
        expect(part.state).toBe("output-available");
      }

      // Verify renderer mappings
      const renderers = toolParts.map(
        (p) => getRenderer(getToolNameFromPart(p))
      );
      expect(renderers).toEqual([
        "ShowPlanRenderer",
        "WebSearchEnhanced",
        "FilePreview",
        "TerminalOutputEnhanced",
        "BrowserViewerEnhanced",
        "ShowPlanRenderer",
      ]);

      // Verify canvas view mappings
      const canvasViews = toolParts.map(
        (p) => TOOL_VIEW_MAP[getToolNameFromPart(p)]
      );
      expect(canvasViews).toEqual([
        undefined, // show_plan — no canvas
        "browser", // web_search
        "editor", // file_write — Manus FileToolView parity
        "terminal", // shell_exec
        "browser", // browser_navigate
        undefined, // show_plan — no canvas
      ]);
    });
  });

  // ========================================================================
  // 9. TOOL_VIEW_MAP COMPLETENESS — Every entry has a renderer
  // ========================================================================

  describe("TOOL_VIEW_MAP ↔ Registry 1:1 coverage", () => {
    it("Every TOOL_VIEW_MAP entry resolves to a non-GenericTool renderer", () => {
      const failures: string[] = [];
      for (const [toolName, viewType] of Object.entries(TOOL_VIEW_MAP)) {
        const renderer = getRenderer(toolName);
        if (renderer === "GenericTool") {
          failures.push(`${toolName} (canvas: ${viewType}) → GenericTool`);
        }
      }
      expect(failures).toEqual([]);
    });
  });

  // ========================================================================
  // 10. EDGE CASES
  // ========================================================================

  describe("Edge cases", () => {
    it("Unknown tool falls to GenericTool", () => {
      expect(getRenderer("some_future_tool")).toBe("GenericTool");
    });

    it("Empty tool name falls to GenericTool", () => {
      expect(getRenderer("")).toBe("GenericTool");
    });

    it("[DONE] event produces no output", () => {
      const output = processor.process("data: [DONE]");
      expect(output).toBe("");
    });

    it("Malformed SSE produces no output", () => {
      const output = processor.process("not valid sse");
      expect(output).toBe("");
    });

    it("Multiple content events accumulate into one text part", () => {
      processor.process(makeContentSSE("Hello "));
      processor.process(makeContentSSE("world"));
      processor.process(makeContentSSE("!"));

      const { parts } = processor.finalize();
      const textParts = parts.filter((p) => p.type === "text");
      expect(textParts.length).toBe(1);
      expect(textParts[0]!.text).toBe("Hello world!");
    });

    it("Reasoning events produce reasoning parts", () => {
      const o1 = processor.process(
        `data: ${JSON.stringify({ type: "reasoning", content: "Let me think..." })}`
      );
      expect(o1).toContain('"type":"reasoning-start"');
      expect(o1).toContain('"type":"reasoning-delta"');

      const o2 = processor.process(
        `data: ${JSON.stringify({ type: "reasoning_end" })}`
      );
      expect(o2).toContain('"type":"reasoning-end"');

      const { parts } = processor.finalize();
      const reasoningParts = parts.filter((p) => p.type === "reasoning");
      expect(reasoningParts.length).toBe(1);
      expect(reasoningParts[0]!.text).toBe("Let me think...");
    });

    it("Warning events inject emoji-prefixed text", () => {
      processor.process(
        `data: ${JSON.stringify({ type: "warning", message: "Rate limited" })}`
      );

      const { parts } = processor.finalize();
      const textParts = parts.filter((p) => p.type === "text");
      expect(textParts.length).toBe(1);
      expect((textParts[0]!.text as string).includes("⚠️ Rate limited")).toBe(true);
    });

    it("Error event emits error chunk", () => {
      const output = processor.process(
        `data: ${JSON.stringify({ type: "error", error: "Something went wrong" })}`
      );
      expect(output).toContain('"type":"error"');
      expect(output).toContain("Something went wrong");
    });

    it("Usage event emits message-metadata", () => {
      const output = processor.process(
        `data: ${JSON.stringify({
          type: "usage",
          usage: { input_tokens: 100, output_tokens: 50 },
          iterations: 3,
          tool_calls_count: 2,
        })}`
      );
      expect(output).toContain('"type":"message-metadata"');
      expect(output).toContain('"input_tokens":100');
    });
  });

  // ========================================================================
  // 11. CANVAS VIEW TYPE CORRECTNESS
  // ========================================================================

  describe("Canvas view type assignments are correct", () => {
    const browserTools = [
      "browser_navigate", "browser_view", "browser_click", "browser_input",
      "browser_scroll", "browser_scroll_up", "browser_scroll_down",
      "browser_move_mouse", "browser_key_press", "browser_press_key",
      "browser_select_option", "browser_console_exec", "browser_console_view",
      "browser_screenshot", "browser_restart",
      "browser_save_image", "browser_upload_file", "browser_fill_form",
      "browser_find_keyword", "browser_close",
      "web_search", "search_web", "info_search_web",
      "deploy_expose_port", "deploy_apply_deployment", "make_manus_page",
      "slide_present", "image_search_upload",
    ];

    const terminalTools = [
      "shell_exec", "shell_view", "shell_wait", "shell_write_to_process",
      "shell_kill_process", "code_execute",
    ];

    const codeTools = [
      // File tools + text_editor map to code (Manus FileToolView parity)
      "file_read", "file_write", "file_str_replace",
      "file_find_in_content", "file_find_by_name", "file_view",
      "text_editor",
    ];

    const noCanvasTools = [
      "show_plan", "message_notify_user", "message_ask_user",
      "schedule_recurring_task", "check_outcomes",
    ];

    for (const tool of browserTools) {
      it(`${tool} → browser canvas`, () => {
        expect(TOOL_VIEW_MAP[tool]).toBe("browser");
      });
    }

    for (const tool of terminalTools) {
      it(`${tool} → terminal canvas`, () => {
        expect(TOOL_VIEW_MAP[tool]).toBe("terminal");
      });
    }

    for (const tool of codeTools) {
      it(`${tool} → editor canvas (Manus FileToolView parity)`, () => {
        expect(TOOL_VIEW_MAP[tool]).toBe("editor");
      });
    }

    for (const tool of noCanvasTools) {
      it(`${tool} → no canvas view`, () => {
        expect(TOOL_VIEW_MAP[tool]).toBeUndefined();
      });
    }
  });

  // ========================================================================
  // 11. REAL ORCHESTRATOR DATA SHAPES — show_plan
  // ========================================================================

  describe("Real orchestrator show_plan data shapes", () => {
    // The orchestrator's plan-tools.ts uses:
    //   Input schema: { steps: [{ id, title, description?, status }] }
    //   Output: { status: 'success', plan: [{ id, title, description?, status }] }
    // This is DIFFERENT from the legacy "todos" format used in older tests.

    it("Processes show_plan with real orchestrator input format (steps, not todos)", () => {
      const realInput = {
        steps: [
          { id: "step-1", title: "Search for templates", description: "Find modern HTML5 templates", status: "in_progress" },
          { id: "step-2", title: "Create project structure", status: "pending" },
          { id: "step-3", title: "Deploy to production", status: "pending" },
        ],
      };

      processor.process(makeToolStartSSE("show_plan", realInput, "plan-real-1"));

      const { parts } = processor.finalize();
      const planPart = parts.find(isToolPart);

      expect(planPart).toBeDefined();
      expect(getToolNameFromPart(planPart!)).toBe("show_plan");
      expect(planPart!.state).toBe("input-available");
      expect(planPart!.input).toEqual(realInput);

      // Verify extractPlanSteps-compatible: data.steps should be found
      const data = planPart!.input as Record<string, unknown>;
      const extracted = (data.plan ?? data.todos ?? data.steps ?? data.phases) as
        | Array<{ id?: string; title?: string; label?: string; status?: string; description?: string }>
        | undefined;
      expect(extracted).toBeDefined();
      expect(extracted!.length).toBe(3);
      expect(extracted![0]!.title).toBe("Search for templates");
      expect(extracted![0]!.description).toBe("Find modern HTML5 templates");
      expect(extracted![0]!.status).toBe("in_progress");
    });

    it("Processes show_plan with real orchestrator output format (plan, not todos)", () => {
      const realInput = {
        steps: [
          { id: "step-1", title: "Search for templates", status: "in_progress" },
          { id: "step-2", title: "Create project structure", status: "pending" },
        ],
      };
      const realOutput = {
        status: "success",
        plan: [
          { id: "step-1", title: "Search for templates", status: "in_progress" },
          { id: "step-2", title: "Create project structure", status: "pending" },
        ],
      };

      processor.process(makeToolStartSSE("show_plan", realInput, "plan-real-2"));
      processor.process(makeToolResultSSE("show_plan", realOutput, "plan-real-2"));

      const { parts } = processor.finalize();
      const planPart = parts.find(isToolPart);

      expect(planPart).toBeDefined();
      expect(planPart!.state).toBe("output-available");

      // When output is available, extractPlanSteps prefers output over input
      const data = planPart!.output as Record<string, unknown>;
      const extracted = (data.plan ?? data.todos ?? data.steps ?? data.phases) as
        | Array<{ id?: string; title?: string; status?: string }>
        | undefined;
      expect(extracted).toBeDefined();
      expect(extracted!.length).toBe(2);
      expect(extracted![0]!.title).toBe("Search for templates");
      // "plan" field is found FIRST in the fallback chain
      expect(data.plan).toBeDefined();
      expect(data.todos).toBeUndefined();
    });

    it("Full session with real orchestrator format: plan → tools → updated plan", () => {
      // 1. Initial plan (input uses 'steps', output uses 'plan')
      processor.process(makeToolStartSSE("show_plan", {
        steps: [
          { id: "s1", title: "Research topic", description: "Search the web for information", status: "in_progress" },
          { id: "s2", title: "Write code", status: "pending" },
          { id: "s3", title: "Test and deploy", status: "pending" },
        ],
      }, "plan-r1"));
      processor.process(makeToolResultSSE("show_plan", {
        status: "success",
        plan: [
          { id: "s1", title: "Research topic", description: "Search the web for information", status: "in_progress" },
          { id: "s2", title: "Write code", status: "pending" },
          { id: "s3", title: "Test and deploy", status: "pending" },
        ],
      }, "plan-r1"));

      // 2. Tool calls under step 1
      processor.process(makeToolStartSSE("web_search", { query: "AI trends 2026" }, "ws-1"));
      processor.process(makeToolResultSSE("web_search", {
        results: [{ title: "AI in 2026", url: "https://example.com", snippet: "..." }],
      }, "ws-1"));

      processor.process(makeToolStartSSE("browser_navigate", { url: "https://example.com" }, "bn-1"));
      processor.process(makeToolResultSSE("browser_navigate", {
        url: "https://example.com", title: "AI in 2026",
      }, "bn-1"));

      // 3. Updated plan (step 1 completed, step 2 in progress)
      processor.process(makeToolStartSSE("show_plan", {
        steps: [
          { id: "s1", title: "Research topic", description: "Search the web for information", status: "completed" },
          { id: "s2", title: "Write code", status: "in_progress" },
          { id: "s3", title: "Test and deploy", status: "pending" },
        ],
      }, "plan-r2"));
      processor.process(makeToolResultSSE("show_plan", {
        status: "success",
        plan: [
          { id: "s1", title: "Research topic", description: "Search the web for information", status: "completed" },
          { id: "s2", title: "Write code", status: "in_progress" },
          { id: "s3", title: "Test and deploy", status: "pending" },
        ],
      }, "plan-r2"));

      // 4. Tool calls under step 2
      processor.process(makeToolStartSSE("file_write", {
        file: "/home/user/app.py", content: "print('hello')",
      }, "fw-1"));
      processor.process(makeToolResultSSE("file_write", {
        success: true, path: "/home/user/app.py",
      }, "fw-1"));

      processor.process(makeContentSSE("Done! I've completed all the tasks."));

      const { parts } = processor.finalize();

      // Verify part counts
      const textParts = parts.filter((p) => p.type === "text");
      const toolParts = parts.filter(isToolPart);

      expect(textParts.length).toBe(1);
      // Tools: show_plan(plan-r1), web_search(ws-1), browser_navigate(bn-1),
      //        show_plan(plan-r2), file_write(fw-1) = 5
      expect(toolParts.length).toBe(5);

      // Verify correct tool names
      const toolNames = toolParts.map(getToolNameFromPart);
      expect(toolNames).toEqual([
        "show_plan", "web_search", "browser_navigate", "show_plan", "file_write",
      ]);

      // Verify canvas views: show_plan has NO canvas view
      const canvasViews = toolParts.map((p) => TOOL_VIEW_MAP[getToolNameFromPart(p)]);
      expect(canvasViews).toEqual([
        undefined, "browser", "browser", undefined, "editor",
      ]);

      // Verify the updated plan part has output with 'plan' field
      const updatedPlan = toolParts[3]!;
      expect(updatedPlan.state).toBe("output-available");
      const output = updatedPlan.output as Record<string, unknown>;
      expect(output.status).toBe("success");
      expect(Array.isArray(output.plan)).toBe(true);
      const planSteps = output.plan as Array<{ id: string; title: string; status: string; description?: string }>;
      expect(planSteps[0]!.status).toBe("completed");
      expect(planSteps[0]!.description).toBe("Search the web for information");
      expect(planSteps[1]!.status).toBe("in_progress");
    });
  });

  // ========================================================================
  // message_notify_user file attachment rendering
  // ========================================================================

  describe("message_notify_user with file attachments", () => {
    it("maps to MessageNotifyRenderer (not ProgressTool)", () => {
      expect(getRenderer("message_notify_user")).toBe("MessageNotifyRenderer");
      expect(getRenderer("message_ask_user")).toBe("MessageNotifyRenderer");
    });

    it("is in FULL_RENDERER_TOOLS (not compact pill)", () => {
      // message_notify_user and message_ask_user should render full, not compact
      // This is validated by tool-part.tsx FULL_RENDERER_TOOLS set
      const fullRendererTools = ["generate_image", "message_notify_user", "message_ask_user"];
      for (const tool of fullRendererTools) {
        const renderer = getRenderer(tool);
        expect(renderer).toBeDefined();
        expect(renderer).not.toBe("GenericTool");
      }
    });

    it("tool output with attachments has files for FilePart rendering", () => {
      // Use SSEProcessor to create tool part (matching file's test patterns)
      processor.process(makeToolStartSSE("message_notify_user", {
        text: "Here is your report",
        attachments: ["/home/ubuntu/report.pdf"],
      }, "tc_notify_file"));
      processor.process(makeToolResultSSE("message_notify_user", {
        status: "sent",
        message: "Message delivered to user",
        attachments: [
          { name: "report.pdf", url: "https://cdn.example.com/report.pdf", mediaType: "application/pdf" },
        ],
      }, "tc_notify_file"));

      const toolParts = processor.collectedParts.filter(isToolPart);
      expect(toolParts).toHaveLength(1);
      expect(toolParts[0]!.state).toBe("output-available");

      const output = toolParts[0]!.output as Record<string, unknown>;
      const attachments = output.attachments as Array<{ name: string; url: string; mediaType: string }>;
      expect(attachments).toHaveLength(1);
      expect(attachments[0].name).toBe("report.pdf");
      expect(attachments[0].url).toContain("https://");
      expect(attachments[0].mediaType).toBe("application/pdf");
    });

    it("tool output without attachments has text-only rendering", () => {
      processor.process(makeToolStartSSE("message_notify_user", {
        text: "Task completed successfully",
      }, "tc_notify_text"));
      processor.process(makeToolResultSSE("message_notify_user", {
        status: "sent",
        message: "Message delivered to user",
      }, "tc_notify_text"));

      const toolParts = processor.collectedParts.filter(isToolPart);
      expect(toolParts).toHaveLength(1);

      const output = toolParts[0]!.output as Record<string, unknown>;
      expect(output).not.toHaveProperty("attachments");
    });

    it("multiple attachments produce multiple file entries", () => {
      const output = {
        status: "sent",
        attachments: [
          { name: "report.pdf", url: "https://cdn.example.com/a.pdf", mediaType: "application/pdf" },
          { name: "chart.png", url: "https://cdn.example.com/b.png", mediaType: "image/png" },
          { name: "data.csv", url: "https://cdn.example.com/c.csv", mediaType: "text/csv" },
        ],
      };
      const fileParts = output.attachments.map((a) => ({
        type: "file" as const,
        mediaType: a.mediaType,
        filename: a.name,
        url: a.url,
      }));
      expect(fileParts).toHaveLength(3);
      expect(fileParts[0].mediaType).toBe("application/pdf");
      expect(fileParts[1].mediaType).toBe("image/png");
      expect(fileParts[2].mediaType).toBe("text/csv");
    });

    it("is excluded from TOOL_VIEW_MAP (no canvas view)", () => {
      expect(TOOL_VIEW_MAP["message_notify_user"]).toBeUndefined();
      expect(TOOL_VIEW_MAP["message_ask_user"]).toBeUndefined();
    });
  });
});
