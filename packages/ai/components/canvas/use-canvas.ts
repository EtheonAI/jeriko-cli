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

  // Image generation -> file preview
  generate_image: "filePreview",
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
  generate_image: (args) => ({
    type: "creating",
    label: `Generating image${args.prompt ? `: ${truncate(args.prompt as string, 25)}` : ""}`,
  }),
};

// ============================================================================
// Terminal tool names (for output accumulation)
// ============================================================================

const TERMINAL_TOOL_NAMES = new Set([
  "shell_exec",
  "shell_view",
  "shell_wait",
  "shell_write_to_process",
  "shell_kill_process",
  "code_execute",
]);

// ============================================================================
// File tool names (for content tracking)
// ============================================================================

const FILE_TOOL_NAMES = new Set(["file_read", "file_write", "file_str_replace"]);

// ============================================================================
// Screenshot helpers
// ============================================================================

/** Known base64 magic prefixes for common image formats */
const BASE64_IMAGE_PREFIXES = ["iVBOR", "/9j/", "R0lGO", "UklGR"];

/** Detect raw base64 and prepend data URI prefix if needed */
function normalizeScreenshot(raw: string): string {
  if (raw.startsWith("data:")) return raw;
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  for (const prefix of BASE64_IMAGE_PREFIXES) {
    if (raw.startsWith(prefix)) {
      const mime = raw.startsWith("/9j/") ? "image/jpeg" : "image/png";
      return `data:${mime};base64,${raw}`;
    }
  }
  if (raw.length > 100 && /^[A-Za-z0-9+/=]+$/.test(raw.slice(0, 100))) {
    return `data:image/png;base64,${raw}`;
  }
  return raw;
}

/** Extract screenshot from tool output, checking multiple keys */
function extractScreenshot(output: Record<string, unknown> | undefined): string | undefined {
  if (!output) return undefined;
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

/** Extract search results from tool output */
function extractSearchResults(
  output: Record<string, unknown> | undefined
): Array<{ title: string; url: string; snippet: string }> | undefined {
  if (!output) return undefined;
  const candidates = [
    output.results,
    output.organic_results,
    output.web_results,
    output.search_results,
  ];
  for (const results of candidates) {
    if (!Array.isArray(results) || results.length === 0) continue;
    const mapped = results
      .filter(
        (r: unknown): r is Record<string, unknown> =>
          typeof r === "object" &&
          r !== null &&
          (typeof (r as Record<string, unknown>).title === "string" ||
            typeof (r as Record<string, unknown>).url === "string")
      )
      .map((r) => ({
        title: String(r.title || r.name || ""),
        url: String(r.url || r.link || r.href || ""),
        snippet: String(r.snippet || r.description || r.body || ""),
      }));
    if (mapped.length > 0) return mapped;
  }
  return undefined;
}

// ============================================================================
// Hook
// ============================================================================

export function useCanvas(messages: UIMessage[]): CanvasState {
  // View switching — track which views have been activated + user override
  const [availableViews, setAvailableViews] = useState<Set<CanvasViewType>>(new Set());
  const [viewOverride, setViewOverride] = useState<CanvasViewType | null>(null);
  const prevAutoView = useRef<CanvasViewType | null>(null);

  // Sandbox ID — set from agent stream metadata
  const [sandboxId, setSandboxId] = useState<string | undefined>();

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

  // User-controlled active file path + closed tabs
  const [userActiveFilePath, setUserActiveFilePath] = useState<string | null>(null);
  const [closedTabs, setClosedTabs] = useState<Set<string>>(new Set());

  // Ref for historyIndex to avoid circular deps in browser effect
  const historyIndexRef = useRef(historyIndex);
  historyIndexRef.current = historyIndex;

  // Extract sandboxId and live browser frames from message metadata
  useEffect(() => {
    for (const msg of messages) {
      const meta = msg.metadata as Record<string, unknown> | undefined;
      if (!meta) continue;

      if (typeof meta.sandboxId === "string" && meta.sandboxId) {
        setSandboxId(meta.sandboxId);
      }

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

  // ========================================================================
  // Forward-scan: extract ALL file contents, terminal lines, deploy URL
  // from every tool call across every message. This is the single source
  // of truth for file and terminal state — no useEffect accumulation.
  // ========================================================================
  const { allFileContents, allTerminalLines, deployPreviewUrl, autoActivePath } = useMemo(() => {
    const files: Record<string, string> = {};
    const terminal: string[] = [];
    let deployUrl: string | undefined;
    let lastFilePath: string | undefined;

    for (const msg of messages) {
      if (msg.role !== "assistant") continue;
      if (!msg.parts) continue;
      for (const part of msg.parts) {
        if (!part || !isToolUIPart(part)) continue;
        const toolPart = part as StaticToolUIPart | DynamicToolUIPart;
        const toolName = getToolName(toolPart);
        const args = (toolPart.input ?? {}) as Record<string, unknown>;
        const output = toolPart.output as Record<string, unknown> | undefined;

        // ---- File content tracking ----
        if (toolName === "file_read" && toolPart.state === "output-available" && output) {
          const path = ((args.path ?? args.file) as string) ?? "unknown";
          const raw = typeof output === "string" ? output : output.content;
          files[path] = typeof raw === "string" ? raw : JSON.stringify(raw ?? output);
          lastFilePath = path;
        }
        if (toolName === "file_write") {
          const path = ((args.path ?? args.file) as string) ?? "unknown";
          files[path] = (args.content as string) ?? "";
          lastFilePath = path;
        }
        if (toolName === "file_str_replace" && toolPart.state === "output-available" && output) {
          const path = ((args.path ?? args.file) as string) ?? "unknown";
          const oldStr = (args.old_str as string) ?? "";
          const newStr = (args.new_str as string) ?? "";
          if (output.success && oldStr && files[path]) {
            files[path] = files[path].replace(oldStr, newStr);
          }
          lastFilePath = path;
        }

        // ---- Terminal output tracking ----
        if (TERMINAL_TOOL_NAMES.has(toolName) && toolPart.state === "output-available" && output) {
          const isCodeExec = toolName === "code_execute";
          const cmd = isCodeExec
            ? ((args.code as string)?.split("\n")[0] ?? "code")
            : ((args.command as string) ?? "");
          const prefix = isCodeExec ? `>>> ${cmd}` : `$ ${cmd}`;

          const rawOutput =
            typeof output === "string"
              ? output
              : (output.stdout ??
                output.output ??
                output.result ??
                JSON.stringify(output, null, 2));
          const outputStr = typeof rawOutput === "string" ? rawOutput : String(rawOutput);

          terminal.push(prefix);
          terminal.push(...outputStr.split("\n"));

          const stderr = typeof output.stderr === "string" ? output.stderr : "";
          if (stderr) {
            terminal.push(...stderr.split("\n").map((l: string) => `\x1b[31m${l}\x1b[0m`));
          }
        }

        // ---- Deploy URL tracking ----
        if (
          (toolName === "deploy_expose_port" || toolName === "deploy_apply_deployment") &&
          toolPart.state === "output-available" &&
          output
        ) {
          const url = (output.url ?? output.public_url ?? output.preview_url) as string | undefined;
          if (url) deployUrl = url;
        }
      }
    }

    return {
      allFileContents: files,
      allTerminalLines: terminal,
      deployPreviewUrl: deployUrl,
      autoActivePath: lastFilePath,
    };
  }, [messages]);

  // Count total tool calls and find the latest canvas-mapped one
  const { latestTool, totalToolCalls } = useMemo(() => {
    let total = 0;
    // Count all tool calls
    for (const m of messages) {
      if (m.role !== "assistant") continue;
      for (const p of m.parts ?? []) {
        if (p && isToolUIPart(p)) total++;
      }
    }

    // Walk backwards to find latest canvas-mapped tool
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.role !== "assistant") continue;
      if (!msg.parts) continue;
      for (let j = msg.parts.length - 1; j >= 0; j--) {
        const part = msg.parts[j];
        if (!part || !isToolUIPart(part)) continue;

        const toolPart = part as StaticToolUIPart | DynamicToolUIPart;
        const toolName = getToolName(toolPart);
        const viewType = TOOL_VIEW_MAP[toolName];
        if (!viewType) continue;

        const args = (toolPart.input ?? {}) as Record<string, unknown>;
        const output = toolPart.output as Record<string, unknown> | undefined;
        const actionFn = TOOL_ACTION_MAP[toolName];
        const currentAction = actionFn ? actionFn(args) : undefined;

        const isActive =
          toolPart.state === "input-streaming" ||
          toolPart.state === "input-available" ||
          toolPart.state === "approval-responded";

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

  // Also mark code/terminal as available when forward-scan finds data
  useEffect(() => {
    setAvailableViews((prev) => {
      let changed = false;
      const next = new Set(prev);
      if (Object.keys(allFileContents).length > 0 && !prev.has("code")) {
        next.add("code");
        changed = true;
      }
      if (allTerminalLines.length > 0 && !prev.has("terminal")) {
        next.add("terminal");
        changed = true;
      }
      return changed ? next : prev;
    });
  }, [allFileContents, allTerminalLines]);

  // View select callback for user manual switching
  const onSelectView = useCallback((view: CanvasViewType) => {
    setViewOverride(view);
  }, []);

  // ========================================================================
  // File interaction callbacks
  // ========================================================================

  const onSelectFile = useCallback((path: string) => {
    setUserActiveFilePath(path);
    // Re-open if it was closed
    setClosedTabs((prev) => {
      if (!prev.has(path)) return prev;
      const next = new Set(prev);
      next.delete(path);
      return next;
    });
  }, []);

  const onSelectTab = useCallback((tabId: string) => {
    // tabId IS the file path
    setUserActiveFilePath(tabId);
  }, []);

  const onCloseTab = useCallback((tabId: string) => {
    setClosedTabs((prev) => {
      const next = new Set(prev);
      next.add(tabId);
      return next;
    });
    setUserActiveFilePath((prev) => (prev === tabId ? null : prev));
  }, []);

  // ========================================================================
  // Browser state persistence (useEffect — browser state is "sticky")
  // ========================================================================

  useEffect(() => {
    if (!latestTool || latestTool.viewType !== "browser") return;

    const url = extractBrowserUrl(latestTool.output, latestTool.args);
    if (url) {
      setBrowserUrl((prev) => (prev === url ? prev : url));
      if (latestTool.toolName === "browser_navigate" || latestTool.toolName === "browser_restart") {
        setBrowserHistory((prev) => {
          const trimmed = prev.slice(0, historyIndexRef.current + 1);
          if (trimmed[trimmed.length - 1] === url) return prev;
          return [...trimmed, url];
        });
        setHistoryIndex((prev) => prev + 1);
      }
    }

    if (latestTool.output) {
      const shot = extractScreenshot(latestTool.output);
      if (shot) setBrowserScreenshot((prev) => (prev === shot ? prev : shot));

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

  // Resolve effective view: user override takes priority over auto-detected
  const effectiveViewType: CanvasViewType = viewOverride ?? latestTool?.viewType ?? "empty";

  // ========================================================================
  // Build canvas state
  // ========================================================================

  if (!latestTool && Object.keys(allFileContents).length === 0 && allTerminalLines.length === 0) {
    return {
      isVisible: false,
      viewType: "empty",
      isWorking: false,
      availableViews,
      onSelectView,
    };
  }

  const currentStep = totalToolCalls;

  const state: CanvasState = {
    isVisible: true,
    viewType: effectiveViewType,
    currentAction: latestTool?.currentAction,
    isWorking: latestTool?.isWorking ?? false,
    statusText: latestTool?.currentAction
      ? `Rubic is working: ${latestTool.currentAction.label}`
      : latestTool?.isWorking
        ? "Rubic is working..."
        : undefined,
    currentStep,
    totalSteps: totalToolCalls,
    timelinePercentage: latestTool?.isWorking ? undefined : 100,
    sandboxId,
    availableViews,
    onSelectView,
    previewUrl: deployPreviewUrl,
  };

  // ---- Browser view data ----
  if (effectiveViewType === "browser" || availableViews.has("browser")) {
    state.browserUrl = browserUrl;
    state.browserLoading = (latestTool?.isWorking ?? false) || browserLoading;
    state.browserScreenshot = browserScreenshot;
    state.browserContent = browserContent;
    state.browserTitle = browserTitle;
    state.browserSearchResults = browserSearchResults;
    state.canGoBack = canGoBack;
    state.canGoForward = canGoForward;
    state.onBrowserNavigate = onBrowserNavigate;
    state.onBrowserBack = onBrowserBack;
    state.onBrowserForward = onBrowserForward;
    state.onBrowserRefresh = onBrowserRefresh;
    state.onBrowserScreenshotUpdate = onBrowserScreenshotUpdate;
  }

  // ---- Terminal view data (from forward-scan) ----
  if (effectiveViewType === "terminal" || availableViews.has("terminal")) {
    state.terminalOutput = allTerminalLines;
  }

  // ---- Code view data (ALWAYS populated when files exist) ----
  const openFilePaths = Object.keys(allFileContents).filter((p) => !closedTabs.has(p));
  if (openFilePaths.length > 0) {
    // Resolve active file: user selection > auto (latest file tool) > last open file
    const resolvedPath =
      userActiveFilePath &&
      allFileContents[userActiveFilePath] &&
      !closedTabs.has(userActiveFilePath)
        ? userActiveFilePath
        : autoActivePath && allFileContents[autoActivePath] && !closedTabs.has(autoActivePath)
          ? autoActivePath
          : openFilePaths[openFilePaths.length - 1];

    state.activeFileContent = allFileContents[resolvedPath];
    state.activeFileLanguage = getLanguage(resolvedPath);
    state.fileTree = buildFileTree(Object.keys(allFileContents));
    state.fileTabs = openFilePaths.map((p) => ({
      id: p,
      name: p.split("/").pop() || p,
      path: p,
      isActive: p === resolvedPath,
    }));
    state.onSelectFile = onSelectFile;
    state.onSelectTab = onSelectTab;
    state.onCloseTab = onCloseTab;
  } else if (latestTool?.toolName === "file_write" && latestTool?.args?.content) {
    // Show content being written even before output
    const path = ((latestTool.args.path ?? latestTool.args.file) as string) ?? "untitled";
    state.activeFileContent = latestTool.args.content as string;
    state.activeFileLanguage = getLanguage(path);
    state.onSelectFile = onSelectFile;
    state.onSelectTab = onSelectTab;
    state.onCloseTab = onCloseTab;
  }

  // ---- File preview data ----
  if (effectiveViewType === "filePreview" || availableViews.has("filePreview")) {
    if (latestTool?.toolName === "generate_image") {
      const output = latestTool.output as Record<string, unknown> | undefined;
      if (output) {
        const imageUrl =
          typeof output.url === "string"
            ? output.url
            : typeof output.image_url === "string"
              ? output.image_url
              : typeof output.image === "string"
                ? output.image
                : undefined;
        if (imageUrl) {
          state.previewContent =
            imageUrl.startsWith("data:") || imageUrl.startsWith("http")
              ? imageUrl
              : normalizeScreenshot(imageUrl);
          state.previewFileType = "image";
          state.previewFileName =
            (latestTool.args?.prompt as string)?.slice(0, 50) ?? "Generated Image";
        }
      }
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
      const part = parts[i];
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
      if (!isFile) {
        current = child;
      }
    }
  }

  return root.children ?? [];
}
