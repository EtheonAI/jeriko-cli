import { createSelector } from "@reduxjs/toolkit";
import type { RootState } from "../index";
import type { ToolEventEntity } from "../slices/websocket.slice";

// Re-export the canonical TOOL_VIEW_MAP + CanvasViewType from packages/ai.
// This is the SINGLE SOURCE OF TRUTH — no duplicate definitions.
export { TOOL_VIEW_MAP, type CanvasViewType } from "@repo/ai/components/canvas/use-canvas";
import { TOOL_VIEW_MAP } from "@repo/ai/components/canvas/use-canvas";
import type { CanvasViewType } from "@repo/ai/components/canvas/use-canvas";

/**
 * Canvas Selectors — Manus-parity
 *
 * Manus reads canvas state from `websocket.entities` via selectors that scan
 * the normalized event store for the latest `toolUsed` event matching a
 * specific tool category (browser_*, shell_*, file_*, etc.).
 *
 * In Rubic, tool events are normalized into `websocket.toolEvents` by the
 * `useSSEToEntities` hook. These selectors derive canvas state from that
 * normalized store — no useMemo scanning of messages[].
 */

export const SEARCH_TOOLS = new Set(["info_search_web", "web_search", "search_web"]);
const BROWSER_TOOLS_PREFIX = "browser_";
const SHELL_TOOLS = new Set(["shell_exec", "shell_view", "shell_wait", "shell_write_to_process", "shell_kill_process", "code_execute"]);
const FILE_TOOLS = new Set(["file_read", "file_write", "file_str_replace", "file_find_in_content", "file_find_by_name", "text_editor"]);

// ============================================================================
// Base selectors
// ============================================================================

const selectToolEvents = (state: RootState) => state.websocket.toolEvents;
const selectToolEventIds = (state: RootState) => state.websocket.toolEventIds;
const selectToolEventsBySession = (state: RootState) => state.websocket.toolEventsBySession;

// ============================================================================
// Session-scoped selectors (parameterized)
// ============================================================================

/** Get all tool event IDs for a session, in order */
export const selectSessionToolEventIds = (state: RootState, sessionId: string): string[] =>
  state.websocket.toolEventsBySession[sessionId] ?? [];

/** Get all tool event entities for a session, in order */
export const selectSessionToolEvents = createSelector(
  [selectToolEvents, selectToolEventsBySession, (_: RootState, sessionId: string) => sessionId],
  (events, bySession, sessionId): ToolEventEntity[] => {
    const ids = bySession[sessionId] ?? [];
    return ids.map((id) => events[id]).filter(Boolean) as ToolEventEntity[];
  }
);

/** Get the latest tool event for a session that maps to a canvas view */
export const selectLatestCanvasToolEvent = createSelector(
  [selectToolEvents, selectToolEventsBySession, selectToolEventIds, (_: RootState, sessionId: string) => sessionId],
  (events, bySession, allIds, sessionId): ToolEventEntity | null => {
    const sessionIds = bySession[sessionId] ?? [];
    // Walk backwards to find the latest tool with a canvas mapping
    for (let i = sessionIds.length - 1; i >= 0; i--) {
      const event = events[sessionIds[i]!];
      if (event && TOOL_VIEW_MAP[event.toolName]) {
        return event;
      }
    }
    return null;
  }
);

/** Count canvas-mapped tool events for a session */
export const selectCanvasToolCount = createSelector(
  [selectToolEvents, selectToolEventsBySession, (_: RootState, sessionId: string) => sessionId],
  (events, bySession, sessionId): number => {
    const sessionIds = bySession[sessionId] ?? [];
    let count = 0;
    for (const id of sessionIds) {
      const event = events[id];
      if (event && TOOL_VIEW_MAP[event.toolName]) count++;
    }
    return count;
  }
);

/** Get all canvas-mapped tool call IDs for a session (for timeline scrubbing) */
export const selectCanvasToolCallIds = createSelector(
  [selectToolEvents, selectToolEventsBySession, (_: RootState, sessionId: string) => sessionId],
  (events, bySession, sessionId): string[] => {
    const sessionIds = bySession[sessionId] ?? [];
    return sessionIds.filter((id) => {
      const event = events[id];
      return event && TOOL_VIEW_MAP[event.toolName];
    });
  }
);

/** Get a specific tool event by ID */
export const selectToolEventById = (state: RootState, toolCallId: string): ToolEventEntity | null =>
  state.websocket.toolEvents[toolCallId] ?? null;

// ============================================================================
// Category-specific selectors (Manus: selectLatestBrowserEvent, etc.)
// ============================================================================

/** Latest browser tool event for a session (Manus: selectLatestBrowserEvent) */
export const selectLatestBrowserEvent = createSelector(
  [selectToolEvents, selectToolEventsBySession, (_: RootState, sessionId: string) => sessionId],
  (events, bySession, sessionId): ToolEventEntity | null => {
    const sessionIds = bySession[sessionId] ?? [];
    for (let i = sessionIds.length - 1; i >= 0; i--) {
      const event = events[sessionIds[i]!];
      if (event && (event.toolName.startsWith(BROWSER_TOOLS_PREFIX) || SEARCH_TOOLS.has(event.toolName) ||
        event.toolName === "deploy_expose_port" || event.toolName === "deploy_apply_deployment" ||
        event.toolName === "make_manus_page" || event.toolName === "slide_present")) {
        return event;
      }
    }
    return null;
  }
);

/** Latest terminal tool event for a session */
export const selectLatestTerminalEvent = createSelector(
  [selectToolEvents, selectToolEventsBySession, (_: RootState, sessionId: string) => sessionId],
  (events, bySession, sessionId): ToolEventEntity | null => {
    const sessionIds = bySession[sessionId] ?? [];
    for (let i = sessionIds.length - 1; i >= 0; i--) {
      const event = events[sessionIds[i]!];
      if (event && SHELL_TOOLS.has(event.toolName)) {
        return event;
      }
    }
    return null;
  }
);

/** Latest file/editor tool event for a session */
export const selectLatestFileEvent = createSelector(
  [selectToolEvents, selectToolEventsBySession, (_: RootState, sessionId: string) => sessionId],
  (events, bySession, sessionId): ToolEventEntity | null => {
    const sessionIds = bySession[sessionId] ?? [];
    for (let i = sessionIds.length - 1; i >= 0; i--) {
      const event = events[sessionIds[i]!];
      if (event && FILE_TOOLS.has(event.toolName)) {
        return event;
      }
    }
    return null;
  }
);

/** All completed browser events for a session (for browser history) */
export const selectBrowserHistory = createSelector(
  [selectToolEvents, selectToolEventsBySession, (_: RootState, sessionId: string) => sessionId],
  (events, bySession, sessionId): Array<{ url: string; screenshot?: string; title?: string }> => {
    const sessionIds = bySession[sessionId] ?? [];
    const history: Array<{ url: string; screenshot?: string; title?: string }> = [];
    const seen = new Set<string>();

    for (const id of sessionIds) {
      const event = events[id];
      if (!event) continue;
      if (event.toolName !== "browser_navigate" && event.toolName !== "browser_restart") continue;
      if (event.state !== "complete" || !event.url) continue;
      if (seen.has(event.url)) continue;
      seen.add(event.url);
      history.push({ url: event.url, screenshot: event.screenshot, title: event.title });
    }

    return history;
  }
);

/** Latest browser-view event with a screenshot — used as fallback when the latest tool is
 * still executing (no output yet). Walks backwards to find the most recent screenshot. */
export const selectLatestBrowserScreenshot = createSelector(
  [selectToolEvents, selectToolEventsBySession, (_: RootState, sessionId: string) => sessionId],
  (events, bySession, sessionId): {
    screenshot?: string;
    url?: string;
    title?: string;
    content?: string;
  } => {
    const sessionIds = bySession[sessionId] ?? [];
    for (let i = sessionIds.length - 1; i >= 0; i--) {
      const event = events[sessionIds[i]!];
      if (!event) continue;
      const viewType = TOOL_VIEW_MAP[event.toolName];
      if (viewType !== "browser") continue;
      // Only completed events with screenshots
      if (event.state === "complete" && event.screenshot) {
        return {
          screenshot: event.screenshot,
          url: event.url,
          title: event.title,
          content: event.content,
        };
      }
    }
    return {};
  }
);

/** Live terminal chunks from WebSocket — used for real-time output during execution */
const selectLiveTerminalChunks = (state: RootState) => state.websocket.liveTerminalChunks;

/** All terminal events for a session, grouped by shell session ID (Manus PTY parity) */
export const selectTerminalSessions = createSelector(
  [selectToolEvents, selectToolEventsBySession, selectLiveTerminalChunks, (_: RootState, sessionId: string) => sessionId],
  (events, bySession, liveChunks, sessionId): {
    sessions: Record<string, string[]>;
    sessionOrder: string[];
    activeSession: string;
  } => {
    const sessionIds = bySession[sessionId] ?? [];
    const sessions: Record<string, string[]> = {};
    const sessionOrder: string[] = [];
    let activeSession = "default";
    // Track in-progress shell sessions to merge live chunks
    const inProgressShellSessions = new Set<string>();

    for (const id of sessionIds) {
      const event = events[id];
      if (!event || !SHELL_TOOLS.has(event.toolName)) continue;

      const shellSessionId = (event.input?.id as string) || (event.input?.session as string) || "default";

      if (!sessions[shellSessionId]) {
        sessions[shellSessionId] = [];
        sessionOrder.push(shellSessionId);
      }

      // Process in-progress shell_exec — show command immediately with live chunks
      if (event.toolName === "shell_exec" && (event.state === "running" || event.state === "pending")) {
        const cmd = (event.input?.command as string) ?? "";
        const lines = sessions[shellSessionId]!;
        const lastCmd = lines.findLast((l) => l.startsWith("$"));
        if (lastCmd !== `$ ${cmd}` && cmd) {
          lines.push(`$ ${cmd}`);
          inProgressShellSessions.add(shellSessionId);
        }
        activeSession = shellSessionId;
        continue;
      }

      // Skip non-complete events without output (except handled above)
      if (event.state !== "complete" || !event.output) continue;

      const output = event.output;
      const rawOutput =
        typeof output === "string"
          ? output
          : ((output.output ?? output.stdout ?? JSON.stringify(output, null, 2)) as string);
      const outputStr = typeof rawOutput === "string" ? rawOutput : String(rawOutput);

      if (event.toolName === "shell_exec") {
        const cmd = (event.input?.command as string) ?? "";
        const status = typeof output === "object" ? (output.status as string) : undefined;
        const lines = sessions[shellSessionId]!;
        const lastCmd = lines.findLast((l) => l.startsWith("$"));
        if (lastCmd !== `$ ${cmd}`) {
          if (status === "running") {
            // Command still running — show command + partial output + indicator
            lines.push(`$ ${cmd}`);
            if (outputStr && outputStr !== "(command still running — use shell_view to check output)") {
              lines.push(...outputStr.split("\n"));
            }
            lines.push("  \u23F3 Running...");
          } else {
            lines.push(`$ ${cmd}`, ...outputStr.split("\n"));
          }
        } else if (lastCmd === `$ ${cmd}`) {
          // Command already shown from input-available — replace running indicator with output
          const lastCmdIndex = lines.findLastIndex((l) => l.startsWith("$"));
          if (lastCmdIndex >= 0) {
            sessions[shellSessionId] = [...lines.slice(0, lastCmdIndex + 1), ...outputStr.split("\n")];
          }
        }
      } else if (event.toolName === "shell_view" || event.toolName === "shell_wait") {
        // shell_view returns the FULL terminal buffer — replace output below the last command
        // Manus parity: each shell_view is a new tool event → progressive terminal updates
        const lines = sessions[shellSessionId]!;
        const lastCmdIndex = lines.findLastIndex((l) => l.startsWith("$"));
        if (lastCmdIndex >= 0) {
          // Keep everything up to and including the command prompt, replace output below
          const keptLines = lines.slice(0, lastCmdIndex + 1);
          sessions[shellSessionId] = [...keptLines, ...outputStr.split("\n")];
        } else {
          // No command prompt yet — just show the full buffer
          sessions[shellSessionId] = outputStr.split("\n");
        }
      } else {
        // Other shell tools (shell_write_to_process, shell_kill_process, code_execute)
        const cmd = (event.input?.command as string) ?? "";
        const lines = sessions[shellSessionId]!;
        if (cmd) lines.push(`$ ${cmd}`);
        lines.push(...outputStr.split("\n"));
      }

      // Remove from in-progress when output arrives
      inProgressShellSessions.delete(shellSessionId);
      activeSession = shellSessionId;
    }

    // Merge live terminal chunks for in-progress sessions
    for (const shellSessionId of inProgressShellSessions) {
      const chunkKey = `${sessionId}:${shellSessionId}`;
      const liveOutput = liveChunks[chunkKey];
      const lines = sessions[shellSessionId];
      if (liveOutput && lines) {
        // Replace "Running..." placeholder with live output
        lines.push(...liveOutput.split("\n"));
      } else if (lines) {
        // No live output yet — show running indicator
        lines.push("  \u23F3 Running...");
      }
    }

    return { sessions, sessionOrder, activeSession };
  }
);

/** All file contents accumulated from file tools (for editor view) */
export const selectAllFileContents = createSelector(
  [selectToolEvents, selectToolEventsBySession, (_: RootState, sessionId: string) => sessionId],
  (events, bySession, sessionId): Record<string, string> => {
    const sessionIds = bySession[sessionId] ?? [];
    const contents: Record<string, string> = {};

    for (const id of sessionIds) {
      const event = events[id];
      if (!event) continue;

      if (event.toolName === "file_write") {
        const path = ((event.input?.path ?? event.input?.file) as string) ?? "";
        const content = (event.input?.content as string) ?? "";
        if (path) contents[path] = content;
      }
      if (event.toolName === "file_read" && event.state === "complete" && event.output) {
        const path = ((event.input?.path ?? event.input?.file) as string) ?? "";
        const output = event.output;
        const result = output.result as Record<string, unknown> | undefined;
        const content =
          typeof output === "string"
            ? output
            : ((output.content as string) ??
              (result?.content as string) ??
              JSON.stringify(output));
        if (path) contents[path] = typeof content === "string" ? content : String(content);
      }
      if (event.toolName === "file_str_replace") {
        // Only apply patches once the operation is complete — during input-streaming
        // the old_str/new_str may be partial and would corrupt the cached content.
        if (event.state !== "complete" && event.state !== "running") continue;
        const path = ((event.input?.path ?? event.input?.file) as string) ?? "";
        const oldStr = (event.input?.old_str as string) ?? "";
        const newStr = (event.input?.new_str as string) ?? "";
        if (path && contents[path] && oldStr) {
          contents[path] = contents[path]!.replace(oldStr, newStr);
        }
      }
      if (event.toolName === "text_editor") {
        const path = (event.input?.path as string) ?? "";
        const command = (event.input?.command as string) ?? "";
        if (path) {
          if (command === "create" && event.input?.file_text) {
            contents[path] = event.input.file_text as string;
          } else if (command === "str_replace" && event.input?.old_str && contents[path]) {
            contents[path] = contents[path]!.replace(
              event.input.old_str as string,
              (event.input?.new_str as string) ?? ""
            );
          } else if (command === "view" && event.state === "complete" && event.output) {
            const content = (event.output.content as string) ?? "";
            if (content) contents[path] = content;
          }
        }
      }
    }

    return contents;
  }
);

/** Get available view types for a session (accumulated from all tools seen).
 * Returns a sorted array (not Set) so createSelector can memoize correctly —
 * Sets always create new references which defeats useSelector equality checks. */
export const selectAvailableViews = createSelector(
  [selectToolEvents, selectToolEventsBySession, (_: RootState, sessionId: string) => sessionId],
  (events, bySession, sessionId): CanvasViewType[] => {
    const sessionIds = bySession[sessionId] ?? [];
    const seen = new Set<CanvasViewType>();
    for (const id of sessionIds) {
      const event = events[id];
      if (!event) continue;
      const viewType = TOOL_VIEW_MAP[event.toolName];
      if (viewType) seen.add(viewType);
    }
    // Sort for stable output — same views in same order = same reference via memoization
    return Array.from(seen).sort();
  }
);

/** Get search results from the latest search tool event */
export const selectLatestSearchResults = createSelector(
  [selectToolEvents, selectToolEventsBySession, (_: RootState, sessionId: string) => sessionId],
  (events, bySession, sessionId): Array<{ title: string; url: string; snippet: string }> | undefined => {
    const sessionIds = bySession[sessionId] ?? [];
    for (let i = sessionIds.length - 1; i >= 0; i--) {
      const event = events[sessionIds[i]!];
      if (!event || !SEARCH_TOOLS.has(event.toolName)) continue;
      if (event.state !== "complete" || !event.output) continue;
      return extractSearchResults(event.output);
    }
    return undefined;
  }
);

/** Get the latest webdev preview URL */
export const selectWebdevPreviewUrl = createSelector(
  [selectToolEvents, selectToolEventsBySession, (_: RootState, sessionId: string) => sessionId],
  (events, bySession, sessionId): string | undefined => {
    const sessionIds = bySession[sessionId] ?? [];
    for (let i = sessionIds.length - 1; i >= 0; i--) {
      const event = events[sessionIds[i]!];
      if (!event || event.state !== "complete" || !event.output) continue;
      const viewType = TOOL_VIEW_MAP[event.toolName];
      if (viewType === "webDevIDE") {
        const output = event.output;
        const url = (output.previewUrl as string) ?? (output.preview_url as string) ?? (output.url as string) ?? null;
        if (url && typeof url === "string") return url;
      }
      if (event.toolName === "deploy_expose_port") {
        const output = event.output;
        const url = (output.url as string) ?? (output.proxyUrl as string) ?? (output.proxy_url as string) ?? null;
        if (url && typeof url === "string") return url;
      }
    }
    return undefined;
  }
);

/** Session metadata (sandboxId, nekoUrl, streamUrl) — from message metadata stored in session */
export const selectSessionMetadata = createSelector(
  [(state: RootState) => state.sessions?.sessions ?? [], (_: RootState, sessionId: string) => sessionId],
  (sessions, sessionId): { sandboxId?: string; nekoUrl?: string; streamUrl?: string } => {
    const session = sessions.find((s) => s.id === sessionId);
    const meta = session?.metadata as Record<string, unknown> | undefined;
    return {
      sandboxId: meta?.sandboxId as string | undefined,
      nekoUrl: meta?.nekoUrl as string | undefined,
      streamUrl: (meta?.streamUrl as string | undefined) ?? (meta?.vncUrl as string | undefined),
    };
  }
);

// ============================================================================
// Domain Slice Selectors — Manus Parity
//
// These selectors read from dedicated domain slices (NOT websocket.toolEvents).
// In Manus, domain slices are the authoritative source for rich view state:
// - slideEditor → slides, presentation mode, current slide
// - mapReduce → parallel task progress, subtask completion
// - webDev → project metadata, active tab, database state
// - aiCanvas → generated images, OCR cache
//
// The websocket.toolEvents selectors above handle the "raw event log" side
// (latest tool, browser history, terminal sessions, file contents).
// These domain selectors handle "aggregated feature state".
// ============================================================================

/** Slides from slideEditor slice (populated by useSSEToEntities when slide_present tool fires) */
export const selectSlideEditorSlides = (state: RootState) => state.slideEditor.slides;
export const selectSlideEditorCurrentIndex = (state: RootState) => state.slideEditor.currentSlideIndex;
export const selectSlideEditorIsPresentationMode = (state: RootState) => state.slideEditor.isPresentationMode;

/** MapReduce from mapReduce slice (populated by useSSEToEntities from message metadata) */
export const selectMapReduceCurrentTask = (state: RootState) => state.mapReduce.currentTask;
export const selectMapReduceOverallProgress = (state: RootState) => state.mapReduce.overallProgress;
export const selectMapReduceCurrentPhase = (state: RootState) => state.mapReduce.currentPhase;
export const selectMapReduceResults = (state: RootState) => state.mapReduce.results;

/** WebDev from webDev slice (populated by useSSEToEntities when webdev_* tools fire) */
export const selectWebDevProject = (state: RootState) => state.webDev.project;
export const selectWebDevActiveTab = (state: RootState) => state.webDev.activeTab;
export const selectWebDevProjectInited = (state: RootState) => state.webDev.projectInited;

/** AI Canvas generated image — from the latest generate_image OR image_rmbg tool output in websocket.toolEvents */
export const selectLatestGeneratedImage = createSelector(
  [selectToolEvents, selectToolEventsBySession, (_: RootState, sessionId: string) => sessionId],
  (events, bySession, sessionId): string | undefined => {
    const sessionIds = bySession[sessionId] ?? [];
    for (let i = sessionIds.length - 1; i >= 0; i--) {
      const event = events[sessionIds[i]!];
      if (!event || (event.toolName !== "generate_image" && event.toolName !== "image_rmbg")) continue;
      if (event.state !== "complete" || !event.output) continue;
      // Extract image URL/data from output
      const output = event.output;
      const image = (output.url as string) ?? (output.image_url as string) ?? (output.image as string) ?? (output.data as string);
      if (typeof image === "string" && image.length > 0) return image;
    }
    return undefined;
  }
);

// ============================================================================
// Helper: Extract search results from tool output
// ============================================================================

export function extractSearchResults(
  output: Record<string, unknown> | string | unknown[] | undefined
): Array<{ title: string; url: string; snippet: string }> | undefined {
  if (!output) return undefined;

  let parsed: Record<string, unknown> | unknown[];
  if (typeof output === "string") {
    try {
      parsed = JSON.parse(output);
    } catch {
      return undefined;
    }
  } else {
    parsed = output as Record<string, unknown> | unknown[];
  }

  let results: unknown[] | undefined;
  if (Array.isArray(parsed)) {
    results = parsed;
  } else {
    const obj = parsed as Record<string, unknown>;
    results = Array.isArray(obj.results)
      ? obj.results
      : Array.isArray(obj.result)
        ? obj.result
        : Array.isArray(obj.data)
          ? obj.data
          : Array.isArray((obj.data as Record<string, unknown> | undefined)?.results)
            ? (obj.data as Record<string, unknown>).results as unknown[]
            : undefined;
  }

  if (!Array.isArray(results) || results.length === 0) return undefined;
  return results
    .filter(
      (r: unknown): r is Record<string, unknown> =>
        typeof r === "object" &&
        r !== null &&
        (typeof (r as Record<string, unknown>).title === "string" ||
          typeof (r as Record<string, unknown>).url === "string" ||
          typeof (r as Record<string, unknown>).link === "string")
    )
    .map((r) => ({
      title: String(r.title || r.name || ""),
      url: String(r.url || r.link || r.href || ""),
      snippet: String(r.snippet || r.description || r.abstract || ""),
    }));
}

// ============================================================================
// CodeViewer Slice Selectors — Manus Parity
//
// Manus reads file content, tabs, and directory tree from the dedicated
// codeViewer domain slice (NOT re-derived from websocket.toolEvents).
// The codeViewer slice is the authoritative source for file viewer state.
// ============================================================================

/** File contents from codeViewer domain slice (Manus: authoritative file data source) */
export const selectCodeViewerFileDataSource = (state: RootState) => state.codeViewer.fileDataSource;

/** Open file tabs from codeViewer domain slice */
export const selectCodeViewerFileTabs = (state: RootState) => state.codeViewer.fileTabList;

/** Active tab ID from codeViewer domain slice */
export const selectCodeViewerActiveTabId = (state: RootState) => state.codeViewer.activeTabId;

/** Directory tree from codeViewer domain slice */
export const selectCodeViewerDirectoryList = (state: RootState) => state.codeViewer.directoryList;

// ============================================================================
// AgentWorkspace Selectors — Manus Parity
//
// Manus uses agentWorkspace.sidebarType to determine which canvas view
// renders. We use it as a fallback when no tool has been called yet.
// ============================================================================

/** Current sidebar type from agentWorkspace slice */
export const selectAgentWorkspaceSidebarType = (state: RootState) => state.agentWorkspace.sidebarType;

/** Mapping from sidebar type → canvas view type */
export const SIDEBAR_TO_VIEW: Partial<Record<string, CanvasViewType>> = {
  browser: "browser",
  computer: "terminal",
  files: "editor",
  webdev: "webDevIDE",
};

// ============================================================================
// Timeline Selectors — Manus Parity
//
// Manus uses timeline.segmentEventsMap for the scrubber — each event has
// a type, title, and timestamp. We expose these for richer scrubber tooltips.
// ============================================================================

/** Timeline events for the current session (Manus: segment-based event history) */
export const selectTimelineEvents = (state: RootState, sessionId: string) =>
  state.timeline.segmentEventsMap[sessionId] ?? [];

/** Timeline event count for a session */
export const selectTimelineEventCount = (state: RootState, sessionId: string) =>
  (state.timeline.segmentEventsMap[sessionId] ?? []).length;

// ============================================================================
// ToolCalls Selectors — Manus Parity
//
// Manus tracks active tool calls for UI status indicators (spinner badges,
// step counters). We expose active and session-scoped tool call data.
// ============================================================================

/** Active tool call correlation IDs (currently running) */
export const selectActiveToolCallIds = (state: RootState) => state.toolCalls.activeCorrelationIds;

/** Tool calls for a specific session */
export const selectSessionToolCalls = createSelector(
  [(state: RootState) => state.toolCalls.byCorrelationId,
   (state: RootState) => state.toolCalls.bySessionId,
   (_: RootState, sessionId: string) => sessionId],
  (byCorrelation, bySession, sessionId) => {
    const ids = bySession[sessionId] ?? [];
    return ids.map((id) => byCorrelation[id]).filter(Boolean);
  }
);

/** Tool call stats (total, success, error counts) */
export const selectToolCallStats = (state: RootState) => state.toolCalls.stats;

// ============================================================================
// AI Canvas Selectors — Manus Whiteboard Parity
//
// These selectors read from the dedicated aiCanvas + aiCanvasEditor slices.
// The AI Canvas is a freeform whiteboard for image annotation, triggered by
// the `generate_image` tool — separate from the tool-streaming canvas.
// ============================================================================

/** All shapes in the AI canvas (Record<id, shape>) */
export const selectAICanvasShapes = (state: RootState) => state.aiCanvas.shapes;

/** Camera position (pan x/y + zoom z) */
export const selectAICanvasCamera = (state: RootState) => state.aiCanvas.camera;

/** Active drawing/interaction tool */
export const selectAICanvasEditorActiveTool = (state: RootState) => state.aiCanvas.interaction.activeTool;

/** Currently selected shape IDs */
export const selectAICanvasEditorSelectedIds = (state: RootState) => state.aiCanvas.selectedShapeIds;

/** Whether user is currently drawing */
export const selectAICanvasEditorIsDrawing = (state: RootState) =>
  state.aiCanvas.interaction.activeTool === "draw" && state.aiCanvas.brushing.isBrushing;

/** Canvas ID */
export const selectAICanvasId = (state: RootState) => state.aiCanvas.canvasId;

/** OCR cache from aiCanvas slice */
export const selectAICanvasOcrCache = (state: RootState) => state.aiCanvas.ocrCache;
