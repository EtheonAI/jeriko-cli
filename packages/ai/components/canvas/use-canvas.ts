"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import type { UIMessage, StaticToolUIPart, DynamicToolUIPart } from "../../lib/types/ui-message";
import { isToolUIPart, getToolName } from "../../lib/types/ui-message";
import type { FileNode, FileTab } from "./views/code-view";

// ============================================================================
// Types
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

export type ToolActionType =
  | "browsing"
  | "clicking"
  | "typing"
  | "scrolling"
  | "viewing"
  | "editing"
  | "reading"
  | "creating"
  | "searching";

export interface ToolAction {
  type: ToolActionType;
  label: string;
}

export interface CanvasState {
  /** Whether the canvas should be shown */
  isVisible: boolean;
  /** Which view to display */
  viewType: CanvasViewType;
  /** Whether the agent is actively working */
  isWorking: boolean;
  /** Status text for the bottom bar */
  statusText?: string;
  /** Current tool action badge */
  currentAction?: ToolAction;
  /** Active sandbox ID (from agent stream) */
  sandboxId?: string;
  /** Neko WebRTC URL for live desktop streaming (from Desktop template sandbox) */
  nekoUrl?: string;
  /** E2B stream URL (noVNC fallback for desktop streaming) */
  streamUrl?: string;
  /** Tool call ID currently pinned in canvas (historical state recall) */
  pinnedToolCallId?: string;
  /** Pin a historical tool call to display in the canvas */
  onPinToolCall?: (toolCallId: string) => void;
  /** Unpin and return to live (latest) tool state */
  onUnpin?: () => void;

  // View switching
  availableViews: Set<CanvasViewType>;
  onSelectView?: (view: CanvasViewType) => void;

  // Browser view
  browserUrl?: string;
  browserScreenshot?: string;
  browserLoading?: boolean;
  browserContent?: string;
  browserTitle?: string;
  browserSearchResults?: Array<{ title: string; url: string; snippet: string }>;
  canGoBack?: boolean;
  canGoForward?: boolean;
  onBrowserNavigate?: (url: string) => void;
  onBrowserBack?: () => void;
  onBrowserForward?: () => void;
  onBrowserRefresh?: () => void;
  onBrowserScreenshotUpdate?: (screenshot: string, url?: string, title?: string) => void;

  // Code view
  fileTree?: FileNode[];
  fileTabs?: FileTab[];
  activeFileContent?: string;
  activeFileLanguage?: string;
  onSelectFile?: (path: string) => void;
  onSelectTab?: (id: string) => void;
  onCloseTab?: (id: string) => void;

  // Terminal view
  terminalOutput?: string[];
  /** Per-session terminal output (session ID → output lines) */
  terminalSessions?: Record<string, string[]>;
  /** Currently displayed terminal session ID */
  activeTerminalSession?: string;
  /** All available terminal session IDs (in order of first use) */
  terminalSessionIds?: string[];
  /** Switch the displayed terminal session */
  onSelectTerminalSession?: (sessionId: string) => void;

  // File preview view
  previewFileName?: string;
  previewContent?: string;
  previewFileType?: "image" | "pdf" | "markdown" | "text" | "html";

  // Slides view
  slides?: string[];
  currentSlideIndex?: number;

  // Preview (deployed app iframe)
  previewUrl?: string;

  // All file contents map (for preview rendering)
  allFileContents?: Record<string, string>;

  // Timeline
  timelinePercentage?: number;
  currentStep?: number;
  totalSteps?: number;
  onTimelineChange?: (percentage: number) => void;
}

// ============================================================================
// Tool Name -> View Type Mapping
// ============================================================================

export const TOOL_VIEW_MAP: Record<string, CanvasViewType> = {
  // Browser tools
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

  // Shell tools
  shell_exec: "terminal",
  shell_view: "terminal",
  shell_wait: "terminal",
  shell_write_to_process: "terminal",
  shell_kill_process: "terminal",

  // File tools — editor view (Manus FileToolView: filename header + read-only editor)
  file_read: "editor",
  file_write: "editor",
  file_str_replace: "editor",
  file_find_in_content: "editor",
  file_find_by_name: "editor",

  // Code execution
  code_execute: "terminal",

  // Search -> browser
  info_search_web: "browser",
  web_search: "browser",
  search_web: "browser",

  // Deploy -> browser
  deploy_expose_port: "browser",
  deploy_apply_deployment: "browser",

  // Manus page -> browser
  make_manus_page: "browser",

  // Text editor -> editor view (operates on files, Manus FileToolView parity)
  text_editor: "editor",

  // Slide present -> browser (generates viewable URL)
  slide_present: "browser",

  // WebDev IDE tools
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

// ============================================================================
// Tool Name -> Action Label Generator
// ============================================================================

const TOOL_ACTION_MAP: Record<string, (args: Record<string, unknown>) => ToolAction> = {
  browser_navigate: (args) => ({
    type: "browsing",
    label: `Browsing ${tryHostname(args.url as string)}`,
  }),
  browser_view: () => ({ type: "viewing", label: "Viewing the page" }),
  browser_click: () => ({ type: "clicking", label: "Clicking element" }),
  browser_input: (args) => ({
    type: "typing",
    label: `Typing ${truncate(args.text as string, 20)}`,
  }),
  browser_scroll: () => ({ type: "scrolling", label: "Scrolling" }),
  browser_scroll_up: () => ({ type: "scrolling", label: "Scrolling up" }),
  browser_scroll_down: () => ({ type: "scrolling", label: "Scrolling down" }),
  browser_move_mouse: () => ({ type: "clicking", label: "Moving mouse" }),
  browser_key_press: () => ({ type: "typing", label: "Pressing key" }),
  browser_press_key: () => ({ type: "typing", label: "Pressing key" }),
  browser_select_option: () => ({ type: "clicking", label: "Selecting option" }),
  browser_console_exec: () => ({
    type: "typing",
    label: "Executing console script",
  }),
  browser_console_view: () => ({
    type: "viewing",
    label: "Viewing console output",
  }),
  browser_screenshot: () => ({
    type: "viewing",
    label: "Taking screenshot",
  }),
  browser_restart: (args) => ({
    type: "browsing",
    label: `Restarting browser ${args.url ? `→ ${tryHostname(args.url as string)}` : ""}`,
  }),
  shell_exec: (args) => ({
    type: "typing",
    label: `Running ${truncate((args.command as string)?.split(" ")[0] ?? "", 20)}`,
  }),
  shell_view: () => ({ type: "viewing", label: "Viewing terminal" }),
  shell_wait: () => ({ type: "viewing", label: "Waiting for process" }),
  shell_write_to_process: () => ({ type: "typing", label: "Writing to process" }),
  shell_kill_process: () => ({ type: "viewing", label: "Killing process" }),
  file_read: (args) => ({
    type: "reading",
    label: `Reading ${fileName((args.path ?? args.file) as string)}`,
  }),
  file_write: (args) => ({
    type: "editing",
    label: `Writing ${fileName((args.path ?? args.file) as string)}`,
  }),
  file_str_replace: (args) => ({
    type: "editing",
    label: `Editing ${fileName((args.path ?? args.file) as string)}`,
  }),
  file_find_in_content: () => ({
    type: "searching",
    label: "Searching in files",
  }),
  file_find_by_name: () => ({
    type: "searching",
    label: "Finding files",
  }),
  code_execute: () => ({
    type: "typing",
    label: "Executing code",
  }),
  info_search_web: (args) => ({
    type: "searching",
    label: `Searching "${truncate(args.query as string, 30)}"`,
  }),
  web_search: (args) => ({
    type: "searching",
    label: `Searching "${truncate(args.query as string, 30)}"`,
  }),
  search_web: (args) => ({
    type: "searching",
    label: `Searching "${truncate(args.query as string, 30)}"`,
  }),
  deploy_expose_port: () => ({
    type: "browsing",
    label: "Exposing port",
  }),
  deploy_apply_deployment: () => ({
    type: "creating",
    label: "Deploying application",
  }),
  make_manus_page: () => ({
    type: "creating",
    label: "Creating page",
  }),
  text_editor: (args) => ({
    type: "editing",
    label: `Editing ${fileName((args.path as string) ?? "")}`,
  }),
  slide_present: () => ({
    type: "browsing",
    label: "Presenting slides",
  }),
  // WebDev IDE tools
  webdev_init_project: (args) => ({
    type: "creating" as ToolActionType,
    label: `Scaffolding ${(args.app_name as string) || "project"}`,
  }),
  webdev_save_checkpoint: (args) => ({
    type: "creating" as ToolActionType,
    label: `Saving: ${truncate((args.message as string) || "checkpoint", 25)}`,
  }),
  webdev_check_status: () => ({ type: "viewing" as ToolActionType, label: "Checking project status" }),
  webdev_restart_server: () => ({ type: "creating" as ToolActionType, label: "Restarting dev server" }),
  webdev_rollback_checkpoint: () => ({ type: "viewing" as ToolActionType, label: "Rolling back version" }),
  webdev_execute_sql: () => ({ type: "searching" as ToolActionType, label: "Executing SQL query" }),
  webdev_push_schema: () => ({ type: "creating" as ToolActionType, label: "Pushing database schema" }),
  webdev_list_versions: () => ({ type: "viewing" as ToolActionType, label: "Listing versions" }),
  webdev_add_feature: (args) => ({ type: "creating" as ToolActionType, label: `Adding ${(args.feature as string) || "feature"}` }),
};

// ============================================================================
// Screenshot helpers
// ============================================================================

/** Known base64 magic prefixes for common image formats */
const BASE64_IMAGE_PREFIXES = ["iVBOR", "/9j/", "R0lGO", "UklGR"];

/** Detect raw base64 and prepend data URI prefix if needed */
function normalizeScreenshot(raw: string): string {
  if (raw.startsWith("data:")) return raw;
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  // Check for known base64 image magic bytes
  for (const prefix of BASE64_IMAGE_PREFIXES) {
    if (raw.startsWith(prefix)) {
      // PNG starts with iVBOR, JPEG with /9j/, GIF with R0lGO, WebP with UklGR
      const mime = raw.startsWith("/9j/")
        ? "image/jpeg"
        : raw.startsWith("UklGR")
          ? "image/webp"
          : raw.startsWith("R0lGO")
            ? "image/gif"
            : "image/png";
      return `data:${mime};base64,${raw}`;
    }
  }
  // Fallback: assume WebP base64 (Manus default format)
  if (raw.length > 100 && /^[A-Za-z0-9+/=]+$/.test(raw.slice(0, 100))) {
    return `data:image/webp;base64,${raw}`;
  }
  return raw;
}

/** Extract screenshot from tool output, checking multiple keys */
function extractScreenshot(output: Record<string, unknown> | undefined): string | undefined {
  if (!output) return undefined;
  // Check common keys where E2B / agent returns screenshots
  const candidates = [
    output.screenshot,
    output.data,
    (output.result as Record<string, unknown>)?.screenshot,
    output.image,
    output.base64,
  ];
  for (const val of candidates) {
    if (typeof val === "string" && val.length > 0) {
      return normalizeScreenshot(val);
    }
  }
  return undefined;
}

/** Extract URL from tool output or args */
function extractBrowserUrl(
  output: Record<string, unknown> | undefined,
  args: Record<string, unknown>
): string | undefined {
  if (output?.url && typeof output.url === "string") return output.url;
  if (args?.url && typeof args.url === "string") return args.url;
  return undefined;
}

/** Extract text content from tool output */
function extractBrowserContent(output: Record<string, unknown> | undefined): string | undefined {
  if (!output) return undefined;
  if (typeof output.content === "string" && output.content.length > 0) return output.content;
  if (typeof output.text === "string" && output.text.length > 0) return output.text;
  return undefined;
}

/** Extract page title from tool output */
function extractBrowserTitle(output: Record<string, unknown> | undefined): string | undefined {
  if (!output) return undefined;
  if (typeof output.title === "string" && output.title.length > 0) return output.title;
  return undefined;
}

/** Extract search results from tool output (handles string/object/array formats) */
function extractSearchResults(
  output: Record<string, unknown> | string | unknown[] | undefined
): Array<{ title: string; url: string; snippet: string }> | undefined {
  if (!output) return undefined;

  // Handle stringified JSON output (double-serialization from SSE)
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

  // Handle direct array of results (e.g. searchProvider returns array directly)
  // Also check nested: { results: [...] }, { data: { results: [...] } }, { result: [...] }
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
// Hook
// ============================================================================

export function useCanvas(messages: UIMessage[], isStreaming = false): CanvasState {
  // Per-session terminal output (Manus parity: each shell session has its own PTY)
  const [terminalSessions, setTerminalSessions] = useState<Record<string, string[]>>({});
  const [terminalSessionOrder, setTerminalSessionOrder] = useState<string[]>([]);
  const [activeTerminalSession, setActiveTerminalSession] = useState<string>("default");

  // User-selected file path (overrides agent's active file)
  const [userSelectedPath, setUserSelectedPath] = useState<string | null>(null);
  // Tracks tabs the user has closed
  const [closedTabs, setClosedTabs] = useState<Set<string>>(new Set());

  // View switching — track which views have been activated + user override
  const [availableViews, setAvailableViews] = useState<Set<CanvasViewType>>(new Set());
  const [viewOverride, setViewOverride] = useState<CanvasViewType | null>(null);
  const prevAutoView = useRef<CanvasViewType | null>(null);

  // ── Metadata extracted via useMemo (NO useEffect+setState on [messages]) ──
  // CRITICAL: During streaming, `messages` gets a new ref on every SSE chunk
  // (~60/sec). useEffect([messages]) + setState caused "Maximum update depth
  // exceeded" in React 19 + Compiler. Pure useMemo avoids setState entirely.

  const messageMeta = useMemo(() => {
    let sandboxId: string | undefined;
    let nekoUrl: string | undefined;
    let streamUrl: string | undefined;
    let browserFrame: { screenshot?: string; url?: string; title?: string } | undefined;

    for (const msg of messages) {
      const meta = msg.metadata as Record<string, unknown> | undefined;
      if (!meta) continue;
      if (typeof meta.sandboxId === "string" && meta.sandboxId) sandboxId = meta.sandboxId;
      if (typeof meta.nekoUrl === "string" && meta.nekoUrl) nekoUrl = meta.nekoUrl;
      if (typeof meta.streamUrl === "string" && meta.streamUrl) {
        streamUrl = meta.streamUrl;
      } else if (typeof meta.vncUrl === "string" && meta.vncUrl) {
        streamUrl = meta.vncUrl;
      }
      const frame = meta.browserFrame as
        | { screenshot?: string; url?: string; title?: string }
        | undefined;
      if (frame?.screenshot) browserFrame = frame;
    }

    return { sandboxId, nekoUrl, streamUrl, browserFrame };
  }, [messages]);

  const sandboxId = messageMeta.sandboxId;
  const nekoUrl = messageMeta.nekoUrl;
  const streamUrl = messageMeta.streamUrl;

  // WebDev IDE preview URL — computed from messages (no effect)
  const webdevPreviewUrlFromMessages = useMemo(() => {
    for (const msg of messages) {
      if (msg.role !== "assistant" || !msg.parts) continue;
      for (const part of msg.parts) {
        if (!part || !isToolUIPart(part)) continue;
        const toolPart = part as StaticToolUIPart | DynamicToolUIPart;
        if (toolPart.state !== "output-available") continue;
        const toolName = getToolName(toolPart);
        const output = toolPart.output as Record<string, unknown> | undefined;
        if (!output) continue;
        if (TOOL_VIEW_MAP[toolName] === "webDevIDE") {
          const url = (output.previewUrl as string) ?? (output.preview_url as string) ?? (output.url as string) ?? null;
          if (url && typeof url === "string") return url;
        }
        if (toolName === "deploy_expose_port") {
          const url = (output.url as string) ?? (output.proxyUrl as string) ?? (output.proxy_url as string) ?? null;
          if (url && typeof url === "string") return url;
        }
      }
    }
    return undefined;
  }, [messages]);

  // WebDev preview URL — latestTool result overrides, messages fallback
  const [webdevPreviewUrlOverride, setWebdevPreviewUrl] = useState<string | undefined>();
  const webdevPreviewUrl = webdevPreviewUrlOverride ?? webdevPreviewUrlFromMessages;

  // Pinned tool call — when set, canvas shows historical state instead of latest
  const [pinnedToolCallId, setPinnedToolCallId] = useState<string | undefined>();

  const onPinToolCall = useCallback((toolCallId: string) => {
    setPinnedToolCallId(toolCallId);
  }, []);

  const onUnpin = useCallback(() => {
    setPinnedToolCallId(undefined);
  }, []);

  // Persistent browser state — survives across non-navigate tool calls
  const [browserUrl, setBrowserUrl] = useState<string | undefined>();
  const [browserScreenshot, setBrowserScreenshot] = useState<string | undefined>();
  const [browserContent, setBrowserContent] = useState<string | undefined>();
  const [browserTitle, setBrowserTitle] = useState<string | undefined>();
  const [browserSearchResults, setBrowserSearchResults] = useState<
    Array<{ title: string; url: string; snippet: string }> | undefined
  >();
  const [browserLoading, setBrowserLoading] = useState(false);
  interface BrowserHistoryEntry {
    url: string;
    screenshot?: string;
    title?: string;
  }
  const [browserHistory, setBrowserHistory] = useState<BrowserHistoryEntry[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Ref for historyIndex to avoid circular deps in browser effect
  const historyIndexRef = useRef(historyIndex);
  historyIndexRef.current = historyIndex;

  // Sync browser frame from metadata (only fires when screenshot changes)
  const processedScreenshotRef = useRef("");
  useEffect(() => {
    const frame = messageMeta.browserFrame;
    if (!frame?.screenshot || frame.screenshot === processedScreenshotRef.current) return;
    processedScreenshotRef.current = frame.screenshot;
    setBrowserScreenshot(normalizeScreenshot(frame.screenshot));
    if (frame.url) setBrowserUrl(frame.url);
    if (frame.title) setBrowserTitle(frame.title);
  }, [messageMeta.browserFrame?.screenshot]); // primitive dep — stable during streaming

  // Accumulate ALL file contents from ALL messages — pure useMemo (no effect)
  // CRITICAL: This used to be useMemo→useEffect→setState which caused infinite
  // re-renders during streaming. Now it's a single useMemo.
  const allFileContents = useMemo(() => {
    const contents: Record<string, string> = {};
    for (const msg of messages) {
      if (msg.role !== "assistant" || !msg.parts) continue;
      for (let j = 0; j < msg.parts.length; j++) {
        const part = msg.parts[j];
        if (!part || !isToolUIPart(part)) continue;
        const toolPart = part as StaticToolUIPart | DynamicToolUIPart;
        const toolName = getToolName(toolPart);
        const args = (toolPart.input ?? {}) as Record<string, unknown>;
        const output = toolPart.output as Record<string, unknown> | undefined;

        if (toolName === "file_write") {
          const path = ((args.path ?? args.file) as string) ?? "";
          const content = (args.content as string) ?? "";
          if (path) contents[path] = content;
        }
        if (toolName === "file_read" && toolPart.state === "output-available" && output) {
          const path = ((args.path ?? args.file) as string) ?? "";
          const result = output.result as Record<string, unknown> | undefined;
          const content =
            typeof output === "string"
              ? output
              : ((output.content as string) ??
                (result?.content as string) ??
                JSON.stringify(output));
          if (path) contents[path] = typeof content === "string" ? content : String(content);
        }
        if (toolName === "file_str_replace" && toolPart.state === "output-available" && output) {
          const path = ((args.path ?? args.file) as string) ?? "";
          const oldStr = (args.old_str as string) ?? "";
          const newStr = (args.new_str as string) ?? "";
          if (path && contents[path] && oldStr) {
            contents[path] = contents[path].replace(oldStr, newStr);
          }
        }
        if (toolName === "text_editor") {
          const path = (args.path as string) ?? "";
          const command = (args.command as string) ?? "";
          if (path) {
            if (command === "create" && args.file_text) {
              contents[path] = args.file_text as string;
            } else if (command === "str_replace" && args.old_str && contents[path]) {
              contents[path] = contents[path].replace(args.old_str as string, (args.new_str as string) ?? "");
            } else if (command === "view" && toolPart.state === "output-available" && output) {
              const content = (output.content as string) ?? "";
              if (content) contents[path] = content;
            }
          }
        }
      }
    }
    return contents;
  }, [messages]);

  // Collect ALL tool call IDs for timeline scrubbing
  const allToolCallIds = useMemo(() => {
    const ids: string[] = [];
    for (const msg of messages) {
      if (msg.role !== "assistant" || !msg.parts) continue;
      for (const part of msg.parts) {
        if (!part || !isToolUIPart(part)) continue;
        const tp = part as StaticToolUIPart | DynamicToolUIPart;
        if (tp.toolCallId && tp.state) {
          const tn = getToolName(tp);
          if (TOOL_VIEW_MAP[tn]) ids.push(tp.toolCallId);
        }
      }
    }
    return ids;
  }, [messages]);

  // Count total tool calls and find the latest one
  const { latestTool, totalToolCalls } = useMemo(() => {
    let toolCount = 0;

    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i]!;
      if (msg.role !== "assistant") continue;

      // Walk parts backwards to find latest tool
      if (!msg.parts) continue;
      for (let j = msg.parts.length - 1; j >= 0; j--) {
        const part = msg.parts[j];
        if (!part || !isToolUIPart(part)) continue;

        toolCount++;
        const toolPart = part as StaticToolUIPart | DynamicToolUIPart;
        // Safety: skip parts without required fields
        if (!toolPart.toolCallId || !toolPart.state) continue;

        const toolName = getToolName(toolPart);
        const viewType = TOOL_VIEW_MAP[toolName];

        // Skip tools that don't map to a canvas view (but still count them)
        if (!viewType) continue;

        const args = (toolPart.input ?? {}) as Record<string, unknown>;
        const output = toolPart.output as Record<string, unknown> | undefined;
        const actionFn = TOOL_ACTION_MAP[toolName];
        const currentAction = actionFn ? actionFn(args) : undefined;

        // Tool is working if it hasn't produced output yet AND the stream is still active.
        // Once streaming ends, treat stuck tools as done (agent moved on without result).
        const isActive =
          isStreaming &&
          (toolPart.state === "input-streaming" ||
            toolPart.state === "input-available" ||
            toolPart.state === "approval-responded");

        // Count all tool calls across all messages for the step counter
        let total = 0;
        for (const m of messages) {
          if (m.role !== "assistant") continue;
          for (const p of m.parts ?? []) {
            if (p && isToolUIPart(p)) total++;
          }
        }

        return {
          latestTool: {
            toolCallId: toolPart.toolCallId,
            toolName,
            args,
            output,
            viewType,
            currentAction,
            isWorking: isActive,
            state: toolPart.state,
          },
          totalToolCalls: total,
        };
      }
    }
    return { latestTool: null, totalToolCalls: 0 };
    // CRITICAL: isStreaming must be in deps — isActive depends on it.
    // Without it, when streaming stops the memo won't recompute and
    // isWorking stays true forever (loading bar loop).
  }, [messages, isStreaming]);

  // Populate availableViews as tools activate new view types
  useEffect(() => {
    if (!latestTool || !latestTool.viewType || latestTool.viewType === "empty") return;
    setAvailableViews((prev) => {
      if (prev.has(latestTool.viewType)) return prev;
      const next = new Set(prev);
      next.add(latestTool.viewType);
      return next;
    });

    // Track the auto-detected view type (but don't clear user override).
    // The user's manual view selection persists until they explicitly change it.
    prevAutoView.current = latestTool.viewType;
  }, [latestTool?.viewType]);

  // View select callback for user manual switching
  const onSelectView = useCallback((view: CanvasViewType) => {
    setViewOverride(view);
  }, []);

  // Terminal session select callback
  const onSelectTerminalSession = useCallback((sessionId: string) => {
    setActiveTerminalSession(sessionId);
  }, []);

  // Timeline scrubber → pin to a specific tool call by percentage
  const onTimelineChange = useCallback(
    (percentage: number) => {
      if (allToolCallIds.length === 0) return;
      if (percentage >= 100) {
        // Jump to live
        setPinnedToolCallId(undefined);
        return;
      }
      const index = Math.min(
        Math.floor((percentage / 100) * allToolCallIds.length),
        allToolCallIds.length - 1
      );
      const toolCallId = allToolCallIds[index];
      if (toolCallId) setPinnedToolCallId(toolCallId);
    },
    [allToolCallIds]
  );

  // Accumulate terminal output from shell_exec — per-session (Manus parity)
  // Shell tools use the `id` param for session tracking.
  // Deps: toolCallId + state (primitives) — avoids infinite loop from object ref
  useEffect(() => {
    if (!latestTool) return;
    if (latestTool.state !== "output-available" || !latestTool.output) return;

    const output = latestTool.output as Record<string, unknown>;

    if (latestTool.toolName === "shell_exec") {
      const sessionId = (latestTool.args?.id as string) || "default";
      const cmd = (latestTool.args?.command as string) ?? "";
      const rawOutput =
        typeof latestTool.output === "string"
          ? latestTool.output
          : ((output.stdout ?? output.output ?? JSON.stringify(latestTool.output, null, 2)) as string);
      const outputStr = typeof rawOutput === "string" ? rawOutput : String(rawOutput);

      setTerminalSessions((prev) => {
        const sessionLines = prev[sessionId] ?? [];
        const lastCmd = sessionLines.findLast((l) => l.startsWith("$"));
        if (lastCmd === `$ ${cmd}`) return prev;
        return {
          ...prev,
          [sessionId]: [...sessionLines, `$ ${cmd}`, ...outputStr.split("\n")],
        };
      });

      setTerminalSessionOrder((prev) => {
        if (prev.includes(sessionId)) return prev;
        return [...prev, sessionId];
      });

      setActiveTerminalSession(sessionId);
    }
  }, [latestTool?.toolCallId, latestTool?.state]);

  // Extract webdev preview URL from webdev tool results and deploy_expose_port
  useEffect(() => {
    if (!latestTool) return;
    if (latestTool.state !== "output-available") return;
    const output = latestTool.output as Record<string, unknown> | undefined;
    if (!output) return;

    // Extract from webdev tools
    if (latestTool.viewType === "webDevIDE") {
      const url =
        (output.previewUrl as string) ??
        (output.preview_url as string) ??
        (output.url as string) ??
        null;
      if (url && typeof url === "string") {
        setWebdevPreviewUrl(url);
      }
    }

    // Extract from deploy_expose_port (sets up port forwarding → returns URL)
    if (latestTool.toolName === "deploy_expose_port") {
      const url =
        (output.url as string) ??
        (output.proxyUrl as string) ??
        (output.proxy_url as string) ??
        null;
      if (url && typeof url === "string") {
        setWebdevPreviewUrl(url);
      }
    }
  }, [latestTool?.toolCallId, latestTool?.state]);

  // Auto-follow: when agent opens a new file, clear user selection override
  useEffect(() => {
    if (!latestTool) return;
    const agentFilePath = (latestTool.args?.path ?? latestTool.args?.file) as string | undefined;
    if (
      agentFilePath &&
      (latestTool.toolName === "file_read" ||
        latestTool.toolName === "file_write" ||
        latestTool.toolName === "file_str_replace" ||
        latestTool.toolName === "text_editor")
    ) {
      setUserSelectedPath(null);
    }
  }, [latestTool?.toolCallId, latestTool?.state]);

  // Persist browser URL and screenshot across all browser tool calls
  // Deps: toolCallId + state (primitives) — avoids infinite loop from object ref
  // Uses historyIndexRef to avoid circular dep (effect sets historyIndex)
  useEffect(() => {
    if (!latestTool || latestTool.viewType !== "browser") return;

    // Detect if this is a search tool (not a browser tool that produces screenshots)
    const isSearchTool =
      latestTool.toolName === "info_search_web" ||
      latestTool.toolName === "web_search" ||
      latestTool.toolName === "search_web";

    // DEBUG: trace browser effect execution during streaming
    if (process.env.NODE_ENV === "development") {
      console.log("[canvas:browser-effect]", {
        toolName: latestTool.toolName,
        state: latestTool.state,
        isSearchTool,
        hasOutput: !!latestTool.output,
        args: latestTool.args,
        outputKeys: latestTool.output ? Object.keys(latestTool.output) : null,
      });
    }

    // Extract URL — update if found
    const url = extractBrowserUrl(latestTool.output, latestTool.args);
    if (url) {
      setBrowserUrl((prev) => (prev === url ? prev : url));
      // Push to history on navigation (with screenshot + title snapshot)
      if (latestTool.toolName === "browser_navigate" || latestTool.toolName === "browser_restart") {
        const shot = latestTool.output ? extractScreenshot(latestTool.output) : undefined;
        const title = extractBrowserTitle(latestTool.output);
        setBrowserHistory((prev) => {
          const trimmed = prev.slice(0, historyIndexRef.current + 1);
          if (trimmed[trimmed.length - 1]?.url === url) return prev;
          return [...trimmed, { url, screenshot: shot, title: title ?? undefined }];
        });
        setHistoryIndex((prev) => prev + 1);
      }
    }

    // When a search tool is active but hasn't returned results yet, show loading state
    // immediately so the user sees activity during streaming (not just after)
    if (isSearchTool && !latestTool.output) {
      const query = (latestTool.args?.query as string) ?? "";
      if (query) {
        setBrowserUrl(`search://${query}`);
      }
      setBrowserLoading(true);
      // Clear stale screenshot/content so search results area is ready
      setBrowserScreenshot(undefined);
      setBrowserContent(undefined);
      return;
    }

    if (latestTool.output) {
      if (isSearchTool) {
        // Search tools: extract results, clear stale screenshot/content
        setBrowserLoading(false);
        setBrowserScreenshot(undefined);
        setBrowserContent(undefined);
        const results = extractSearchResults(latestTool.output);
        if (process.env.NODE_ENV === "development") {
          console.log("[canvas:search-results]", {
            outputType: typeof latestTool.output,
            output: latestTool.output,
            extractedCount: results?.length ?? 0,
          });
        }
        // Always set results — empty array shows "No results found" in BrowserView
        setBrowserSearchResults(results && results.length > 0 ? results : []);
        const title = extractBrowserTitle(latestTool.output);
        if (title) setBrowserTitle(title);
        // Set URL to search query for display
        const query = (latestTool.args?.query as string) ?? "";
        if (query) {
          setBrowserUrl(`search://${query}`);
        }
      } else {
        // Non-search browser tools: extract screenshot, content, title
        const shot = extractScreenshot(latestTool.output);
        if (shot) {
          setBrowserScreenshot((prev) => (prev === shot ? prev : shot));
          // Clear search results when a real screenshot arrives (agent moved past search)
          setBrowserSearchResults(undefined);
        }
        const content = extractBrowserContent(latestTool.output);
        if (content) setBrowserContent(content);
        const title = extractBrowserTitle(latestTool.output);
        if (title) setBrowserTitle(title);
      }
    }
  }, [latestTool?.toolCallId, latestTool?.state]);

  // Screenshot update callback — used by Take Control mode
  const onBrowserScreenshotUpdate = useCallback(
    (screenshot: string, url?: string, title?: string) => {
      setBrowserScreenshot(normalizeScreenshot(screenshot));
      if (url) setBrowserUrl(url);
      if (title) setBrowserTitle(title);
    },
    []
  );

  // File selection callbacks
  const onSelectFile = useCallback((path: string) => {
    setUserSelectedPath(path);
    // Re-open the tab if it was closed
    setClosedTabs((prev) => {
      if (!prev.has(path)) return prev;
      const next = new Set(prev);
      next.delete(path);
      return next;
    });
  }, []);

  const onSelectTab = useCallback(
    (tabId: string) => {
      // Tab IDs are indexes into open paths (excluding closed tabs)
      const openPaths = Object.keys(allFileContents).filter((p) => !closedTabs.has(p));
      const idx = Number(tabId);
      if (!Number.isNaN(idx) && openPaths[idx]) {
        setUserSelectedPath(openPaths[idx]);
      }
    },
    [allFileContents, closedTabs]
  );

  const onCloseTab = useCallback(
    (tabId: string) => {
      const openPaths = Object.keys(allFileContents).filter((p) => !closedTabs.has(p));
      const idx = Number(tabId);
      const closedPath = openPaths[idx];
      if (!closedPath) return;

      setClosedTabs((prev) => {
        const next = new Set(prev);
        next.add(closedPath);
        return next;
      });

      // If closing the active tab, select the next available tab
      setUserSelectedPath((prev) => {
        if (prev !== closedPath) return prev;
        const remaining = openPaths.filter((p) => p !== closedPath);
        return remaining.length > 0 ? remaining[remaining.length - 1]! : null;
      });
    },
    [allFileContents, closedTabs]
  );

  // Browser navigation callbacks
  const onBrowserNavigate = useCallback(
    async (url: string) => {
      setBrowserUrl(url);
      setBrowserLoading(true);
      // Clear search results — user is navigating away from search
      setBrowserSearchResults(undefined);
      setBrowserHistory((prev) => {
        const trimmed = prev.slice(0, historyIndex + 1);
        return [...trimmed, { url }];
      });
      setHistoryIndex((prev) => prev + 1);

      try {
        if (sandboxId) {
          // Navigate inside E2B sandbox (returns screenshot)
          const resp = await fetch("/api/sandbox/browser", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sandboxId,
              action: "navigate",
              params: { url },
            }),
          });
          const data = await resp.json();
          if (data.screenshot) {
            setBrowserScreenshot(normalizeScreenshot(data.screenshot));
          }
          if (data.url) setBrowserUrl(data.url);
          if (data.title) setBrowserTitle(data.title);
          if (data.content) setBrowserContent(data.content);
        }
      } catch {
        // Ignore — URL bar still updated
      } finally {
        setBrowserLoading(false);
      }
    },
    [historyIndex, sandboxId]
  );

  const onBrowserBack = useCallback(() => {
    if (historyIndex <= 0) return;
    const newIndex = historyIndex - 1;
    const entry = browserHistory[newIndex];
    if (!entry) return;
    setHistoryIndex(newIndex);
    setBrowserUrl(entry.url);
    if (entry.screenshot) setBrowserScreenshot(entry.screenshot);
    if (entry.title) setBrowserTitle(entry.title);
  }, [historyIndex, browserHistory]);

  const onBrowserForward = useCallback(() => {
    if (historyIndex >= browserHistory.length - 1) return;
    const newIndex = historyIndex + 1;
    const entry = browserHistory[newIndex];
    if (!entry) return;
    setHistoryIndex(newIndex);
    setBrowserUrl(entry.url);
    if (entry.screenshot) setBrowserScreenshot(entry.screenshot);
    if (entry.title) setBrowserTitle(entry.title);
  }, [historyIndex, browserHistory]);

  const onBrowserRefresh = useCallback(async () => {
    if (!browserUrl) return;

    setBrowserLoading(true);
    try {
      if (sandboxId) {
        const resp = await fetch("/api/sandbox/browser", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sandboxId,
            action: "navigate",
            params: { url: browserUrl },
          }),
        });
        const data = await resp.json();
        if (data.screenshot) {
          setBrowserScreenshot(normalizeScreenshot(data.screenshot));
        }
        if (data.title) setBrowserTitle(data.title);
        if (data.content) setBrowserContent(data.content);
      }
    } catch {
      // Ignore
    } finally {
      setBrowserLoading(false);
    }
  }, [browserUrl, sandboxId]);

  const canGoBack = historyIndex > 0;
  const canGoForward = historyIndex < browserHistory.length - 1;

  // Resolve the pinned tool (if any) by scanning all messages for the matching toolCallId
  const pinnedTool = useMemo(() => {
    if (!pinnedToolCallId) return null;

    for (const msg of messages) {
      if (msg.role !== "assistant" || !msg.parts) continue;
      for (const part of msg.parts) {
        if (!part || !isToolUIPart(part)) continue;
        const toolPart = part as StaticToolUIPart | DynamicToolUIPart;
        if (!toolPart.toolCallId || !toolPart.state) continue;
        if (toolPart.toolCallId !== pinnedToolCallId) continue;

        const toolName = getToolName(toolPart);
        const viewType = TOOL_VIEW_MAP[toolName];
        if (!viewType) return null;

        const args = (toolPart.input ?? {}) as Record<string, unknown>;
        const output = toolPart.output as Record<string, unknown> | undefined;
        const actionFn = TOOL_ACTION_MAP[toolName];

        return {
          toolCallId: toolPart.toolCallId,
          toolName,
          args,
          output,
          viewType,
          currentAction: actionFn ? actionFn(args) : undefined,
          isWorking: false, // Pinned tools are always completed
          state: toolPart.state,
        };
      }
    }
    return null;
  }, [pinnedToolCallId, messages]);

  // Resolve effective view: user override takes priority over auto-detected
  // When pinned, use the pinned tool's view type
  const effectiveViewType: CanvasViewType =
    pinnedTool?.viewType ?? viewOverride ?? latestTool?.viewType ?? "empty";

  // Build canvas state
  if (!latestTool && !pinnedTool) {
    return {
      isVisible: false,
      viewType: "empty",
      isWorking: false,
      sandboxId,
      nekoUrl,
      streamUrl,
      availableViews,
      onSelectView,
      onPinToolCall,
      onUnpin,
      onTimelineChange,
    };
  }

  // Calculate current step (index of this tool call)
  const currentStep = totalToolCalls;

  // Use pinned tool data when pinned, otherwise latest
  const activeTool = pinnedTool ?? latestTool;

  const state: CanvasState = {
    isVisible: true,
    viewType: effectiveViewType,
    currentAction: activeTool?.currentAction,
    isWorking: pinnedTool ? false : (latestTool?.isWorking ?? false),
    statusText: pinnedTool
      ? `Viewing: ${pinnedTool.currentAction?.label ?? pinnedTool.toolName.replace(/_/g, " ")}`
      : latestTool?.isWorking
        ? latestTool.currentAction
          ? `Rubic is working: ${latestTool.currentAction.label}`
          : "Rubic is working..."
        : undefined,
    currentStep,
    totalSteps: totalToolCalls,
    timelinePercentage: pinnedToolCallId
      ? (() => {
          const idx = allToolCallIds.indexOf(pinnedToolCallId);
          return idx >= 0 && allToolCallIds.length > 0
            ? Math.round(((idx + 1) / allToolCallIds.length) * 100)
            : 100;
        })()
      : latestTool?.isWorking
        ? undefined
        : 100,
    onTimelineChange,
    sandboxId,
    nekoUrl,
    streamUrl,
    pinnedToolCallId,
    onPinToolCall,
    onUnpin,
    availableViews,
    onSelectView,
  };

  // Browser view data — use persistent state (populate when browser view available, not just active)
  // When pinned to a browser tool, extract data from the pinned tool directly
  if (effectiveViewType === "browser" || availableViews.has("browser")) {
    if (pinnedTool && pinnedTool.viewType === "browser") {
      // Pinned: extract browser data from the pinned tool
      state.browserUrl = extractBrowserUrl(pinnedTool.output, pinnedTool.args);
      state.browserScreenshot = pinnedTool.output
        ? extractScreenshot(pinnedTool.output)
        : undefined;
      state.browserContent = extractBrowserContent(pinnedTool.output);
      state.browserTitle = extractBrowserTitle(pinnedTool.output);
      state.browserSearchResults = extractSearchResults(pinnedTool.output);
      state.browserLoading = false;
    } else {
      state.browserUrl = browserUrl;
      state.browserLoading = (latestTool?.isWorking ?? false) || browserLoading;
      state.browserScreenshot = browserScreenshot;
      state.browserContent = browserContent;
      state.browserTitle = browserTitle;
      state.browserSearchResults = browserSearchResults;
    }
    state.canGoBack = canGoBack;
    state.canGoForward = canGoForward;
    state.onBrowserNavigate = onBrowserNavigate;
    state.onBrowserBack = onBrowserBack;
    state.onBrowserForward = onBrowserForward;
    state.onBrowserRefresh = onBrowserRefresh;
    state.onBrowserScreenshotUpdate = onBrowserScreenshotUpdate;
  }

  // Terminal view data — populate when terminal is available (for view switching)
  // Per-session: Manus uses named PTY sessions; we track each session separately.
  if (effectiveViewType === "terminal" || availableViews.has("terminal")) {
    if (pinnedTool && pinnedTool.viewType === "terminal" && pinnedTool.output) {
      // Pinned: extract terminal output from the pinned tool
      const pinOutput = pinnedTool.output as Record<string, unknown>;
      const cmd = (pinnedTool.args?.command as string) ?? "";
      const pinSessionId = (pinnedTool.args?.id as string) || "default";
      const rawOut =
        typeof pinnedTool.output === "string"
          ? pinnedTool.output
          : (pinOutput.stdout ?? JSON.stringify(pinnedTool.output, null, 2));
      const outStr = typeof rawOut === "string" ? rawOut : String(rawOut);
      state.terminalOutput = cmd ? [`$ ${cmd}`, ...outStr.split("\n")] : outStr.split("\n");
      state.activeTerminalSession = pinSessionId;
    } else {
      // Live: show the active session's output
      state.terminalOutput = terminalSessions[activeTerminalSession] ?? [];
      state.activeTerminalSession = activeTerminalSession;
    }
    state.terminalSessions = terminalSessions;
    state.terminalSessionIds = terminalSessionOrder;
    state.onSelectTerminalSession = onSelectTerminalSession;
  }

  // Editor view data — simple Manus-style: one file at a time, no tree/tabs
  if (effectiveViewType === "editor" || availableViews.has("editor")) {
    const agentPath = (activeTool?.args?.path ?? activeTool?.args?.file) as string | undefined;

    if (pinnedTool && pinnedTool.viewType === "editor") {
      const pinnedPath = (pinnedTool.args?.path ?? pinnedTool.args?.file) as string | undefined;
      const pinOutput = pinnedTool.output as Record<string, unknown> | undefined;
      const content =
        typeof pinnedTool.output === "string"
          ? pinnedTool.output
          : (pinOutput?.content ?? (pinnedTool.args?.content as string | undefined));
      if (content) {
        state.activeFileContent = typeof content === "string" ? content : String(content);
        state.activeFileLanguage = pinnedPath ? getLanguage(pinnedPath) : undefined;
        if (pinnedPath) {
          state.fileTabs = [{ id: "0", name: pinnedPath.split("/").pop() || pinnedPath, path: pinnedPath, isActive: true }];
        }
      }
    } else if (Object.keys(allFileContents).length > 0) {
      const allPaths = Object.keys(allFileContents);
      const activePath =
        (agentPath && allFileContents[agentPath] ? agentPath : null) ??
        allPaths[allPaths.length - 1] ??
        null;
      if (activePath) {
        state.activeFileContent = allFileContents[activePath];
        state.activeFileLanguage = getLanguage(activePath);
        state.fileTabs = [{ id: "0", name: activePath.split("/").pop() || activePath, path: activePath, isActive: true }];
      }
      state.allFileContents = allFileContents;
    } else if (
      (activeTool?.toolName === "file_write" && activeTool?.args?.content) ||
      (activeTool?.toolName === "text_editor" && activeTool?.args?.command === "create" && activeTool?.args?.file_text)
    ) {
      const content = (activeTool.args.content ?? activeTool.args.file_text) as string;
      state.activeFileContent = content;
      state.activeFileLanguage = agentPath ? getLanguage(agentPath) : undefined;
      if (agentPath) {
        state.fileTabs = [{ id: "0", name: agentPath.split("/").pop() || agentPath, path: agentPath, isActive: true }];
      }
    }
  }

  // Code view data — populate when code is available (for view switching)
  if (effectiveViewType === "code" || availableViews.has("code")) {
    const agentPath = (activeTool?.args?.path ?? activeTool?.args?.file) as string | undefined;

    if (pinnedTool && pinnedTool.viewType === "code") {
      // Pinned: extract file content from the pinned tool's output
      const pinnedPath = (pinnedTool.args?.path ?? pinnedTool.args?.file) as string | undefined;
      const pinOutput = pinnedTool.output as Record<string, unknown> | undefined;
      const content =
        typeof pinnedTool.output === "string"
          ? pinnedTool.output
          : (pinOutput?.content ?? (pinnedTool.args?.content as string | undefined));
      if (content) {
        state.activeFileContent = typeof content === "string" ? content : String(content);
        state.activeFileLanguage = pinnedPath ? getLanguage(pinnedPath) : undefined;
        if (pinnedPath) {
          state.fileTabs = [
            {
              id: "0",
              name: pinnedPath.split("/").pop() || pinnedPath,
              path: pinnedPath,
              isActive: true,
            },
          ];
          state.fileTree = buildFileTree([pinnedPath]);
        }
      }
    } else if (Object.keys(allFileContents).length > 0) {
      // Determine active file: user selection > agent's current file > last file
      const allPaths = Object.keys(allFileContents);
      const openPaths = allPaths.filter((p) => !closedTabs.has(p));
      const activePath =
        (userSelectedPath && allFileContents[userSelectedPath] ? userSelectedPath : null) ??
        (agentPath && allFileContents[agentPath] ? agentPath : null) ??
        (openPaths.length > 0 ? openPaths[openPaths.length - 1] : allPaths[allPaths.length - 1]) ??
        null;

      if (activePath) {
        state.activeFileContent = allFileContents[activePath];
        state.activeFileLanguage = getLanguage(activePath);
      }

      // Build file tree from ALL accumulated paths
      state.fileTree = buildFileTree(allPaths);

      // Build tabs from open files (excluding closed tabs)
      state.fileTabs = openPaths.map((p, i) => ({
        id: String(i),
        name: p.split("/").pop() || p,
        path: p,
        isActive: p === activePath,
      }));

      // Wire selection callbacks
      state.onSelectFile = onSelectFile;
      state.onSelectTab = onSelectTab;
      state.onCloseTab = onCloseTab;
      state.allFileContents = allFileContents;
    } else if (
      (activeTool?.toolName === "file_write" && activeTool?.args?.content) ||
      (activeTool?.toolName === "text_editor" && activeTool?.args?.command === "create" && activeTool?.args?.file_text)
    ) {
      // Show content being written even before output
      const content = (activeTool.args.content ?? activeTool.args.file_text) as string;
      state.activeFileContent = content;
      state.activeFileLanguage = agentPath ? getLanguage(agentPath) : undefined;
    }
  }

  // WebDev IDE view data — reuse file tree + add preview URL
  if (effectiveViewType === "webDevIDE" || availableViews.has("webDevIDE")) {
    if (Object.keys(allFileContents).length > 0) {
      const allPaths = Object.keys(allFileContents);
      const openPaths = allPaths.filter((p) => !closedTabs.has(p));
      const activePath =
        (userSelectedPath && allFileContents[userSelectedPath] ? userSelectedPath : null) ??
        (openPaths.length > 0 ? openPaths[openPaths.length - 1] : allPaths[allPaths.length - 1]) ??
        null;
      if (activePath) {
        state.activeFileContent = allFileContents[activePath];
        state.activeFileLanguage = getLanguage(activePath);
      }
      state.fileTree = buildFileTree(allPaths);
      state.fileTabs = openPaths.map((p, i) => ({
        id: String(i),
        name: p.split("/").pop() || p,
        path: p,
        isActive: p === activePath,
      }));
      state.onSelectFile = onSelectFile;
      state.onSelectTab = onSelectTab;
      state.onCloseTab = onCloseTab;
    }
    state.previewUrl = webdevPreviewUrl;
    state.allFileContents = allFileContents;
  }

  return state;
}

// ============================================================================
// Helpers
// ============================================================================

function tryHostname(url?: string): string {
  if (!url) return "...";
  try {
    return new URL(url).hostname;
  } catch {
    return url.slice(0, 30);
  }
}

function truncate(str?: string, max = 20): string {
  if (!str) return "...";
  return str.length > max ? str.slice(0, max) + "..." : str;
}

function fileName(path?: string): string {
  if (!path) return "";
  return path.split("/").pop() ?? path;
}

function getLanguage(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",
    py: "python",
    rs: "rust",
    go: "go",
    css: "css",
    html: "html",
    json: "json",
    md: "markdown",
    yaml: "yaml",
    yml: "yaml",
    sh: "bash",
    sql: "sql",
  };
  return map[ext ?? ""] ?? "text";
}

/**
 * Builds a simple file tree from an array of file paths.
 */
function buildFileTree(paths: string[]): FileNode[] {
  // Find common prefix to strip (e.g., /home/ubuntu/my-app/ → show my-app/ as root)
  // Matches Manus behavior where the file tree starts at the project directory
  const commonPrefix = findCommonPrefix(paths);

  const root: FileNode = { name: "root", path: "/", type: "directory", children: [] };

  for (const filePath of paths) {
    // Strip common prefix so tree starts at project root
    const relativePath = commonPrefix ? filePath.slice(commonPrefix.length) : filePath;
    const parts = relativePath.split("/").filter(Boolean);
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]!;
      const isFile = i === parts.length - 1;
      // Keep full path for file operations (clicking opens the right file)
      const currentPath = commonPrefix
        ? commonPrefix + parts.slice(0, i + 1).join("/")
        : "/" + parts.slice(0, i + 1).join("/");

      let child = current.children?.find((c) => c.name === part);
      if (!child) {
        child = {
          name: part,
          path: currentPath,
          type: isFile ? "file" : "directory",
          children: isFile ? undefined : [],
        };
        current.children ??= [];
        current.children.push(child);
      }
      if (!isFile && child) {
        current = child;
      }
    }
  }

  return root.children ?? [];
}

/** Find the common directory prefix of all file paths (up to the project root). */
function findCommonPrefix(paths: string[]): string {
  if (paths.length === 0) return "";
  const splitPaths = paths.map((p) => p.split("/").filter(Boolean));
  const minLen = Math.min(...splitPaths.map((p) => p.length));
  const commonParts: string[] = [];
  for (let i = 0; i < minLen - 1; i++) {
    const part = splitPaths[0]![i];
    if (splitPaths.every((p) => p[i] === part)) {
      commonParts.push(part!);
    } else {
      break;
    }
  }
  // Only strip if prefix is at least /home/ubuntu/project (3 parts)
  if (commonParts.length < 3) return "";
  return "/" + commonParts.join("/") + "/";
}
