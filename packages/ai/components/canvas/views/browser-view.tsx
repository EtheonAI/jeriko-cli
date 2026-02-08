"use client";

import * as React from "react";
import { useCallback, useRef, useState } from "react";
import {
  GlobeIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  RotateCcwIcon,
  ExternalLinkIcon,
  LoaderIcon,
  MousePointerIcon,
} from "lucide-react";
import { cn } from "@repo/design-system/lib/utils";

// ============================================================================
// Types
// ============================================================================

export interface BrowserViewProps {
  url?: string;
  screenshot?: string;
  loading?: boolean;
  content?: string;
  title?: string;
  searchResults?: Array<{ title: string; url: string; snippet: string }>;
  onNavigate?: (url: string) => void;
  onBack?: () => void;
  onForward?: () => void;
  onRefresh?: () => void;
  canGoBack?: boolean;
  canGoForward?: boolean;
  /** Active sandbox ID — enables Take Control mode */
  sandboxId?: string;
  /** Called when user control actions return a new screenshot */
  onScreenshotUpdate?: (screenshot: string, url?: string, title?: string) => void;
}

// ============================================================================
// URL Bar
// ============================================================================

function BrowserUrlBar({
  url,
  loading,
  onNavigate,
  onBack,
  onForward,
  onRefresh,
  canGoBack,
  canGoForward,
  sandboxId,
  userControlActive,
  onToggleUserControl,
}: {
  url: string;
  loading?: boolean;
  onNavigate?: (url: string) => void;
  onBack?: () => void;
  onForward?: () => void;
  onRefresh?: () => void;
  canGoBack?: boolean;
  canGoForward?: boolean;
  sandboxId?: string;
  userControlActive: boolean;
  onToggleUserControl: () => void;
}) {
  const [inputValue, setInputValue] = useState(url);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync input when url prop changes (from agent navigation)
  React.useEffect(() => {
    if (url && document.activeElement !== inputRef.current) {
      setInputValue(url);
    }
  }, [url]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    let finalUrl = inputValue.trim();
    if (!/^https?:\/\//i.test(finalUrl)) {
      finalUrl = `https://${finalUrl}`;
    }
    onNavigate?.(finalUrl);
    inputRef.current?.blur();
  };

  return (
    <div className="flex items-center gap-2 border-b border-border/10 bg-canvas-surface px-3 py-1.5">
      <div className="flex items-center gap-1">
        <button
          type="button"
          className={cn(
            "rounded p-1 transition-colors",
            canGoBack
              ? "text-muted-foreground/70 hover:bg-muted/20"
              : "pointer-events-none text-muted-foreground/20"
          )}
          onClick={onBack}
          disabled={!canGoBack}
          title="Back"
        >
          <ArrowLeftIcon className="size-3.5" />
        </button>
        <button
          type="button"
          className={cn(
            "rounded p-1 transition-colors",
            canGoForward
              ? "text-muted-foreground/70 hover:bg-muted/20"
              : "pointer-events-none text-muted-foreground/20"
          )}
          onClick={onForward}
          disabled={!canGoForward}
          title="Forward"
        >
          <ArrowRightIcon className="size-3.5" />
        </button>
        <button
          type="button"
          className="rounded p-1 text-muted-foreground/70 transition-colors hover:bg-muted/20"
          onClick={onRefresh}
          title="Refresh"
        >
          <RotateCcwIcon className={cn("size-3.5", loading && "animate-spin")} />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-1">
        <div className="flex flex-1 items-center gap-2 truncate rounded-md bg-canvas-deep px-3 py-1 font-mono text-xs text-muted-foreground">
          {loading && <LoaderIcon className="size-3 flex-shrink-0 animate-spin text-blue-400" />}
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Enter URL..."
            className="flex-1 bg-transparent outline-none placeholder:text-muted-foreground/30"
            spellCheck={false}
          />
        </div>
      </form>
      {/* Take Control button — only shown when sandbox is available */}
      {sandboxId && (
        <button
          type="button"
          className={cn(
            "rounded-md p-1.5 transition-colors",
            userControlActive
              ? "bg-blue-500/20 text-blue-400"
              : "text-muted-foreground/50 hover:bg-muted/20 hover:text-muted-foreground"
          )}
          onClick={onToggleUserControl}
          title={userControlActive ? "Release control" : "Take control"}
        >
          <MousePointerIcon className="size-3.5" />
        </button>
      )}
      <button
        type="button"
        className="rounded p-1 text-muted-foreground/70 transition-colors hover:bg-muted/20"
        onClick={() => {
          if (url) window.open(url, "_blank", "noopener,noreferrer");
        }}
        title="Open in new tab"
      >
        <ExternalLinkIcon className="size-3.5" />
      </button>
    </div>
  );
}

// ============================================================================
// Component
// ============================================================================

export function BrowserView({
  url,
  screenshot,
  loading,
  content,
  title,
  searchResults,
  onNavigate,
  onBack,
  onForward,
  onRefresh,
  canGoBack,
  canGoForward,
  sandboxId,
  onScreenshotUpdate,
}: BrowserViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [userControlActive, setUserControlActive] = useState(false);
  const [controlLoading, setControlLoading] = useState(false);

  const toggleUserControl = useCallback(() => {
    setUserControlActive((prev) => !prev);
  }, []);

  // Send a browser action to the sandbox
  const sendBrowserAction = useCallback(
    async (action: string, params: Record<string, unknown>) => {
      if (!sandboxId) return null;
      setControlLoading(true);
      try {
        const resp = await fetch("/api/sandbox/browser", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sandboxId, action, params }),
        });
        return await resp.json();
      } catch {
        return null;
      } finally {
        setControlLoading(false);
      }
    },
    [sandboxId]
  );

  // Handle clicks on the screenshot when in user control mode
  const handleScreenshotClick = useCallback(
    async (e: React.MouseEvent<HTMLImageElement>) => {
      if (!userControlActive || !sandboxId) return;

      const img = e.currentTarget;
      const rect = img.getBoundingClientRect();

      // Map click coordinates to the 1280x720 viewport
      const scaleX = 1280 / rect.width;
      const scaleY = 720 / rect.height;
      const x = Math.round((e.clientX - rect.left) * scaleX);
      const y = Math.round((e.clientY - rect.top) * scaleY);

      const result = await sendBrowserAction("click", {
        coordinate_x: x,
        coordinate_y: y,
      });

      if (result?.screenshot && onScreenshotUpdate) {
        onScreenshotUpdate(result.screenshot, result.url, result.title);
      }
    },
    [userControlActive, sandboxId, sendBrowserAction, onScreenshotUpdate]
  );

  // Handle keyboard input in user control mode
  const handleKeyDown = useCallback(
    async (e: React.KeyboardEvent) => {
      if (!userControlActive || !sandboxId) return;

      e.preventDefault();
      e.stopPropagation();

      // Map common keys
      const key =
        e.key === "Enter"
          ? "Enter"
          : e.key === "Backspace"
            ? "Backspace"
            : e.key === "Tab"
              ? "Tab"
              : e.key === "Escape"
                ? "Escape"
                : e.key === "ArrowUp"
                  ? "ArrowUp"
                  : e.key === "ArrowDown"
                    ? "ArrowDown"
                    : e.key === "ArrowLeft"
                      ? "ArrowLeft"
                      : e.key === "ArrowRight"
                        ? "ArrowRight"
                        : e.key.length === 1
                          ? e.key
                          : null;

      if (!key) return;

      let result;
      if (key.length === 1 && !e.ctrlKey && !e.metaKey) {
        // Type single character
        result = await sendBrowserAction("input", {
          text: key,
          coordinate_x: 640,
          coordinate_y: 360,
        });
      } else {
        result = await sendBrowserAction("press_key", { key });
      }

      if (result?.screenshot && onScreenshotUpdate) {
        onScreenshotUpdate(result.screenshot, result.url, result.title);
      }
    },
    [userControlActive, sandboxId, sendBrowserAction, onScreenshotUpdate]
  );

  return (
    <div className="flex h-full flex-col">
      <BrowserUrlBar
        url={url ?? ""}
        loading={loading || controlLoading}
        onNavigate={onNavigate}
        onBack={onBack}
        onForward={onForward}
        onRefresh={onRefresh}
        canGoBack={canGoBack}
        canGoForward={canGoForward}
        sandboxId={sandboxId}
        userControlActive={userControlActive}
        onToggleUserControl={toggleUserControl}
      />
      <div
        ref={containerRef}
        className={cn(
          "relative flex-1 overflow-hidden bg-canvas-deep",
          userControlActive && "cursor-crosshair"
        )}
        tabIndex={userControlActive ? 0 : undefined}
        onKeyDown={userControlActive ? handleKeyDown : undefined}
      >
        {screenshot ? (
          <img
            src={screenshot}
            alt="Browser view"
            className={cn("size-full object-contain", userControlActive && "cursor-crosshair")}
            onClick={userControlActive ? handleScreenshotClick : undefined}
            draggable={false}
          />
        ) : searchResults && searchResults.length > 0 ? (
          <div className="h-full overflow-y-auto p-4">
            {title && <h3 className="mb-3 text-sm font-medium text-foreground/80">{title}</h3>}
            <div className="space-y-3">
              {searchResults.map((result, i) => (
                <div
                  key={`${result.url}-${i}`}
                  className="rounded-lg border border-border/20 bg-background/50 p-3 transition-colors hover:bg-background/80"
                >
                  <a
                    href={result.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-blue-400 hover:underline"
                  >
                    {result.title}
                  </a>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground/50">{result.url}</p>
                  {result.snippet && (
                    <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground/70">
                      {result.snippet}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : content ? (
          <div className="h-full overflow-y-auto p-4">
            {title && <h3 className="mb-3 text-sm font-medium text-foreground/80">{title}</h3>}
            <div className="whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground/70">
              {content.slice(0, 5000)}
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground/40">
            <div className="text-center">
              {loading ? (
                <>
                  <GlobeIcon className="mx-auto mb-3 size-12 animate-pulse opacity-50" />
                  <p className="text-sm">Navigating...</p>
                </>
              ) : (
                <>
                  <GlobeIcon className="mx-auto mb-3 size-12 opacity-30" />
                  <p className="text-sm">Waiting for browser content...</p>
                </>
              )}
            </div>
          </div>
        )}
        {loading && (
          <div className="absolute inset-x-0 top-0 h-0.5 overflow-hidden bg-blue-500/10">
            <div className="browser-loading-bar h-full bg-blue-500" />
          </div>
        )}
        {/* User control indicator */}
        {userControlActive && (
          <div className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-full bg-blue-500/90 px-2.5 py-1 text-xs font-medium text-white shadow-lg">
            <MousePointerIcon className="size-3" />
            You have control
          </div>
        )}
      </div>
    </div>
  );
}
