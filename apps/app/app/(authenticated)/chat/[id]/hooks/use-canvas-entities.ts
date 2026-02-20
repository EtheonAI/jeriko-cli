"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useAppSelector } from "@/lib/store/hooks";
import {
  selectLatestCanvasToolEvent,
  selectCanvasToolCount,
  selectCanvasToolCallIds,
  selectToolEventById,
  selectAllFileContents,
  selectTerminalSessions,
  selectBrowserHistory,
  selectLatestBrowserScreenshot,
  selectAvailableViews,
  selectLatestSearchResults,
  selectWebdevPreviewUrl,
  selectSessionMetadata,
  // Domain slice selectors — Manus parity: rich feature state from dedicated slices
  selectSlideEditorSlides,
  selectSlideEditorCurrentIndex,
  selectSlideEditorIsPresentationMode,
  selectMapReduceCurrentTask,
  selectMapReduceOverallProgress,
  selectWebDevProject,
  selectLatestGeneratedImage,
  // CodeViewer slice selectors — Manus parity: authoritative file data source
  selectCodeViewerFileDataSource,
  selectCodeViewerFileTabs,
  selectCodeViewerActiveTabId,
  selectCodeViewerDirectoryList,
  // AgentWorkspace slice selectors — Manus parity: sidebar type → view fallback
  selectAgentWorkspaceSidebarType,
  SIDEBAR_TO_VIEW,
  // Timeline slice selectors — Manus parity: event-based scrubber data
  selectTimelineEvents,
  // ToolCalls slice selectors — Manus parity: active tool status indicators
  selectActiveToolCallIds,
  selectToolCallStats,
  TOOL_VIEW_MAP,
  SEARCH_TOOLS,
  extractSearchResults,
  type CanvasViewType,
} from "@/lib/store/selectors/canvas.selectors";
import type { CanvasState, ToolAction, ToolActionType } from "@repo/ai/components/canvas/use-canvas";

/**
 * Canvas hook that reads from Redux websocket.toolEvents via selectors.
 * Manus-parity: declarative state derived from normalized tool event entities.
 *
 * This replaces the useMemo-heavy `useCanvas(messages)` from packages/ai.
 * All tool state is read from Redux (populated by useSSEToEntities).
 * Only local UI state (viewOverride, pinned, tabs) uses useState.
 */

// ============================================================================
// Action label generators (same as use-canvas.ts)
// ============================================================================

function tryHostname(url?: string): string {
  if (!url) return "...";
  try { return new URL(url).hostname; } catch { return url.slice(0, 30); }
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
    ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript",
    py: "python", rs: "rust", go: "go", css: "css", html: "html",
    json: "json", md: "markdown", yaml: "yaml", yml: "yaml", sh: "bash", sql: "sql",
  };
  return map[ext ?? ""] ?? "text";
}

const TOOL_ACTION_MAP: Record<string, (args: Record<string, unknown>) => ToolAction> = {
  browser_navigate: (args) => ({ type: "browsing", label: `Browsing ${tryHostname(args.url as string)}` }),
  browser_view: () => ({ type: "viewing", label: "Viewing the page" }),
  browser_click: () => ({ type: "clicking", label: "Clicking element" }),
  browser_input: (args) => ({ type: "typing", label: `Typing ${truncate(args.text as string, 20)}` }),
  browser_scroll: () => ({ type: "scrolling", label: "Scrolling" }),
  browser_scroll_up: () => ({ type: "scrolling", label: "Scrolling up" }),
  browser_scroll_down: () => ({ type: "scrolling", label: "Scrolling down" }),
  browser_move_mouse: () => ({ type: "clicking", label: "Moving mouse" }),
  browser_key_press: () => ({ type: "typing", label: "Pressing key" }),
  browser_press_key: () => ({ type: "typing", label: "Pressing key" }),
  browser_select_option: () => ({ type: "clicking", label: "Selecting option" }),
  browser_console_exec: () => ({ type: "typing", label: "Executing console script" }),
  browser_console_view: () => ({ type: "viewing", label: "Viewing console output" }),
  browser_screenshot: () => ({ type: "viewing", label: "Taking screenshot" }),
  browser_restart: (args) => ({ type: "browsing", label: `Restarting browser ${args.url ? `→ ${tryHostname(args.url as string)}` : ""}` }),
  browser_save_image: (args) => ({ type: "viewing", label: `Saving image ${args.path ? `to ${fileName(args.path as string)}` : ""}` }),
  browser_upload_file: () => ({ type: "clicking", label: "Uploading file" }),
  browser_fill_form: () => ({ type: "typing", label: "Filling form" }),
  browser_find_keyword: (args) => ({ type: "searching", label: `Finding "${truncate((args.keyword as string) ?? "", 20)}"` }),
  browser_close: () => ({ type: "viewing", label: "Closing browser" }),
  shell_exec: (args) => ({ type: "typing", label: `Running ${truncate((args.command as string)?.split(" ")[0] ?? "", 20)}` }),
  shell_view: () => ({ type: "viewing", label: "Viewing terminal" }),
  shell_wait: () => ({ type: "viewing", label: "Waiting for process" }),
  shell_write_to_process: () => ({ type: "typing", label: "Writing to process" }),
  shell_kill_process: () => ({ type: "viewing", label: "Killing process" }),
  file_read: (args) => ({ type: "reading", label: `Reading ${fileName((args.path ?? args.file) as string)}` }),
  file_write: (args) => ({ type: "editing", label: `Writing ${fileName((args.path ?? args.file) as string)}` }),
  file_str_replace: (args) => ({ type: "editing", label: `Editing ${fileName((args.path ?? args.file) as string)}` }),
  file_find_in_content: () => ({ type: "searching", label: "Searching in files" }),
  file_find_by_name: () => ({ type: "searching", label: "Finding files" }),
  code_execute: () => ({ type: "typing", label: "Executing code" }),
  info_search_web: (args) => ({ type: "searching", label: `Searching "${truncate(args.query as string, 30)}"` }),
  web_search: (args) => ({ type: "searching", label: `Searching "${truncate(args.query as string, 30)}"` }),
  search_web: (args) => ({ type: "searching", label: `Searching "${truncate(args.query as string, 30)}"` }),
  deploy_expose_port: () => ({ type: "browsing", label: "Exposing port" }),
  deploy_apply_deployment: () => ({ type: "creating", label: "Deploying application" }),
  make_manus_page: () => ({ type: "creating", label: "Creating page" }),
  text_editor: (args) => ({ type: "editing", label: `Editing ${fileName((args.path as string) ?? "")}` }),
  slide_present: () => ({ type: "browsing", label: "Presenting slides" }),
  webdev_init_project: (args) => ({ type: "creating" as ToolActionType, label: `Scaffolding ${(args.app_name as string) || "project"}` }),
  webdev_save_checkpoint: (args) => ({ type: "creating" as ToolActionType, label: `Saving: ${truncate((args.message as string) || "checkpoint", 25)}` }),
  webdev_check_status: () => ({ type: "viewing" as ToolActionType, label: "Checking project status" }),
  webdev_restart_server: () => ({ type: "creating" as ToolActionType, label: "Restarting dev server" }),
  webdev_rollback_checkpoint: () => ({ type: "viewing" as ToolActionType, label: "Rolling back version" }),
  webdev_execute_sql: () => ({ type: "searching" as ToolActionType, label: "Executing SQL query" }),
  webdev_push_schema: () => ({ type: "creating" as ToolActionType, label: "Pushing database schema" }),
  webdev_list_versions: () => ({ type: "viewing" as ToolActionType, label: "Listing versions" }),
  webdev_add_feature: (args) => ({ type: "creating" as ToolActionType, label: `Adding ${(args.feature as string) || "feature"}` }),
  generate_image: (args) => ({ type: "creating" as ToolActionType, label: `Generating ${(args.prompt as string)?.slice(0, 30) || "image"}` }),
  image_rmbg: () => ({ type: "editing" as ToolActionType, label: "Removing background" }),
  image_search_upload: () => ({ type: "searching" as ToolActionType, label: "Reverse image search" }),
  slide_init: (args) => ({ type: "creating" as ToolActionType, label: `Creating presentation ${(args.title as string)?.slice(0, 25) || ""}` }),
  slide_modify: () => ({ type: "editing" as ToolActionType, label: "Modifying slide" }),
  slide_add_notes: () => ({ type: "editing" as ToolActionType, label: "Adding speaker notes" }),
  parallel_tasks: (args) => ({ type: "creating" as ToolActionType, label: `Running ${(args.description as string)?.slice(0, 25) || "parallel tasks"}` }),
};

// ============================================================================
// File tree builder
// ============================================================================

interface FileNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileNode[];
}

function findCommonPrefix(paths: string[]): string {
  if (paths.length === 0) return "";
  const splitPaths = paths.map((p) => p.split("/").filter(Boolean));
  const minLen = Math.min(...splitPaths.map((p) => p.length));
  const commonParts: string[] = [];
  for (let i = 0; i < minLen - 1; i++) {
    const part = splitPaths[0]![i];
    if (splitPaths.every((p) => p[i] === part)) commonParts.push(part!);
    else break;
  }
  if (commonParts.length < 3) return "";
  return "/" + commonParts.join("/") + "/";
}

function buildFileTree(paths: string[]): FileNode[] {
  const commonPrefix = findCommonPrefix(paths);
  const root: FileNode = { name: "root", path: "/", type: "directory", children: [] };

  for (const filePath of paths) {
    const relativePath = commonPrefix ? filePath.slice(commonPrefix.length) : filePath;
    const parts = relativePath.split("/").filter(Boolean);
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]!;
      const isFile = i === parts.length - 1;
      const currentPath = commonPrefix ? commonPrefix + parts.slice(0, i + 1).join("/") : "/" + parts.slice(0, i + 1).join("/");
      let child = current.children?.find((c) => c.name === part);
      if (!child) {
        child = { name: part, path: currentPath, type: isFile ? "file" : "directory", children: isFile ? undefined : [] };
        current.children ??= [];
        current.children.push(child);
      }
      if (!isFile && child) current = child;
    }
  }
  return root.children ?? [];
}

// ============================================================================
// Hook
// ============================================================================

export function useCanvasFromEntities(sessionId: string, isStreaming: boolean): CanvasState {
  // ── Redux reads via selectors (Manus: useSelector + selectors) ──
  // websocket.toolEvents — raw event log (browser, terminal, editor, code, webDevIDE)
  const latestTool = useAppSelector((state) => selectLatestCanvasToolEvent(state, sessionId));
  const totalToolCalls = useAppSelector((state) => selectCanvasToolCount(state, sessionId));
  const allToolCallIds = useAppSelector((state) => selectCanvasToolCallIds(state, sessionId));
  const allFileContents = useAppSelector((state) => selectAllFileContents(state, sessionId));
  const terminalData = useAppSelector((state) => selectTerminalSessions(state, sessionId));
  const browserHistoryFromRedux = useAppSelector((state) => selectBrowserHistory(state, sessionId));
  const availableViewsFromRedux = useAppSelector((state) => selectAvailableViews(state, sessionId));
  const latestBrowserScreenshot = useAppSelector((state) => selectLatestBrowserScreenshot(state, sessionId));
  const searchResults = useAppSelector((state) => selectLatestSearchResults(state, sessionId));
  const webdevPreviewUrl = useAppSelector((state) => selectWebdevPreviewUrl(state, sessionId));
  const sessionMeta = useAppSelector((state) => selectSessionMetadata(state, sessionId));

  // Domain slice reads — Manus parity: aggregated feature state from dedicated slices
  // (populated by useSSEToEntities, consumed HERE for rendering)
  const slideEditorSlides = useAppSelector(selectSlideEditorSlides);
  const slideEditorCurrentIndex = useAppSelector(selectSlideEditorCurrentIndex);
  const slideEditorIsPresentationMode = useAppSelector(selectSlideEditorIsPresentationMode);
  const mapReduceCurrentTask = useAppSelector(selectMapReduceCurrentTask);
  const mapReduceOverallProgress = useAppSelector(selectMapReduceOverallProgress);
  const webDevProject = useAppSelector(selectWebDevProject);
  const aiCanvasGeneratedImage = useAppSelector((state) => selectLatestGeneratedImage(state, sessionId));

  // CodeViewer slice — Manus parity: authoritative file data source (dispatch by useSSEToEntities)
  const codeViewerFileDataSource = useAppSelector(selectCodeViewerFileDataSource);
  const codeViewerFileTabs = useAppSelector(selectCodeViewerFileTabs);
  const codeViewerActiveTabId = useAppSelector(selectCodeViewerActiveTabId);
  const codeViewerDirectoryList = useAppSelector(selectCodeViewerDirectoryList);

  // AgentWorkspace slice — Manus parity: sidebar type drives canvas view as fallback
  const agentWorkspaceSidebarType = useAppSelector(selectAgentWorkspaceSidebarType);

  // Timeline slice — Manus parity: event-based scrubber data
  const timelineEvents = useAppSelector((state) => selectTimelineEvents(state, sessionId));

  // ToolCalls slice — Manus parity: active tool status indicators
  const activeToolCallIds = useAppSelector(selectActiveToolCallIds);
  const toolCallStats = useAppSelector(selectToolCallStats);

  // ── Local UI state (not server data — user interactions only) ──
  const [viewOverride, setViewOverride] = useState<CanvasViewType | null>(null);
  const [pinnedToolCallId, setPinnedToolCallId] = useState<string | undefined>();
  const [userSelectedPath, setUserSelectedPath] = useState<string | null>(null);
  const [closedTabs, setClosedTabs] = useState<Set<string>>(new Set());
  // Terminal session selection override (user-driven)
  const [activeTerminalSessionOverride, setActiveTerminalSessionOverride] = useState<string | null>(null);

  // Reset terminal override when session changes
  const prevSessionIdRef = useRef(sessionId);
  useEffect(() => {
    if (prevSessionIdRef.current !== sessionId) {
      setActiveTerminalSessionOverride(null);
      prevSessionIdRef.current = sessionId;
    }
  }, [sessionId]);

  // Browser navigation state (user-driven, persists across tool calls)
  const [browserUrlOverride, setBrowserUrlOverride] = useState<string | undefined>();
  const [browserScreenshotOverride, setBrowserScreenshotOverride] = useState<string | undefined>();
  const [browserTitleOverride, setBrowserTitleOverride] = useState<string | undefined>();
  const [browserContentOverride, setBrowserContentOverride] = useState<string | undefined>();
  const [browserLoading, setBrowserLoading] = useState(false);

  // Lookup pinned tool from Redux
  const pinnedTool = useAppSelector((state) =>
    pinnedToolCallId ? selectToolEventById(state, pinnedToolCallId) : null
  );

  // ── Derived values ──
  const latestToolViewType = latestTool ? (TOOL_VIEW_MAP[latestTool.toolName] as CanvasViewType | undefined) : undefined;
  const pinnedViewType = pinnedTool ? (TOOL_VIEW_MAP[pinnedTool.toolName] as CanvasViewType | undefined) : undefined;
  // Manus parity: agentWorkspace.sidebarType serves as fallback when no tool has been called
  const sidebarViewType = agentWorkspaceSidebarType ? (SIDEBAR_TO_VIEW[agentWorkspaceSidebarType] as CanvasViewType | undefined) : undefined;
  // Manus parity: WebDev IDE session lock — during an active webdev session, file and terminal
  // operations should NOT switch away from the IDE view. Manus keeps the IDE throughout;
  // file operations show in the Code tab, terminal runs in the IDE's terminal panel.
  const isWebDevSession = availableViewsFromRedux.includes("webDevIDE");
  const isFileOrTerminalDuringWebdev = isWebDevSession && !pinnedTool &&
    (latestToolViewType === "editor" || latestToolViewType === "terminal");
  const effectiveViewType: CanvasViewType = pinnedViewType ?? viewOverride ??
    (isFileOrTerminalDuringWebdev ? "webDevIDE" : latestToolViewType) ?? sidebarViewType ?? "empty";

  const isActive = isStreaming && latestTool && (latestTool.state === "pending" || latestTool.state === "running");
  // Manus parity: `live` ref in ToolPanel persists until explicitly changed.
  // Show Neko live stream as long as latest tool is browser — no isStreaming check.
  // Goes false only when: non-browser tool starts or user pins a historical tool.
  // BrowserView guards on nekoUrl existence, so this is safe even after sandbox dies.
  const isBrowserToolActive = latestTool && TOOL_VIEW_MAP[latestTool.toolName] === "browser";
  // Check if the latest tool is a search tool that's still running
  const isSearchRunning = isActive && SEARCH_TOOLS.has(latestTool!.toolName);
  const latestAction = latestTool ? TOOL_ACTION_MAP[latestTool.toolName]?.(latestTool.input) : undefined;

  // Merge Redux browser state with local overrides (user navigation > agent state)
  const browserUrl = browserUrlOverride ?? latestTool?.url;
  const browserScreenshot = browserScreenshotOverride ?? latestTool?.screenshot;
  const browserTitle = browserTitleOverride ?? latestTool?.title;
  const browserContent = browserContentOverride ?? latestTool?.content;

  // Streaming editor content — progressive file_write/create during input-streaming (entity state "pending")
  const streamingEditorContent = (() => {
    if (!latestTool || latestTool.state !== "pending") return null;
    if (
      latestTool.toolName !== "file_write" &&
      latestTool.toolName !== "create_file" &&
      !(
        latestTool.toolName === "text_editor" &&
        (latestTool.input?.command === "create" || latestTool.input?.command === "insert")
      )
    )
      return null;
    return ((latestTool.input?.content ?? latestTool.input?.file_text) as string) || null;
  })();

  // ── Callbacks ──
  const onSelectView = useCallback((view: CanvasViewType) => setViewOverride(view), []);
  const onPinToolCall = useCallback((id: string) => setPinnedToolCallId(id), []);
  const onUnpin = useCallback(() => setPinnedToolCallId(undefined), []);

  const onSelectTerminalSession = useCallback((termSessionId: string) => {
    setActiveTerminalSessionOverride(termSessionId);
  }, []);

  const onTimelineChange = useCallback((percentage: number) => {
    if (allToolCallIds.length === 0) return;
    if (percentage >= 100) { setPinnedToolCallId(undefined); return; }
    const index = Math.min(Math.floor((percentage / 100) * allToolCallIds.length), allToolCallIds.length - 1);
    const toolCallId = allToolCallIds[index];
    if (toolCallId) setPinnedToolCallId(toolCallId);
  }, [allToolCallIds]);

  // Browser navigation
  const onBrowserNavigate = useCallback(async (url: string) => {
    setBrowserUrlOverride(url);
    setBrowserLoading(true);
    setBrowserScreenshotOverride(undefined);
    setBrowserContentOverride(undefined);
    try {
      if (sessionMeta.sandboxId) {
        const resp = await fetch("/api/sandbox/browser", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sandboxId: sessionMeta.sandboxId, action: "navigate", params: { url } }),
        });
        const data = await resp.json();
        if (data.screenshot) setBrowserScreenshotOverride(data.screenshot);
        if (data.url) setBrowserUrlOverride(data.url);
        if (data.title) setBrowserTitleOverride(data.title);
        if (data.content) setBrowserContentOverride(data.content);
      }
    } catch { /* Ignore — URL bar still updated */ }
    finally { setBrowserLoading(false); }
  }, [sessionMeta.sandboxId]);

  const onBrowserBack = useCallback(() => {
    const history = browserHistoryFromRedux;
    const currentIdx = history.findIndex((h) => h.url === browserUrl);
    if (currentIdx > 0) {
      const entry = history[currentIdx - 1]!;
      setBrowserUrlOverride(entry.url);
      if (entry.screenshot) setBrowserScreenshotOverride(entry.screenshot);
      if (entry.title) setBrowserTitleOverride(entry.title);
    }
  }, [browserHistoryFromRedux, browserUrl]);

  const onBrowserForward = useCallback(() => {
    const history = browserHistoryFromRedux;
    const currentIdx = history.findIndex((h) => h.url === browserUrl);
    if (currentIdx >= 0 && currentIdx < history.length - 1) {
      const entry = history[currentIdx + 1]!;
      setBrowserUrlOverride(entry.url);
      if (entry.screenshot) setBrowserScreenshotOverride(entry.screenshot);
      if (entry.title) setBrowserTitleOverride(entry.title);
    }
  }, [browserHistoryFromRedux, browserUrl]);

  const onBrowserRefresh = useCallback(async () => {
    if (!browserUrl) return;
    setBrowserLoading(true);
    try {
      if (sessionMeta.sandboxId) {
        const resp = await fetch("/api/sandbox/browser", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sandboxId: sessionMeta.sandboxId, action: "navigate", params: { url: browserUrl } }),
        });
        const data = await resp.json();
        if (data.screenshot) setBrowserScreenshotOverride(data.screenshot);
        if (data.title) setBrowserTitleOverride(data.title);
        if (data.content) setBrowserContentOverride(data.content);
      }
    } catch { /* Ignore */ }
    finally { setBrowserLoading(false); }
  }, [browserUrl, sessionMeta.sandboxId]);

  const onBrowserScreenshotUpdate = useCallback((screenshot: string, url?: string, title?: string) => {
    setBrowserScreenshotOverride(screenshot);
    if (url) setBrowserUrlOverride(url);
    if (title) setBrowserTitleOverride(title);
  }, []);

  // File selection
  const onSelectFile = useCallback((path: string) => {
    setUserSelectedPath(path);
    setClosedTabs((prev) => { if (!prev.has(path)) return prev; const next = new Set(prev); next.delete(path); return next; });
  }, []);

  const onSelectTab = useCallback((tabId: string) => {
    const openPaths = Object.keys(allFileContents).filter((p) => !closedTabs.has(p));
    const idx = Number(tabId);
    if (!Number.isNaN(idx) && openPaths[idx]) setUserSelectedPath(openPaths[idx]!);
  }, [allFileContents, closedTabs]);

  const onCloseTab = useCallback((tabId: string) => {
    const openPaths = Object.keys(allFileContents).filter((p) => !closedTabs.has(p));
    const idx = Number(tabId);
    const closedPath = openPaths[idx];
    if (!closedPath) return;
    setClosedTabs((prev) => { const next = new Set(prev); next.add(closedPath); return next; });
    setUserSelectedPath((prev) => {
      if (prev !== closedPath) return prev;
      const remaining = openPaths.filter((p) => p !== closedPath);
      return remaining.length > 0 ? remaining[remaining.length - 1]! : null;
    });
  }, [allFileContents, closedTabs]);

  // Browser history navigation
  const historyIdx = browserHistoryFromRedux.findIndex((h) => h.url === browserUrl);
  const canGoBack = historyIdx > 0;
  const canGoForward = historyIdx >= 0 && historyIdx < browserHistoryFromRedux.length - 1;

  // ── Build CanvasState ──
  if (!latestTool && !pinnedTool) {
    return {
      isVisible: false,
      viewType: "empty",
      isWorking: false,
      sandboxId: sessionMeta.sandboxId,
      nekoUrl: sessionMeta.nekoUrl,
      streamUrl: sessionMeta.streamUrl,
      availableViews: availableViewsFromRedux,
      onSelectView,
      onPinToolCall,
      onUnpin,
      onTimelineChange,
    };
  }

  const activeTool = pinnedTool ?? latestTool;

  const state: CanvasState = {
    isVisible: true,
    viewType: effectiveViewType,
    currentAction: activeTool ? TOOL_ACTION_MAP[activeTool.toolName]?.(activeTool.input) : undefined,
    isWorking: pinnedTool ? false : (isActive ?? false),
    statusText: pinnedTool
      ? `Viewing: ${TOOL_ACTION_MAP[pinnedTool.toolName]?.(pinnedTool.input)?.label ?? pinnedTool.toolName.replace(/_/g, " ")}`
      : isActive
        ? latestAction ? `Rubic is working: ${latestAction.label}` : "Rubic is working..."
        : undefined,
    currentStep: totalToolCalls,
    totalSteps: totalToolCalls,
    timelinePercentage: pinnedToolCallId
      ? (() => {
          const idx = allToolCallIds.indexOf(pinnedToolCallId);
          return idx >= 0 && allToolCallIds.length > 0 ? Math.round(((idx + 1) / allToolCallIds.length) * 100) : 100;
        })()
      : isActive ? undefined : 100,
    // Manus parity: timeline event count enriches the scrubber UI
    timelineEventCount: timelineEvents.length,
    onTimelineChange,
    // Manus parity: active tool call count for status indicator badges
    activeToolCallCount: activeToolCallIds.length,
    toolCallStats,
    sandboxId: sessionMeta.sandboxId,
    nekoUrl: sessionMeta.nekoUrl,
    streamUrl: sessionMeta.streamUrl,
    // Manus parity: auto-show Neko live stream when agent is actively browsing
    isAgentBrowsing: !pinnedTool && (isBrowserToolActive ?? false),
    pinnedToolCallId,
    onPinToolCall,
    onUnpin,
    availableViews: availableViewsFromRedux,
    onSelectView,
  };

  // Browser view data
  if (effectiveViewType === "browser" || availableViewsFromRedux.includes("browser")) {
    if (pinnedTool && TOOL_VIEW_MAP[pinnedTool.toolName] === "browser") {
      state.browserUrl = pinnedTool.url;
      state.browserScreenshot = pinnedTool.screenshot;
      state.browserContent = pinnedTool.content;
      state.browserTitle = pinnedTool.title;
      state.browserLoading = false;
      // Pinned search tool — extract results from THIS tool's output, not the global latest
      if (SEARCH_TOOLS.has(pinnedTool.toolName) && pinnedTool.state === "complete" && pinnedTool.output) {
        state.browserSearchResults = extractSearchResults(pinnedTool.output as Record<string, unknown>);
      }
    } else {
      // Use latest tool's data, falling back to the most recent completed browser
      // event with a screenshot. This prevents losing screenshots when tools chain
      // rapidly (e.g., navigate → click → view — click has no screenshot yet).
      state.browserUrl = browserUrl ?? latestBrowserScreenshot.url;
      state.browserScreenshot = browserScreenshot ?? latestBrowserScreenshot.screenshot;
      state.browserContent = browserContent ?? latestBrowserScreenshot.content;
      state.browserTitle = browserTitle ?? latestBrowserScreenshot.title;
      // Loading bar only when a browser tool is actively executing, not between tools
      state.browserLoading = ((isActive && TOOL_VIEW_MAP[latestTool!.toolName] === "browser") ?? false) || browserLoading;
      // When a new search is running, DON'T show stale results from previous search.
      // Instead show "Searching..." placeholder (loading=true + search:// URL).
      state.browserSearchResults = isSearchRunning ? undefined : searchResults;
    }
    state.canGoBack = canGoBack;
    state.canGoForward = canGoForward;
    state.onBrowserNavigate = onBrowserNavigate;
    state.onBrowserBack = onBrowserBack;
    state.onBrowserForward = onBrowserForward;
    state.onBrowserRefresh = onBrowserRefresh;
    state.onBrowserScreenshotUpdate = onBrowserScreenshotUpdate;
  }

  // Terminal view data
  if (effectiveViewType === "terminal" || availableViewsFromRedux.includes("terminal")) {
    if (pinnedTool && (pinnedTool.toolName.startsWith("shell_") || pinnedTool.toolName === "code_execute") && pinnedTool.output) {
      const cmd = (pinnedTool.input?.command as string) ?? "";
      const rawOut = typeof pinnedTool.output === "string" ? pinnedTool.output : ((pinnedTool.output.output ?? pinnedTool.output.stdout ?? JSON.stringify(pinnedTool.output, null, 2)) as string);
      const outStr = typeof rawOut === "string" ? rawOut : String(rawOut);
      state.terminalOutput = cmd ? [`$ ${cmd}`, ...outStr.split("\n")] : outStr.split("\n");
      state.activeTerminalSession = (pinnedTool.input?.id as string) || (pinnedTool.input?.session as string) || "default";
    } else {
      const effectiveActiveSession = activeTerminalSessionOverride ?? terminalData.activeSession;
      state.terminalOutput = terminalData.sessions[effectiveActiveSession] ?? [];
      state.activeTerminalSession = effectiveActiveSession;
    }
    state.terminalSessions = terminalData.sessions;
    state.terminalSessionIds = terminalData.sessionOrder;
    state.onSelectTerminalSession = onSelectTerminalSession;

    // Manus parity: show currently running command BEFORE shell_exec returns.
    // The selectTerminalSessions selector now processes "pending"/"running" events
    // and merges live terminal chunks from WebSocket. Only add "Running..." here
    // if the selector didn't already include the command (edge case: no session data yet).
    if (!pinnedTool && latestTool && isActive &&
        (latestTool.toolName.startsWith("shell_") || latestTool.toolName === "code_execute") &&
        (latestTool.state === "pending" || latestTool.state === "running")) {
      const cmd = (latestTool.input?.command as string) ?? "";
      const sessionIdForPending = (latestTool.input?.id as string) || (latestTool.input?.session as string) || "default";
      if (cmd) {
        const existingLines = state.terminalOutput ?? [];
        // Only add command if selector didn't already include it (from live chunks)
        const alreadyHasCmd = existingLines.some((l) => l === `$ ${cmd}`);
        if (!alreadyHasCmd) {
          state.terminalOutput = [...existingLines, `$ ${cmd}`, "  \u23F3 Running..."];
        }
        state.activeTerminalSession = sessionIdForPending;
      }
    }
  }

  // Editor view data (Manus FileToolView: simple filename header + read-only syntax highlighting)
  // Manus parity: prefer codeViewer domain slice data when available, fall back to websocket selectors
  if (effectiveViewType === "editor" || availableViewsFromRedux.includes("editor")) {
    const agentPath = (activeTool?.input?.path ?? activeTool?.input?.file) as string | undefined;
    // Merge codeViewer slice data with websocket-derived data (codeViewer is authoritative)
    const mergedFileContents = Object.keys(codeViewerFileDataSource).length > 0
      ? { ...allFileContents, ...codeViewerFileDataSource }
      : allFileContents;

    if (pinnedTool && TOOL_VIEW_MAP[pinnedTool.toolName] === "editor") {
      const pinnedPath = (pinnedTool.input?.path ?? pinnedTool.input?.file) as string | undefined;
      const content = typeof pinnedTool.output === "string" ? pinnedTool.output : (pinnedTool.output?.content ?? pinnedTool.input?.content) as string | undefined;
      if (content) {
        state.activeFileContent = typeof content === "string" ? content : String(content);
        state.activeFileLanguage = pinnedPath ? getLanguage(pinnedPath) : undefined;
        if (pinnedPath) state.fileTabs = [{ id: "0", name: pinnedPath.split("/").pop() || pinnedPath, path: pinnedPath, isActive: true }];
      }
    } else if (Object.keys(mergedFileContents).length > 0) {
      const allPaths = Object.keys(mergedFileContents);
      const openPaths = allPaths.filter((p) => !closedTabs.has(p));
      // Prefer user selection, then codeViewer active tab, then agent path, then latest file
      const codeViewerActivePath = codeViewerActiveTabId && mergedFileContents[codeViewerActiveTabId] ? codeViewerActiveTabId : null;
      const activePath =
        (userSelectedPath && mergedFileContents[userSelectedPath] ? userSelectedPath : null) ??
        codeViewerActivePath ??
        (agentPath && mergedFileContents[agentPath] ? agentPath : null) ??
        (openPaths.length > 0 ? openPaths[openPaths.length - 1] : allPaths[allPaths.length - 1]) ??
        null;
      if (activePath) {
        // Use streaming content when the active path matches the streaming tool's target
        state.activeFileContent = (streamingEditorContent && agentPath === activePath)
          ? streamingEditorContent : mergedFileContents[activePath];
        state.activeFileLanguage = getLanguage(activePath);
      }
      // Multi-file tabs from all open files
      state.fileTabs = openPaths.map((p, i) => ({
        id: String(i),
        name: p.split("/").pop() || p,
        path: p,
        isActive: p === activePath,
      }));
      state.allFileContents = mergedFileContents;
      state.onSelectTab = onSelectTab;
      state.onCloseTab = onCloseTab;
    } else if (streamingEditorContent) {
      // No allFileContents yet but streaming is active — show progressive content
      state.activeFileContent = streamingEditorContent;
      state.activeFileLanguage = agentPath ? getLanguage(agentPath) : undefined;
      if (agentPath) state.fileTabs = [{ id: "0", name: agentPath.split("/").pop() || agentPath, path: agentPath, isActive: true }];
    } else if (activeTool?.toolName === "file_write" && activeTool?.input?.content) {
      state.activeFileContent = activeTool.input.content as string;
      state.activeFileLanguage = agentPath ? getLanguage(agentPath) : undefined;
      if (agentPath) state.fileTabs = [{ id: "0", name: agentPath.split("/").pop() || agentPath, path: agentPath, isActive: true }];
    }
  }

  // Code view data (Manus parity: prefer codeViewer slice for tabs + directory tree)
  if (effectiveViewType === "code" || availableViewsFromRedux.includes("code")) {
    const agentPath = (activeTool?.input?.path ?? activeTool?.input?.file) as string | undefined;
    const mergedFileContents = Object.keys(codeViewerFileDataSource).length > 0
      ? { ...allFileContents, ...codeViewerFileDataSource }
      : allFileContents;

    if (Object.keys(mergedFileContents).length > 0) {
      const allPaths = Object.keys(mergedFileContents);
      const openPaths = allPaths.filter((p) => !closedTabs.has(p));
      const codeViewerActivePath = codeViewerActiveTabId && mergedFileContents[codeViewerActiveTabId] ? codeViewerActiveTabId : null;
      const activePath =
        (userSelectedPath && mergedFileContents[userSelectedPath] ? userSelectedPath : null) ??
        codeViewerActivePath ??
        (agentPath && mergedFileContents[agentPath] ? agentPath : null) ??
        (openPaths.length > 0 ? openPaths[openPaths.length - 1] : allPaths[allPaths.length - 1]) ?? null;

      if (activePath) {
        state.activeFileContent = mergedFileContents[activePath];
        state.activeFileLanguage = getLanguage(activePath);
      }
      // Prefer codeViewer directory tree if populated, else build from file paths
      state.fileTree = codeViewerDirectoryList.length > 0
        ? codeViewerDirectoryList.map((d) => ({ name: d.name, path: d.path, type: d.type, children: d.children?.map((c) => ({ name: c.name, path: c.path, type: c.type })) }))
        : buildFileTree(allPaths);
      // Prefer codeViewer tabs if populated, else derive from file paths
      if (codeViewerFileTabs.length > 0) {
        state.fileTabs = codeViewerFileTabs
          .filter((t) => !closedTabs.has(t.path))
          .map((t) => ({ id: t.id, name: t.name, path: t.path, isActive: t.id === codeViewerActiveTabId }));
      } else {
        state.fileTabs = openPaths.map((p, i) => ({ id: String(i), name: p.split("/").pop() || p, path: p, isActive: p === activePath }));
      }
      state.onSelectFile = onSelectFile;
      state.onSelectTab = onSelectTab;
      state.onCloseTab = onCloseTab;
      state.allFileContents = mergedFileContents;
    }
  }

  // WebDev IDE view data (Manus parity: codeViewer slice for file state)
  if (effectiveViewType === "webDevIDE" || availableViewsFromRedux.includes("webDevIDE")) {
    const mergedFileContents = Object.keys(codeViewerFileDataSource).length > 0
      ? { ...allFileContents, ...codeViewerFileDataSource }
      : allFileContents;

    if (Object.keys(mergedFileContents).length > 0) {
      const allPaths = Object.keys(mergedFileContents);
      const openPaths = allPaths.filter((p) => !closedTabs.has(p));
      const codeViewerActivePath = codeViewerActiveTabId && mergedFileContents[codeViewerActiveTabId] ? codeViewerActiveTabId : null;
      // When a file tool runs during webdev session (view locked), follow the agent's active file
      const agentPath = (activeTool?.input?.path ?? activeTool?.input?.file) as string | undefined;
      const activePath =
        (userSelectedPath && mergedFileContents[userSelectedPath] ? userSelectedPath : null) ??
        codeViewerActivePath ??
        (agentPath && mergedFileContents[agentPath] ? agentPath : null) ??
        (openPaths.length > 0 ? openPaths[openPaths.length - 1] : allPaths[allPaths.length - 1]) ?? null;
      if (activePath) {
        // Use streaming content when agent is actively writing a file
        state.activeFileContent = (streamingEditorContent && agentPath === activePath)
          ? streamingEditorContent : mergedFileContents[activePath];
        state.activeFileLanguage = getLanguage(activePath);
      }
      state.fileTree = codeViewerDirectoryList.length > 0
        ? codeViewerDirectoryList.map((d) => ({ name: d.name, path: d.path, type: d.type, children: d.children?.map((c) => ({ name: c.name, path: c.path, type: c.type })) }))
        : buildFileTree(allPaths);
      if (codeViewerFileTabs.length > 0) {
        state.fileTabs = codeViewerFileTabs
          .filter((t) => !closedTabs.has(t.path))
          .map((t) => ({ id: t.id, name: t.name, path: t.path, isActive: t.id === codeViewerActiveTabId }));
      } else {
        state.fileTabs = openPaths.map((p, i) => ({ id: String(i), name: p.split("/").pop() || p, path: p, isActive: p === activePath }));
      }
      state.onSelectFile = onSelectFile;
      state.onSelectTab = onSelectTab;
      state.onCloseTab = onCloseTab;
    }
    // Prefer webDev slice project previewUrl over raw tool event extraction
    state.previewUrl = webDevProject?.previewUrl ?? webdevPreviewUrl;
    state.projectPath = webDevProject?.projectPath;
    state.allFileContents = Object.keys(codeViewerFileDataSource).length > 0
      ? { ...allFileContents, ...codeViewerFileDataSource }
      : allFileContents;
  }

  // ── Domain slice data (Manus parity: aggregated feature state) ──

  // Slides — from slideEditor slice (populated by useSSEToEntities on slide_present)
  if (slideEditorSlides.length > 0 || slideEditorIsPresentationMode) {
    state.slides = slideEditorSlides.map((s) => s.thumbnail ?? "");
    state.currentSlideIndex = slideEditorCurrentIndex;
  }

  // MapReduce — from mapReduce slice (populated by useSSEToEntities from message metadata)
  if (mapReduceCurrentTask) {
    state.mapReduceTasks = [{
      id: mapReduceCurrentTask.id,
      label: mapReduceCurrentTask.name,
      status: mapReduceCurrentTask.status,
      progress: mapReduceCurrentTask.progress,
    }];
    state.mapReduceOverallProgress = mapReduceOverallProgress;
  }

  // AI Canvas — generated image from generate_image tool output
  if (aiCanvasGeneratedImage) {
    state.aiCanvasContent = aiCanvasGeneratedImage;
  }

  return state;
}
