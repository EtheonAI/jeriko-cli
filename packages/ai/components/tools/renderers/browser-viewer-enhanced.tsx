"use client";

/**
 * Enhanced Browser Viewer - Screenshot display with zoom/fullscreen
 *
 * Features:
 * - Interactive screenshot with zoom/pan
 * - Fullscreen modal view
 * - Click/action overlays
 * - URL bar with navigation history
 * - Loading states with progress
 * - Console output display
 */

import * as React from "react";
import { useState, useRef, useCallback, useMemo } from "react";
import { cn } from "@repo/design-system/lib/utils";
import {
  ExternalLinkIcon,
  GlobeIcon,
  ImageIcon,
  ZoomInIcon,
  ZoomOutIcon,
  MaximizeIcon,
  XIcon,
  RefreshCwIcon,
  MousePointerClickIcon,
  KeyboardIcon,
  ScrollIcon,
  AlertCircleIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  TerminalIcon,
} from "lucide-react";
import type { ToolRendererProps } from "../tool-registry";

// ============================================================================
// Types
// ============================================================================

interface BrowserInput {
  url?: string;
  action?: string;
  selector?: string;
  text?: string;
  direction?: "up" | "down";
  amount?: number;
  key?: string;
  coordinate?: [number, number];
}

interface BrowserOutput {
  url?: string;
  title?: string;
  content?: string;
  screenshot?: string; // base64
  error?: string;
  console_output?: string[];
  network_requests?: number;
  page_loaded?: boolean;
  action_result?: string;
  elements_found?: number;
}

// ============================================================================
// Zoom & Pan Hook
// ============================================================================

function useImageZoom(initialScale = 1, minScale = 0.5, maxScale = 4) {
  const [scale, setScale] = useState(initialScale);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const lastPosition = useRef({ x: 0, y: 0 });

  const zoomIn = useCallback(() => {
    setScale((s) => Math.min(s * 1.25, maxScale));
  }, [maxScale]);

  const zoomOut = useCallback(() => {
    setScale((s) => Math.max(s / 1.25, minScale));
  }, [minScale]);

  const resetZoom = useCallback(() => {
    setScale(initialScale);
    setPosition({ x: 0, y: 0 });
  }, [initialScale]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsDragging(true);
      lastPosition.current = { x: e.clientX, y: e.clientY };
    }
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isDragging) {
        const dx = e.clientX - lastPosition.current.x;
        const dy = e.clientY - lastPosition.current.y;
        setPosition((p) => ({ x: p.x + dx, y: p.y + dy }));
        lastPosition.current = { x: e.clientX, y: e.clientY };
      }
    },
    [isDragging]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setScale((s) => Math.min(Math.max(s * delta, minScale), maxScale));
    },
    [minScale, maxScale]
  );

  return {
    scale,
    position,
    isDragging,
    zoomIn,
    zoomOut,
    resetZoom,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleWheel,
  };
}

// ============================================================================
// Action Icon Component
// ============================================================================

function ActionIcon({ action }: { action?: string }) {
  switch (action) {
    case "click":
      return <MousePointerClickIcon className="size-3.5" />;
    case "input":
    case "type":
      return <KeyboardIcon className="size-3.5" />;
    case "scroll":
      return <ScrollIcon className="size-3.5" />;
    case "navigate":
      return <GlobeIcon className="size-3.5" />;
    default:
      return <ImageIcon className="size-3.5" />;
  }
}

// ============================================================================
// Fullscreen Modal
// ============================================================================

function FullscreenModal({
  isOpen,
  onClose,
  screenshot,
  url,
  title,
}: {
  isOpen: boolean;
  onClose: () => void;
  screenshot: string;
  url?: string;
  title?: string;
}) {
  const {
    scale,
    position,
    zoomIn,
    zoomOut,
    resetZoom,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleWheel,
  } = useImageZoom(1, 0.25, 6);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center gap-2 text-white/80">
          <GlobeIcon className="size-4" />
          <span className="text-sm truncate max-w-md">{title || url || "Browser Screenshot"}</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={zoomOut}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white"
          >
            <ZoomOutIcon className="size-4" />
          </button>
          <span className="text-sm text-white/60 min-w-[4ch] text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={zoomIn}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white"
          >
            <ZoomInIcon className="size-4" />
          </button>
          <button
            onClick={resetZoom}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white"
          >
            <RefreshCwIcon className="size-4" />
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white ml-2"
          >
            <XIcon className="size-4" />
          </button>
        </div>
      </div>

      {/* Image container */}
      <div
        className="w-full h-full overflow-hidden cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <img
          src={`data:image/png;base64,${screenshot}`}
          alt="Browser screenshot fullscreen"
          className="max-w-none select-none"
          style={{
            transform: `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px)) scale(${scale})`,
            position: "absolute",
            top: "50%",
            left: "50%",
          }}
          draggable={false}
        />
      </div>

      {/* Keyboard hints */}
      <div className="absolute bottom-4 left-4 text-xs text-white/40">
        Scroll to zoom • Drag to pan • ESC to close
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function BrowserViewerEnhanced({
  toolName,
  toolCallId,
  state,
  input,
  output,
  errorText,
}: ToolRendererProps<BrowserInput, BrowserOutput>) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showConsole, setShowConsole] = useState(false);

  const typedInput = input as BrowserInput | undefined;
  const typedOutput = output as BrowserOutput | undefined;

  const url = typedOutput?.url ?? typedInput?.url;
  const screenshot = typedOutput?.screenshot;
  const error = typedOutput?.error ?? errorText;
  const consoleOutput = typedOutput?.console_output ?? [];
  const title = typedOutput?.title;
  const actionResult = typedOutput?.action_result;

  // Derive action from tool name
  const action = useMemo(() => {
    if (toolName.includes("click")) return "click";
    if (toolName.includes("input") || toolName.includes("type")) return "input";
    if (toolName.includes("scroll")) return "scroll";
    if (toolName.includes("navigate") || toolName.includes("view")) return "navigate";
    return typedInput?.action ?? "screenshot";
  }, [toolName, typedInput?.action]);

  const isLoading = state === "input-streaming" || state === "input-available";
  const hasError = state === "output-error" || !!error;
  const isComplete = state === "output-available" && !error;

  // Escape key to close fullscreen
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isFullscreen]);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border",
        hasError ? "border-red-500/30" : "border-border"
      )}
    >
      {/* Browser chrome header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-b">
        {/* Traffic lights */}
        <div className="flex items-center gap-1.5">
          <div className="size-2.5 rounded-full bg-red-500" />
          <div className="size-2.5 rounded-full bg-yellow-500" />
          <div className="size-2.5 rounded-full bg-green-500" />
        </div>

        {/* URL bar */}
        <div className="flex-1 flex items-center gap-2 px-3 py-1 rounded-lg bg-background border text-sm">
          {isLoading ? (
            <div className="size-3 border-2 border-muted-foreground/30 border-t-primary rounded-full spinner" />
          ) : (
            <ActionIcon action={action} />
          )}
          <span className="truncate text-muted-foreground">
            {url ??
              (action === "click" ? `Clicking ${typedInput?.selector ?? "element"}` : "Browser")}
          </span>
          {isComplete && <CheckIcon className="size-3.5 text-green-500 ml-auto" />}
        </div>

        {/* Actions */}
        {screenshot && (
          <>
            <button
              onClick={() => setIsFullscreen(true)}
              className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
              title="Fullscreen"
            >
              <MaximizeIcon className="size-4" />
            </button>
            {url && (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
                title="Open URL"
              >
                <ExternalLinkIcon className="size-4" />
              </a>
            )}
          </>
        )}
      </div>

      {/* Content */}
      {isLoading && (
        <div className="p-8 flex flex-col items-center justify-center gap-3 text-muted-foreground">
          <div className="size-8 border-2 border-muted-foreground/30 border-t-primary rounded-full spinner" />
          <span className="text-sm">
            {action === "click"
              ? "Clicking element..."
              : action === "input"
                ? "Typing text..."
                : action === "scroll"
                  ? "Scrolling page..."
                  : "Loading page..."}
          </span>
        </div>
      )}

      {hasError && (
        <div className="p-4 flex items-start gap-2 text-red-500 bg-red-500/5">
          <AlertCircleIcon className="size-4 mt-0.5 flex-shrink-0" />
          <div className="text-sm">
            <p className="font-medium">Browser action failed</p>
            <p className="text-red-400/80 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Screenshot */}
      {screenshot && !isLoading && (
        <div className="relative">
          <img
            src={`data:image/png;base64,${screenshot}`}
            alt="Browser screenshot"
            className="w-full cursor-pointer"
            onClick={() => setIsFullscreen(true)}
          />

          {/* Action result overlay */}
          {actionResult && (
            <div className="absolute bottom-3 left-3 right-3 px-3 py-2 rounded-lg bg-black/80 text-white text-xs backdrop-blur-sm">
              {actionResult}
            </div>
          )}
        </div>
      )}

      {/* Title (when no screenshot) */}
      {!screenshot && title && !isLoading && !hasError && (
        <div className="p-3">
          <h4 className="text-sm font-medium">{title}</h4>
          {typedOutput?.content && (
            <p className="mt-2 text-xs text-muted-foreground line-clamp-4">{typedOutput.content}</p>
          )}
        </div>
      )}

      {/* Console output */}
      {consoleOutput.length > 0 && (
        <div className="border-t">
          <button
            onClick={() => setShowConsole(!showConsole)}
            className="w-full flex items-center justify-between px-3 py-2 text-xs text-muted-foreground hover:bg-muted/30"
          >
            <div className="flex items-center gap-2">
              <TerminalIcon className="size-3.5" />
              <span>Console ({consoleOutput.length})</span>
            </div>
            {showConsole ? (
              <ChevronUpIcon className="size-3.5" />
            ) : (
              <ChevronDownIcon className="size-3.5" />
            )}
          </button>

          {showConsole && (
            <div className="px-3 py-2 bg-zinc-900 text-xs font-mono max-h-32 overflow-y-auto">
              {consoleOutput.map((line, i) => (
                <div key={i} className="text-zinc-400">
                  {line}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Stats footer */}
      {typedOutput?.network_requests !== undefined && (
        <div className="px-3 py-2 border-t bg-muted/30 flex items-center gap-4 text-xs text-muted-foreground">
          <span>{typedOutput.network_requests} requests</span>
          {typedOutput.elements_found !== undefined && (
            <span>{typedOutput.elements_found} elements</span>
          )}
        </div>
      )}

      {/* Fullscreen modal */}
      {screenshot && (
        <FullscreenModal
          isOpen={isFullscreen}
          onClose={() => setIsFullscreen(false)}
          screenshot={screenshot}
          url={url}
          title={title}
        />
      )}
    </div>
  );
}

export default BrowserViewerEnhanced;
