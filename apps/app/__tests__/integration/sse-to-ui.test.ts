/**
 * Integration Test: SSE → Redux → UI Rendering Pipeline
 *
 * Tests the complete flow from SSE events through the accumulation layer
 * to Redux state management and UI rendering decisions.
 *
 * Covers:
 * 1. text-delta events → text parts → message content
 * 2. tool-input-available → tool parts → correct renderer selection
 * 3. tool-output-available → tool result → renderer data
 * 4. show_plan tool → PlannerBar state update
 * 5. All 34 tool renderers → no crashes, correct component selection
 * 6. Canvas view auto-detection from tool calls
 * 7. Session metadata events → sandbox/neko state
 * 8. Reasoning events → reasoning parts
 * 9. Source URL events → source parts
 * 10. Error handling and edge cases
 */

import { describe, it, expect, beforeEach } from "vitest";
import { SSEProcessor } from "../../lib/chat/sse-processor";
import { TOOL_VIEW_MAP } from "@repo/ai/components/canvas/use-canvas";

// ============================================================================
// Helper: Mock renderer registry (no React context in unit tests)
// ============================================================================

const REGISTERED_RENDERERS: Record<string, string> = {
  web_search: "WebSearchEnhanced",
  search_web: "WebSearchEnhanced",
  info_search_web: "WebSearchEnhanced",
  code_execute: "CodeBlockEnhanced",
  shell_exec: "TerminalOutputEnhanced",
  shell_view: "TerminalOutputEnhanced",
  shell_wait: "TerminalOutputEnhanced",
  shell_write_to_process: "TerminalOutputEnhanced",
  shell_kill_process: "TerminalOutputEnhanced",
  file_read: "FilePreview",
  file_write: "FilePreview",
  file_str_replace: "FilePreview",
  file_find_in_content: "FilePreview",
  file_find_by_name: "FilePreview",
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
  generate_image: "ImageResult",
  deploy_expose_port: "DeployResult",
  deploy_apply_deployment: "DeployResult",
  make_manus_page: "DeployResult",
  show_plan: "ShowPlanRenderer",
  showPlan: "ShowPlanRenderer",
  message_notify_user: "ProgressTool",
  message_ask_user: "ProgressTool",
  schedule_task: "ProgressTool",
  schedule_recurring_task: "ProgressTool",
  check_outcomes: "ProgressTool",
  track_analytics: "ProgressTool",
  idle: "ProgressTool",
  text_editor: "FilePreview",
  image_rmbg: "ImageResult",
  image_search_upload: "ImageResult",
  gmail_send: "ProgressTool",
  gmail_download: "ProgressTool",
  outlook_send: "ProgressTool",
  outlook_download: "ProgressTool",
  skills_sync: "ProgressTool",
  skills_package: "ProgressTool",
  slide_init: "ProgressTool",
  slide_modify: "ProgressTool",
  slide_add_notes: "ProgressTool",
  slide_present: "DeployResult",
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
  return REGISTERED_RENDERERS[toolName] ?? "GenericTool";
}

function makeSSE(data: Record<string, unknown>): string {
  return `data: ${JSON.stringify(data)}`;
}

function isToolPart(part: Record<string, unknown>): boolean {
  return typeof part.type === "string" && (part.type as string).startsWith("tool-");
}

function getToolNameFromPart(part: Record<string, unknown>): string {
  return (part.type as string).slice(5); // Remove "tool-" prefix
}

// ============================================================================
// Tests
// ============================================================================

describe("SSE → UI Rendering Pipeline", () => {
  let processor: SSEProcessor;

  beforeEach(() => {
    processor = new SSEProcessor();
  });

  // ========================================================================
  // 1. Text events → text parts
  // ========================================================================

  describe("Text Delta Events", () => {
    it("should accumulate text-delta into a single text part", () => {
      processor.process(makeSSE({ type: "content", content: "Hello " }));
      processor.process(makeSSE({ type: "content", content: "world!" }));

      const { parts } = processor.finalize();
      const textParts = parts.filter((p) => p.type === "text");

      expect(textParts).toHaveLength(1);
      expect(textParts[0]!.text).toBe("Hello world!");
    });

    it("should produce text-start → text-delta → text-end SSE events", () => {
      const output1 = processor.process(makeSSE({ type: "content", content: "Hello" }));
      expect(output1).toContain('"type":"text-start"');
      expect(output1).toContain('"type":"text-delta"');

      const { closingSSE } = processor.finalize();
      expect(closingSSE).toContain('"type":"text-end"');
    });

    it("should split text parts around tool calls", () => {
      processor.process(makeSSE({ type: "content", content: "Before tool" }));
      processor.process(makeSSE({ type: "tool_start", toolCallId: "t1", tool: "file_write", input: { file: "test.txt" } }));
      processor.process(makeSSE({ type: "tool_result", toolCallId: "t1", tool: "file_write", success: true, result: {} }));
      processor.process(makeSSE({ type: "content", content: "After tool" }));

      const { parts } = processor.finalize();
      const textParts = parts.filter((p) => p.type === "text");

      expect(textParts).toHaveLength(2);
      expect(textParts[0]!.text).toBe("Before tool");
      expect(textParts[1]!.text).toBe("After tool");
    });
  });

  // ========================================================================
  // 2. Reasoning events → reasoning parts
  // ========================================================================

  describe("Reasoning Events", () => {
    it("should accumulate reasoning into reasoning parts", () => {
      processor.process(makeSSE({ type: "reasoning", content: "Let me think about this..." }));
      processor.process(makeSSE({ type: "reasoning_end" }));

      const { parts } = processor.finalize();
      const reasoningParts = parts.filter((p) => p.type === "reasoning");

      expect(reasoningParts).toHaveLength(1);
      expect(reasoningParts[0]!.text).toBe("Let me think about this...");
    });

    it("should emit reasoning-start/delta/end SSE events", () => {
      const output = processor.process(makeSSE({ type: "reasoning", content: "Thinking..." }));
      expect(output).toContain('"type":"reasoning-start"');
      expect(output).toContain('"type":"reasoning-delta"');

      const output2 = processor.process(makeSSE({ type: "reasoning_end" }));
      expect(output2).toContain('"type":"reasoning-end"');
    });
  });

  // ========================================================================
  // 3. Tool events → tool parts → renderer selection
  // ========================================================================

  describe("Tool Events → Correct Renderer", () => {
    const toolTestCases = [
      { tool: "show_plan", input: { title: "Plan", todos: [] }, renderer: "ShowPlanRenderer" },
      { tool: "file_write", input: { file: "test.py", content: "pass" }, renderer: "FilePreview" },
      { tool: "shell_exec", input: { command: "ls" }, renderer: "TerminalOutputEnhanced" },
      { tool: "browser_navigate", input: { url: "https://example.com" }, renderer: "BrowserViewerEnhanced" },
      { tool: "web_search", input: { query: "test" }, renderer: "WebSearchEnhanced" },
      { tool: "code_execute", input: { code: "print(42)" }, renderer: "CodeBlockEnhanced" },
      { tool: "generate_image", input: { prompt: "cat" }, renderer: "ImageResult" },
      { tool: "deploy_expose_port", input: { port: 3000 }, renderer: "DeployResult" },
      { tool: "message_notify_user", input: { text: "Done" }, renderer: "ProgressTool" },
      { tool: "schedule_task", input: { name: "task" }, renderer: "ProgressTool" },
      { tool: "text_editor", input: { command: "view", path: "/test" }, renderer: "FilePreview" },
      { tool: "gmail_send", input: { to: "test@example.com" }, renderer: "ProgressTool" },
      { tool: "slide_init", input: { title: "Slides" }, renderer: "ProgressTool" },
      { tool: "skills_sync", input: {}, renderer: "ProgressTool" },
      { tool: "image_rmbg", input: { path: "/img.png" }, renderer: "ImageResult" },
    ];

    for (const tc of toolTestCases) {
      it(`${tc.tool} → ${tc.renderer}`, () => {
        const toolCallId = `tc-${tc.tool}`;
        processor.process(makeSSE({
          type: "tool_start",
          toolCallId,
          tool: tc.tool,
          input: tc.input,
        }));
        processor.process(makeSSE({
          type: "tool_result",
          toolCallId,
          tool: tc.tool,
          success: true,
          result: { ok: true },
        }));

        const toolParts = processor.collectedParts.filter(isToolPart);
        expect(toolParts).toHaveLength(1);

        const rendererName = getRenderer(getToolNameFromPart(toolParts[0]!));
        expect(rendererName).toBe(tc.renderer);
      });
    }
  });

  // ========================================================================
  // 4. Canvas view auto-detection
  // ========================================================================

  describe("Canvas View Auto-Detection", () => {
    it("should map browser tools to browser canvas view", () => {
      const browserTools = [
        "browser_navigate", "browser_view", "browser_click", "browser_input",
        "browser_scroll_up", "browser_scroll_down", "browser_move_mouse",
        "browser_press_key", "browser_select_option", "browser_console_exec",
        "browser_console_view", "browser_screenshot", "browser_restart",
        "web_search", "info_search_web", "search_web",
        "deploy_expose_port", "deploy_apply_deployment", "make_manus_page",
      ];

      for (const tool of browserTools) {
        expect(TOOL_VIEW_MAP[tool]).toBe("browser");
      }
    });

    it("should map terminal tools to terminal canvas view", () => {
      const terminalTools = [
        "shell_exec", "shell_view", "shell_wait",
        "shell_write_to_process", "shell_kill_process", "code_execute",
      ];

      for (const tool of terminalTools) {
        expect(TOOL_VIEW_MAP[tool]).toBe("terminal");
      }
    });

    it("should map file tools to editor canvas view", () => {
      const fileTools = [
        "file_read", "file_write", "file_str_replace",
        "file_find_in_content", "file_find_by_name",
      ];

      for (const tool of fileTools) {
        expect(TOOL_VIEW_MAP[tool]).toBe("editor");
      }
    });

    it("should NOT map communication/planning tools to any canvas view", () => {
      const noCanvasTools = [
        "show_plan", "message_notify_user", "message_ask_user",
      ];

      for (const tool of noCanvasTools) {
        expect(TOOL_VIEW_MAP[tool]).toBeUndefined();
      }
    });

    it("should map generate_image to aiCanvas view", () => {
      expect(TOOL_VIEW_MAP["generate_image"]).toBe("aiCanvas");
    });

    it("should detect latest tool view from sequential tool calls", () => {
      // Simulate processing multiple tools in sequence
      const tools = ["file_write", "shell_exec", "browser_navigate"];
      const expectedViews = ["editor", "terminal", "browser"];

      for (let i = 0; i < tools.length; i++) {
        const tool = tools[i]!;
        const id = `tc-${i}`;

        processor.process(makeSSE({
          type: "tool_start", toolCallId: id, tool, input: {},
        }));
        processor.process(makeSSE({
          type: "tool_result", toolCallId: id, tool, success: true, result: {},
        }));

        // The latest tool call determines the active view
        const latestToolParts = processor.collectedParts.filter(isToolPart);
        const latestTool = latestToolParts[latestToolParts.length - 1]!;
        const latestView = TOOL_VIEW_MAP[getToolNameFromPart(latestTool)];
        expect(latestView).toBe(expectedViews[i]);
      }
    });
  });

  // ========================================================================
  // 5. show_plan tool → planner state
  // ========================================================================

  describe("Show Plan Tool → Planner State", () => {
    it("should produce show_plan tool part with plan data", () => {
      const planInput = {
        title: "Build Website",
        todos: [
          { id: "1", label: "Search templates", status: "in_progress" },
          { id: "2", label: "Create files", status: "pending" },
          { id: "3", label: "Deploy", status: "pending" },
        ],
      };

      processor.process(makeSSE({
        type: "tool_start",
        toolCallId: "plan-1",
        tool: "show_plan",
        input: planInput,
      }));
      processor.process(makeSSE({
        type: "tool_result",
        toolCallId: "plan-1",
        tool: "show_plan",
        success: true,
        result: planInput,
      }));

      const toolParts = processor.collectedParts.filter(isToolPart);
      expect(toolParts).toHaveLength(1);

      const planPart = toolParts[0]!;
      expect(planPart.type).toBe("tool-show_plan");
      expect(planPart.toolName).toBe("show_plan");
      expect(planPart.state).toBe("output-available");

      // Input should contain the plan data
      const input = planPart.input as Record<string, unknown>;
      expect(input.title).toBe("Build Website");
      expect(input.todos).toHaveLength(3);
    });

    it("should update plan when show_plan is called again with new statuses", () => {
      // First plan
      processor.process(makeSSE({
        type: "tool_start",
        toolCallId: "plan-1",
        tool: "show_plan",
        input: { title: "Plan", todos: [{ id: "1", label: "Step 1", status: "pending" }] },
      }));
      processor.process(makeSSE({
        type: "tool_result",
        toolCallId: "plan-1",
        tool: "show_plan",
        success: true,
        result: {},
      }));

      // Updated plan
      processor.process(makeSSE({
        type: "tool_start",
        toolCallId: "plan-2",
        tool: "show_plan",
        input: { title: "Plan", todos: [{ id: "1", label: "Step 1", status: "completed" }] },
      }));
      processor.process(makeSSE({
        type: "tool_result",
        toolCallId: "plan-2",
        tool: "show_plan",
        success: true,
        result: {},
      }));

      const planParts = processor.collectedParts.filter(
        (p) => isToolPart(p) && (p.type as string) === "tool-show_plan"
      );
      expect(planParts).toHaveLength(2);

      // The LATEST show_plan is the one the planner should display
      const latestPlan = planParts[planParts.length - 1]!;
      const input = latestPlan.input as Record<string, unknown>;
      const todos = input.todos as Array<{ status: string }>;
      expect(todos[0]!.status).toBe("completed");
    });

    it("should not produce canvas view for show_plan", () => {
      expect(TOOL_VIEW_MAP["show_plan"]).toBeUndefined();
    });
  });

  // ========================================================================
  // 6. Source URL events → source parts
  // ========================================================================

  describe("Source URL Events", () => {
    it("should collect source URL events as parts", () => {
      processor.process(makeSSE({
        type: "source_url",
        sourceId: "src-1",
        url: "https://docs.example.com",
        title: "Example Docs",
      }));

      const { parts } = processor.finalize();
      const sourceParts = parts.filter((p) => p.type === "source-url");

      expect(sourceParts).toHaveLength(1);
      expect(sourceParts[0]!.url).toBe("https://docs.example.com");
      expect(sourceParts[0]!.title).toBe("Example Docs");
    });
  });

  // ========================================================================
  // 7. Session metadata events
  // ========================================================================

  describe("Session Metadata Events", () => {
    it("should emit message-metadata for sandbox_info", () => {
      const output = processor.process(makeSSE({
        type: "sandbox_info",
        sandboxId: "sandbox-123",
        nekoUrl: "https://neko.example.com",
      }));

      expect(output).toContain('"type":"message-metadata"');
      expect(output).toContain('"sandboxId":"sandbox-123"');
    });

    it("should emit message-metadata for usage events", () => {
      const output = processor.process(makeSSE({
        type: "usage",
        usage: { input_tokens: 500, output_tokens: 200 },
        iterations: 5,
        tool_calls_count: 3,
      }));

      expect(output).toContain('"type":"message-metadata"');
      expect(output).toContain('"input_tokens":500');
    });

    it("should emit message-metadata for browser_frame", () => {
      const output = processor.process(makeSSE({
        type: "browser_frame",
        screenshot: "iVBORscreenshot",
        url: "https://example.com",
        title: "Example",
      }));

      expect(output).toContain('"type":"message-metadata"');
      expect(output).toContain('"browserFrame"');
    });
  });

  // ========================================================================
  // 8. Error handling
  // ========================================================================

  describe("Error Handling", () => {
    it("should emit error event for error SSE", () => {
      const output = processor.process(makeSSE({
        type: "error",
        error: "Rate limit exceeded",
      }));

      expect(output).toContain('"type":"error"');
      expect(output).toContain("Rate limit exceeded");
    });

    it("should emit tool-output-error for failed tool results", () => {
      processor.process(makeSSE({
        type: "tool_start",
        toolCallId: "t1",
        tool: "shell_exec",
        input: { command: "nonexistent" },
      }));

      const output = processor.process(makeSSE({
        type: "tool_result",
        toolCallId: "t1",
        tool: "shell_exec",
        success: false,
        result: { error: "Command not found" },
      }));

      expect(output).toContain('"type":"tool-output-error"');
    });

    it("should handle tool_call_failed event", () => {
      processor.process(makeSSE({
        type: "tool_start",
        toolCallId: "t1",
        tool: "browser_navigate",
        input: { url: "https://example.com" },
      }));

      const output = processor.process(makeSSE({
        type: "tool_call_failed",
        toolCallId: "t1",
        tool: "browser_navigate",
        error: "Timeout",
      }));

      expect(output).toContain("tool-output-error");
    });

    it("should handle [DONE] event gracefully", () => {
      const output = processor.process("data: [DONE]");
      expect(output).toBe("");
    });

    it("should handle malformed SSE gracefully", () => {
      const output = processor.process("not valid sse data");
      expect(output).toBe("");
    });

    it("should handle warning events", () => {
      processor.process(makeSSE({
        type: "warning",
        message: "Approaching step limit",
      }));

      const { parts } = processor.finalize();
      const textParts = parts.filter((p) => p.type === "text");
      expect(textParts.length).toBeGreaterThan(0);
    });
  });

  // ========================================================================
  // 9. Tool state transitions
  // ========================================================================

  describe("Tool Part State Transitions", () => {
    it("should transition: input-available → output-available", () => {
      processor.process(makeSSE({
        type: "tool_start",
        toolCallId: "t1",
        tool: "file_read",
        input: { file: "/home/user/test.py" },
      }));

      let toolParts = processor.collectedParts.filter(isToolPart);
      expect(toolParts[0]!.state).toBe("input-available");

      processor.process(makeSSE({
        type: "tool_result",
        toolCallId: "t1",
        tool: "file_read",
        success: true,
        result: { content: "print('hello')" },
      }));

      toolParts = processor.collectedParts.filter(isToolPart);
      expect(toolParts[0]!.state).toBe("output-available");
      expect(toolParts[0]!.output).toBeDefined();
    });

    it("should transition: input-available → output-error on failure", () => {
      processor.process(makeSSE({
        type: "tool_start",
        toolCallId: "t1",
        tool: "file_read",
        input: { file: "/nonexistent" },
      }));

      processor.process(makeSSE({
        type: "tool_result",
        toolCallId: "t1",
        tool: "file_read",
        success: false,
        result: { error: "File not found" },
      }));

      const toolParts = processor.collectedParts.filter(isToolPart);
      expect(toolParts[0]!.state).toBe("output-error");
    });
  });

  // ========================================================================
  // 10. Complete renderer coverage — no tool falls to GenericTool
  // ========================================================================

  describe("Complete Renderer Coverage", () => {
    it("all TOOL_VIEW_MAP entries have non-GenericTool renderers", () => {
      const failures: string[] = [];
      for (const toolName of Object.keys(TOOL_VIEW_MAP)) {
        if (getRenderer(toolName) === "GenericTool") {
          failures.push(toolName);
        }
      }
      expect(failures).toEqual([]);
    });

    it("all 47 agent tools have explicit renderers", () => {
      const agentTools = [
        "show_plan", "message_notify_user", "message_ask_user",
        "file_read", "file_write", "file_str_replace", "file_find_in_content", "file_find_by_name",
        "shell_exec", "shell_view", "shell_wait", "shell_write_to_process", "shell_kill_process",
        "code_execute", "web_search",
        "browser_navigate", "browser_view", "browser_click", "browser_input",
        "browser_scroll_up", "browser_scroll_down", "browser_move_mouse",
        "browser_press_key", "browser_select_option",
        "browser_console_exec", "browser_console_view", "browser_screenshot", "browser_restart",
        "browser_save_image", "browser_upload_file", "browser_fill_form",
        "browser_find_keyword", "browser_close",
        "deploy_expose_port", "deploy_apply_deployment",
        "generate_image", "schedule_task", "track_analytics",
        "text_editor",
        "webdev_init_project", "webdev_save_checkpoint", "webdev_check_status",
        "webdev_restart_server", "webdev_rollback_checkpoint", "webdev_execute_sql",
        "webdev_push_schema", "webdev_list_versions",
      ];

      const missing: string[] = [];
      for (const tool of agentTools) {
        if (getRenderer(tool) === "GenericTool") {
          missing.push(tool);
        }
      }
      expect(missing).toEqual([]);
    });

    it("both show_plan variants resolve to ShowPlanRenderer", () => {
      expect(getRenderer("show_plan")).toBe("ShowPlanRenderer");
      expect(getRenderer("showPlan")).toBe("ShowPlanRenderer");
    });
  });

  // ========================================================================
  // 11. Multi-tool session with mixed canvas views
  // ========================================================================

  describe("Multi-Tool Session: Mixed Canvas Views", () => {
    it("should correctly track latest canvas view across tool switches", () => {
      const toolSequence = [
        { tool: "show_plan", expectedView: undefined },
        { tool: "web_search", expectedView: "browser" },
        { tool: "file_write", expectedView: "editor" },
        { tool: "shell_exec", expectedView: "terminal" },
        { tool: "browser_navigate", expectedView: "browser" },
        { tool: "message_notify_user", expectedView: undefined },
      ];

      for (let i = 0; i < toolSequence.length; i++) {
        const { tool, expectedView } = toolSequence[i]!;
        const id = `tc-${i}`;

        processor.process(makeSSE({
          type: "tool_start", toolCallId: id, tool, input: {},
        }));
        processor.process(makeSSE({
          type: "tool_result", toolCallId: id, tool, success: true, result: {},
        }));

        const view = TOOL_VIEW_MAP[tool];
        expect(view).toBe(expectedView);
      }

      // Verify all tool parts were created
      const toolParts = processor.collectedParts.filter(isToolPart);
      expect(toolParts).toHaveLength(toolSequence.length);

      // Verify no duplicates
      const ids = toolParts.map((p) => p.toolCallId as string);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });
});
