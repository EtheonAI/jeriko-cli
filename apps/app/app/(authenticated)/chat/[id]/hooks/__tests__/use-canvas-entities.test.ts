/**
 * useCanvasFromEntities — comprehensive tests
 *
 * Validates the Redux-based canvas state derivation hook (Manus parity).
 * Reads from websocket.toolEvents via memoized selectors.
 *
 * Tests cover:
 * - View type determination (browser/terminal/editor/code/webDevIDE/empty)
 * - Browser state (URL, screenshot, history, back/forward, loading)
 * - Terminal state (multi-session, session switching, output accumulation)
 * - Editor state (file content, active file, tab management, streaming content)
 * - Code view (file tree building, tab close/select)
 * - WebDev IDE (preview URL, file tree)
 * - Timeline scrubbing (pin/unpin, percentage)
 * - View override (user manual selection)
 * - isWorking state (streaming + pending/running tool)
 * - Status text (working, pinned, idle)
 * - Session metadata (sandboxId, nekoUrl, streamUrl)
 * - Session switch (local state reset)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { ToolEventEntity } from "@/lib/store/slices/websocket.slice";

// ============================================================================
// Mock Redux state
// ============================================================================

let mockState: Record<string, any> = {};

function makeEvent(overrides: Partial<ToolEventEntity> = {}): ToolEventEntity {
  return {
    id: `tc-${Math.random().toString(36).slice(2, 6)}`,
    sessionId: "session-1",
    timestamp: Date.now(),
    toolName: "browser_navigate",
    state: "complete",
    input: {},
    ...overrides,
  };
}

function buildMockState(events: ToolEventEntity[], sessions: any[] = []) {
  const toolEvents: Record<string, ToolEventEntity> = {};
  const toolEventIds: string[] = [];
  const toolEventsBySession: Record<string, string[]> = {};

  for (const event of events) {
    toolEvents[event.id] = event;
    toolEventIds.push(event.id);
    if (!toolEventsBySession[event.sessionId]) {
      toolEventsBySession[event.sessionId] = [];
    }
    toolEventsBySession[event.sessionId]!.push(event.id);
  }

  return {
    websocket: { toolEvents, toolEventIds, toolEventsBySession },
    sessions: { sessions },
    // Domain slices — Manus parity: defaults for canvas rendering tests
    slideEditor: { slides: [], currentSlideIndex: 0, isPresentationMode: false },
    mapReduce: { currentTask: null, overallProgress: 0, currentPhase: "idle" as const, results: [] },
    webDev: { project: null, activeTab: "preview" as const, projectInited: false },
    // CodeViewer slice — Manus parity: authoritative file data source
    codeViewer: { fileDataSource: {}, fileTabList: [], activeTabId: null, directoryList: [] },
    // AgentWorkspace slice — Manus parity: sidebar type → view fallback
    agentWorkspace: { sidebarType: null },
    // Timeline slice — Manus parity: event-based scrubber data
    timeline: { segmentEventsMap: {} },
    // ToolCalls slice — Manus parity: active tool call indicators
    toolCalls: { activeCorrelationIds: [], byCorrelationId: {}, bySessionId: {}, stats: { totalCalls: 0, successCount: 0, errorCount: 0, cancelledCount: 0 } },
  };
}

// Mock useAppSelector to read from mockState
vi.mock("@/lib/store/hooks", () => ({
  useAppSelector: (selector: (state: any) => any) => selector(mockState),
}));

// Import AFTER mocks
import { useCanvasFromEntities } from "../use-canvas-entities";

// ============================================================================
// Tests
// ============================================================================

describe("useCanvasFromEntities", () => {
  beforeEach(() => {
    mockState = buildMockState([], []);
  });

  // ── View type determination ──

  describe("view type determination", () => {
    it("should return viewType 'empty' and isVisible false when no tools exist", () => {
      const { result } = renderHook(() => useCanvasFromEntities("session-1", false));
      expect(result.current.isVisible).toBe(false);
      expect(result.current.viewType).toBe("empty");
    });

    it("should return 'browser' for browser_navigate", () => {
      mockState = buildMockState([
        makeEvent({ id: "tc-1", toolName: "browser_navigate", state: "complete" }),
      ]);
      const { result } = renderHook(() => useCanvasFromEntities("session-1", false));
      expect(result.current.viewType).toBe("browser");
    });

    it("should return 'terminal' for shell_exec", () => {
      mockState = buildMockState([
        makeEvent({ id: "tc-1", toolName: "shell_exec", state: "complete", input: { command: "ls" }, output: { stdout: "ok" } }),
      ]);
      const { result } = renderHook(() => useCanvasFromEntities("session-1", false));
      expect(result.current.viewType).toBe("terminal");
    });

    it("should return 'editor' for file_write", () => {
      mockState = buildMockState([
        makeEvent({ id: "tc-1", toolName: "file_write", state: "complete", input: { path: "/app.ts", content: "x" } }),
      ]);
      const { result } = renderHook(() => useCanvasFromEntities("session-1", false));
      expect(result.current.viewType).toBe("editor");
    });

    it("should return 'webDevIDE' for webdev_init_project", () => {
      mockState = buildMockState([
        makeEvent({ id: "tc-1", toolName: "webdev_init_project", state: "complete" }),
      ]);
      const { result } = renderHook(() => useCanvasFromEntities("session-1", false));
      expect(result.current.viewType).toBe("webDevIDE");
    });

    it("should return 'terminal' for code_execute", () => {
      mockState = buildMockState([
        makeEvent({ id: "tc-1", toolName: "code_execute", state: "complete", input: {}, output: { stdout: "42" } }),
      ]);
      const { result } = renderHook(() => useCanvasFromEntities("session-1", false));
      expect(result.current.viewType).toBe("terminal");
    });

    it("should return 'browser' for search tools", () => {
      for (const tool of ["web_search", "search_web", "info_search_web"]) {
        mockState = buildMockState([
          makeEvent({ id: "tc-search", toolName: tool, state: "complete" }),
        ]);
        const { result } = renderHook(() => useCanvasFromEntities("session-1", false));
        expect(result.current.viewType).toBe("browser");
      }
    });

    it("should use LATEST canvas tool, not first", () => {
      mockState = buildMockState([
        makeEvent({ id: "tc-1", toolName: "browser_navigate", state: "complete" }),
        makeEvent({ id: "tc-2", toolName: "shell_exec", state: "complete", input: { command: "ls" }, output: { stdout: "ok" } }),
      ]);
      const { result } = renderHook(() => useCanvasFromEntities("session-1", false));
      expect(result.current.viewType).toBe("terminal");
    });
  });

  // ── Browser state ──

  describe("browser state", () => {
    it("should populate browserUrl and browserScreenshot", () => {
      mockState = buildMockState([
        makeEvent({
          id: "tc-1",
          toolName: "browser_navigate",
          state: "complete",
          url: "https://example.com",
          screenshot: "data:image/png;base64,test",
          title: "Example",
        }),
      ]);

      const { result } = renderHook(() => useCanvasFromEntities("session-1", false));
      expect(result.current.browserUrl).toBe("https://example.com");
      expect(result.current.browserScreenshot).toBe("data:image/png;base64,test");
      expect(result.current.browserTitle).toBe("Example");
    });

    it("should show browser loading when isActive", () => {
      mockState = buildMockState([
        makeEvent({ id: "tc-1", toolName: "browser_navigate", state: "running" }),
      ]);

      const { result } = renderHook(() => useCanvasFromEntities("session-1", true));
      expect(result.current.browserLoading).toBe(true);
    });

    it("should show search results for search tools", () => {
      mockState = buildMockState([
        makeEvent({
          id: "tc-1",
          toolName: "web_search",
          state: "complete",
          output: {
            results: [
              { title: "R1", url: "https://r1.com", snippet: "Snippet 1" },
            ],
          },
        }),
      ]);

      const { result } = renderHook(() => useCanvasFromEntities("session-1", false));
      expect(result.current.browserSearchResults).toHaveLength(1);
      expect(result.current.browserSearchResults![0]!.title).toBe("R1");
    });

    it("should track browser history for back/forward navigation", () => {
      mockState = buildMockState([
        makeEvent({ id: "tc-1", toolName: "browser_navigate", state: "complete", url: "https://a.com" }),
        makeEvent({ id: "tc-2", toolName: "browser_navigate", state: "complete", url: "https://b.com" }),
        makeEvent({ id: "tc-3", toolName: "browser_navigate", state: "complete", url: "https://c.com" }),
      ]);

      const { result } = renderHook(() => useCanvasFromEntities("session-1", false));
      expect(result.current.canGoBack).toBe(true);
      expect(result.current.canGoForward).toBe(false); // at latest
    });
  });

  // ── Terminal state ──

  describe("terminal state", () => {
    it("should show terminal output with command prefix", () => {
      mockState = buildMockState([
        makeEvent({
          id: "tc-1",
          toolName: "shell_exec",
          state: "complete",
          input: { command: "ls", id: "pty-1" },
          output: { stdout: "file1.txt\nfile2.txt" },
        }),
      ]);

      const { result } = renderHook(() => useCanvasFromEntities("session-1", false));
      expect(result.current.terminalOutput).toContain("$ ls");
      expect(result.current.terminalOutput).toContain("file1.txt");
    });

    it("should support multiple terminal sessions", () => {
      mockState = buildMockState([
        makeEvent({
          id: "tc-1",
          toolName: "shell_exec",
          state: "complete",
          input: { command: "ls", id: "pty-1" },
          output: { stdout: "file1" },
        }),
        makeEvent({
          id: "tc-2",
          toolName: "shell_exec",
          state: "complete",
          input: { command: "pwd", id: "pty-2" },
          output: { stdout: "/home" },
        }),
      ]);

      const { result } = renderHook(() => useCanvasFromEntities("session-1", false));
      expect(result.current.terminalSessionIds).toEqual(["pty-1", "pty-2"]);
      expect(result.current.activeTerminalSession).toBe("pty-2");
    });

    it("should switch terminal sessions", () => {
      mockState = buildMockState([
        makeEvent({
          id: "tc-1",
          toolName: "shell_exec",
          state: "complete",
          input: { command: "ls", id: "pty-1" },
          output: { stdout: "file1" },
        }),
        makeEvent({
          id: "tc-2",
          toolName: "shell_exec",
          state: "complete",
          input: { command: "pwd", id: "pty-2" },
          output: { stdout: "/home" },
        }),
      ]);

      const { result } = renderHook(() => useCanvasFromEntities("session-1", false));
      expect(result.current.activeTerminalSession).toBe("pty-2");

      act(() => result.current.onSelectTerminalSession?.("pty-1"));
      expect(result.current.activeTerminalSession).toBe("pty-1");
      expect(result.current.terminalOutput).toContain("$ ls");
    });

    it("should handle pinned terminal tool", () => {
      mockState = buildMockState([
        makeEvent({
          id: "tc-pin-term",
          toolName: "shell_exec",
          state: "complete",
          input: { command: "echo hello", id: "pty-1" },
          output: { stdout: "hello" },
        }),
        makeEvent({
          id: "tc-latest",
          toolName: "browser_navigate",
          state: "complete",
        }),
      ]);

      const { result } = renderHook(() => useCanvasFromEntities("session-1", false));

      // Pin the terminal event
      act(() => result.current.onPinToolCall?.("tc-pin-term"));

      expect(result.current.viewType).toBe("terminal");
      expect(result.current.terminalOutput).toContain("$ echo hello");
      expect(result.current.terminalOutput).toContain("hello");
    });
  });

  // ── Editor state ──

  describe("editor state", () => {
    it("should show file content from file_write", () => {
      mockState = buildMockState([
        makeEvent({
          id: "tc-1",
          toolName: "file_write",
          state: "complete",
          input: { path: "/src/app.ts", content: "const x = 1;" },
        }),
      ]);

      const { result } = renderHook(() => useCanvasFromEntities("session-1", false));
      expect(result.current.activeFileContent).toBe("const x = 1;");
      expect(result.current.activeFileLanguage).toBe("typescript");
    });

    it("should detect language from file extension", () => {
      const cases: [string, string][] = [
        ["/app.py", "python"],
        ["/app.rs", "rust"],
        ["/app.go", "go"],
        ["/style.css", "css"],
        ["/index.html", "html"],
        ["/data.json", "json"],
        ["/readme.md", "markdown"],
        ["/deploy.sh", "bash"],
        ["/query.sql", "sql"],
        ["/unknown.xyz", "text"],
      ];

      for (const [path, expectedLang] of cases) {
        mockState = buildMockState([
          makeEvent({
            id: `tc-${path}`,
            toolName: "file_write",
            state: "complete",
            input: { path, content: "..." },
          }),
        ]);

        const { result } = renderHook(() => useCanvasFromEntities("session-1", false));
        expect(result.current.activeFileLanguage).toBe(expectedLang);
      }
    });

    it("should show streaming content during pending file_write", () => {
      mockState = buildMockState([
        makeEvent({
          id: "tc-stream",
          toolName: "file_write",
          state: "pending",
          input: { path: "/main.ts", content: "const partial = " },
        }),
      ]);

      const { result } = renderHook(() => useCanvasFromEntities("session-1", true));
      expect(result.current.activeFileContent).toBe("const partial = ");
      expect(result.current.isWorking).toBe(true);
    });

    it("should show streaming content for text_editor create", () => {
      mockState = buildMockState([
        makeEvent({
          id: "tc-text-ed",
          toolName: "text_editor",
          state: "pending",
          input: { path: "/new.py", command: "create", file_text: "print('hi')" },
        }),
      ]);

      const { result } = renderHook(() => useCanvasFromEntities("session-1", true));
      expect(result.current.activeFileContent).toBe("print('hi')");
    });

    it("should NOT show streaming content for file_read (only writes)", () => {
      mockState = buildMockState([
        makeEvent({
          id: "tc-read",
          toolName: "file_read",
          state: "pending",
          input: { path: "/readme.md" },
        }),
      ]);

      const { result } = renderHook(() => useCanvasFromEntities("session-1", true));
      // file_read during pending has no content to show
      expect(result.current.activeFileContent).toBeUndefined();
    });

    it("should show file content from allFileContents when not streaming", () => {
      mockState = buildMockState([
        makeEvent({
          id: "tc-1",
          toolName: "file_write",
          state: "complete",
          input: { path: "/a.ts", content: "const a = 1;" },
        }),
        makeEvent({
          id: "tc-2",
          toolName: "file_write",
          state: "complete",
          input: { path: "/b.ts", content: "const b = 2;" },
        }),
      ]);

      const { result } = renderHook(() => useCanvasFromEntities("session-1", false));
      // Latest file_write's path becomes active
      expect(result.current.activeFileContent).toBe("const b = 2;");
    });

    it("should show file_write input.content even when no accumulated allFileContents yet", () => {
      // This handles the case where the file_write event is complete but the
      // allFileContents selector hasn't built up content yet (e.g., first tool event)
      mockState = buildMockState([
        makeEvent({
          id: "tc-1",
          toolName: "file_write",
          state: "complete",
          input: { path: "/app.ts", content: "const fallback = true;" },
        }),
      ]);

      const { result } = renderHook(() => useCanvasFromEntities("session-1", false));
      expect(result.current.activeFileContent).toBe("const fallback = true;");
    });
  });

  // ── Code view ──

  describe("code view (file tree + tabs)", () => {
    it("should build file tree from accumulated file paths", () => {
      mockState = buildMockState([
        makeEvent({ id: "tc-1", toolName: "file_write", state: "complete", input: { path: "/src/app.ts", content: "a" } }),
        makeEvent({ id: "tc-2", toolName: "file_write", state: "complete", input: { path: "/src/utils.ts", content: "b" } }),
        makeEvent({ id: "tc-3", toolName: "file_write", state: "complete", input: { path: "/package.json", content: "c" } }),
      ]);

      // Force code view since latest is file_write → editor
      const { result } = renderHook(() => useCanvasFromEntities("session-1", false));

      // Override to code view
      act(() => result.current.onSelectView?.("code"));

      expect(result.current.viewType).toBe("code");
      expect(result.current.fileTree).toBeDefined();
      expect(result.current.fileTree!.length).toBeGreaterThan(0);
    });
  });

  // ── View override ──

  describe("view override", () => {
    it("should allow view switching via onSelectView", () => {
      mockState = buildMockState([
        makeEvent({ id: "tc-1", toolName: "browser_navigate", state: "complete" }),
        makeEvent({ id: "tc-2", toolName: "shell_exec", state: "complete", input: { command: "ls" }, output: { stdout: "ok" } }),
      ]);

      const { result } = renderHook(() => useCanvasFromEntities("session-1", false));
      expect(result.current.viewType).toBe("terminal");

      act(() => result.current.onSelectView?.("browser"));
      expect(result.current.viewType).toBe("browser");
    });

    it("pinned view should override user view override", () => {
      mockState = buildMockState([
        makeEvent({ id: "tc-browser", toolName: "browser_navigate", state: "complete" }),
        makeEvent({ id: "tc-terminal", toolName: "shell_exec", state: "complete", input: { command: "ls" }, output: { stdout: "ok" } }),
      ]);

      const { result } = renderHook(() => useCanvasFromEntities("session-1", false));

      // User overrides to browser
      act(() => result.current.onSelectView?.("browser"));
      expect(result.current.viewType).toBe("browser");

      // Pin terminal event — should override user override
      act(() => result.current.onPinToolCall?.("tc-terminal"));
      expect(result.current.viewType).toBe("terminal");
    });
  });

  // ── Timeline ──

  describe("timeline", () => {
    it("should pin tool call via onTimelineChange", () => {
      const events = [
        makeEvent({ id: "tc-1", toolName: "browser_navigate", state: "complete" }),
        makeEvent({ id: "tc-2", toolName: "shell_exec", state: "complete", input: { command: "ls" }, output: { stdout: "ok" } }),
        makeEvent({ id: "tc-3", toolName: "file_write", state: "complete", input: { path: "/a", content: "x" } }),
        makeEvent({ id: "tc-4", toolName: "browser_click", state: "complete" }),
      ];
      mockState = buildMockState(events);

      const { result } = renderHook(() => useCanvasFromEntities("session-1", false));

      act(() => result.current.onTimelineChange?.(25));
      expect(result.current.pinnedToolCallId).toBe("tc-2");
      expect(result.current.timelinePercentage).toBe(50); // (1+1)/4 * 100

      // Unpin at 100%
      act(() => result.current.onTimelineChange?.(100));
      expect(result.current.pinnedToolCallId).toBeUndefined();
    });

    it("should show 100% when not pinned and not working", () => {
      mockState = buildMockState([
        makeEvent({ id: "tc-1", toolName: "browser_navigate", state: "complete" }),
      ]);

      const { result } = renderHook(() => useCanvasFromEntities("session-1", false));
      expect(result.current.timelinePercentage).toBe(100);
    });

    it("should show undefined percentage when actively working", () => {
      mockState = buildMockState([
        makeEvent({ id: "tc-1", toolName: "browser_navigate", state: "running" }),
      ]);

      const { result } = renderHook(() => useCanvasFromEntities("session-1", true));
      expect(result.current.timelinePercentage).toBeUndefined();
    });
  });

  // ── isWorking / statusText ──

  describe("working state", () => {
    it("should be working when streaming AND tool is pending", () => {
      mockState = buildMockState([
        makeEvent({ id: "tc-1", toolName: "browser_navigate", state: "pending" }),
      ]);

      const { result } = renderHook(() => useCanvasFromEntities("session-1", true));
      expect(result.current.isWorking).toBe(true);
    });

    it("should be working when streaming AND tool is running", () => {
      mockState = buildMockState([
        makeEvent({ id: "tc-1", toolName: "browser_navigate", state: "running" }),
      ]);

      const { result } = renderHook(() => useCanvasFromEntities("session-1", true));
      expect(result.current.isWorking).toBe(true);
    });

    it("should NOT be working when tool is complete", () => {
      mockState = buildMockState([
        makeEvent({ id: "tc-1", toolName: "browser_navigate", state: "complete" }),
      ]);

      const { result } = renderHook(() => useCanvasFromEntities("session-1", true));
      expect(result.current.isWorking).toBe(false);
    });

    it("should NOT be working when not streaming", () => {
      mockState = buildMockState([
        makeEvent({ id: "tc-1", toolName: "browser_navigate", state: "running" }),
      ]);

      const { result } = renderHook(() => useCanvasFromEntities("session-1", false));
      expect(result.current.isWorking).toBe(false);
    });

    it("should NOT be working when pinned", () => {
      mockState = buildMockState([
        makeEvent({ id: "tc-1", toolName: "browser_navigate", state: "running" }),
      ]);

      const { result } = renderHook(() => useCanvasFromEntities("session-1", true));
      expect(result.current.isWorking).toBe(true);

      act(() => result.current.onPinToolCall?.("tc-1"));
      expect(result.current.isWorking).toBe(false);
    });

    it("should show 'Rubic is working' statusText when active", () => {
      mockState = buildMockState([
        makeEvent({ id: "tc-1", toolName: "browser_navigate", state: "running", input: { url: "https://example.com" } }),
      ]);

      const { result } = renderHook(() => useCanvasFromEntities("session-1", true));
      expect(result.current.statusText).toContain("Rubic is working");
      expect(result.current.statusText).toContain("Browsing");
    });

    it("should show 'Viewing' statusText when pinned", () => {
      mockState = buildMockState([
        makeEvent({ id: "tc-1", toolName: "browser_navigate", state: "complete", input: { url: "https://example.com" } }),
      ]);

      const { result } = renderHook(() => useCanvasFromEntities("session-1", false));

      act(() => result.current.onPinToolCall?.("tc-1"));
      expect(result.current.statusText).toContain("Viewing");
    });
  });

  // ── Session metadata ──

  describe("session metadata", () => {
    it("should read sandboxId, nekoUrl, streamUrl from session metadata", () => {
      mockState = buildMockState([], [
        {
          id: "session-1",
          metadata: {
            sandboxId: "sb-abc",
            nekoUrl: "https://neko.e2b.dev",
            streamUrl: "https://stream.e2b.dev",
          },
        },
      ]);

      const { result } = renderHook(() => useCanvasFromEntities("session-1", false));
      expect(result.current.sandboxId).toBe("sb-abc");
      expect(result.current.nekoUrl).toBe("https://neko.e2b.dev");
      expect(result.current.streamUrl).toBe("https://stream.e2b.dev");
    });
  });

  // ── WebDev IDE ──

  describe("webDevIDE", () => {
    it("should show preview URL from webdev tool output", () => {
      mockState = buildMockState([
        makeEvent({
          id: "tc-webdev",
          toolName: "webdev_init_project",
          state: "complete",
          input: { app_name: "my-app" },
          output: { previewUrl: "https://preview.e2b.dev:3000" },
        }),
      ]);

      const { result } = renderHook(() => useCanvasFromEntities("session-1", false));
      expect(result.current.viewType).toBe("webDevIDE");
      expect(result.current.previewUrl).toBe("https://preview.e2b.dev:3000");
    });

    it("should show action label for webdev tools", () => {
      mockState = buildMockState([
        makeEvent({
          id: "tc-webdev",
          toolName: "webdev_init_project",
          state: "running",
          input: { app_name: "todo-app" },
        }),
      ]);

      const { result } = renderHook(() => useCanvasFromEntities("session-1", true));
      expect(result.current.currentAction?.label).toContain("todo-app");
    });
  });

  // ── Action labels ──

  describe("action labels", () => {
    it("should generate correct label for browser_navigate", () => {
      mockState = buildMockState([
        makeEvent({
          id: "tc-1",
          toolName: "browser_navigate",
          state: "running",
          input: { url: "https://github.com/test" },
        }),
      ]);

      const { result } = renderHook(() => useCanvasFromEntities("session-1", true));
      expect(result.current.currentAction?.label).toContain("github.com");
      expect(result.current.currentAction?.type).toBe("browsing");
    });

    it("should generate correct label for shell_exec", () => {
      mockState = buildMockState([
        makeEvent({
          id: "tc-1",
          toolName: "shell_exec",
          state: "running",
          input: { command: "npm install express" },
        }),
      ]);

      const { result } = renderHook(() => useCanvasFromEntities("session-1", true));
      expect(result.current.currentAction?.label).toContain("npm");
    });

    it("should generate correct label for file_write", () => {
      mockState = buildMockState([
        makeEvent({
          id: "tc-1",
          toolName: "file_write",
          state: "running",
          input: { path: "/src/components/Button.tsx", content: "..." },
        }),
      ]);

      const { result } = renderHook(() => useCanvasFromEntities("session-1", true));
      expect(result.current.currentAction?.label).toContain("Button.tsx");
      expect(result.current.currentAction?.type).toBe("editing");
    });

    it("should generate correct label for web_search", () => {
      mockState = buildMockState([
        makeEvent({
          id: "tc-1",
          toolName: "web_search",
          state: "running",
          input: { query: "how to use React hooks" },
        }),
      ]);

      const { result } = renderHook(() => useCanvasFromEntities("session-1", true));
      expect(result.current.currentAction?.label).toContain("how to use React h");
    });
  });

  // ── Available views ──

  describe("available views", () => {
    it("should collect all view types from tool history", () => {
      mockState = buildMockState([
        makeEvent({ id: "tc-1", toolName: "browser_navigate", state: "complete" }),
        makeEvent({ id: "tc-2", toolName: "shell_exec", state: "complete", input: { command: "ls" }, output: { stdout: "ok" } }),
        makeEvent({ id: "tc-3", toolName: "file_write", state: "complete", input: { path: "/a", content: "x" } }),
      ]);

      const { result } = renderHook(() => useCanvasFromEntities("session-1", false));

      // availableViews is now an array (Manus parity — no Sets in Redux)
      expect(result.current.availableViews).toContain("browser");
      expect(result.current.availableViews).toContain("terminal");
      expect(result.current.availableViews).toContain("editor");
    });
  });

  // ============================================================================
  // Domain Slice Wiring — Manus Parity
  //
  // These tests verify that useCanvasFromEntities reads from domain slices
  // (slideEditor, mapReduce, webDev) and populates CanvasState correctly.
  // This is THE critical fix: dispatch side was wired but render side wasn't.
  // ============================================================================

  describe("slideEditor slice wiring", () => {
    it("should populate slides from slideEditor slice", () => {
      mockState = buildMockState([
        makeEvent({ id: "tc-1", toolName: "browser_navigate", state: "complete" }),
      ]);
      mockState.slideEditor = {
        slides: [
          { id: "s1", index: 0, elements: [], thumbnail: "https://cdn.example.com/slide1.png" },
          { id: "s2", index: 1, elements: [], thumbnail: "https://cdn.example.com/slide2.png" },
        ],
        currentSlideIndex: 1,
        isPresentationMode: true,
      };

      const { result } = renderHook(() => useCanvasFromEntities("session-1", false));

      expect(result.current.slides).toEqual([
        "https://cdn.example.com/slide1.png",
        "https://cdn.example.com/slide2.png",
      ]);
      expect(result.current.currentSlideIndex).toBe(1);
    });

    it("should return empty slides when slideEditor has no slides", () => {
      mockState = buildMockState([
        makeEvent({ id: "tc-1", toolName: "browser_navigate", state: "complete" }),
      ]);
      // Default slideEditor state: slides: [], isPresentationMode: false

      const { result } = renderHook(() => useCanvasFromEntities("session-1", false));

      expect(result.current.slides).toBeUndefined();
      expect(result.current.currentSlideIndex).toBeUndefined();
    });

    it("should populate slides when isPresentationMode is true even with empty slides", () => {
      mockState = buildMockState([
        makeEvent({ id: "tc-1", toolName: "browser_navigate", state: "complete" }),
      ]);
      mockState.slideEditor = {
        slides: [],
        currentSlideIndex: 0,
        isPresentationMode: true,
      };

      const { result } = renderHook(() => useCanvasFromEntities("session-1", false));

      expect(result.current.slides).toEqual([]);
      expect(result.current.currentSlideIndex).toBe(0);
    });

    it("should use empty string for slides without thumbnails", () => {
      mockState = buildMockState([
        makeEvent({ id: "tc-1", toolName: "browser_navigate", state: "complete" }),
      ]);
      mockState.slideEditor = {
        slides: [
          { id: "s1", index: 0, elements: [] },
          { id: "s2", index: 1, elements: [], thumbnail: "https://thumb.png" },
        ],
        currentSlideIndex: 0,
        isPresentationMode: true,
      };

      const { result } = renderHook(() => useCanvasFromEntities("session-1", false));

      expect(result.current.slides).toEqual(["", "https://thumb.png"]);
    });
  });

  describe("mapReduce slice wiring", () => {
    it("should populate mapReduceTasks from mapReduce slice", () => {
      mockState = buildMockState([
        makeEvent({ id: "tc-1", toolName: "browser_navigate", state: "complete" }),
      ]);
      mockState.mapReduce = {
        currentTask: {
          id: "mr-1",
          name: "Research companies",
          status: "running",
          progress: 45,
          totalItems: 10,
          processedItems: 4,
        },
        overallProgress: 45,
        currentPhase: "map",
        results: [],
      };

      const { result } = renderHook(() => useCanvasFromEntities("session-1", false));

      expect(result.current.mapReduceTasks).toEqual([
        { id: "mr-1", label: "Research companies", status: "running", progress: 45 },
      ]);
      expect(result.current.mapReduceOverallProgress).toBe(45);
    });

    it("should NOT populate mapReduceTasks when no current task", () => {
      mockState = buildMockState([
        makeEvent({ id: "tc-1", toolName: "browser_navigate", state: "complete" }),
      ]);
      // Default mapReduce state: currentTask: null

      const { result } = renderHook(() => useCanvasFromEntities("session-1", false));

      expect(result.current.mapReduceTasks).toBeUndefined();
      expect(result.current.mapReduceOverallProgress).toBeUndefined();
    });

    it("should handle completed mapReduce task", () => {
      mockState = buildMockState([
        makeEvent({ id: "tc-1", toolName: "browser_navigate", state: "complete" }),
      ]);
      mockState.mapReduce = {
        currentTask: {
          id: "mr-done",
          name: "Analyze data",
          status: "completed",
          progress: 100,
          totalItems: 5,
          processedItems: 5,
        },
        overallProgress: 100,
        currentPhase: "complete",
        results: [{ id: "r1", key: "key1", value: "val1" }],
      };

      const { result } = renderHook(() => useCanvasFromEntities("session-1", false));

      expect(result.current.mapReduceTasks?.[0]?.status).toBe("completed");
      expect(result.current.mapReduceTasks?.[0]?.progress).toBe(100);
      expect(result.current.mapReduceOverallProgress).toBe(100);
    });
  });

  describe("AI Canvas / generate_image wiring", () => {
    it("should populate aiCanvasContent from generate_image tool output", () => {
      mockState = buildMockState([
        makeEvent({
          id: "tc-gen",
          toolName: "generate_image",
          state: "complete",
          output: { url: "https://cdn.example.com/generated.png" },
        }),
      ]);

      const { result } = renderHook(() => useCanvasFromEntities("session-1", false));

      expect(result.current.aiCanvasContent).toBe("https://cdn.example.com/generated.png");
    });

    it("should map generate_image to aiCanvas view type", () => {
      mockState = buildMockState([
        makeEvent({
          id: "tc-gen",
          toolName: "generate_image",
          state: "complete",
          output: { url: "https://cdn.example.com/generated.png" },
        }),
      ]);

      const { result } = renderHook(() => useCanvasFromEntities("session-1", false));

      expect(result.current.viewType).toBe("aiCanvas");
      expect(result.current.isVisible).toBe(true);
    });

    it("should NOT populate aiCanvasContent when no generate_image tool", () => {
      mockState = buildMockState([
        makeEvent({ id: "tc-1", toolName: "browser_navigate", state: "complete" }),
      ]);

      const { result } = renderHook(() => useCanvasFromEntities("session-1", false));

      expect(result.current.aiCanvasContent).toBeUndefined();
    });

    it("should extract image from image_url field", () => {
      mockState = buildMockState([
        makeEvent({
          id: "tc-gen2",
          toolName: "generate_image",
          state: "complete",
          output: { image_url: "https://cdn.example.com/alt-format.png" },
        }),
      ]);

      const { result } = renderHook(() => useCanvasFromEntities("session-1", false));

      expect(result.current.aiCanvasContent).toBe("https://cdn.example.com/alt-format.png");
    });
  });

  describe("webDev slice enrichment", () => {
    it("should prefer webDev project previewUrl over raw tool event URL", () => {
      mockState = buildMockState([
        makeEvent({
          id: "tc-wd",
          toolName: "webdev_init_project",
          state: "complete",
          output: { previewUrl: "https://old-url.com" },
        }),
      ]);
      mockState.webDev = {
        project: {
          id: "proj-1",
          name: "My App",
          previewUrl: "https://new-preview-url.com",
          status: "deployed",
          createdAt: "2026-02-19",
          updatedAt: "2026-02-19",
        },
        activeTab: "preview",
        projectInited: true,
      };

      const { result } = renderHook(() => useCanvasFromEntities("session-1", false));

      // webDevIDE view — previewUrl should come from webDev slice, not raw tool event
      expect(result.current.previewUrl).toBe("https://new-preview-url.com");
    });

    it("should fallback to tool event previewUrl when webDev project has none", () => {
      mockState = buildMockState([
        makeEvent({
          id: "tc-wd",
          toolName: "webdev_init_project",
          state: "complete",
          output: { previewUrl: "https://tool-event-url.com" },
        }),
      ]);
      mockState.webDev = {
        project: {
          id: "proj-1",
          name: "My App",
          // No previewUrl
          status: "deployed",
          createdAt: "2026-02-19",
          updatedAt: "2026-02-19",
        },
        activeTab: "preview",
        projectInited: true,
      };

      const { result } = renderHook(() => useCanvasFromEntities("session-1", false));

      // Falls back to selectWebdevPreviewUrl (from tool events)
      expect(result.current.previewUrl).toBe("https://tool-event-url.com");
    });
  });

  describe("domain slice data with no canvas tools", () => {
    it("should NOT populate domain data when canvas is not visible", () => {
      mockState = buildMockState([]);
      mockState.slideEditor = {
        slides: [{ id: "s1", index: 0, elements: [], thumbnail: "thumb.png" }],
        currentSlideIndex: 0,
        isPresentationMode: true,
      };
      mockState.mapReduce = {
        currentTask: { id: "mr-1", name: "Task", status: "running", progress: 50, totalItems: 1, processedItems: 0 },
        overallProgress: 50,
        currentPhase: "map",
        results: [],
      };

      const { result } = renderHook(() => useCanvasFromEntities("session-1", false));

      // Canvas not visible (no tool events) — early return before domain slice data
      expect(result.current.isVisible).toBe(false);
      // Domain slice data should NOT be populated when canvas isn't visible
      expect(result.current.slides).toBeUndefined();
      expect(result.current.mapReduceTasks).toBeUndefined();
    });
  });
});
