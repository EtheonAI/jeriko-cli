/**
 * useSSEToEntities — comprehensive tests
 *
 * Validates the SSE → Redux bridge hook that normalizes AI SDK tool parts
 * and dispatches to ALL 9 Manus-aligned slices:
 *
 * Tests cover:
 * - State mapping (AI SDK → entity states)
 * - Deduplication (same toolCallId:state dispatched once)
 * - input-streaming always re-dispatches (content grows)
 * - Session metadata extraction (sandboxId, nekoUrl, streamUrl, vncUrl fallback)
 * - Sidebar auto-set during streaming
 * - Non-canvas tools skipped
 * - Screenshot normalization (base64, data URIs, raw formats)
 * - URL/title/content extraction from tool output
 * - Search URL generation (search://query)
 * - Session switch clears processedRef
 * - Multiple tools in single message
 * - Multiple messages processed in order
 * - Timeline slice wiring (addSegmentEvent)
 * - ToolCalls slice wiring (start/complete/fail lifecycle)
 * - CodeViewer slice wiring (file tabs + content)
 * - WebDev slice wiring (setProject, updateProject, setActiveTab)
 * - SlideEditor slice wiring (setIsPresentationMode, setSlides)
 * - MapReduce slice wiring (startTask, updateProgress, completeTask, failTask)
 * - Session switch resets webDev, slideEditor, mapReduce slices
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import type { UIMessage } from "ai";

// ── Mocks ──
const mockDispatch = vi.fn();
vi.mock("@/lib/store/hooks", () => ({
  useAppDispatch: () => mockDispatch,
}));

vi.mock("@/lib/store/slices/websocket.slice", () => ({
  upsertToolEvent: (entity: any) => ({ type: "websocket/upsertToolEvent", payload: entity }),
}));

vi.mock("@/lib/store/slices/agentWorkspace.slice", () => ({
  setWorkspaceSidebarType: (sidebarType: any) => ({
    type: "agentWorkspace/setWorkspaceSidebarType",
    payload: sidebarType,
  }),
}));

vi.mock("@/lib/store/slices/sessions.slice", () => ({
  updateSession: (payload: any) => ({ type: "sessions/updateSession", payload }),
}));

vi.mock("@/lib/store/slices/timeline.slice", () => ({
  addSegmentEvent: (payload: any) => ({ type: "timeline/addSegmentEvent", payload }),
  setTimelineSessionId: (id: any) => ({ type: "timeline/setTimelineSessionId", payload: id }),
  resetTimeline: () => ({ type: "timeline/resetTimeline" }),
}));

vi.mock("@/lib/store/slices/toolCalls.slice", () => ({
  startToolCall: (payload: any) => ({ type: "toolCalls/startToolCall", payload }),
  completeToolCall: (payload: any) => ({ type: "toolCalls/completeToolCall", payload }),
  failToolCall: (payload: any) => ({ type: "toolCalls/failToolCall", payload }),
  cancelToolCall: (id: any) => ({ type: "toolCalls/cancelToolCall", payload: id }),
  clearSessionToolCalls: (id: any) => ({ type: "toolCalls/clearSessionToolCalls", payload: id }),
}));

vi.mock("@/lib/store/slices/codeViewer.slice", () => ({
  openFileTab: (tab: any) => ({ type: "codeViewer/openFileTab", payload: tab }),
  setFileContent: (payload: any) => ({ type: "codeViewer/setFileContent", payload }),
  setDirectoryList: (entries: any) => ({ type: "codeViewer/setDirectoryList", payload: entries }),
  resetCodeViewer: () => ({ type: "codeViewer/resetCodeViewer" }),
}));

vi.mock("@/lib/store/slices/webDev.slice", () => ({
  setProject: (project: any) => ({ type: "webDev/setProject", payload: project }),
  updateProject: (updates: any) => ({ type: "webDev/updateProject", payload: updates }),
  setActiveTab: (tab: any) => ({ type: "webDev/setActiveTab", payload: tab }),
  resetWebDev: () => ({ type: "webDev/resetWebDev" }),
}));

vi.mock("@/lib/store/slices/slideEditor.slice", () => ({
  setSlides: (slides: any) => ({ type: "slideEditor/setSlides", payload: slides }),
  setIsPresentationMode: (mode: any) => ({ type: "slideEditor/setIsPresentationMode", payload: mode }),
  resetSlideEditor: () => ({ type: "slideEditor/resetSlideEditor" }),
}));

vi.mock("@/lib/store/slices/mapReduce.slice", () => ({
  startTask: (payload: any) => ({ type: "mapReduce/startTask", payload }),
  updateProgress: (payload: any) => ({ type: "mapReduce/updateProgress", payload }),
  completeTask: () => ({ type: "mapReduce/completeTask" }),
  failTask: (error: any) => ({ type: "mapReduce/failTask", payload: error }),
  resetMapReduce: () => ({ type: "mapReduce/resetMapReduce" }),
}));

import { useSSEToEntities } from "../use-sse-to-entities";

// ============================================================================
// Helpers
// ============================================================================

function makeMessage(parts: any[], metadata?: Record<string, unknown>): UIMessage {
  return {
    id: `msg-${Math.random().toString(36).slice(2, 6)}`,
    role: "assistant",
    parts,
    content: "",
    createdAt: new Date(),
    metadata,
  } as unknown as UIMessage;
}

function makeToolPart(overrides: Record<string, unknown> = {}) {
  return {
    type: "tool-browser_navigate",
    toolCallId: `tc-${Math.random().toString(36).slice(2, 6)}`,
    toolName: "browser_navigate",
    state: "output-available",
    input: { url: "https://example.com" },
    output: { screenshot: "iVBOR..." },
    ...overrides,
  };
}

function getCallsByType(type: string) {
  return mockDispatch.mock.calls.filter(([action]: any) => action.type === type);
}

function getUpsertCalls() { return getCallsByType("websocket/upsertToolEvent"); }
function getSessionCalls() { return getCallsByType("sessions/updateSession"); }
function getSidebarCalls() { return getCallsByType("agentWorkspace/setWorkspaceSidebarType"); }
function getTimelineCalls() { return getCallsByType("timeline/addSegmentEvent"); }
function getTimelineSessionCalls() { return getCallsByType("timeline/setTimelineSessionId"); }
function getTimelineResetCalls() { return getCallsByType("timeline/resetTimeline"); }
function getStartToolCalls() { return getCallsByType("toolCalls/startToolCall"); }
function getCompleteToolCalls() { return getCallsByType("toolCalls/completeToolCall"); }
function getFailToolCalls() { return getCallsByType("toolCalls/failToolCall"); }
function getClearSessionToolCalls() { return getCallsByType("toolCalls/clearSessionToolCalls"); }
function getOpenFileTabCalls() { return getCallsByType("codeViewer/openFileTab"); }
function getSetFileContentCalls() { return getCallsByType("codeViewer/setFileContent"); }
function getSetDirectoryListCalls() { return getCallsByType("codeViewer/setDirectoryList"); }
// WebDev helpers
function getSetProjectCalls() { return getCallsByType("webDev/setProject"); }
function getUpdateProjectCalls() { return getCallsByType("webDev/updateProject"); }
function getWebDevActiveTabCalls() { return getCallsByType("webDev/setActiveTab"); }
function getResetWebDevCalls() { return getCallsByType("webDev/resetWebDev"); }
// SlideEditor helpers
function getSetSlidesCalls() { return getCallsByType("slideEditor/setSlides"); }
function getSetPresentationModeCalls() { return getCallsByType("slideEditor/setIsPresentationMode"); }
function getResetSlideEditorCalls() { return getCallsByType("slideEditor/resetSlideEditor"); }
// MapReduce helpers
function getMapReduceStartCalls() { return getCallsByType("mapReduce/startTask"); }
function getMapReduceProgressCalls() { return getCallsByType("mapReduce/updateProgress"); }
function getMapReduceCompleteCalls() { return getCallsByType("mapReduce/completeTask"); }
function getMapReduceFailCalls() { return getCallsByType("mapReduce/failTask"); }
function getResetMapReduceCalls() { return getCallsByType("mapReduce/resetMapReduce"); }

// ============================================================================
// Tests
// ============================================================================

describe("useSSEToEntities", () => {
  beforeEach(() => {
    mockDispatch.mockClear();
  });

  // ── State mapping ──

  describe("state mapping", () => {
    it.each([
      ["input-streaming", "pending"],
      ["input-available", "running"],
      ["approval-responded", "running"],
      ["output-available", "complete"],
      ["output-error", "error"],
    ] as const)("should map AI SDK '%s' → entity '%s'", (aiState, expectedState) => {
      const part = makeToolPart({
        toolCallId: `tc-${aiState}`,
        state: aiState,
        output: aiState === "output-available" ? { result: "ok" } : undefined,
      });
      const messages = [makeMessage([part])];
      renderHook(() => useSSEToEntities(messages, "session-1", true));

      const calls = getUpsertCalls();
      expect(calls.length).toBeGreaterThan(0);
      expect(calls[0]![0].payload.state).toBe(expectedState);
    });

    it("should map unknown states to 'running'", () => {
      const part = makeToolPart({
        toolCallId: "tc-unknown",
        state: "some-future-state",
      });
      renderHook(() => useSSEToEntities([makeMessage([part])], "s1", true));
      expect(getUpsertCalls()[0]![0].payload.state).toBe("running");
    });
  });

  // ── Deduplication ──

  describe("deduplication", () => {
    it("should dispatch upsertToolEvent for browser_navigate in output-available", () => {
      const part = makeToolPart({
        toolCallId: "tc-1",
        toolName: "browser_navigate",
        state: "output-available",
        input: { url: "https://example.com" },
        output: { screenshot: "iVBOR..." },
      });
      const messages = [makeMessage([part])];

      renderHook(() => useSSEToEntities(messages, "session-1", true));

      const calls = getUpsertCalls();
      expect(calls.length).toBe(1);

      const entity = calls[0]![0].payload;
      expect(entity.id).toBe("tc-1");
      expect(entity.toolName).toBe("browser_navigate");
      expect(entity.state).toBe("complete");
      expect(entity.sessionId).toBe("session-1");
    });

    it("should dedup same toolCallId:state — dispatches only once", () => {
      const part = makeToolPart({
        toolCallId: "tc-dedup",
        state: "output-available",
      });
      const messages = [makeMessage([part])];

      const { rerender } = renderHook(
        ({ msgs }) => useSSEToEntities(msgs, "session-1", true),
        { initialProps: { msgs: messages } }
      );

      const countAfterFirst = getUpsertCalls().length;

      rerender({ msgs: messages });
      expect(getUpsertCalls().length).toBe(countAfterFirst);
    });

    it("should re-dispatch on every pass during input-streaming", () => {
      const part1 = makeToolPart({
        toolCallId: "tc-stream",
        toolName: "file_write",
        state: "input-streaming",
        input: { path: "/app.ts", content: "const " },
      });
      const messages1 = [makeMessage([part1])];

      const { rerender } = renderHook(
        ({ msgs }) => useSSEToEntities(msgs, "session-1", true),
        { initialProps: { msgs: messages1 } }
      );

      expect(getUpsertCalls().length).toBe(1);

      // Updated streaming content
      const part2 = {
        ...part1,
        input: { path: "/app.ts", content: "const x = 1;" },
      };
      rerender({ msgs: [makeMessage([part2])] });
      expect(getUpsertCalls().length).toBe(2);
    });

    it("should dispatch when state transitions (pending → running → complete)", () => {
      const { rerender } = renderHook(
        ({ msgs }) => useSSEToEntities(msgs, "session-1", true),
        {
          initialProps: {
            msgs: [makeMessage([makeToolPart({ toolCallId: "tc-1", state: "input-available" })])],
          },
        }
      );

      expect(getUpsertCalls().length).toBe(1);
      expect(getUpsertCalls()[0]![0].payload.state).toBe("running");

      // Transition to complete
      rerender({
        msgs: [
          makeMessage([
            makeToolPart({ toolCallId: "tc-1", state: "output-available", output: { ok: true } }),
          ]),
        ],
      });

      expect(getUpsertCalls().length).toBe(2);
      expect(getUpsertCalls()[1]![0].payload.state).toBe("complete");
    });
  });

  // ── Session metadata ──

  describe("session metadata", () => {
    it("should dispatch sandboxId, nekoUrl, streamUrl from message metadata", () => {
      const messages = [
        makeMessage([], {
          sandboxId: "sb-123",
          nekoUrl: "https://neko.test",
          streamUrl: "https://stream.test",
        }),
      ];

      renderHook(() => useSSEToEntities(messages, "session-1", true));

      const calls = getSessionCalls();
      expect(calls.length).toBe(1);
      expect(calls[0]![0].payload.updates.metadata.sandboxId).toBe("sb-123");
      expect(calls[0]![0].payload.updates.metadata.nekoUrl).toBe("https://neko.test");
      expect(calls[0]![0].payload.updates.metadata.streamUrl).toBe("https://stream.test");
    });

    it("should fallback vncUrl → streamUrl", () => {
      const messages = [
        makeMessage([], { sandboxId: "sb-456", vncUrl: "https://vnc.test" }),
      ];

      renderHook(() => useSSEToEntities(messages, "session-1", true));

      const calls = getSessionCalls();
      expect(calls.length).toBe(1);
      expect(calls[0]![0].payload.updates.metadata.streamUrl).toBe("https://vnc.test");
    });

    it("should not dispatch metadata when it hasn't changed", () => {
      const messages = [
        makeMessage([], { sandboxId: "sb-stable" }),
      ];

      const { rerender } = renderHook(
        ({ msgs }) => useSSEToEntities(msgs, "session-1", true),
        { initialProps: { msgs: messages } }
      );

      const countAfterFirst = getSessionCalls().length;

      rerender({ msgs: [...messages] });
      expect(getSessionCalls().length).toBe(countAfterFirst);
    });

    it("should skip empty metadata", () => {
      const messages = [makeMessage([], {})];
      renderHook(() => useSSEToEntities(messages, "session-1", true));
      expect(getSessionCalls().length).toBe(0);
    });
  });

  // ── Sidebar auto-set ──

  describe("sidebar auto-set", () => {
    it("should set sidebar to 'browser' for browser tools during streaming", () => {
      const part = makeToolPart({
        toolCallId: "tc-sidebar",
        toolName: "browser_navigate",
        state: "output-available",
      });
      renderHook(() => useSSEToEntities([makeMessage([part])], "session-1", true));

      const calls = getSidebarCalls();
      expect(calls.length).toBe(1);
      expect(calls[0]![0].payload).toBe("browser");
    });

    it("should set sidebar to 'computer' for terminal tools", () => {
      const part = makeToolPart({
        toolCallId: "tc-term",
        toolName: "shell_exec",
        state: "output-available",
      });
      renderHook(() => useSSEToEntities([makeMessage([part])], "session-1", true));
      expect(getSidebarCalls()[0]![0].payload).toBe("computer");
    });

    it("should set sidebar to 'files' for file tools", () => {
      const part = makeToolPart({
        toolCallId: "tc-file",
        toolName: "file_write",
        state: "output-available",
      });
      renderHook(() => useSSEToEntities([makeMessage([part])], "session-1", true));
      expect(getSidebarCalls()[0]![0].payload).toBe("files");
    });

    it("should set sidebar to 'webdev' for webdev IDE tools", () => {
      const part = makeToolPart({
        toolCallId: "tc-webdev",
        toolName: "webdev_init_project",
        state: "output-available",
      });
      renderHook(() => useSSEToEntities([makeMessage([part])], "session-1", true));
      expect(getSidebarCalls()[0]![0].payload).toBe("webdev");
    });

    it("should NOT set sidebar when not streaming", () => {
      const part = makeToolPart({
        toolCallId: "tc-no-stream",
        toolName: "browser_navigate",
        state: "output-available",
      });
      renderHook(() => useSSEToEntities([makeMessage([part])], "session-1", false));
      expect(getSidebarCalls().length).toBe(0);
    });

    it("should not re-dispatch same sidebar type", () => {
      const parts = [
        makeToolPart({ toolCallId: "tc-1", toolName: "browser_navigate", state: "output-available" }),
        makeToolPart({ toolCallId: "tc-2", toolName: "browser_click", state: "output-available" }),
      ];
      renderHook(() => useSSEToEntities([makeMessage(parts)], "session-1", true));

      // Both are browser → should dispatch sidebar "browser" only once
      expect(getSidebarCalls().length).toBe(1);
    });
  });

  // ── Non-canvas tools ──

  describe("non-canvas tools", () => {
    it("should skip show_plan", () => {
      const part = makeToolPart({
        toolCallId: "tc-plan",
        toolName: "show_plan",
        type: "tool-show_plan",
        state: "output-available",
      });
      renderHook(() => useSSEToEntities([makeMessage([part])], "session-1", true));
      expect(getUpsertCalls().length).toBe(0);
    });

    it("should skip message_notify_user", () => {
      const part = makeToolPart({
        toolCallId: "tc-notify",
        toolName: "message_notify_user",
        type: "tool-message_notify_user",
        state: "output-available",
      });
      renderHook(() => useSSEToEntities([makeMessage([part])], "session-1", true));
      expect(getUpsertCalls().length).toBe(0);
    });

    it("should map generate_image to aiCanvas view", () => {
      const part = makeToolPart({
        toolCallId: "tc-img",
        toolName: "generate_image",
        type: "tool-generate_image",
        state: "output-available",
        output: { url: "https://cdn.example.com/img.png" },
      });
      renderHook(() => useSSEToEntities([makeMessage([part])], "session-1", true));
      expect(getUpsertCalls().length).toBe(1);
      expect(getUpsertCalls()[0]![0].payload.toolName).toBe("generate_image");
    });
  });

  // ── Screenshot normalization ──

  describe("screenshot extraction", () => {
    it("should normalize raw PNG base64 to data URI", () => {
      const part = makeToolPart({
        toolCallId: "tc-png",
        state: "output-available",
        output: { screenshot: "iVBORw0KGgoAAAANS..." },
      });
      renderHook(() => useSSEToEntities([makeMessage([part])], "s1", true));
      expect(getUpsertCalls()[0]![0].payload.screenshot).toMatch(/^data:image\/png;base64,/);
    });

    it("should normalize raw JPEG base64 to data URI", () => {
      const part = makeToolPart({
        toolCallId: "tc-jpg",
        state: "output-available",
        output: { screenshot: "/9j/4AAQSkZJRg..." },
      });
      renderHook(() => useSSEToEntities([makeMessage([part])], "s1", true));
      expect(getUpsertCalls()[0]![0].payload.screenshot).toMatch(/^data:image\/jpeg;base64,/);
    });

    it("should pass through data URIs unchanged", () => {
      const dataUri = "data:image/webp;base64,UklGR...";
      const part = makeToolPart({
        toolCallId: "tc-datauri",
        state: "output-available",
        output: { screenshot: dataUri },
      });
      renderHook(() => useSSEToEntities([makeMessage([part])], "s1", true));
      expect(getUpsertCalls()[0]![0].payload.screenshot).toBe(dataUri);
    });

    it("should pass through URLs unchanged", () => {
      const url = "https://cdn.example.com/screenshot.png";
      const part = makeToolPart({
        toolCallId: "tc-url",
        state: "output-available",
        output: { screenshot: url },
      });
      renderHook(() => useSSEToEntities([makeMessage([part])], "s1", true));
      expect(getUpsertCalls()[0]![0].payload.screenshot).toBe(url);
    });

    it("should extract screenshot from output.data fallback", () => {
      const part = makeToolPart({
        toolCallId: "tc-data",
        state: "output-available",
        output: { data: "iVBORw0KGgo..." },
      });
      renderHook(() => useSSEToEntities([makeMessage([part])], "s1", true));
      expect(getUpsertCalls()[0]![0].payload.screenshot).toMatch(/^data:image\/png;base64,/);
    });

    it("should extract screenshot from output.result.screenshot fallback", () => {
      const part = makeToolPart({
        toolCallId: "tc-nested",
        state: "output-available",
        output: { result: { screenshot: "iVBORw0KGgo..." } },
      });
      renderHook(() => useSSEToEntities([makeMessage([part])], "s1", true));
      expect(getUpsertCalls()[0]![0].payload.screenshot).toMatch(/^data:image\/png;base64,/);
    });
  });

  // ── URL/title/content extraction ──

  describe("data extraction", () => {
    it("should extract URL from output first, then input args", () => {
      const part = makeToolPart({
        toolCallId: "tc-url",
        state: "output-available",
        input: { url: "https://input.com" },
        output: { url: "https://output.com" },
      });
      renderHook(() => useSSEToEntities([makeMessage([part])], "s1", true));
      expect(getUpsertCalls()[0]![0].payload.url).toBe("https://output.com");
    });

    it("should fallback URL to input args when output has none", () => {
      const part = makeToolPart({
        toolCallId: "tc-url-fallback",
        state: "output-available",
        input: { url: "https://input-only.com" },
        output: { content: "some text" },
      });
      renderHook(() => useSSEToEntities([makeMessage([part])], "s1", true));
      expect(getUpsertCalls()[0]![0].payload.url).toBe("https://input-only.com");
    });

    it("should generate search:// URL for search tools", () => {
      const part = makeToolPart({
        toolCallId: "tc-search",
        toolName: "web_search",
        type: "tool-web_search",
        state: "output-available",
        input: { query: "croatia summer" },
        output: { results: [] },
      });
      renderHook(() => useSSEToEntities([makeMessage([part])], "s1", true));
      expect(getUpsertCalls()[0]![0].payload.url).toBe("search://croatia summer");
    });

    it("should generate search:// URL from search_query arg", () => {
      const part = makeToolPart({
        toolCallId: "tc-search2",
        toolName: "info_search_web",
        type: "tool-info_search_web",
        state: "output-available",
        input: { search_query: "best beaches" },
        output: {},
      });
      renderHook(() => useSSEToEntities([makeMessage([part])], "s1", true));
      expect(getUpsertCalls()[0]![0].payload.url).toBe("search://best beaches");
    });

    it("should extract title from output", () => {
      const part = makeToolPart({
        toolCallId: "tc-title",
        state: "output-available",
        output: { title: "Example Page" },
      });
      renderHook(() => useSSEToEntities([makeMessage([part])], "s1", true));
      expect(getUpsertCalls()[0]![0].payload.title).toBe("Example Page");
    });

    it("should extract content from output", () => {
      const part = makeToolPart({
        toolCallId: "tc-content",
        toolName: "browser_view",
        state: "output-available",
        output: { content: "Page text content here" },
      });
      renderHook(() => useSSEToEntities([makeMessage([part])], "s1", true));
      expect(getUpsertCalls()[0]![0].payload.content).toBe("Page text content here");
    });

    it("should extract content from output.text fallback", () => {
      const part = makeToolPart({
        toolCallId: "tc-text",
        toolName: "browser_view",
        state: "output-available",
        output: { text: "Fallback text" },
      });
      renderHook(() => useSSEToEntities([makeMessage([part])], "s1", true));
      expect(getUpsertCalls()[0]![0].payload.content).toBe("Fallback text");
    });
  });

  // ── Session switch ──

  describe("session switch", () => {
    it("should clear processedRef when session changes", () => {
      const part = makeToolPart({ toolCallId: "tc-1", state: "output-available" });
      const messages = [makeMessage([part])];

      const { rerender } = renderHook(
        ({ msgs, sid }) => useSSEToEntities(msgs, sid, true),
        { initialProps: { msgs: messages, sid: "session-1" } }
      );

      expect(getUpsertCalls().length).toBe(1);

      // Switch session — processedRef clears
      rerender({ msgs: messages, sid: "session-2" });
      // Re-trigger with new array ref
      rerender({ msgs: [...messages], sid: "session-2" });

      // Should re-dispatch for new session
      expect(getUpsertCalls().length).toBeGreaterThan(1);
    });

    it("should dispatch clearSessionToolCalls and resetTimeline on session switch", () => {
      const part = makeToolPart({ toolCallId: "tc-1", state: "output-available" });
      const messages = [makeMessage([part])];

      const { rerender } = renderHook(
        ({ msgs, sid }) => useSSEToEntities(msgs, sid, true),
        { initialProps: { msgs: messages, sid: "session-1" } }
      );

      rerender({ msgs: messages, sid: "session-2" });

      expect(getClearSessionToolCalls().length).toBe(1);
      expect(getClearSessionToolCalls()[0]![0].payload).toBe("session-1");
      expect(getTimelineResetCalls().length).toBe(1);
    });
  });

  // ── Multiple tools ──

  describe("multiple tools", () => {
    it("should process multiple tools in a single message", () => {
      const parts = [
        makeToolPart({ toolCallId: "tc-1", toolName: "browser_navigate", state: "output-available" }),
        makeToolPart({ toolCallId: "tc-2", toolName: "browser_click", state: "output-available" }),
        makeToolPart({ toolCallId: "tc-3", toolName: "shell_exec", state: "output-available" }),
      ];
      renderHook(() => useSSEToEntities([makeMessage(parts)], "session-1", true));
      expect(getUpsertCalls().length).toBe(3);
    });

    it("should process tools across multiple messages", () => {
      const msg1 = makeMessage([
        makeToolPart({ toolCallId: "tc-1", toolName: "browser_navigate", state: "output-available" }),
      ]);
      const msg2 = makeMessage([
        makeToolPart({ toolCallId: "tc-2", toolName: "shell_exec", state: "output-available" }),
      ]);

      renderHook(() => useSSEToEntities([msg1, msg2], "session-1", true));
      expect(getUpsertCalls().length).toBe(2);
    });

    it("should skip user messages (role !== assistant)", () => {
      const userMsg = {
        id: "user-1",
        role: "user" as const,
        parts: [{ type: "text", text: "Hello" }],
        content: "Hello",
        createdAt: new Date(),
      } as unknown as UIMessage;

      renderHook(() => useSSEToEntities([userMsg], "session-1", true));
      expect(getUpsertCalls().length).toBe(0);
    });
  });

  // ── Tool name extraction ──

  describe("tool name extraction", () => {
    it("should use toolName field when present", () => {
      const part = makeToolPart({
        toolCallId: "tc-named",
        type: "tool-browser_navigate",
        toolName: "browser_navigate",
        state: "output-available",
      });
      renderHook(() => useSSEToEntities([makeMessage([part])], "s1", true));
      expect(getUpsertCalls()[0]![0].payload.toolName).toBe("browser_navigate");
    });

    it("should derive tool name from type when toolName is missing", () => {
      const part = {
        type: "tool-shell_exec",
        toolCallId: "tc-no-name",
        state: "output-available",
        input: { command: "ls" },
        output: { stdout: "ok" },
      };
      renderHook(() => useSSEToEntities([makeMessage([part])], "s1", true));
      expect(getUpsertCalls()[0]![0].payload.toolName).toBe("shell_exec");
    });
  });

  // ── TIMELINE SLICE WIRING ──

  describe("timeline slice wiring", () => {
    it("should dispatch addSegmentEvent for output-available tool", () => {
      const part = makeToolPart({
        toolCallId: "tc-tl-1",
        toolName: "browser_navigate",
        state: "output-available",
        input: { url: "https://example.com" },
      });
      renderHook(() => useSSEToEntities([makeMessage([part])], "session-1", true));

      const calls = getTimelineCalls();
      expect(calls.length).toBe(1);
      expect(calls[0]![0].payload.segmentId).toBe("session-1");
      expect(calls[0]![0].payload.event.type).toBe("browser_navigate");
      expect(calls[0]![0].payload.event.title).toContain("Navigate to");
    });

    it("should dispatch addSegmentEvent for shell_exec with command title", () => {
      const part = makeToolPart({
        toolCallId: "tc-tl-shell",
        toolName: "shell_exec",
        type: "tool-shell_exec",
        state: "output-available",
        input: { command: "npm install express" },
        output: { stdout: "added 50 packages" },
      });
      renderHook(() => useSSEToEntities([makeMessage([part])], "session-1", true));

      const calls = getTimelineCalls();
      expect(calls.length).toBe(1);
      expect(calls[0]![0].payload.event.type).toBe("shell_exec");
      expect(calls[0]![0].payload.event.title).toContain("npm install");
    });

    it("should dispatch addSegmentEvent for file_write with path title", () => {
      const part = makeToolPart({
        toolCallId: "tc-tl-file",
        toolName: "file_write",
        type: "tool-file_write",
        state: "output-available",
        input: { path: "/src/app.ts" },
        output: { content: "const x = 1;" },
      });
      renderHook(() => useSSEToEntities([makeMessage([part])], "session-1", true));

      const calls = getTimelineCalls();
      expect(calls.length).toBe(1);
      expect(calls[0]![0].payload.event.type).toBe("file_create");
      expect(calls[0]![0].payload.event.title).toContain("/src/app.ts");
    });

    it("should dispatch addSegmentEvent for search tool with query title", () => {
      const part = makeToolPart({
        toolCallId: "tc-tl-search",
        toolName: "web_search",
        type: "tool-web_search",
        state: "output-available",
        input: { query: "best restaurants" },
        output: { results: [] },
      });
      renderHook(() => useSSEToEntities([makeMessage([part])], "session-1", true));

      const calls = getTimelineCalls();
      expect(calls.length).toBe(1);
      expect(calls[0]![0].payload.event.title).toContain("Search:");
      expect(calls[0]![0].payload.event.title).toContain("best restaurants");
    });

    it("should dedup timeline events (same toolCallId:state)", () => {
      const part = makeToolPart({
        toolCallId: "tc-tl-dedup",
        state: "output-available",
      });
      const { rerender } = renderHook(
        ({ msgs }) => useSSEToEntities(msgs, "s1", true),
        { initialProps: { msgs: [makeMessage([part])] } }
      );

      const countAfterFirst = getTimelineCalls().length;
      rerender({ msgs: [makeMessage([part])] });
      expect(getTimelineCalls().length).toBe(countAfterFirst);
    });

    it("should NOT dispatch timeline for input-streaming (noisy)", () => {
      const part = makeToolPart({
        toolCallId: "tc-tl-stream",
        toolName: "file_write",
        state: "input-streaming",
        input: { path: "/app.ts", content: "partial..." },
      });
      renderHook(() => useSSEToEntities([makeMessage([part])], "s1", true));
      // input-streaming is explicitly excluded from timeline
      expect(getTimelineCalls().length).toBe(0);
    });

    it("should set timeline sessionId on mount", () => {
      renderHook(() => useSSEToEntities([], "session-42", false));
      const calls = getTimelineSessionCalls();
      expect(calls.length).toBe(1);
      expect(calls[0]![0].payload).toBe("session-42");
    });

    it("should dispatch deploy event type for deploy tools", () => {
      const part = makeToolPart({
        toolCallId: "tc-deploy",
        toolName: "deploy_apply_deployment",
        type: "tool-deploy_apply_deployment",
        state: "output-available",
        input: {},
        output: {},
      });
      renderHook(() => useSSEToEntities([makeMessage([part])], "s1", true));
      expect(getTimelineCalls()[0]![0].payload.event.type).toBe("deploy");
    });

    it("should include error description for failed tools", () => {
      const part = makeToolPart({
        toolCallId: "tc-err",
        state: "output-error",
        output: { error: "Permission denied" },
      });
      renderHook(() => useSSEToEntities([makeMessage([part])], "s1", true));

      const calls = getTimelineCalls();
      expect(calls.length).toBe(1);
      expect(calls[0]![0].payload.event.description).toBe("Permission denied");
    });
  });

  // ── TOOLCALLS SLICE WIRING ──

  describe("toolCalls slice wiring", () => {
    it("should dispatch startToolCall on input-available", () => {
      const part = makeToolPart({
        toolCallId: "tc-start-1",
        toolName: "browser_navigate",
        state: "input-available",
        input: { url: "https://example.com" },
      });
      renderHook(() => useSSEToEntities([makeMessage([part])], "session-1", true));

      const calls = getStartToolCalls();
      expect(calls.length).toBe(1);
      expect(calls[0]![0].payload.correlationId).toBe("tc-start-1");
      expect(calls[0]![0].payload.toolName).toBe("browser_navigate");
      expect(calls[0]![0].payload.sessionId).toBe("session-1");
      expect(calls[0]![0].payload.input).toEqual({ url: "https://example.com" });
    });

    it("should dispatch startToolCall on input-streaming", () => {
      const part = makeToolPart({
        toolCallId: "tc-start-stream",
        toolName: "file_write",
        state: "input-streaming",
        input: { path: "/app.ts" },
      });
      renderHook(() => useSSEToEntities([makeMessage([part])], "session-1", true));

      const calls = getStartToolCalls();
      expect(calls.length).toBe(1);
      expect(calls[0]![0].payload.correlationId).toBe("tc-start-stream");
    });

    it("should dispatch completeToolCall on output-available", () => {
      const part = makeToolPart({
        toolCallId: "tc-complete-1",
        toolName: "shell_exec",
        state: "output-available",
        output: { stdout: "OK", exitCode: 0 },
      });
      renderHook(() => useSSEToEntities([makeMessage([part])], "session-1", true));

      const calls = getCompleteToolCalls();
      expect(calls.length).toBe(1);
      expect(calls[0]![0].payload.correlationId).toBe("tc-complete-1");
      expect(calls[0]![0].payload.output).toEqual({ stdout: "OK", exitCode: 0 });
    });

    it("should dispatch failToolCall on output-error", () => {
      const part = makeToolPart({
        toolCallId: "tc-fail-1",
        toolName: "shell_exec",
        state: "output-error",
        output: { error: "Command not found" },
      });
      renderHook(() => useSSEToEntities([makeMessage([part])], "session-1", true));

      const calls = getFailToolCalls();
      expect(calls.length).toBe(1);
      expect(calls[0]![0].payload.correlationId).toBe("tc-fail-1");
      expect(calls[0]![0].payload.error).toBe("Command not found");
    });

    it("should dispatch failToolCall with default error message when no error in output", () => {
      const part = makeToolPart({
        toolCallId: "tc-fail-default",
        state: "output-error",
        output: {},
      });
      renderHook(() => useSSEToEntities([makeMessage([part])], "s1", true));
      expect(getFailToolCalls()[0]![0].payload.error).toBe("Tool execution failed");
    });

    it("should track full lifecycle: start → complete", () => {
      const { rerender } = renderHook(
        ({ msgs }) => useSSEToEntities(msgs, "session-1", true),
        {
          initialProps: {
            msgs: [makeMessage([makeToolPart({
              toolCallId: "tc-lifecycle",
              toolName: "browser_navigate",
              state: "input-available",
              input: { url: "https://example.com" },
            })])],
          },
        }
      );

      expect(getStartToolCalls().length).toBe(1);
      expect(getCompleteToolCalls().length).toBe(0);

      rerender({
        msgs: [makeMessage([makeToolPart({
          toolCallId: "tc-lifecycle",
          toolName: "browser_navigate",
          state: "output-available",
          output: { screenshot: "iVBOR..." },
        })])],
      });

      expect(getCompleteToolCalls().length).toBe(1);
      expect(getCompleteToolCalls()[0]![0].payload.correlationId).toBe("tc-lifecycle");
    });

    it("should NOT double-start a tool (dedup on started flag)", () => {
      const part1 = makeToolPart({
        toolCallId: "tc-double",
        toolName: "file_write",
        state: "input-streaming",
        input: { path: "/a.ts" },
      });
      const part2 = {
        ...part1,
        state: "input-available",
      };
      const messages = [makeMessage([part1, part2])];
      renderHook(() => useSSEToEntities(messages, "s1", true));

      // Only one startToolCall despite two start-like states
      expect(getStartToolCalls().length).toBe(1);
    });
  });

  // ── CODEVIEWER SLICE WIRING ──

  describe("codeViewer slice wiring", () => {
    it("should dispatch openFileTab + setFileContent for file_read output", () => {
      const part = makeToolPart({
        toolCallId: "tc-cv-read",
        toolName: "file_read",
        type: "tool-file_read",
        state: "output-available",
        input: { path: "/src/index.ts" },
        output: { content: "export default function() {}" },
      });
      renderHook(() => useSSEToEntities([makeMessage([part])], "session-1", true));

      const fileCalls = getSetFileContentCalls();
      expect(fileCalls.length).toBe(1);
      expect(fileCalls[0]![0].payload.path).toBe("/src/index.ts");
      expect(fileCalls[0]![0].payload.content).toBe("export default function() {}");

      const tabCalls = getOpenFileTabCalls();
      expect(tabCalls.length).toBe(1);
      expect(tabCalls[0]![0].payload.id).toBe("/src/index.ts");
      expect(tabCalls[0]![0].payload.name).toBe("index.ts");
      expect(tabCalls[0]![0].payload.language).toBe("typescript");
      expect(tabCalls[0]![0].payload.isModified).toBe(false);
    });

    it("should mark tab as modified for file_write", () => {
      const part = makeToolPart({
        toolCallId: "tc-cv-write",
        toolName: "file_write",
        type: "tool-file_write",
        state: "output-available",
        input: { path: "/src/app.py" },
        output: { content: "print('hello')" },
      });
      renderHook(() => useSSEToEntities([makeMessage([part])], "s1", true));

      const tabCalls = getOpenFileTabCalls();
      expect(tabCalls.length).toBe(1);
      expect(tabCalls[0]![0].payload.isModified).toBe(true);
      expect(tabCalls[0]![0].payload.language).toBe("python");
    });

    it("should mark tab as modified for file_str_replace", () => {
      const part = makeToolPart({
        toolCallId: "tc-cv-replace",
        toolName: "file_str_replace",
        type: "tool-file_str_replace",
        state: "output-available",
        input: { path: "/app.css" },
        output: { content: "body { color: red; }" },
      });
      renderHook(() => useSSEToEntities([makeMessage([part])], "s1", true));

      expect(getOpenFileTabCalls()[0]![0].payload.isModified).toBe(true);
      expect(getOpenFileTabCalls()[0]![0].payload.language).toBe("css");
    });

    it("should detect language from file extension", () => {
      const extensions = [
        { path: "/a.ts", lang: "typescript" },
        { path: "/b.js", lang: "javascript" },
        { path: "/c.py", lang: "python" },
        { path: "/d.rs", lang: "rust" },
        { path: "/e.go", lang: "go" },
        { path: "/f.json", lang: "json" },
        { path: "/g.md", lang: "markdown" },
        { path: "/h.html", lang: "html" },
        { path: "/i.sql", lang: "sql" },
        { path: "/j.yaml", lang: "yaml" },
      ];

      for (const { path, lang } of extensions) {
        mockDispatch.mockClear();
        const part = makeToolPart({
          toolCallId: `tc-lang-${lang}`,
          toolName: "file_read",
          type: "tool-file_read",
          state: "output-available",
          input: { path },
          output: { content: "// code" },
        });
        renderHook(() => useSSEToEntities([makeMessage([part])], "s1", true));
        expect(getOpenFileTabCalls()[0]![0].payload.language).toBe(lang);
      }
    });

    it("should NOT dispatch codeViewer for non-complete states", () => {
      const part = makeToolPart({
        toolCallId: "tc-cv-incomplete",
        toolName: "file_read",
        type: "tool-file_read",
        state: "input-available",
        input: { path: "/src/test.ts" },
      });
      renderHook(() => useSSEToEntities([makeMessage([part])], "s1", true));
      expect(getOpenFileTabCalls().length).toBe(0);
      expect(getSetFileContentCalls().length).toBe(0);
    });

    it("should dispatch setDirectoryList for file_find_by_name results", () => {
      const part = makeToolPart({
        toolCallId: "tc-cv-find",
        toolName: "file_find_by_name",
        type: "tool-file_find_by_name",
        state: "output-available",
        input: { pattern: "*.ts" },
        output: {
          files: [
            { path: "/src/index.ts", name: "index.ts", type: "file" },
            { path: "/src/app.ts", name: "app.ts", type: "file" },
            { path: "/src/utils", name: "utils", type: "directory" },
          ],
        },
      });
      renderHook(() => useSSEToEntities([makeMessage([part])], "s1", true));

      const calls = getSetDirectoryListCalls();
      expect(calls.length).toBe(1);
      expect(calls[0]![0].payload).toHaveLength(3);
      expect(calls[0]![0].payload[0].path).toBe("/src/index.ts");
      expect(calls[0]![0].payload[2].type).toBe("directory");
    });

    it("should NOT dispatch setDirectoryList when output has no files array", () => {
      const part = makeToolPart({
        toolCallId: "tc-cv-nofind",
        toolName: "file_find_by_name",
        type: "tool-file_find_by_name",
        state: "output-available",
        input: { pattern: "*.xyz" },
        output: { message: "No files found" },
      });
      renderHook(() => useSSEToEntities([makeMessage([part])], "s1", true));
      expect(getSetDirectoryListCalls().length).toBe(0);
    });

    it("should extract file path from file_path arg variant", () => {
      const part = makeToolPart({
        toolCallId: "tc-cv-alt",
        toolName: "file_read",
        type: "tool-file_read",
        state: "output-available",
        input: { file_path: "/config.json" },
        output: { content: "{}" },
      });
      renderHook(() => useSSEToEntities([makeMessage([part])], "s1", true));
      expect(getOpenFileTabCalls()[0]![0].payload.path).toBe("/config.json");
    });

    it("should handle text_editor tool (Manus parity)", () => {
      const part = makeToolPart({
        toolCallId: "tc-cv-text-editor",
        toolName: "text_editor",
        type: "tool-text_editor",
        state: "output-available",
        input: { path: "/readme.md" },
        output: { content: "# Hello" },
      });
      renderHook(() => useSSEToEntities([makeMessage([part])], "s1", true));
      expect(getOpenFileTabCalls().length).toBe(1);
      expect(getOpenFileTabCalls()[0]![0].payload.language).toBe("markdown");
    });
  });

  // ── WEBDEV SLICE WIRING ──

  describe("webDev slice wiring", () => {
    it("should dispatch setProject for webdev_init_project output", () => {
      const part = makeToolPart({
        toolCallId: "tc-wd-init",
        toolName: "webdev_init_project",
        type: "tool-webdev_init_project",
        state: "output-available",
        input: { name: "My App", framework: "next" },
        output: {
          projectId: "proj-123",
          name: "My App",
          description: "A Next.js app",
          url: "https://myapp.rubic.dev",
          previewUrl: "https://preview.rubic.dev/proj-123",
          framework: "next",
        },
      });
      renderHook(() => useSSEToEntities([makeMessage([part])], "session-1", true));

      const calls = getSetProjectCalls();
      expect(calls.length).toBe(1);
      expect(calls[0]![0].payload.id).toBe("proj-123");
      expect(calls[0]![0].payload.name).toBe("My App");
      expect(calls[0]![0].payload.description).toBe("A Next.js app");
      expect(calls[0]![0].payload.url).toBe("https://myapp.rubic.dev");
      expect(calls[0]![0].payload.previewUrl).toBe("https://preview.rubic.dev/proj-123");
      expect(calls[0]![0].payload.framework).toBe("next");
      expect(calls[0]![0].payload.status).toBe("deployed");
    });

    it("should use toolCallId as project ID when output has no projectId", () => {
      const part = makeToolPart({
        toolCallId: "tc-wd-noid",
        toolName: "webdev_init_project",
        type: "tool-webdev_init_project",
        state: "output-available",
        input: { name: "Fallback" },
        output: { name: "Fallback" },
      });
      renderHook(() => useSSEToEntities([makeMessage([part])], "s1", true));

      expect(getSetProjectCalls()[0]![0].payload.id).toBe("tc-wd-noid");
    });

    it("should dispatch updateProject for webdev_check_status", () => {
      const part = makeToolPart({
        toolCallId: "tc-wd-status",
        toolName: "webdev_check_status",
        type: "tool-webdev_check_status",
        state: "output-available",
        input: {},
        output: {
          status: "building",
          url: "https://updated.rubic.dev",
          previewUrl: "https://preview2.rubic.dev",
        },
      });
      renderHook(() => useSSEToEntities([makeMessage([part])], "s1", true));

      const calls = getUpdateProjectCalls();
      expect(calls.length).toBe(1);
      expect(calls[0]![0].payload.status).toBe("building");
      expect(calls[0]![0].payload.url).toBe("https://updated.rubic.dev");
      expect(calls[0]![0].payload.previewUrl).toBe("https://preview2.rubic.dev");
    });

    it("should dispatch updateProject with building status for webdev_restart_server", () => {
      const part = makeToolPart({
        toolCallId: "tc-wd-restart",
        toolName: "webdev_restart_server",
        type: "tool-webdev_restart_server",
        state: "output-available",
        input: {},
        output: { message: "Server restarting" },
      });
      renderHook(() => useSSEToEntities([makeMessage([part])], "s1", true));

      const calls = getUpdateProjectCalls();
      expect(calls.length).toBe(1);
      expect(calls[0]![0].payload.status).toBe("building");
    });

    it("should dispatch setWebDevActiveTab('database') for webdev_execute_sql", () => {
      const part = makeToolPart({
        toolCallId: "tc-wd-sql",
        toolName: "webdev_execute_sql",
        type: "tool-webdev_execute_sql",
        state: "output-available",
        input: { query: "SELECT * FROM users" },
        output: { rows: [] },
      });
      renderHook(() => useSSEToEntities([makeMessage([part])], "s1", true));

      const calls = getWebDevActiveTabCalls();
      expect(calls.length).toBe(1);
      expect(calls[0]![0].payload).toBe("database");
    });

    it("should dispatch setWebDevActiveTab + updateProject for webdev_push_schema", () => {
      const part = makeToolPart({
        toolCallId: "tc-wd-schema",
        toolName: "webdev_push_schema",
        type: "tool-webdev_push_schema",
        state: "output-available",
        input: {},
        output: { success: true },
      });
      renderHook(() => useSSEToEntities([makeMessage([part])], "s1", true));

      expect(getWebDevActiveTabCalls().length).toBe(1);
      expect(getWebDevActiveTabCalls()[0]![0].payload).toBe("database");
      expect(getUpdateProjectCalls().length).toBe(1);
    });

    it("should dispatch updateProject for webdev_save_checkpoint", () => {
      const part = makeToolPart({
        toolCallId: "tc-wd-save",
        toolName: "webdev_save_checkpoint",
        type: "tool-webdev_save_checkpoint",
        state: "output-available",
        input: {},
        output: { version: "v3" },
      });
      renderHook(() => useSSEToEntities([makeMessage([part])], "s1", true));

      const calls = getUpdateProjectCalls();
      expect(calls.length).toBe(1);
      expect(calls[0]![0].payload.updatedAt).toBeDefined();
    });

    it("should dispatch updateProject for webdev_add_feature", () => {
      const part = makeToolPart({
        toolCallId: "tc-wd-feature",
        toolName: "webdev_add_feature",
        type: "tool-webdev_add_feature",
        state: "output-available",
        input: { feature: "dark mode" },
        output: { success: true },
      });
      renderHook(() => useSSEToEntities([makeMessage([part])], "s1", true));
      expect(getUpdateProjectCalls().length).toBe(1);
    });

    it("should NOT dispatch webDev for non-output states", () => {
      const part = makeToolPart({
        toolCallId: "tc-wd-pending",
        toolName: "webdev_init_project",
        type: "tool-webdev_init_project",
        state: "input-available",
        input: { name: "test" },
      });
      renderHook(() => useSSEToEntities([makeMessage([part])], "s1", true));
      expect(getSetProjectCalls().length).toBe(0);
      expect(getUpdateProjectCalls().length).toBe(0);
    });

    it("should dedup webDev dispatches (same toolCallId)", () => {
      const part = makeToolPart({
        toolCallId: "tc-wd-dedup",
        toolName: "webdev_init_project",
        type: "tool-webdev_init_project",
        state: "output-available",
        input: { name: "test" },
        output: { projectId: "p1" },
      });
      const { rerender } = renderHook(
        ({ msgs }) => useSSEToEntities(msgs, "s1", true),
        { initialProps: { msgs: [makeMessage([part])] } }
      );

      const countAfterFirst = getSetProjectCalls().length;
      rerender({ msgs: [makeMessage([part])] });
      expect(getSetProjectCalls().length).toBe(countAfterFirst);
    });
  });

  // ── SLIDE EDITOR SLICE WIRING ──

  describe("slideEditor slice wiring", () => {
    it("should dispatch setIsPresentationMode(true) for slide_present", () => {
      const part = makeToolPart({
        toolCallId: "tc-slide-1",
        toolName: "slide_present",
        type: "tool-slide_present",
        state: "output-available",
        input: {},
        output: { url: "https://slides.rubic.dev/123" },
      });
      renderHook(() => useSSEToEntities([makeMessage([part])], "session-1", true));

      const calls = getSetPresentationModeCalls();
      expect(calls.length).toBe(1);
      expect(calls[0]![0].payload).toBe(true);
    });

    it("should dispatch setSlides when output contains slides array", () => {
      const part = makeToolPart({
        toolCallId: "tc-slide-data",
        toolName: "slide_present",
        type: "tool-slide_present",
        state: "output-available",
        input: {},
        output: {
          slides: [
            { id: "s1", elements: [{ id: "e1", type: "text" }], notes: "Intro slide" },
            { id: "s2", elements: [], thumbnail: "data:image/png;base64,abc" },
          ],
        },
      });
      renderHook(() => useSSEToEntities([makeMessage([part])], "session-1", true));

      const calls = getSetSlidesCalls();
      expect(calls.length).toBe(1);
      expect(calls[0]![0].payload).toHaveLength(2);
      expect(calls[0]![0].payload[0].id).toBe("s1");
      expect(calls[0]![0].payload[0].index).toBe(0);
      expect(calls[0]![0].payload[0].notes).toBe("Intro slide");
      expect(calls[0]![0].payload[1].id).toBe("s2");
      expect(calls[0]![0].payload[1].index).toBe(1);
      expect(calls[0]![0].payload[1].thumbnail).toBe("data:image/png;base64,abc");
    });

    it("should NOT dispatch setSlides when output has no slides array", () => {
      const part = makeToolPart({
        toolCallId: "tc-slide-noslides",
        toolName: "slide_present",
        type: "tool-slide_present",
        state: "output-available",
        input: {},
        output: { url: "https://slides.rubic.dev/123" },
      });
      renderHook(() => useSSEToEntities([makeMessage([part])], "s1", true));

      expect(getSetPresentationModeCalls().length).toBe(1);
      expect(getSetSlidesCalls().length).toBe(0);
    });

    it("should generate slide IDs when not provided", () => {
      const part = makeToolPart({
        toolCallId: "tc-slide-noid",
        toolName: "slide_present",
        type: "tool-slide_present",
        state: "output-available",
        input: {},
        output: {
          slides: [{ elements: [] }, { elements: [] }],
        },
      });
      renderHook(() => useSSEToEntities([makeMessage([part])], "s1", true));

      const slides = getSetSlidesCalls()[0]![0].payload;
      expect(slides[0].id).toBe("slide-0");
      expect(slides[1].id).toBe("slide-1");
    });

    it("should NOT dispatch slideEditor for non-output states", () => {
      const part = makeToolPart({
        toolCallId: "tc-slide-pending",
        toolName: "slide_present",
        type: "tool-slide_present",
        state: "input-available",
        input: {},
      });
      renderHook(() => useSSEToEntities([makeMessage([part])], "s1", true));
      expect(getSetPresentationModeCalls().length).toBe(0);
    });

    it("should dedup slideEditor dispatches", () => {
      const part = makeToolPart({
        toolCallId: "tc-slide-dedup",
        toolName: "slide_present",
        type: "tool-slide_present",
        state: "output-available",
        input: {},
        output: { slides: [{ elements: [] }] },
      });
      const { rerender } = renderHook(
        ({ msgs }) => useSSEToEntities(msgs, "s1", true),
        { initialProps: { msgs: [makeMessage([part])] } }
      );

      const countMode = getSetPresentationModeCalls().length;
      const countSlides = getSetSlidesCalls().length;
      rerender({ msgs: [makeMessage([part])] });
      expect(getSetPresentationModeCalls().length).toBe(countMode);
      expect(getSetSlidesCalls().length).toBe(countSlides);
    });
  });

  // ── MAPREDUCE SLICE WIRING ──

  describe("mapReduce slice wiring", () => {
    it("should dispatch startMapReduceTask from metadata.mapReduce.action=start", () => {
      const messages = [
        makeMessage([], {
          mapReduce: {
            action: "start",
            taskId: "mr-task-1",
            name: "Research competitors",
            totalItems: 4,
          },
        }),
      ];
      renderHook(() => useSSEToEntities(messages, "session-1", true));

      const calls = getMapReduceStartCalls();
      expect(calls.length).toBe(1);
      expect(calls[0]![0].payload.id).toBe("mr-task-1");
      expect(calls[0]![0].payload.name).toBe("Research competitors");
      expect(calls[0]![0].payload.totalItems).toBe(4);
    });

    it("should use msg.id as taskId when mapReduce.taskId is missing", () => {
      const msg = makeMessage([], {
        mapReduce: { action: "start", name: "Quick task", totalItems: 2 },
      });
      renderHook(() => useSSEToEntities([msg], "s1", true));

      expect(getMapReduceStartCalls()[0]![0].payload.id).toBe(msg.id);
    });

    it("should dispatch updateMapReduceProgress from metadata.mapReduce.action=progress", () => {
      const messages = [
        makeMessage([], {
          mapReduce: {
            action: "progress",
            taskId: "mr-task-1",
            processedItems: 2,
            progress: 50,
          },
        }),
      ];
      renderHook(() => useSSEToEntities(messages, "s1", true));

      const calls = getMapReduceProgressCalls();
      expect(calls.length).toBe(1);
      expect(calls[0]![0].payload.processedItems).toBe(2);
      expect(calls[0]![0].payload.progress).toBe(50);
    });

    it("should dispatch completeMapReduceTask from metadata.mapReduce.action=complete", () => {
      const messages = [
        makeMessage([], {
          mapReduce: { action: "complete", taskId: "mr-task-1" },
        }),
      ];
      renderHook(() => useSSEToEntities(messages, "s1", true));

      expect(getMapReduceCompleteCalls().length).toBe(1);
    });

    it("should dispatch failMapReduceTask from metadata.mapReduce.action=fail", () => {
      const messages = [
        makeMessage([], {
          mapReduce: {
            action: "fail",
            taskId: "mr-task-1",
            error: "Worker 3 timed out",
          },
        }),
      ];
      renderHook(() => useSSEToEntities(messages, "s1", true));

      const calls = getMapReduceFailCalls();
      expect(calls.length).toBe(1);
      expect(calls[0]![0].payload).toBe("Worker 3 timed out");
    });

    it("should use default error message when mapReduce.error is missing", () => {
      const messages = [
        makeMessage([], {
          mapReduce: { action: "fail", taskId: "mr-task-1" },
        }),
      ];
      renderHook(() => useSSEToEntities(messages, "s1", true));
      expect(getMapReduceFailCalls()[0]![0].payload).toBe("Parallel task failed");
    });

    it("should dedup mapReduce metadata (same msg.id + action)", () => {
      const msg = makeMessage([], {
        mapReduce: { action: "start", taskId: "mr-1", name: "test", totalItems: 1 },
      });

      const { rerender } = renderHook(
        ({ msgs }) => useSSEToEntities(msgs, "s1", true),
        { initialProps: { msgs: [msg] } }
      );

      const countAfterFirst = getMapReduceStartCalls().length;
      rerender({ msgs: [msg] });
      expect(getMapReduceStartCalls().length).toBe(countAfterFirst);
    });

    it("should NOT dispatch mapReduce when metadata has no mapReduce field", () => {
      const messages = [makeMessage([], { sandboxId: "sb-1" })];
      renderHook(() => useSSEToEntities(messages, "s1", true));
      expect(getMapReduceStartCalls().length).toBe(0);
      expect(getMapReduceProgressCalls().length).toBe(0);
    });

    it("should handle full mapReduce lifecycle across messages", () => {
      const msg1 = makeMessage([], {
        mapReduce: { action: "start", taskId: "mr-lc", name: "Full cycle", totalItems: 3 },
      });
      const msg2 = makeMessage([], {
        mapReduce: { action: "progress", taskId: "mr-lc", processedItems: 2, progress: 66 },
      });
      const msg3 = makeMessage([], {
        mapReduce: { action: "complete", taskId: "mr-lc" },
      });

      renderHook(() => useSSEToEntities([msg1, msg2, msg3], "s1", true));

      expect(getMapReduceStartCalls().length).toBe(1);
      expect(getMapReduceProgressCalls().length).toBe(1);
      expect(getMapReduceCompleteCalls().length).toBe(1);
    });
  });

  // ── SESSION SWITCH RESETS ALL SLICES ──

  describe("session switch resets all slices", () => {
    it("should dispatch resetWebDev, resetSlideEditor, resetMapReduce on session switch", () => {
      const part = makeToolPart({ toolCallId: "tc-1", state: "output-available" });
      const messages = [makeMessage([part])];

      const { rerender } = renderHook(
        ({ msgs, sid }) => useSSEToEntities(msgs, sid, true),
        { initialProps: { msgs: messages, sid: "session-1" } }
      );

      rerender({ msgs: messages, sid: "session-2" });

      expect(getResetWebDevCalls().length).toBe(1);
      expect(getResetSlideEditorCalls().length).toBe(1);
      expect(getResetMapReduceCalls().length).toBe(1);
    });
  });
});
