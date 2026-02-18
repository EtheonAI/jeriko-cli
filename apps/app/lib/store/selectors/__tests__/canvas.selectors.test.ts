/**
 * Canvas selectors — tests
 *
 * Validates that canvas selectors correctly derive view state from
 * normalized websocket.toolEvents (Manus parity).
 *
 * Uses a minimal mock RootState with only the fields selectors need.
 */

import { describe, it, expect, beforeEach } from "vitest";
import type { ToolEventEntity } from "../../slices/websocket.slice";
import {
  selectSessionToolEvents,
  selectLatestCanvasToolEvent,
  selectCanvasToolCount,
  selectCanvasToolCallIds,
  selectToolEventById,
  selectLatestBrowserEvent,
  selectLatestTerminalEvent,
  selectLatestFileEvent,
  selectBrowserHistory,
  selectTerminalSessions,
  selectAllFileContents,
  selectAvailableViews,
  selectLatestSearchResults,
  selectWebdevPreviewUrl,
  selectSessionMetadata,
  TOOL_VIEW_MAP,
} from "../canvas.selectors";

// ============================================================================
// Helpers
// ============================================================================

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

function buildState(events: ToolEventEntity[], sessions: any[] = []) {
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
    websocket: {
      toolEvents,
      toolEventIds,
      toolEventsBySession,
    },
    sessions: {
      sessions,
    },
  } as any; // Minimal mock RootState
}

// ============================================================================
// Tests
// ============================================================================

describe("canvas.selectors", () => {
  describe("TOOL_VIEW_MAP", () => {
    it("should map all 22 browser tools", () => {
      const browserTools = Object.entries(TOOL_VIEW_MAP).filter(([, v]) => v === "browser");
      expect(browserTools.length).toBe(22);
    });

    it("should map all 6 editor tools", () => {
      const editorTools = Object.entries(TOOL_VIEW_MAP).filter(([, v]) => v === "editor");
      expect(editorTools.length).toBe(6);
    });

    it("should map all 6 terminal tools", () => {
      const terminalTools = Object.entries(TOOL_VIEW_MAP).filter(([, v]) => v === "terminal");
      expect(terminalTools.length).toBe(6);
    });

    it("should map all 9 webDevIDE tools", () => {
      const ideTools = Object.entries(TOOL_VIEW_MAP).filter(([, v]) => v === "webDevIDE");
      expect(ideTools.length).toBe(9);
    });

    it("should map to correct view types", () => {
      expect(TOOL_VIEW_MAP["browser_navigate"]).toBe("browser");
      expect(TOOL_VIEW_MAP["shell_exec"]).toBe("terminal");
      expect(TOOL_VIEW_MAP["file_write"]).toBe("editor");
      expect(TOOL_VIEW_MAP["webdev_init_project"]).toBe("webDevIDE");
      expect(TOOL_VIEW_MAP["info_search_web"]).toBe("browser");
      expect(TOOL_VIEW_MAP["code_execute"]).toBe("terminal");
      expect(TOOL_VIEW_MAP["text_editor"]).toBe("editor");
    });
  });

  describe("selectSessionToolEvents", () => {
    it("should return events for a specific session in order", () => {
      const e1 = makeEvent({ id: "tc-1", sessionId: "s1", toolName: "browser_navigate" });
      const e2 = makeEvent({ id: "tc-2", sessionId: "s1", toolName: "browser_click" });
      const e3 = makeEvent({ id: "tc-3", sessionId: "s2", toolName: "shell_exec" });

      const state = buildState([e1, e2, e3]);
      const result = selectSessionToolEvents(state, "s1");

      expect(result).toEqual([e1, e2]);
    });

    it("should return empty array for unknown session", () => {
      const state = buildState([]);
      expect(selectSessionToolEvents(state, "nonexistent")).toEqual([]);
    });
  });

  describe("selectLatestCanvasToolEvent", () => {
    it("should return the latest canvas-mapped tool event", () => {
      const e1 = makeEvent({ id: "tc-1", toolName: "browser_navigate" });
      const e2 = makeEvent({ id: "tc-2", toolName: "shell_exec" });

      const state = buildState([e1, e2]);
      const result = selectLatestCanvasToolEvent(state, "session-1");

      expect(result?.id).toBe("tc-2");
    });

    it("should skip tools without canvas mapping", () => {
      const e1 = makeEvent({ id: "tc-1", toolName: "browser_navigate" });
      const e2 = makeEvent({ id: "tc-2", toolName: "show_plan" }); // no canvas view

      const state = buildState([e1, e2]);
      const result = selectLatestCanvasToolEvent(state, "session-1");

      expect(result?.id).toBe("tc-1");
    });

    it("should return null when no events exist", () => {
      const state = buildState([]);
      expect(selectLatestCanvasToolEvent(state, "session-1")).toBeNull();
    });
  });

  describe("selectCanvasToolCount", () => {
    it("should count only canvas-mapped tools", () => {
      const events = [
        makeEvent({ id: "tc-1", toolName: "browser_navigate" }),
        makeEvent({ id: "tc-2", toolName: "show_plan" }), // not canvas
        makeEvent({ id: "tc-3", toolName: "shell_exec" }),
      ];

      const state = buildState(events);
      expect(selectCanvasToolCount(state, "session-1")).toBe(2);
    });
  });

  describe("selectCanvasToolCallIds", () => {
    it("should return ordered IDs of canvas-mapped tools only", () => {
      const events = [
        makeEvent({ id: "tc-1", toolName: "browser_navigate" }),
        makeEvent({ id: "tc-2", toolName: "show_plan" }),
        makeEvent({ id: "tc-3", toolName: "file_write" }),
      ];

      const state = buildState(events);
      expect(selectCanvasToolCallIds(state, "session-1")).toEqual(["tc-1", "tc-3"]);
    });
  });

  describe("selectToolEventById", () => {
    it("should return event by ID", () => {
      const event = makeEvent({ id: "tc-1", toolName: "browser_navigate" });
      const state = buildState([event]);

      expect(selectToolEventById(state, "tc-1")).toEqual(event);
    });

    it("should return null for unknown ID", () => {
      const state = buildState([]);
      expect(selectToolEventById(state, "nonexistent")).toBeNull();
    });
  });

  describe("selectLatestBrowserEvent", () => {
    it("should return latest browser tool event", () => {
      const events = [
        makeEvent({ id: "tc-1", toolName: "browser_navigate" }),
        makeEvent({ id: "tc-2", toolName: "shell_exec" }),
        makeEvent({ id: "tc-3", toolName: "browser_click" }),
      ];

      const state = buildState(events);
      expect(selectLatestBrowserEvent(state, "session-1")?.id).toBe("tc-3");
    });

    it("should include search tools as browser events", () => {
      const events = [
        makeEvent({ id: "tc-1", toolName: "info_search_web" }),
      ];

      const state = buildState(events);
      expect(selectLatestBrowserEvent(state, "session-1")?.id).toBe("tc-1");
    });
  });

  describe("selectLatestTerminalEvent", () => {
    it("should return latest terminal tool event", () => {
      const events = [
        makeEvent({ id: "tc-1", toolName: "shell_exec" }),
        makeEvent({ id: "tc-2", toolName: "browser_navigate" }),
        makeEvent({ id: "tc-3", toolName: "code_execute" }),
      ];

      const state = buildState(events);
      expect(selectLatestTerminalEvent(state, "session-1")?.id).toBe("tc-3");
    });
  });

  describe("selectLatestFileEvent", () => {
    it("should return latest file tool event", () => {
      const events = [
        makeEvent({ id: "tc-1", toolName: "file_write" }),
        makeEvent({ id: "tc-2", toolName: "browser_navigate" }),
        makeEvent({ id: "tc-3", toolName: "file_read" }),
      ];

      const state = buildState(events);
      expect(selectLatestFileEvent(state, "session-1")?.id).toBe("tc-3");
    });

    it("should include text_editor as file tool", () => {
      const events = [makeEvent({ id: "tc-1", toolName: "text_editor" })];
      const state = buildState(events);
      expect(selectLatestFileEvent(state, "session-1")?.id).toBe("tc-1");
    });
  });

  describe("selectBrowserHistory", () => {
    it("should collect completed browser_navigate URLs", () => {
      const events = [
        makeEvent({ id: "tc-1", toolName: "browser_navigate", state: "complete", url: "https://a.com", screenshot: "s1", title: "A" }),
        makeEvent({ id: "tc-2", toolName: "browser_click", state: "complete" }), // not navigate
        makeEvent({ id: "tc-3", toolName: "browser_navigate", state: "complete", url: "https://b.com", title: "B" }),
      ];

      const state = buildState(events);
      const history = selectBrowserHistory(state, "session-1");

      expect(history).toEqual([
        { url: "https://a.com", screenshot: "s1", title: "A" },
        { url: "https://b.com", screenshot: undefined, title: "B" },
      ]);
    });

    it("should deduplicate URLs", () => {
      const events = [
        makeEvent({ id: "tc-1", toolName: "browser_navigate", state: "complete", url: "https://a.com" }),
        makeEvent({ id: "tc-2", toolName: "browser_navigate", state: "complete", url: "https://a.com" }),
      ];

      const state = buildState(events);
      expect(selectBrowserHistory(state, "session-1")).toHaveLength(1);
    });

    it("should skip non-complete navigations", () => {
      const events = [
        makeEvent({ id: "tc-1", toolName: "browser_navigate", state: "running", url: "https://a.com" }),
      ];

      const state = buildState(events);
      expect(selectBrowserHistory(state, "session-1")).toHaveLength(0);
    });
  });

  describe("selectTerminalSessions", () => {
    it("should group terminal output by shell session", () => {
      const events = [
        makeEvent({
          id: "tc-1",
          toolName: "shell_exec",
          state: "complete",
          input: { command: "ls", id: "pty-1" },
          output: { stdout: "file1.txt\nfile2.txt" },
        }),
        makeEvent({
          id: "tc-2",
          toolName: "shell_exec",
          state: "complete",
          input: { command: "pwd", id: "pty-1" },
          output: { stdout: "/home/user" },
        }),
        makeEvent({
          id: "tc-3",
          toolName: "shell_exec",
          state: "complete",
          input: { command: "echo hi", id: "pty-2" },
          output: { stdout: "hi" },
        }),
      ];

      const state = buildState(events);
      const result = selectTerminalSessions(state, "session-1");

      expect(result.sessionOrder).toEqual(["pty-1", "pty-2"]);
      expect(result.activeSession).toBe("pty-2");
      expect(result.sessions["pty-1"]).toEqual([
        "$ ls", "file1.txt", "file2.txt",
        "$ pwd", "/home/user",
      ]);
      expect(result.sessions["pty-2"]).toEqual(["$ echo hi", "hi"]);
    });

    it("should use 'default' for events without shell session id", () => {
      const events = [
        makeEvent({
          id: "tc-1",
          toolName: "shell_exec",
          state: "complete",
          input: { command: "ls" },
          output: { stdout: "ok" },
        }),
      ];

      const state = buildState(events);
      const result = selectTerminalSessions(state, "session-1");
      expect(result.sessions["default"]).toBeDefined();
    });

    it("should deduplicate consecutive identical commands", () => {
      const events = [
        makeEvent({
          id: "tc-1",
          toolName: "shell_exec",
          state: "complete",
          input: { command: "ls" },
          output: { stdout: "a" },
        }),
        makeEvent({
          id: "tc-2",
          toolName: "shell_exec",
          state: "complete",
          input: { command: "ls" },
          output: { stdout: "a" },
        }),
      ];

      const state = buildState(events);
      const result = selectTerminalSessions(state, "session-1");
      // Should only have one "$ ls" entry
      const lines = result.sessions["default"]!;
      const cmdCount = lines.filter((l) => l === "$ ls").length;
      expect(cmdCount).toBe(1);
    });
  });

  describe("selectAllFileContents", () => {
    it("should accumulate file_write contents", () => {
      const events = [
        makeEvent({
          id: "tc-1",
          toolName: "file_write",
          input: { path: "/src/app.ts", content: "const x = 1;" },
        }),
        makeEvent({
          id: "tc-2",
          toolName: "file_write",
          input: { path: "/src/main.ts", content: "import x from './app';" },
        }),
      ];

      const state = buildState(events);
      const contents = selectAllFileContents(state, "session-1");

      expect(contents["/src/app.ts"]).toBe("const x = 1;");
      expect(contents["/src/main.ts"]).toBe("import x from './app';");
    });

    it("should accumulate file_read contents from output", () => {
      const events = [
        makeEvent({
          id: "tc-1",
          toolName: "file_read",
          state: "complete",
          input: { path: "/readme.md" },
          output: { content: "# Hello" },
        }),
      ];

      const state = buildState(events);
      expect(selectAllFileContents(state, "session-1")["/readme.md"]).toBe("# Hello");
    });

    it("should apply file_str_replace patches", () => {
      const events = [
        makeEvent({
          id: "tc-1",
          toolName: "file_write",
          input: { path: "/app.ts", content: "const x = 1;" },
        }),
        makeEvent({
          id: "tc-2",
          toolName: "file_str_replace",
          state: "complete",
          input: { path: "/app.ts", old_str: "const x = 1;", new_str: "const x = 2;" },
        }),
      ];

      const state = buildState(events);
      expect(selectAllFileContents(state, "session-1")["/app.ts"]).toBe("const x = 2;");
    });

    it("should handle text_editor create command", () => {
      const events = [
        makeEvent({
          id: "tc-1",
          toolName: "text_editor",
          input: { path: "/new.py", command: "create", file_text: "print('hello')" },
        }),
      ];

      const state = buildState(events);
      expect(selectAllFileContents(state, "session-1")["/new.py"]).toBe("print('hello')");
    });
  });

  describe("selectAvailableViews", () => {
    it("should collect unique view types from all tools", () => {
      const events = [
        makeEvent({ toolName: "browser_navigate" }),
        makeEvent({ toolName: "shell_exec" }),
        makeEvent({ toolName: "browser_click" }),
        makeEvent({ toolName: "file_write" }),
      ];

      const state = buildState(events);
      const views = selectAvailableViews(state, "session-1");

      expect(views.has("browser")).toBe(true);
      expect(views.has("terminal")).toBe(true);
      expect(views.has("editor")).toBe(true);
      expect(views.has("webDevIDE")).toBe(false);
    });
  });

  describe("selectLatestSearchResults", () => {
    it("should extract search results from output array", () => {
      const events = [
        makeEvent({
          toolName: "web_search",
          state: "complete",
          output: {
            results: [
              { title: "Result 1", url: "https://r1.com", snippet: "Snippet 1" },
              { title: "Result 2", url: "https://r2.com", description: "Desc 2" },
            ],
          },
        }),
      ];

      const state = buildState(events);
      const results = selectLatestSearchResults(state, "session-1");

      expect(results).toHaveLength(2);
      expect(results![0]).toEqual({ title: "Result 1", url: "https://r1.com", snippet: "Snippet 1" });
      expect(results![1]).toEqual({ title: "Result 2", url: "https://r2.com", snippet: "Desc 2" });
    });

    it("should return undefined when no search events", () => {
      const events = [makeEvent({ toolName: "browser_navigate", state: "complete" })];
      const state = buildState(events);
      expect(selectLatestSearchResults(state, "session-1")).toBeUndefined();
    });
  });

  describe("selectWebdevPreviewUrl", () => {
    it("should extract preview URL from webdev tool output", () => {
      const events = [
        makeEvent({
          toolName: "webdev_init_project",
          state: "complete",
          output: { previewUrl: "https://preview.e2b.dev:3000" },
        }),
      ];

      const state = buildState(events);
      expect(selectWebdevPreviewUrl(state, "session-1")).toBe("https://preview.e2b.dev:3000");
    });

    it("should extract URL from deploy_expose_port", () => {
      const events = [
        makeEvent({
          toolName: "deploy_expose_port",
          state: "complete",
          output: { url: "https://deployed.rubic.dev" },
        }),
      ];

      const state = buildState(events);
      expect(selectWebdevPreviewUrl(state, "session-1")).toBe("https://deployed.rubic.dev");
    });
  });

  describe("selectSessionMetadata", () => {
    it("should extract metadata from session store", () => {
      const sessions = [
        {
          id: "session-1",
          metadata: {
            sandboxId: "sb-123",
            nekoUrl: "https://neko.e2b.dev",
            streamUrl: "https://stream.e2b.dev",
          },
        },
      ];

      const state = buildState([], sessions);
      const meta = selectSessionMetadata(state, "session-1");

      expect(meta.sandboxId).toBe("sb-123");
      expect(meta.nekoUrl).toBe("https://neko.e2b.dev");
      expect(meta.streamUrl).toBe("https://stream.e2b.dev");
    });

    it("should return empty metadata for unknown session", () => {
      const state = buildState([], []);
      const meta = selectSessionMetadata(state, "nonexistent");

      expect(meta.sandboxId).toBeUndefined();
      expect(meta.nekoUrl).toBeUndefined();
      expect(meta.streamUrl).toBeUndefined();
    });

    it("should fallback vncUrl → streamUrl", () => {
      const sessions = [
        {
          id: "session-1",
          metadata: { vncUrl: "https://vnc.e2b.dev" },
        },
      ];

      const state = buildState([], sessions);
      expect(selectSessionMetadata(state, "session-1").streamUrl).toBe("https://vnc.e2b.dev");
    });
  });
});
