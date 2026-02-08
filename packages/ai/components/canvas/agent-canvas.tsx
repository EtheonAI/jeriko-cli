"use client";

import * as React from "react";
import { useState, useEffect, useRef } from "react";
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
import { BrowserView } from "./views/browser-view";
import { CodeView, type FileNode, type FileTab } from "./views/code-view";
import { TerminalView } from "./views/terminal-view";
import { FilePreviewView } from "./views/file-preview-view";
import { EmptyView } from "./views/empty-view";
import { SlidesView } from "./views/slides-view";
import { WebDevIDEView } from "./views/web-dev-ide-view";
import { AICanvasView } from "./views/ai-canvas-view";
import { MapReduceView } from "./views/map-reduce-view";

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

  // File preview
  previewFileName?: string;
  previewContent?: string;
  previewFileType?: "image" | "pdf" | "markdown" | "text" | "html";

  // Slides view
  slides?: string[];
  currentSlideIndex?: number;

  // Timeline
  timelinePercentage?: number;
  onTimelineChange?: (percentage: number) => void;

  // Step counter
  currentStep?: number;
  totalSteps?: number;

  // View switching
  availableViews?: Set<CanvasViewType>;
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
  const trackRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  const handleTrackInteraction = (clientX: number) => {
    if (!trackRef.current || !onChange) return;
    const rect = trackRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const pct = Math.round((x / rect.width) * 100);
    onChange(pct);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingRef.current) handleTrackInteraction(e.clientX);
    };
    const handleMouseUp = () => {
      isDraggingRef.current = false;
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  });

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
        className="group relative h-1 flex-1 cursor-pointer rounded-full bg-muted/20"
        onMouseDown={(e) => {
          isDraggingRef.current = true;
          handleTrackInteraction(e.clientX);
        }}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-blue-500 transition-all"
          style={{ width: `${percentage}%` }}
        />
        <div
          className="absolute top-1/2 size-3 -translate-y-1/2 rounded-full bg-blue-500 opacity-0 transition-opacity group-hover:opacity-100"
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
  previewFileName,
  previewContent,
  previewFileType,
  slides,
  currentSlideIndex,
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

  // Track mount state for SSR-safe portal rendering
  useEffect(() => {
    setMounted(true);
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
      {/* Header                                                            */}
      {/* ================================================================= */}
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

      {/* ================================================================= */}
      {/* View Tabs                                                         */}
      {/* ================================================================= */}
      {availableViews && onSelectView && (
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
        {viewType === "terminal" && <TerminalView output={terminalOutput} />}
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
        {viewType === "aiCanvas" && <AICanvasView />}
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
          />
        )}
        {viewType === "mapReduce" && <MapReduceView />}
        {viewType === "empty" && <EmptyView />}
      </div>

      {/* ================================================================= */}
      {/* Timeline Scrubber                                                 */}
      {/* ================================================================= */}
      <TimelineScrubber
        percentage={timelinePercentage}
        onChange={onTimelineChange}
      />

      {/* ================================================================= */}
      {/* Status Bar                                                        */}
      {/* ================================================================= */}
      {(isWorking || statusText) && (
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
