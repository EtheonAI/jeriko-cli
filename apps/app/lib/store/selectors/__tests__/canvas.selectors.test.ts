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
  // Domain slice selectors — Manus parity
  selectSlideEditorSlides,
  selectMapReduceCurrentTask,
  selectWebDevProject,
  selectLatestGeneratedImage,
  // CodeViewer selectors — Manus parity
  selectCodeViewerFileDataSource,
  // AgentWorkspace selectors — Manus parity
  selectAgentWorkspaceSidebarType,
  // Timeline selectors — Manus parity
  selectTimelineEvents,
  // ToolCalls selectors — Manus parity
  selectActiveToolCallIds,
  selectToolCallStats,
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
    it("should map all 28 browser tools", () => {
      const browserTools = Object.entries(TOOL_VIEW_MAP).filter(([, v]) => v === "browser");
      // 15 core + 5 new Manus (save_image, upload_file, fill_form, find_keyword, close)
      // + 3 search aliases + 2 deploy + make_manus_page + slide_present + image_search_upload = 28
      expect(browserTools.length).toBe(28);
    });

    it("should map all 7 editor tools", () => {
      const editorTools = Object.entries(TOOL_VIEW_MAP).filter(([, v]) => v === "editor");
      expect(editorTools.length).toBe(7);
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
    it("should collect unique view types from all tools as sorted array", () => {
      const events = [
        makeEvent({ toolName: "browser_navigate" }),
        makeEvent({ toolName: "shell_exec" }),
        makeEvent({ toolName: "browser_click" }),
        makeEvent({ toolName: "file_write" }),
      ];

      const state = buildState(events);
      const views = selectAvailableViews(state, "session-1");

      // Returns sorted array (not Set) for Redux-friendly memoization
      expect(Array.isArray(views)).toBe(true);
      expect(views).toContain("browser");
      expect(views).toContain("terminal");
      expect(views).toContain("editor");
      expect(views).not.toContain("webDevIDE");
    });

    it("should return stable reference when re-invoked with same input (memoization)", () => {
      const events = [makeEvent({ toolName: "browser_navigate" })];
      const state = buildState(events);

      const views1 = selectAvailableViews(state, "session-1");
      const views2 = selectAvailableViews(state, "session-1");

      expect(views1).toBe(views2); // Same reference = memoized
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

  // ============================================================================
  // Domain Slice Selectors — Manus Parity
  // ============================================================================

  describe("TOOL_VIEW_MAP — generate_image", () => {
    it("should map generate_image to aiCanvas view", () => {
      expect(TOOL_VIEW_MAP["generate_image"]).toBe("aiCanvas");
    });

    it("should have exactly 2 aiCanvas tools", () => {
      const canvasTools = Object.entries(TOOL_VIEW_MAP).filter(([, v]) => v === "aiCanvas");
      expect(canvasTools.length).toBe(2); // generate_image + image_rmbg
      const names = canvasTools.map(([k]) => k).sort();
      expect(names).toEqual(["generate_image", "image_rmbg"]);
    });
  });

  describe("selectLatestGeneratedImage", () => {
    it("should return image URL from generate_image tool output", () => {
      const e = makeEvent({
        id: "tc-gen",
        toolName: "generate_image",
        state: "complete",
        output: { url: "https://cdn.example.com/cat.png" },
      });
      const state = buildState([e]);
      expect(selectLatestGeneratedImage(state, "session-1")).toBe("https://cdn.example.com/cat.png");
    });

    it("should return image_url as fallback", () => {
      const e = makeEvent({
        id: "tc-gen",
        toolName: "generate_image",
        state: "complete",
        output: { image_url: "https://cdn.example.com/alt.png" },
      });
      const state = buildState([e]);
      expect(selectLatestGeneratedImage(state, "session-1")).toBe("https://cdn.example.com/alt.png");
    });

    it("should return undefined when no generate_image tool exists", () => {
      const e = makeEvent({ id: "tc-1", toolName: "browser_navigate", state: "complete" });
      const state = buildState([e]);
      expect(selectLatestGeneratedImage(state, "session-1")).toBeUndefined();
    });

    it("should return undefined when generate_image is still running", () => {
      const e = makeEvent({
        id: "tc-gen",
        toolName: "generate_image",
        state: "running",
      });
      const state = buildState([e]);
      expect(selectLatestGeneratedImage(state, "session-1")).toBeUndefined();
    });

    it("should return the latest generate_image when multiple exist", () => {
      const e1 = makeEvent({
        id: "tc-gen1",
        toolName: "generate_image",
        state: "complete",
        output: { url: "https://cdn.example.com/old.png" },
      });
      const e2 = makeEvent({
        id: "tc-gen2",
        toolName: "generate_image",
        state: "complete",
        output: { url: "https://cdn.example.com/new.png" },
      });
      const state = buildState([e1, e2]);
      expect(selectLatestGeneratedImage(state, "session-1")).toBe("https://cdn.example.com/new.png");
    });
  });

  describe("selectSlideEditorSlides", () => {
    it("should read slides from slideEditor slice", () => {
      const state = {
        ...buildState([]),
        slideEditor: {
          slides: [{ id: "s1", index: 0, elements: [] }],
          currentSlideIndex: 0,
          isPresentationMode: true,
        },
      } as any;
      expect(selectSlideEditorSlides(state)).toEqual([{ id: "s1", index: 0, elements: [] }]);
    });

    it("should return empty array when no slides", () => {
      const state = {
        ...buildState([]),
        slideEditor: { slides: [], currentSlideIndex: 0, isPresentationMode: false },
      } as any;
      expect(selectSlideEditorSlides(state)).toEqual([]);
    });
  });

  describe("selectMapReduceCurrentTask", () => {
    it("should read current task from mapReduce slice", () => {
      const task = { id: "mr-1", name: "Analyze", status: "running", progress: 30, totalItems: 10, processedItems: 3 };
      const state = {
        ...buildState([]),
        mapReduce: { currentTask: task, overallProgress: 30, currentPhase: "map", results: [] },
      } as any;
      expect(selectMapReduceCurrentTask(state)).toEqual(task);
    });

    it("should return null when no current task", () => {
      const state = {
        ...buildState([]),
        mapReduce: { currentTask: null, overallProgress: 0, currentPhase: "idle", results: [] },
      } as any;
      expect(selectMapReduceCurrentTask(state)).toBeNull();
    });
  });

  describe("selectWebDevProject", () => {
    it("should read project from webDev slice", () => {
      const project = { id: "p1", name: "MyApp", status: "deployed", createdAt: "2026-01-01", updatedAt: "2026-01-01" };
      const state = {
        ...buildState([]),
        webDev: { project, activeTab: "preview", projectInited: true },
      } as any;
      expect(selectWebDevProject(state)).toEqual(project);
    });

    it("should return null when no project", () => {
      const state = {
        ...buildState([]),
        webDev: { project: null, activeTab: "preview", projectInited: false },
      } as any;
      expect(selectWebDevProject(state)).toBeNull();
    });
  });

  // ── New tool mappings (6 missing tools added for Manus parity) ──

  describe("TOOL_VIEW_MAP — new tools", () => {
    it("should map slide_init to slides", () => {
      expect(TOOL_VIEW_MAP["slide_init"]).toBe("slides");
    });
    it("should map slide_modify to slides", () => {
      expect(TOOL_VIEW_MAP["slide_modify"]).toBe("slides");
    });
    it("should map slide_add_notes to slides", () => {
      expect(TOOL_VIEW_MAP["slide_add_notes"]).toBe("slides");
    });
    it("should map parallel_tasks to mapReduce", () => {
      expect(TOOL_VIEW_MAP["parallel_tasks"]).toBe("mapReduce");
    });
    it("should map image_rmbg to aiCanvas", () => {
      expect(TOOL_VIEW_MAP["image_rmbg"]).toBe("aiCanvas");
    });
    it("should map image_search_upload to browser", () => {
      expect(TOOL_VIEW_MAP["image_search_upload"]).toBe("browser");
    });
    it("should have exactly 3 slides tools", () => {
      const slideTools = Object.entries(TOOL_VIEW_MAP).filter(([, v]) => v === "slides");
      expect(slideTools.length).toBe(3);
    });
    it("should have exactly 1 mapReduce tool", () => {
      const mrTools = Object.entries(TOOL_VIEW_MAP).filter(([, v]) => v === "mapReduce");
      expect(mrTools.length).toBe(1);
      expect(mrTools[0]![0]).toBe("parallel_tasks");
    });
    it("should have total 56 mapped tools", () => {
      // 28 browser + 7 editor + 6 terminal + 9 webDevIDE + 2 aiCanvas + 3 slides + 1 mapReduce = 56
      expect(Object.keys(TOOL_VIEW_MAP).length).toBe(56);
    });
  });

  describe("selectLatestGeneratedImage — image_rmbg", () => {
    it("should return image from image_rmbg tool", () => {
      const e = makeEvent({
        id: "tc-rmbg",
        toolName: "image_rmbg",
        state: "complete",
        output: { url: "https://cdn.example.com/nobg.png" },
      });
      const state = buildState([e]);
      expect(selectLatestGeneratedImage(state, "session-1")).toBe("https://cdn.example.com/nobg.png");
    });

    it("should prefer latest between generate_image and image_rmbg", () => {
      const e1 = makeEvent({
        id: "tc-gen",
        toolName: "generate_image",
        state: "complete",
        output: { url: "https://cdn.example.com/gen.png" },
      });
      const e2 = makeEvent({
        id: "tc-rmbg",
        toolName: "image_rmbg",
        state: "complete",
        output: { url: "https://cdn.example.com/rmbg.png" },
      });
      const state = buildState([e1, e2]);
      expect(selectLatestGeneratedImage(state, "session-1")).toBe("https://cdn.example.com/rmbg.png");
    });
  });

  // ── CodeViewer selectors ──

  describe("selectCodeViewerFileDataSource", () => {
    it("should read file data from codeViewer slice", () => {
      const state = {
        ...buildState([]),
        codeViewer: { fileDataSource: { "/app.ts": "const x = 1;" }, fileTabList: [], activeTabId: null, directoryList: [] },
      } as any;
      expect(selectCodeViewerFileDataSource(state)).toEqual({ "/app.ts": "const x = 1;" });
    });
  });

  // ── AgentWorkspace selectors ──

  describe("selectAgentWorkspaceSidebarType", () => {
    it("should read sidebarType from agentWorkspace slice", () => {
      const state = {
        ...buildState([]),
        agentWorkspace: { sidebarType: "browser" },
      } as any;
      expect(selectAgentWorkspaceSidebarType(state)).toBe("browser");
    });

    it("should return null when no sidebar type", () => {
      const state = {
        ...buildState([]),
        agentWorkspace: { sidebarType: null },
      } as any;
      expect(selectAgentWorkspaceSidebarType(state)).toBeNull();
    });
  });

  // ── Timeline selectors ──

  describe("selectTimelineEvents", () => {
    it("should read events for session from timeline slice", () => {
      const events = [{ id: "ev-1", type: "browser_navigate", title: "Navigate", timestamp: "2026-01-01" }];
      const state = {
        ...buildState([]),
        timeline: { segmentEventsMap: { "session-1": events } },
      } as any;
      expect(selectTimelineEvents(state, "session-1")).toEqual(events);
    });

    it("should return empty array for unknown session", () => {
      const state = {
        ...buildState([]),
        timeline: { segmentEventsMap: {} },
      } as any;
      expect(selectTimelineEvents(state, "session-1")).toEqual([]);
    });
  });

  // ── ToolCalls selectors ──

  describe("selectActiveToolCallIds", () => {
    it("should return active tool call IDs", () => {
      const state = {
        ...buildState([]),
        toolCalls: { activeCorrelationIds: ["tc-1", "tc-2"], byCorrelationId: {}, bySessionId: {}, stats: { totalCalls: 0, successCount: 0, errorCount: 0, cancelledCount: 0 } },
      } as any;
      expect(selectActiveToolCallIds(state)).toEqual(["tc-1", "tc-2"]);
    });
  });

  describe("selectToolCallStats", () => {
    it("should return tool call stats", () => {
      const stats = { totalCalls: 10, successCount: 8, errorCount: 1, cancelledCount: 1 };
      const state = {
        ...buildState([]),
        toolCalls: { activeCorrelationIds: [], byCorrelationId: {}, bySessionId: {}, stats },
      } as any;
      expect(selectToolCallStats(state)).toEqual(stats);
    });
  });
});
