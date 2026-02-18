"use client";

import { useState, useCallback, useRef } from "react";
import { useAppSelector } from "@/lib/store/hooks";
import {
  selectLatestCanvasToolEvent,
  selectCanvasToolCount,
  selectCanvasToolCallIds,
  selectToolEventById,
  selectAllFileContents,
  selectTerminalSessions,
  selectBrowserHistory,
  selectAvailableViews,
  selectLatestSearchResults,
  selectWebdevPreviewUrl,
  selectSessionMetadata,
  TOOL_VIEW_MAP,
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
  const latestTool = useAppSelector((state) => selectLatestCanvasToolEvent(state, sessionId));
  const totalToolCalls = useAppSelector((state) => selectCanvasToolCount(state, sessionId));
  const allToolCallIds = useAppSelector((state) => selectCanvasToolCallIds(state, sessionId));
  const allFileContents = useAppSelector((state) => selectAllFileContents(state, sessionId));
  const terminalData = useAppSelector((state) => selectTerminalSessions(state, sessionId));
  const browserHistoryFromRedux = useAppSelector((state) => selectBrowserHistory(state, sessionId));
  const availableViewsFromRedux = useAppSelector((state) => selectAvailableViews(state, sessionId));
  const searchResults = useAppSelector((state) => selectLatestSearchResults(state, sessionId));
  const webdevPreviewUrl = useAppSelector((state) => selectWebdevPreviewUrl(state, sessionId));
  const sessionMeta = useAppSelector((state) => selectSessionMetadata(state, sessionId));

  // ── Local UI state (not server data — user interactions only) ──
  const [viewOverride, setViewOverride] = useState<CanvasViewType | null>(null);
  const [pinnedToolCallId, setPinnedToolCallId] = useState<string | undefined>();
  const [userSelectedPath, setUserSelectedPath] = useState<string | null>(null);
  const [closedTabs, setClosedTabs] = useState<Set<string>>(new Set());
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
  const effectiveViewType: CanvasViewType = pinnedViewType ?? viewOverride ?? latestToolViewType ?? "empty";

  const isActive = isStreaming && latestTool && (latestTool.state === "pending" || latestTool.state === "running");
  const latestAction = latestTool ? TOOL_ACTION_MAP[latestTool.toolName]?.(latestTool.input) : undefined;

  // Merge Redux browser state with local overrides (user navigation > agent state)
  const browserUrl = browserUrlOverride ?? latestTool?.url;
  const browserScreenshot = browserScreenshotOverride ?? latestTool?.screenshot;
  const browserTitle = browserTitleOverride ?? latestTool?.title;
  const browserContent = browserContentOverride ?? latestTool?.content;

  // ── Callbacks ──
  const onSelectView = useCallback((view: CanvasViewType) => setViewOverride(view), []);
  const onPinToolCall = useCallback((id: string) => setPinnedToolCallId(id), []);
  const onUnpin = useCallback(() => setPinnedToolCallId(undefined), []);

  const onSelectTerminalSession = useCallback((_sessionId: string) => {
    // Terminal session selection is handled by the view component
    // The selector already provides the active session
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
    onTimelineChange,
    sandboxId: sessionMeta.sandboxId,
    nekoUrl: sessionMeta.nekoUrl,
    streamUrl: sessionMeta.streamUrl,
    pinnedToolCallId,
    onPinToolCall,
    onUnpin,
    availableViews: availableViewsFromRedux,
    onSelectView,
  };

  // Browser view data
  if (effectiveViewType === "browser" || availableViewsFromRedux.has("browser")) {
    if (pinnedTool && TOOL_VIEW_MAP[pinnedTool.toolName] === "browser") {
      state.browserUrl = pinnedTool.url;
      state.browserScreenshot = pinnedTool.screenshot;
      state.browserContent = pinnedTool.content;
      state.browserTitle = pinnedTool.title;
      state.browserLoading = false;
    } else {
      state.browserUrl = browserUrl;
      state.browserScreenshot = browserScreenshot;
      state.browserContent = browserContent;
      state.browserTitle = browserTitle;
      state.browserLoading = (isActive ?? false) || browserLoading;
      state.browserSearchResults = searchResults;
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
  if (effectiveViewType === "terminal" || availableViewsFromRedux.has("terminal")) {
    if (pinnedTool && (pinnedTool.toolName.startsWith("shell_") || pinnedTool.toolName === "code_execute") && pinnedTool.output) {
      const cmd = (pinnedTool.input?.command as string) ?? "";
      const rawOut = typeof pinnedTool.output === "string" ? pinnedTool.output : ((pinnedTool.output.stdout ?? JSON.stringify(pinnedTool.output, null, 2)) as string);
      const outStr = typeof rawOut === "string" ? rawOut : String(rawOut);
      state.terminalOutput = cmd ? [`$ ${cmd}`, ...outStr.split("\n")] : outStr.split("\n");
      state.activeTerminalSession = (pinnedTool.input?.id as string) || "default";
    } else {
      state.terminalOutput = terminalData.sessions[terminalData.activeSession] ?? [];
      state.activeTerminalSession = terminalData.activeSession;
    }
    state.terminalSessions = terminalData.sessions;
    state.terminalSessionIds = terminalData.sessionOrder;
    state.onSelectTerminalSession = onSelectTerminalSession;
  }

  // Editor view data (Manus FileToolView: simple filename header + read-only syntax highlighting)
  if (effectiveViewType === "editor" || availableViewsFromRedux.has("editor")) {
    const agentPath = (activeTool?.input?.path ?? activeTool?.input?.file) as string | undefined;

    if (pinnedTool && TOOL_VIEW_MAP[pinnedTool.toolName] === "editor") {
      const pinnedPath = (pinnedTool.input?.path ?? pinnedTool.input?.file) as string | undefined;
      const content = typeof pinnedTool.output === "string" ? pinnedTool.output : (pinnedTool.output?.content ?? pinnedTool.input?.content) as string | undefined;
      if (content) {
        state.activeFileContent = typeof content === "string" ? content : String(content);
        state.activeFileLanguage = pinnedPath ? getLanguage(pinnedPath) : undefined;
        if (pinnedPath) state.fileTabs = [{ id: "0", name: pinnedPath.split("/").pop() || pinnedPath, path: pinnedPath, isActive: true }];
      }
    } else if (Object.keys(allFileContents).length > 0) {
      const allPaths = Object.keys(allFileContents);
      const activePath = (agentPath && allFileContents[agentPath] ? agentPath : null) ?? allPaths[allPaths.length - 1] ?? null;
      if (activePath) {
        state.activeFileContent = allFileContents[activePath];
        state.activeFileLanguage = getLanguage(activePath);
        state.fileTabs = [{ id: "0", name: activePath.split("/").pop() || activePath, path: activePath, isActive: true }];
      }
      state.allFileContents = allFileContents;
    } else if (activeTool?.toolName === "file_write" && activeTool?.input?.content) {
      state.activeFileContent = activeTool.input.content as string;
      state.activeFileLanguage = agentPath ? getLanguage(agentPath) : undefined;
      if (agentPath) state.fileTabs = [{ id: "0", name: agentPath.split("/").pop() || agentPath, path: agentPath, isActive: true }];
    }
  }

  // Code view data
  if (effectiveViewType === "code" || availableViewsFromRedux.has("code")) {
    const agentPath = (activeTool?.input?.path ?? activeTool?.input?.file) as string | undefined;

    if (Object.keys(allFileContents).length > 0) {
      const allPaths = Object.keys(allFileContents);
      const openPaths = allPaths.filter((p) => !closedTabs.has(p));
      const activePath =
        (userSelectedPath && allFileContents[userSelectedPath] ? userSelectedPath : null) ??
        (agentPath && allFileContents[agentPath] ? agentPath : null) ??
        (openPaths.length > 0 ? openPaths[openPaths.length - 1] : allPaths[allPaths.length - 1]) ?? null;

      if (activePath) {
        state.activeFileContent = allFileContents[activePath];
        state.activeFileLanguage = getLanguage(activePath);
      }
      state.fileTree = buildFileTree(allPaths);
      state.fileTabs = openPaths.map((p, i) => ({ id: String(i), name: p.split("/").pop() || p, path: p, isActive: p === activePath }));
      state.onSelectFile = onSelectFile;
      state.onSelectTab = onSelectTab;
      state.onCloseTab = onCloseTab;
      state.allFileContents = allFileContents;
    }
  }

  // WebDev IDE view data
  if (effectiveViewType === "webDevIDE" || availableViewsFromRedux.has("webDevIDE")) {
    if (Object.keys(allFileContents).length > 0) {
      const allPaths = Object.keys(allFileContents);
      const openPaths = allPaths.filter((p) => !closedTabs.has(p));
      const activePath =
        (userSelectedPath && allFileContents[userSelectedPath] ? userSelectedPath : null) ??
        (openPaths.length > 0 ? openPaths[openPaths.length - 1] : allPaths[allPaths.length - 1]) ?? null;
      if (activePath) {
        state.activeFileContent = allFileContents[activePath];
        state.activeFileLanguage = getLanguage(activePath);
      }
      state.fileTree = buildFileTree(allPaths);
      state.fileTabs = openPaths.map((p, i) => ({ id: String(i), name: p.split("/").pop() || p, path: p, isActive: p === activePath }));
      state.onSelectFile = onSelectFile;
      state.onSelectTab = onSelectTab;
      state.onCloseTab = onCloseTab;
    }
    state.previewUrl = webdevPreviewUrl;
    state.allFileContents = allFileContents;
  }

  return state;
}
