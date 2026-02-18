import { createSelector } from "@reduxjs/toolkit";
import type { RootState } from "../index";
import type { ToolEventEntity } from "../slices/websocket.slice";

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

// ============================================================================
// TOOL_VIEW_MAP — which tools map to which canvas view
// Re-exported here so selectors and hooks share one source of truth.
// (Canonical definition is in packages/ai/components/canvas/use-canvas.ts)
// ============================================================================

export type CanvasViewType =
  | "browser"
  | "editor"
  | "code"
  | "terminal"
  | "filePreview"
  | "slides"
  | "aiCanvas"
  | "webDevIDE"
  | "mapReduce"
  | "empty";

export const TOOL_VIEW_MAP: Record<string, CanvasViewType> = {
  browser_navigate: "browser",
  browser_view: "browser",
  browser_click: "browser",
  browser_input: "browser",
  browser_scroll: "browser",
  browser_scroll_up: "browser",
  browser_scroll_down: "browser",
  browser_move_mouse: "browser",
  browser_key_press: "browser",
  browser_press_key: "browser",
  browser_select_option: "browser",
  browser_console_exec: "browser",
  browser_console_view: "browser",
  browser_screenshot: "browser",
  browser_restart: "browser",
  shell_exec: "terminal",
  shell_view: "terminal",
  shell_wait: "terminal",
  shell_write_to_process: "terminal",
  shell_kill_process: "terminal",
  file_read: "editor",
  file_write: "editor",
  file_str_replace: "editor",
  file_find_in_content: "editor",
  file_find_by_name: "editor",
  code_execute: "terminal",
  info_search_web: "browser",
  web_search: "browser",
  search_web: "browser",
  deploy_expose_port: "browser",
  deploy_apply_deployment: "browser",
  make_manus_page: "browser",
  text_editor: "editor",
  slide_present: "browser",
  webdev_init_project: "webDevIDE",
  webdev_save_checkpoint: "webDevIDE",
  webdev_check_status: "webDevIDE",
  webdev_restart_server: "webDevIDE",
  webdev_rollback_checkpoint: "webDevIDE",
  webdev_execute_sql: "webDevIDE",
  webdev_push_schema: "webDevIDE",
  webdev_list_versions: "webDevIDE",
  webdev_add_feature: "webDevIDE",
};

const SEARCH_TOOLS = new Set(["info_search_web", "web_search", "search_web"]);
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

/** All terminal events for a session, grouped by shell session ID (Manus PTY parity) */
export const selectTerminalSessions = createSelector(
  [selectToolEvents, selectToolEventsBySession, (_: RootState, sessionId: string) => sessionId],
  (events, bySession, sessionId): {
    sessions: Record<string, string[]>;
    sessionOrder: string[];
    activeSession: string;
  } => {
    const sessionIds = bySession[sessionId] ?? [];
    const sessions: Record<string, string[]> = {};
    const sessionOrder: string[] = [];
    let activeSession = "default";

    for (const id of sessionIds) {
      const event = events[id];
      if (!event || !SHELL_TOOLS.has(event.toolName)) continue;
      if (event.state !== "complete" || !event.output) continue;

      const shellSessionId = (event.input?.id as string) || "default";
      const cmd = (event.input?.command as string) ?? "";
      const output = event.output;
      const rawOutput =
        typeof output === "string"
          ? output
          : ((output.stdout ?? output.output ?? JSON.stringify(output, null, 2)) as string);
      const outputStr = typeof rawOutput === "string" ? rawOutput : String(rawOutput);

      if (!sessions[shellSessionId]) {
        sessions[shellSessionId] = [];
        sessionOrder.push(shellSessionId);
      }

      // Deduplicate: skip if last command is the same
      const lines = sessions[shellSessionId]!;
      const lastCmd = lines.findLast((l) => l.startsWith("$"));
      if (lastCmd !== `$ ${cmd}`) {
        lines.push(`$ ${cmd}`, ...outputStr.split("\n"));
      }

      activeSession = shellSessionId;
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
      if (event.toolName === "file_str_replace" && event.state === "complete") {
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

/** Get set of available view types for a session (accumulated from all tools seen) */
export const selectAvailableViews = createSelector(
  [selectToolEvents, selectToolEventsBySession, (_: RootState, sessionId: string) => sessionId],
  (events, bySession, sessionId): Set<CanvasViewType> => {
    const sessionIds = bySession[sessionId] ?? [];
    const views = new Set<CanvasViewType>();
    for (const id of sessionIds) {
      const event = events[id];
      if (!event) continue;
      const viewType = TOOL_VIEW_MAP[event.toolName];
      if (viewType) views.add(viewType);
    }
    return views;
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
  [(state: RootState) => state.sessions.sessions, (_: RootState, sessionId: string) => sessionId],
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
// Helper: Extract search results from tool output
// ============================================================================

function extractSearchResults(
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
