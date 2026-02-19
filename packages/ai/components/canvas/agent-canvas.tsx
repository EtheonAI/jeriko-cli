"use client";

import * as React from "react";
import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  MonitorIcon,
  GlobeIcon,
  CodeIcon,
  TerminalIcon,
  FileTextIcon,
  PresentationIcon,
  PaintbrushIcon,
  LayoutGridIcon,
  Maximize2Icon,
  Minimize2Icon,
  XIcon,
  MousePointerIcon,
  KeyboardIcon,
  ScrollTextIcon,
  EyeIcon,
  PencilIcon,
  BookOpenIcon,
  SearchIcon,
  FileIcon,
  SkipBackIcon,
  PlayIcon,
  PauseIcon,
  SkipForwardIcon,
  ArrowLeftIcon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@repo/design-system/lib/utils";
import type { CanvasViewType, ToolAction, ToolActionType } from "./use-canvas";
import { ViewTabs } from "./view-tabs";
import { lazy, Suspense } from "react";
import type { FileNode, FileTab } from "./views/code-view";
import { EmptyView } from "./views/empty-view";
import type { CanvasStateSnapshot } from "./views/ai-canvas-view";

// Lazy-load heavy canvas views — only the active view's JS is loaded.
// EmptyView stays eager since it's the default (lightweight).
//
// Preloading: The 3 most common views (Browser, Editor, Terminal) are preloaded
// as soon as the canvas mounts. This eliminates the visible Suspense fallback
// delay when the agent first calls a browser/file/shell tool. The import()
// promise is cached by the bundler — calling it again via lazy() resolves instantly.
const browserImport = () => import("./views/browser-view");
const editorImport = () => import("./views/editor-view");
const terminalImport = () => import("./views/terminal-view");

const BrowserView = lazy(() => browserImport().then(m => ({ default: m.BrowserView })));
const CodeView = lazy(() => import("./views/code-view").then(m => ({ default: m.CodeView })));
const EditorView = lazy(() => editorImport().then(m => ({ default: m.EditorView })));
const TerminalView = lazy(() => terminalImport().then(m => ({ default: m.TerminalView })));
const FilePreviewView = lazy(() => import("./views/file-preview-view").then(m => ({ default: m.FilePreviewView })));
const SlidesView = lazy(() => import("./views/slides-view").then(m => ({ default: m.SlidesView })));
const WebDevIDEView = lazy(() => import("./views/web-dev-ide-view").then(m => ({ default: m.WebDevIDEView })));
const AICanvasView = lazy(() => import("./views/ai-canvas-view").then(m => ({ default: m.AICanvasView })));
const MapReduceView = lazy(() => import("./views/map-reduce-view").then(m => ({ default: m.MapReduceView })));

/** Preload the 3 most common canvas views (Browser, Editor, Terminal). */
let _preloaded = false;
function preloadCommonViews() {
  if (_preloaded) return;
  _preloaded = true;
  // Fire-and-forget — bundler caches the module, lazy() resolves instantly later
  browserImport().catch(() => {});
  editorImport().catch(() => {});
  terminalImport().catch(() => {});
}

// ============================================================================
// Types
// ============================================================================

export interface AgentCanvasProps {
  /** Which view to display */
  viewType: CanvasViewType;
  /** Whether in fullscreen mode */
  isFullscreen?: boolean;
  /** Toggle fullscreen */
  onToggleFullscreen?: () => void;
  /** Close the canvas */
  onClose?: () => void;
  /** Active sandbox ID for user control */
  sandboxId?: string;

  // Browser view
  browserUrl?: string;
  browserScreenshot?: string;
  browserLoading?: boolean;
  browserContent?: string;
  browserTitle?: string;
  browserSearchResults?: Array<{ title: string; url: string; snippet: string }>;
  onBrowserNavigate?: (url: string) => void;
  onBrowserBack?: () => void;
  onBrowserForward?: () => void;
  onBrowserRefresh?: () => void;
  onBrowserScreenshotUpdate?: (screenshot: string, url?: string, title?: string) => void;
  canGoBack?: boolean;
  canGoForward?: boolean;

  // Code view
  fileTree?: FileNode[];
  fileTabs?: FileTab[];
  activeFileContent?: string;
  activeFileLanguage?: string;
  onSelectFile?: (path: string) => void;
  onSelectTab?: (id: string) => void;
  onCloseTab?: (id: string) => void;

  // Preview URL (deployed sandbox app)
  previewUrl?: string;

  // All file contents (for preview rendering)
  fileContents?: Record<string, string>;

  // Terminal view
  terminalOutput?: string[];
  /** Live PTY output from WebSocket stream */
  liveTerminalOutput?: string[];
  /** Whether the live PTY stream is connected */
  liveTerminalConnected?: boolean;
  /** Send keyboard input to the live PTY */
  onTerminalSendInput?: (data: string) => void;
  /** Per-session terminal output (Manus-style named PTY sessions) */
  terminalSessions?: Record<string, string[]>;
  /** Currently active terminal session ID */
  activeTerminalSession?: string;
  /** All terminal session IDs in order */
  terminalSessionIds?: string[];
  /** Switch displayed terminal session */
  onSelectTerminalSession?: (sessionId: string) => void;

  // Live browser streaming
  /** Neko WebRTC URL for live desktop streaming */
  nekoUrl?: string;
  /** E2B stream URL (noVNC fallback for desktop streaming) */
  streamUrl?: string;
  /** Called when user control mode changes (Take Control on/off) */
  onUserControlChange?: (active: boolean) => void;
  /** Whether agent is actively executing a browser tool (auto-shows Neko live stream) */
  isAgentBrowsing?: boolean;

  // File preview
  previewFileName?: string;
  previewContent?: string;
  previewFileType?: "image" | "pdf" | "markdown" | "text" | "html";

  // Slides view
  slides?: string[];
  currentSlideIndex?: number;

  // MapReduce view (Manus parity: parallel task tracking)
  mapReduceTasks?: Array<{ id: string; label: string; status: string; progress?: number }>;
  mapReduceOverallProgress?: number;

  // AI Canvas view (Manus parity: generated image content)
  aiCanvasContent?: string;
  /** Called when AI Canvas editor state changes (for Redux sync) */
  onCanvasStateChange?: (snapshot: CanvasStateSnapshot) => void;
  /** Manus toolbar: upscale image */
  onCanvasUpscale?: (imageUrl: string) => void;
  /** Manus toolbar: remove background */
  onCanvasRemoveBg?: (imageUrl: string) => void;
  /** Called when a marking annotation rectangle is completed */
  onCanvasMarkingComplete?: (annotation: {
    imageId: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }) => void;
  /** Called when annotations change */
  onCanvasAnnotationsChange?: (annotations: any[]) => void;
  /** Called when user clicks "Edit in canvas" from screenshot overlay */
  onEditInCanvas?: (imageUrl: string) => void;

  // Timeline
  timelinePercentage?: number;
  onTimelineChange?: (percentage: number) => void;

  // Step counter
  currentStep?: number;
  totalSteps?: number;

  // View switching
  availableViews?: CanvasViewType[];
  onSelectView?: (view: CanvasViewType) => void;

  // Pinned state — historical tool state recall
  /** When set, canvas is showing a pinned historical tool, not live state */
  pinnedToolCallId?: string;
  /** Callback to return to live (latest) tool state */
  onUnpin?: () => void;

  // Common
  currentAction?: ToolAction;
  statusText?: string;
  isWorking?: boolean;
}

// ============================================================================
// Action icon map
// ============================================================================

const ACTION_ICONS: Record<ToolActionType, LucideIcon> = {
  browsing: GlobeIcon,
  clicking: MousePointerIcon,
  typing: KeyboardIcon,
  scrolling: ScrollTextIcon,
  viewing: EyeIcon,
  editing: PencilIcon,
  reading: BookOpenIcon,
  creating: FileIcon,
  searching: SearchIcon,
};

// ============================================================================
// View metadata
// ============================================================================

const VIEW_INFO: Record<
  CanvasViewType,
  { label: string; icon: LucideIcon; color: string }
> = {
  browser: { label: "Browser", icon: GlobeIcon, color: "text-blue-400" },
  editor: { label: "Editor", icon: PencilIcon, color: "text-amber-400" },
  code: { label: "Code Editor", icon: CodeIcon, color: "text-green-400" },
  terminal: {
    label: "Terminal",
    icon: TerminalIcon,
    color: "text-green-400",
  },
  filePreview: {
    label: "File Preview",
    icon: FileTextIcon,
    color: "text-orange-400",
  },
  slides: {
    label: "Slide Editor",
    icon: PresentationIcon,
    color: "text-purple-400",
  },
  aiCanvas: {
    label: "AI Canvas",
    icon: PaintbrushIcon,
    color: "text-pink-400",
  },
  webDevIDE: {
    label: "Web Dev IDE",
    icon: CodeIcon,
    color: "text-emerald-400",
  },
  mapReduce: {
    label: "Parallel Processing",
    icon: LayoutGridIcon,
    color: "text-cyan-400",
  },
  empty: { label: "Computer", icon: MonitorIcon, color: "text-muted-foreground" },
};

// ============================================================================
// Sub-components
// ============================================================================

function ActionBadge({ action }: { action: ToolAction }) {
  const Icon = ACTION_ICONS[action.type] ?? MonitorIcon;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/20 px-2.5 py-1 text-xs font-medium text-muted-foreground">
      <Icon className="size-3 text-muted-foreground/60" />
      {action.label}
    </span>
  );
}

function TimelineScrubber({
  percentage = 0,
  onChange,
}: {
  percentage?: number;
  onChange?: (percentage: number) => void;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const handleTrackInteraction = useCallback((clientX: number) => {
    if (!trackRef.current || !onChangeRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const pct = Math.round((x / rect.width) * 100);
    onChangeRef.current(pct);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      handleTrackInteraction(e.clientX);
    };
    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging, handleTrackInteraction]);

  return (
    <div className="flex items-center gap-2 border-t border-border/10 bg-canvas-surface px-3 py-1.5">
      <button
        type="button"
        className="rounded p-1 text-muted-foreground/50 transition-colors hover:bg-muted/20"
        onClick={() => onChange?.(0)}
      >
        <SkipBackIcon className="size-3.5" />
      </button>
      <button
        type="button"
        className="rounded p-1 text-muted-foreground/50 transition-colors hover:bg-muted/20"
        onClick={() => setIsPlaying(!isPlaying)}
      >
        {isPlaying ? (
          <PauseIcon className="size-3.5" />
        ) : (
          <PlayIcon className="size-3.5" />
        )}
      </button>
      <div
        ref={trackRef}
        className="group relative h-4 flex-1 cursor-pointer flex items-center"
        onMouseDown={(e) => {
          setIsDragging(true);
          handleTrackInteraction(e.clientX);
        }}
      >
        {/* Track background */}
        <div className="absolute inset-x-0 h-1 rounded-full bg-muted/20" />
        {/* Fill */}
        <div
          className={cn(
            "absolute h-1 left-0 rounded-full bg-blue-500",
            !isDragging && "transition-[width] duration-200"
          )}
          style={{ width: `${percentage}%` }}
        />
        {/* Knob — visible on hover and always visible when dragging */}
        <div
          className={cn(
            "absolute top-1/2 size-3 -translate-y-1/2 rounded-full bg-blue-500 shadow-sm",
            isDragging ? "opacity-100 scale-110" : "opacity-0 group-hover:opacity-100",
            "transition-opacity"
          )}
          style={{ left: `${percentage}%`, marginLeft: "-6px" }}
        />
      </div>
      <button
        type="button"
        className="rounded p-1 text-muted-foreground/50 transition-colors hover:bg-muted/20"
        onClick={() => onChange?.(100)}
      >
        <SkipForwardIcon className="size-3.5" />
      </button>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function AgentCanvas({
  viewType = "empty",
  isFullscreen = false,
  onToggleFullscreen,
  onClose,
  sandboxId,
  browserUrl,
  browserScreenshot,
  browserLoading,
  browserContent,
  browserTitle,
  browserSearchResults,
  onBrowserNavigate,
  onBrowserBack,
  onBrowserForward,
  onBrowserRefresh,
  onBrowserScreenshotUpdate,
  canGoBack,
  canGoForward,
  fileTree,
  fileTabs,
  activeFileContent,
  activeFileLanguage,
  onSelectFile,
  onSelectTab,
  onCloseTab,
  previewUrl,
  fileContents,
  terminalOutput,
  liveTerminalOutput,
  liveTerminalConnected,
  onTerminalSendInput,
  terminalSessions,
  activeTerminalSession,
  terminalSessionIds,
  onSelectTerminalSession,
  nekoUrl,
  streamUrl,
  onUserControlChange,
  isAgentBrowsing,
  previewFileName,
  previewContent,
  previewFileType,
  slides,
  currentSlideIndex,
  mapReduceTasks,
  mapReduceOverallProgress,
  aiCanvasContent,
  onCanvasStateChange,
  onCanvasUpscale,
  onCanvasRemoveBg,
  onCanvasMarkingComplete,
  onCanvasAnnotationsChange,
  onEditInCanvas,
  availableViews,
  onSelectView,
  pinnedToolCallId,
  onUnpin,
  timelinePercentage = 0,
  onTimelineChange,
  currentStep,
  totalSteps,
  currentAction,
  statusText,
  isWorking = false,
}: AgentCanvasProps) {
  const viewInfo = VIEW_INFO[viewType];
  const [mounted, setMounted] = useState(false);

  // Track mount state for SSR-safe portal rendering.
  // Also preload the 3 most common canvas views so there's no lazy-loading
  // delay when the agent first calls a browser/file/shell tool.
  useEffect(() => {
    setMounted(true);
    preloadCommonViews();
  }, []);

  const canvasContent = (
    <div
      data-testid="agent-canvas"
      data-view-type={viewType}
      className={cn(
        "flex flex-col overflow-hidden",
        isFullscreen
          ? "fixed inset-0 z-50 bg-background"
          : "h-full border-l border-border/30 bg-canvas-bg"
      )}
    >
      {/* ================================================================= */}
      {/* Header — hidden when webDevIDE is active (IDE has its own header) */}
      {/* ================================================================= */}
      {viewType !== "webDevIDE" && (
        <div className="flex items-center justify-between border-b border-border/20 bg-canvas-header px-4 py-3">
          <div className="flex flex-col gap-1">
            {/* Title */}
            <div className="flex items-center gap-2">
              <MonitorIcon className="size-4 text-muted-foreground/60" />
              <h2 className="text-sm font-semibold text-foreground">
                Rubic&apos;s Computer
              </h2>
            </div>

            {/* Status line */}
            <div className="flex flex-wrap items-center gap-2">
              {viewType !== "empty" && (
                <span className="text-xs text-muted-foreground/60">
                  Using{" "}
                  <span className={cn("font-medium", viewInfo.color)}>
                    {viewInfo.label}
                  </span>
                </span>
              )}
              {currentAction && <ActionBadge action={currentAction} />}
            </div>
          </div>

          {/* Header buttons */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="rounded-md p-1.5 text-muted-foreground/50 transition-colors hover:bg-muted/20"
              onClick={onToggleFullscreen}
              title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? (
                <Minimize2Icon className="size-4" />
              ) : (
                <Maximize2Icon className="size-4" />
              )}
            </button>
            {onClose && (
              <button
                type="button"
                className="rounded-md p-1.5 text-muted-foreground/50 transition-colors hover:bg-muted/20"
                onClick={onClose}
                title="Close"
              >
                <XIcon className="size-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* View Tabs — hidden when webDevIDE is active (IDE has its own tabs)*/}
      {/* ================================================================= */}
      {viewType !== "webDevIDE" && availableViews && onSelectView && (
        <ViewTabs
          availableViews={availableViews}
          activeView={viewType}
          onSelectView={onSelectView}
        />
      )}

      {/* ================================================================= */}
      {/* Pinned "Back to Live" banner                                      */}
      {/* ================================================================= */}
      {pinnedToolCallId && onUnpin && (
        <button
          type="button"
          onClick={onUnpin}
          className="flex w-full items-center gap-2 border-b border-amber-500/20 bg-amber-500/10 px-3 py-2 text-left text-xs text-amber-600 transition-colors hover:bg-amber-500/20 dark:text-amber-400"
        >
          <ArrowLeftIcon className="size-3.5" />
          <span className="font-medium">Viewing pinned tool state</span>
          <span className="ml-auto text-amber-500/60">Click to return to live</span>
        </button>
      )}

      {/* ================================================================= */}
      {/* Content                                                           */}
      {/* ================================================================= */}
      <div className="min-h-0 flex-1 overflow-hidden">
        <Suspense fallback={
          <div className="flex h-full items-center justify-center">
            <div className="size-6 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-muted-foreground/60" />
          </div>
        }>
        {viewType === "browser" && (
          <BrowserView
            url={browserUrl}
            screenshot={browserScreenshot}
            loading={browserLoading}
            content={browserContent}
            title={browserTitle}
            searchResults={browserSearchResults}
            onNavigate={onBrowserNavigate}
            onBack={onBrowserBack}
            onForward={onBrowserForward}
            onRefresh={onBrowserRefresh}
            canGoBack={canGoBack}
            canGoForward={canGoForward}
            sandboxId={sandboxId}
            onScreenshotUpdate={onBrowserScreenshotUpdate}
            nekoUrl={nekoUrl}
            streamUrl={streamUrl}
            onUserControlChange={onUserControlChange}
            isAgentBrowsing={isAgentBrowsing}
            onEditInCanvas={onEditInCanvas}
          />
        )}
        {viewType === "editor" && (
          <EditorView
            filePath={fileTabs?.find((t) => t.isActive)?.path}
            content={activeFileContent}
            language={activeFileLanguage}
          />
        )}
        {viewType === "code" && (
          <CodeView
            fileTree={fileTree}
            fileTabs={fileTabs}
            activeFileContent={activeFileContent}
            activeFileLanguage={activeFileLanguage}
            onSelectFile={onSelectFile}
            onSelectTab={onSelectTab}
            onCloseTab={onCloseTab}
          />
        )}
        {viewType === "terminal" && (
          <TerminalView
            output={terminalOutput}
            liveOutput={liveTerminalOutput}
            liveConnected={liveTerminalConnected}
            onSendInput={onTerminalSendInput}
            sessions={terminalSessions}
            activeSession={activeTerminalSession}
            sessionIds={terminalSessionIds}
            onSelectSession={onSelectTerminalSession}
          />
        )}
        {viewType === "filePreview" && (
          <FilePreviewView
            fileName={previewFileName}
            content={previewContent}
            fileType={previewFileType}
          />
        )}
        {viewType === "slides" && (
          <SlidesView
            slides={slides}
            currentIndex={currentSlideIndex}
          />
        )}
        {viewType === "aiCanvas" && (
          <AICanvasView
            content={aiCanvasContent}
            onStateChange={onCanvasStateChange}
            onUpscale={onCanvasUpscale}
            onRemoveBg={onCanvasRemoveBg}
            onMarkingComplete={onCanvasMarkingComplete}
            onAnnotationsChange={onCanvasAnnotationsChange}
          />
        )}
        {viewType === "webDevIDE" && (
          <WebDevIDEView
            fileTree={fileTree}
            fileTabs={fileTabs}
            activeFileContent={activeFileContent}
            activeFileLanguage={activeFileLanguage}
            onSelectFile={onSelectFile}
            onSelectTab={onSelectTab}
            onCloseTab={onCloseTab}
            previewUrl={previewUrl}
            fileContents={fileContents}
            sandboxId={sandboxId}
            isWorking={isWorking}
            isStreaming={isWorking}
            onClose={onClose}
          />
        )}
        {viewType === "mapReduce" && <MapReduceView tasks={mapReduceTasks} overallProgress={mapReduceOverallProgress} />}
        {viewType === "empty" && <EmptyView />}
        </Suspense>
      </div>

      {/* ================================================================= */}
      {/* Timeline Scrubber — hidden for webDevIDE                          */}
      {/* ================================================================= */}
      {viewType !== "webDevIDE" && (
        <TimelineScrubber
          percentage={timelinePercentage}
          onChange={onTimelineChange}
        />
      )}

      {/* ================================================================= */}
      {/* Status Bar — hidden for webDevIDE (IDE has its own loading state) */}
      {/* ================================================================= */}
      {viewType !== "webDevIDE" && (isWorking || statusText) && (
        <div className="flex items-center gap-2 border-t border-border/20 bg-canvas-deep px-3 py-2">
          {isWorking && (
            <div className="size-2 animate-pulse rounded-full bg-blue-500" />
          )}
          <span className="flex-1 truncate text-xs text-muted-foreground/60">
            {statusText || "Rubic is working..."}
          </span>
          {currentStep != null && totalSteps != null && (
            <span className="flex-shrink-0 font-mono text-xs text-muted-foreground/40">
              {currentStep}:{String(totalSteps).padStart(2, "0")}
            </span>
          )}
          {currentAction && (
            <span className="text-xs text-muted-foreground/40">
              {currentAction.label}
            </span>
          )}
        </div>
      )}
    </div>
  );

  // Use portal for fullscreen to escape parent clipping
  if (isFullscreen && mounted) {
    return createPortal(canvasContent, document.body);
  }

  return canvasContent;
}
