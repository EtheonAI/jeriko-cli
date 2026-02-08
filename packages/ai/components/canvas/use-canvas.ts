"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import type {
  UIMessage,
  StaticToolUIPart,
  DynamicToolUIPart,
} from "../../lib/types/ui-message";
import { isToolUIPart, getToolName } from "../../lib/types/ui-message";
import type { FileNode, FileTab } from "./views/code-view";

// ============================================================================
// Types
// ============================================================================

export type CanvasViewType =
  | "browser"
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
  fileContents?: Record<string, string>;

  // Timeline
  timelinePercentage?: number;
  currentStep?: number;
  totalSteps?: number;
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

  // File tools
  file_read: "code",
  file_write: "code",
  file_str_replace: "code",
  file_find_in_content: "code",
  file_find_by_name: "code",

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
};

// ============================================================================
// Tool Name -> Action Label Generator
// ============================================================================

const TOOL_ACTION_MAP: Record<
  string,
  (args: Record<string, unknown>) => ToolAction
> = {
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
      const mime = raw.startsWith("/9j/") ? "image/jpeg" : "image/png";
      return `data:${mime};base64,${raw}`;
    }
  }
  // Fallback: assume PNG base64
  if (raw.length > 100 && /^[A-Za-z0-9+/=]+$/.test(raw.slice(0, 100))) {
    return `data:image/png;base64,${raw}`;
  }
  return raw;
}

/** Extract screenshot from tool output, checking multiple keys */
function extractScreenshot(
  output: Record<string, unknown> | undefined
): string | undefined {
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
function extractBrowserContent(
  output: Record<string, unknown> | undefined
): string | undefined {
  if (!output) return undefined;
  if (typeof output.content === "string" && output.content.length > 0) return output.content;
  if (typeof output.text === "string" && output.text.length > 0) return output.text;
  return undefined;
}

/** Extract page title from tool output */
function extractBrowserTitle(
  output: Record<string, unknown> | undefined
): string | undefined {
  if (!output) return undefined;
  if (typeof output.title === "string" && output.title.length > 0) return output.title;
  return undefined;
}

/** Extract search results from tool output */
function extractSearchResults(
  output: Record<string, unknown> | undefined
): Array<{ title: string; url: string; snippet: string }> | undefined {
  if (!output) return undefined;
  const results = output.results;
  if (!Array.isArray(results) || results.length === 0) return undefined;
  return results
    .filter(
      (r: unknown): r is Record<string, unknown> =>
        typeof r === "object" && r !== null && typeof (r as Record<string, unknown>).title === "string"
    )
    .map((r) => ({
      title: String(r.title || ""),
      url: String(r.url || r.link || ""),
      snippet: String(r.snippet || ""),
    }));
}

// ============================================================================
// Hook
// ============================================================================

export function useCanvas(messages: UIMessage[]): CanvasState {
  const [terminalHistory, setTerminalHistory] = useState<string[]>([]);
  const [fileContents, setFileContents] = useState<Record<string, string>>({});

  // User-selected file path (overrides agent's active file)
  const [userSelectedPath, setUserSelectedPath] = useState<string | null>(null);
  // Tracks tabs the user has closed
  const [closedTabs, setClosedTabs] = useState<Set<string>>(new Set());

  // View switching — track which views have been activated + user override
  const [availableViews, setAvailableViews] = useState<Set<CanvasViewType>>(new Set());
  const [viewOverride, setViewOverride] = useState<CanvasViewType | null>(null);
  const prevAutoView = useRef<CanvasViewType | null>(null);

  // Sandbox ID — set from agent stream metadata
  const [sandboxId, setSandboxId] = useState<string | undefined>();

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
  const [browserHistory, setBrowserHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Ref for historyIndex to avoid circular deps in browser effect
  const historyIndexRef = useRef(historyIndex);
  historyIndexRef.current = historyIndex;

  // Extract sandboxId and live browser frames from message metadata
  useEffect(() => {
    for (const msg of messages) {
      const meta = msg.metadata as Record<string, unknown> | undefined;
      if (!meta) continue;

      // Pick up sandbox ID
      if (typeof meta.sandboxId === "string" && meta.sandboxId) {
        setSandboxId(meta.sandboxId);
      }

      // Pick up live browser frame
      const frame = meta.browserFrame as
        | { screenshot?: string; url?: string; title?: string }
        | undefined;
      if (frame?.screenshot) {
        setBrowserScreenshot(normalizeScreenshot(frame.screenshot));
        if (frame.url) setBrowserUrl(frame.url);
        if (frame.title) setBrowserTitle(frame.title);
      }
    }
  }, [messages]);

  // Accumulate ALL file contents from ALL messages — runs on mount + message changes
  // This ensures file contents survive page reloads with initial messages
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
          const content = typeof output === "string"
            ? output
            : (output.content as string) ?? JSON.stringify(output);
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
      }
    }
    return contents;
  }, [messages]);

  // Merge accumulated file contents into state (on mount / message change)
  useEffect(() => {
    setFileContents((prev) => {
      const merged = { ...prev };
      let changed = false;
      for (const [path, content] of Object.entries(allFileContents)) {
        if (merged[path] !== content) {
          merged[path] = content;
          changed = true;
        }
      }
      return changed ? merged : prev;
    });
  }, [allFileContents]);

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

        // Only return the first match (which is the latest)
        if (toolCount === 1 || !TOOL_VIEW_MAP[toolName]) {
          // keep counting but we found the latest
        }

        const args = (toolPart.input ?? {}) as Record<string, unknown>;
        const output = toolPart.output as Record<string, unknown> | undefined;
        const actionFn = TOOL_ACTION_MAP[toolName];
        const currentAction = actionFn ? actionFn(args) : undefined;

        const isActive =
          toolPart.state === "input-streaming" ||
          toolPart.state === "input-available" ||
          toolPart.state === "approval-responded";

        // Count all tool calls across all messages for the step counter
        let total = 0;
        for (const m of messages) {
          if (m.role !== "assistant") continue;
          for (const p of (m.parts ?? [])) {
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
  }, [messages]);

  // Populate availableViews as tools activate new view types
  useEffect(() => {
    if (!latestTool || !latestTool.viewType || latestTool.viewType === "empty") return;
    setAvailableViews((prev) => {
      if (prev.has(latestTool.viewType)) return prev;
      const next = new Set(prev);
      next.add(latestTool.viewType);
      return next;
    });

    // Auto-switch: if a NEW view type appears, clear any user override
    if (latestTool.viewType !== prevAutoView.current) {
      prevAutoView.current = latestTool.viewType;
      setViewOverride(null);
    }
  }, [latestTool?.viewType]);

  // View select callback for user manual switching
  const onSelectView = useCallback((view: CanvasViewType) => {
    setViewOverride(view);
  }, []);

  // Accumulate terminal output from shell_exec results
  // Deps: toolCallId + state (primitives) — avoids infinite loop from object ref
  useEffect(() => {
    if (!latestTool) return;
    if (
      latestTool.toolName === "shell_exec" &&
      latestTool.state === "output-available" &&
      latestTool.output
    ) {
      const cmd = (latestTool.args?.command as string) ?? "";
      const rawOutput =
        typeof latestTool.output === "string"
          ? latestTool.output
          : (latestTool.output as Record<string, unknown>)?.stdout ??
            JSON.stringify(latestTool.output, null, 2);
      const outputStr = typeof rawOutput === "string" ? rawOutput : String(rawOutput);

      setTerminalHistory((prev) => {
        // Avoid duplicates
        const lastCmd = prev.findLast((l) => l.startsWith("$"));
        if (lastCmd === `$ ${cmd}`) return prev;
        return [...prev, `$ ${cmd}`, ...outputStr.split("\n")];
      });
    }
  }, [latestTool?.toolCallId, latestTool?.state]);

  // Track file contents from file_read/file_write
  // Also auto-follow the agent's file operations (clear user selection)
  // Deps: toolCallId + state (primitives) — avoids infinite loop from object ref
  useEffect(() => {
    if (!latestTool) return;

    // Auto-follow: when agent opens a new file, clear user override
    const agentFilePath = (latestTool.args?.path ?? latestTool.args?.file) as string | undefined;
    if (
      agentFilePath &&
      (latestTool.toolName === "file_read" || latestTool.toolName === "file_write" || latestTool.toolName === "file_str_replace")
    ) {
      setUserSelectedPath(null);
    }

    if (
      latestTool.toolName === "file_read" &&
      latestTool.state === "output-available" &&
      latestTool.output
    ) {
      const path = ((latestTool.args?.path ?? latestTool.args?.file) as string) ?? "unknown";
      const content =
        typeof latestTool.output === "string"
          ? latestTool.output
          : (latestTool.output as Record<string, unknown>)?.content ??
            JSON.stringify(latestTool.output);
      setFileContents((prev) => ({
        ...prev,
        [path]: typeof content === "string" ? content : String(content),
      }));
    }
    if (latestTool.toolName === "file_write") {
      const path = ((latestTool.args?.path ?? latestTool.args?.file) as string) ?? "unknown";
      const content = (latestTool.args?.content as string) ?? "";
      setFileContents((prev) => ({ ...prev, [path]: content }));
    }
    if (
      latestTool.toolName === "file_str_replace" &&
      latestTool.state === "output-available" &&
      latestTool.output
    ) {
      const path = ((latestTool.args?.path ?? latestTool.args?.file) as string) ?? "unknown";
      const oldStr = (latestTool.args?.old_str as string) ?? "";
      const newStr = (latestTool.args?.new_str as string) ?? "";
      const output = latestTool.output as Record<string, unknown>;
      if (output.success && oldStr) {
        setFileContents((prev) => {
          const existing = prev[path];
          if (!existing) return prev;
          return { ...prev, [path]: existing.replace(oldStr, newStr) };
        });
      }
    }
  }, [latestTool?.toolCallId, latestTool?.state]);

  // Persist browser URL and screenshot across all browser tool calls
  // Deps: toolCallId + state (primitives) — avoids infinite loop from object ref
  // Uses historyIndexRef to avoid circular dep (effect sets historyIndex)
  useEffect(() => {
    if (!latestTool || latestTool.viewType !== "browser") return;

    // Extract URL — update if found
    const url = extractBrowserUrl(latestTool.output, latestTool.args);
    if (url) {
      setBrowserUrl((prev) => (prev === url ? prev : url));
      // Push to history on navigation
      if (
        latestTool.toolName === "browser_navigate" ||
        latestTool.toolName === "browser_restart"
      ) {
        setBrowserHistory((prev) => {
          const trimmed = prev.slice(0, historyIndexRef.current + 1);
          if (trimmed[trimmed.length - 1] === url) return prev;
          return [...trimmed, url];
        });
        setHistoryIndex((prev) => prev + 1);
      }
    }

    // Extract screenshot — update if found (persists from previous otherwise)
    if (latestTool.output) {
      const shot = extractScreenshot(latestTool.output);
      if (shot) setBrowserScreenshot((prev) => (prev === shot ? prev : shot));

      // Extract content, title, and search results for display without screenshots
      const content = extractBrowserContent(latestTool.output);
      if (content) setBrowserContent(content);

      const title = extractBrowserTitle(latestTool.output);
      if (title) setBrowserTitle(title);

      const results = extractSearchResults(latestTool.output);
      if (results) setBrowserSearchResults(results);
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

  const onSelectTab = useCallback((tabId: string) => {
    // Tab IDs are indexes into open paths (excluding closed tabs)
    const openPaths = Object.keys(fileContents).filter((p) => !closedTabs.has(p));
    const idx = Number(tabId);
    if (!Number.isNaN(idx) && openPaths[idx]) {
      setUserSelectedPath(openPaths[idx]);
    }
  }, [fileContents, closedTabs]);

  const onCloseTab = useCallback((tabId: string) => {
    const openPaths = Object.keys(fileContents).filter((p) => !closedTabs.has(p));
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
  }, [fileContents, closedTabs]);

  // Browser navigation callbacks
  const onBrowserNavigate = useCallback(
    async (url: string) => {
      setBrowserUrl(url);
      setBrowserLoading(true);
      setBrowserHistory((prev) => {
        const trimmed = prev.slice(0, historyIndex + 1);
        return [...trimmed, url];
      });
      setHistoryIndex((prev) => prev + 1);

      // If sandbox is available, actually navigate inside E2B
      if (sandboxId) {
        try {
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
        } catch {
          // Ignore — URL bar still updated
        } finally {
          setBrowserLoading(false);
        }
      }
    },
    [historyIndex, sandboxId]
  );

  const onBrowserBack = useCallback(() => {
    if (historyIndex <= 0) return;
    const newIndex = historyIndex - 1;
    setHistoryIndex(newIndex);
    setBrowserUrl(browserHistory[newIndex]);
  }, [historyIndex, browserHistory]);

  const onBrowserForward = useCallback(() => {
    if (historyIndex >= browserHistory.length - 1) return;
    const newIndex = historyIndex + 1;
    setHistoryIndex(newIndex);
    setBrowserUrl(browserHistory[newIndex]);
  }, [historyIndex, browserHistory]);

  const onBrowserRefresh = useCallback(async () => {
    if (!browserUrl) return;

    if (sandboxId) {
      setBrowserLoading(true);
      try {
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
      } catch {
        // Ignore
      } finally {
        setBrowserLoading(false);
      }
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
      availableViews,
      onSelectView,
      onPinToolCall,
      onUnpin,
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
      : latestTool?.currentAction
        ? `Rubic is working: ${latestTool.currentAction.label}`
        : "Rubic is working...",
    currentStep,
    totalSteps: totalToolCalls,
    timelinePercentage: pinnedTool ? 100 : (latestTool?.isWorking ? undefined : 100),
    sandboxId,
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
      state.browserScreenshot = pinnedTool.output ? extractScreenshot(pinnedTool.output) : undefined;
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
  if (effectiveViewType === "terminal" || availableViews.has("terminal")) {
    if (pinnedTool && pinnedTool.viewType === "terminal" && pinnedTool.output) {
      // Pinned: extract terminal output from the pinned tool
      const pinOutput = pinnedTool.output as Record<string, unknown>;
      const cmd = (pinnedTool.args?.command as string) ?? "";
      const rawOut =
        typeof pinnedTool.output === "string"
          ? pinnedTool.output
          : (pinOutput.stdout ?? JSON.stringify(pinnedTool.output, null, 2));
      const outStr = typeof rawOut === "string" ? rawOut : String(rawOut);
      state.terminalOutput = cmd ? [`$ ${cmd}`, ...outStr.split("\n")] : outStr.split("\n");
    } else {
      state.terminalOutput = terminalHistory;
    }
  }

  // Code view data — populate when code is available (for view switching)
  if (effectiveViewType === "code" || availableViews.has("code")) {
    const agentPath = ((activeTool?.args?.path ?? activeTool?.args?.file) as string | undefined);

    if (pinnedTool && pinnedTool.viewType === "code") {
      // Pinned: extract file content from the pinned tool's output
      const pinnedPath = ((pinnedTool.args?.path ?? pinnedTool.args?.file) as string | undefined);
      const pinOutput = pinnedTool.output as Record<string, unknown> | undefined;
      const content =
        typeof pinnedTool.output === "string"
          ? pinnedTool.output
          : pinOutput?.content ?? (pinnedTool.args?.content as string | undefined);
      if (content) {
        state.activeFileContent = typeof content === "string" ? content : String(content);
        state.activeFileLanguage = pinnedPath ? getLanguage(pinnedPath) : undefined;
        if (pinnedPath) {
          state.fileTabs = [{ id: "0", name: pinnedPath.split("/").pop() || pinnedPath, path: pinnedPath, isActive: true }];
          state.fileTree = buildFileTree([pinnedPath]);
        }
      }
    } else if (Object.keys(fileContents).length > 0) {
      // Determine active file: user selection > agent's current file > last file
      const allPaths = Object.keys(fileContents);
      const openPaths = allPaths.filter((p) => !closedTabs.has(p));
      const activePath =
        (userSelectedPath && fileContents[userSelectedPath] ? userSelectedPath : null) ??
        (agentPath && fileContents[agentPath] ? agentPath : null) ??
        (openPaths.length > 0 ? openPaths[openPaths.length - 1] : allPaths[allPaths.length - 1]) ??
        null;

      if (activePath) {
        state.activeFileContent = fileContents[activePath];
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
      state.fileContents = fileContents;
    } else if (
      activeTool?.toolName === "file_write" &&
      activeTool?.args?.content
    ) {
      // Show content being written even before output
      state.activeFileContent = activeTool.args.content as string;
      state.activeFileLanguage = agentPath
        ? getLanguage(agentPath)
        : undefined;
    }
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
  const root: FileNode = { name: "root", path: "/", type: "directory", children: [] };

  for (const filePath of paths) {
    const parts = filePath.split("/").filter(Boolean);
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]!;
      const isFile = i === parts.length - 1;
      const currentPath = "/" + parts.slice(0, i + 1).join("/");

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
