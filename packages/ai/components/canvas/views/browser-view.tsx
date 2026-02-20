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
  MonitorIcon,
  SearchIcon,
  XIcon,
} from "lucide-react";
import { cn } from "@repo/design-system/lib/utils";
import { ScreenshotOverlay } from "./screenshot-overlay";

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
  /** Active sandbox ID — enables Take Control mode and live streaming */
  sandboxId?: string;
  /** Called when user control actions return a new screenshot */
  onScreenshotUpdate?: (screenshot: string, url?: string, title?: string) => void;
  /** Neko WebRTC URL — primary live desktop stream (port 8333 inside sandbox) */
  nekoUrl?: string;
  /** E2B stream URL — fallback live desktop stream (noVNC) */
  streamUrl?: string;
  /** Called when user control mode changes (Take Control on/off) — used to pause prompt */
  onUserControlChange?: (active: boolean) => void;
  /** Whether the agent is actively working on a browser tool (auto-shows Neko live stream) */
  isAgentBrowsing?: boolean;
  /** Called when user clicks "Edit in canvas" on a screenshot overlay */
  onEditInCanvas?: (imageUrl: string) => void;
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
  isLiveStream,
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
  isLiveStream: boolean;
}) {
  const [inputValue, setInputValue] = useState(url);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync input when url prop changes (from agent navigation)
  // Display search queries nicely (search://query → "Searching: query")
  React.useEffect(() => {
    if (url && document.activeElement !== inputRef.current) {
      setInputValue(url.startsWith("search://") ? `Searching: ${url.slice(9)}` : url);
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
      {/* Navigation buttons — disabled during live stream (Neko handles navigation) */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          className={cn(
            "rounded p-1 transition-colors",
            !isLiveStream && canGoBack
              ? "text-muted-foreground/70 hover:bg-muted/20"
              : "pointer-events-none text-muted-foreground/20"
          )}
          onClick={onBack}
          disabled={isLiveStream || !canGoBack}
          title="Back"
        >
          <ArrowLeftIcon className="size-3.5" />
        </button>
        <button
          type="button"
          className={cn(
            "rounded p-1 transition-colors",
            !isLiveStream && canGoForward
              ? "text-muted-foreground/70 hover:bg-muted/20"
              : "pointer-events-none text-muted-foreground/20"
          )}
          onClick={onForward}
          disabled={isLiveStream || !canGoForward}
          title="Forward"
        >
          <ArrowRightIcon className="size-3.5" />
        </button>
        <button
          type="button"
          className={cn(
            "rounded p-1 transition-colors",
            isLiveStream
              ? "pointer-events-none text-muted-foreground/20"
              : "text-muted-foreground/70 hover:bg-muted/20"
          )}
          onClick={onRefresh}
          disabled={isLiveStream}
          title="Refresh"
        >
          <RotateCcwIcon className={cn("size-3.5", loading && !isLiveStream && "animate-spin")} />
        </button>
      </div>
      {/* URL bar — read-only during live stream (Manus pattern: <span> not <input>) */}
      <form onSubmit={handleSubmit} className="flex flex-1">
        <div className="flex flex-1 items-center gap-2 truncate rounded-md bg-canvas-deep px-3 py-1 font-mono text-xs text-muted-foreground">
          {loading && !isLiveStream && (
            url?.startsWith("search://") ? (
              <SearchIcon className="size-3 flex-shrink-0 animate-pulse text-blue-400" />
            ) : (
              <LoaderIcon className="size-3 flex-shrink-0 animate-spin text-blue-400" />
            )
          )}
          {isLiveStream ? (
            <span className="flex-1 truncate text-muted-foreground/50">
              {inputValue || "Live desktop — use the browser directly"}
            </span>
          ) : (
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Enter URL..."
              className="flex-1 bg-transparent outline-none placeholder:text-muted-foreground/30"
              spellCheck={false}
            />
          )}
        </div>
      </form>
      {/* Take Control button — shown when sandbox is available.
          Toggles between screenshot-based control and Neko WebRTC live stream. */}
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
        className={cn(
          "rounded p-1 transition-colors",
          isLiveStream
            ? "pointer-events-none text-muted-foreground/20"
            : "text-muted-foreground/70 hover:bg-muted/20"
        )}
        onClick={() => {
          if (url && !isLiveStream) window.open(url, "_blank", "noopener,noreferrer");
        }}
        disabled={isLiveStream}
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
  nekoUrl,
  streamUrl,
  onUserControlChange,
  isAgentBrowsing,
  onEditInCanvas,
}: BrowserViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [userControlActive, setUserControlActive] = useState(false);
  const [controlLoading, setControlLoading] = useState(false);
  const [overlayImage, setOverlayImage] = useState<string | null>(null);

  // Live stream URL — Neko WebRTC (primary) or E2B noVNC stream (fallback)
  const liveStreamUrl = nekoUrl || streamUrl || null;
  // Manus pattern: Neko iframe is always rendered as a BACKGROUND layer when available.
  // Screenshots overlay on top during agent browsing. Live stream shows through when
  // no screenshot is available or user clicks "Take Control".
  const hasLiveStream = !!liveStreamUrl;
  // Show ONLY the live stream (no screenshot overlay) in two cases:
  // 1. User explicitly clicked "Take Control" (interactive mode)
  // 2. Agent is actively browsing AND no screenshot available yet
  const isLiveStreamMode = (userControlActive || (!!isAgentBrowsing && !screenshot)) && hasLiveStream;
  // User has interactive control (can click/type in browser) — only via Take Control button
  const isInteractiveMode = userControlActive && hasLiveStream;

  const toggleUserControl = useCallback(() => {
    setUserControlActive((prev) => {
      const next = !prev;
      // Defer parent callback to avoid setState-during-render error
      queueMicrotask(() => onUserControlChange?.(next));
      return next;
    });
  }, [onUserControlChange]);

  // Deactivate Take Control — shared helper to keep state + parent callback in sync
  const deactivateUserControl = useCallback(() => {
    setUserControlActive(false);
    onUserControlChange?.(false);
  }, [onUserControlChange]);

  // Deactivate Take Control on outside click
  React.useEffect(() => {
    if (!userControlActive) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        deactivateUserControl();
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [userControlActive, deactivateUserControl]);

  // Send a browser action to the sandbox (for screenshot-based Take Control)
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

  // Handle clicks on the screenshot when in user control mode (non-VNC fallback)
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
        x,
        y,
        button: "left",
      });

      if (result?.screenshot && onScreenshotUpdate) {
        onScreenshotUpdate(result.screenshot, result.url, result.title);
      }
    },
    [userControlActive, sandboxId, sendBrowserAction, onScreenshotUpdate]
  );

  // Handle keyboard input in user control mode (non-VNC fallback)
  const handleKeyDown = useCallback(
    async (e: React.KeyboardEvent) => {
      if (!userControlActive || !sandboxId) return;

      // Escape deactivates Take Control mode
      if (e.key === "Escape") {
        e.preventDefault();
        deactivateUserControl();
        return;
      }

      // Map common keys
      const key = e.key === "Enter" ? "Enter"
        : e.key === "Backspace" ? "Backspace"
        : e.key === "Tab" ? "Tab"
        : e.key === "ArrowUp" ? "ArrowUp"
        : e.key === "ArrowDown" ? "ArrowDown"
        : e.key === "ArrowLeft" ? "ArrowLeft"
        : e.key === "ArrowRight" ? "ArrowRight"
        : e.key.length === 1 ? e.key
        : null;

      if (!key) return;
      e.preventDefault();
      e.stopPropagation();

      let result;
      if (key.length === 1 && !e.ctrlKey && !e.metaKey) {
        result = await sendBrowserAction("type", {
          text: key,
        });
      } else {
        result = await sendBrowserAction("key", { key });
      }

      if (result?.screenshot && onScreenshotUpdate) {
        onScreenshotUpdate(result.screenshot, result.url, result.title);
      }
    },
    [userControlActive, sandboxId, sendBrowserAction, onScreenshotUpdate, deactivateUserControl]
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
        isLiveStream={isLiveStreamMode}
      />
      <div
        ref={containerRef}
        className={cn(
          "relative flex-1 overflow-hidden bg-canvas-deep",
          isInteractiveMode && !isLiveStreamMode && "cursor-crosshair"
        )}
        tabIndex={isInteractiveMode && !isLiveStreamMode ? 0 : undefined}
        onKeyDown={isInteractiveMode && !isLiveStreamMode ? handleKeyDown : undefined}
      >
        {/* Layer 1 (background): Neko live desktop stream — always rendered when URL available.
            Manus pattern: live stream persists behind screenshots so transitions are seamless.
            When agent is browsing, user sees live desktop. Screenshots overlay on top. */}
        {hasLiveStream && (
          <iframe
            key="neko-live-stream"
            src={liveStreamUrl!}
            title="Rubic Virtual Computer — Live Desktop"
            className={cn(
              "absolute inset-0 size-full border-0",
              // Hide behind screenshot/search overlay unless in live stream mode
              !isLiveStreamMode && "z-0",
              isLiveStreamMode && "z-10",
              // Read-only during agent browsing — block mouse/keyboard to iframe
              !isInteractiveMode && "pointer-events-none"
            )}
            allow="clipboard-read; clipboard-write; autoplay; microphone; camera; display-capture"
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals allow-downloads"
            referrerPolicy="no-referrer"
          />
        )}
        {/* Layer 2: Content overlays (search results, screenshots, empty state) */}
        {isLiveStreamMode ? null : searchResults ? (
          /* Priority 2: Search results — always shown above screenshot so E2B polling
             doesn't hide search results with stale screenshots */
          <div className="h-full overflow-y-auto p-4">
            {searchResults.length > 0 ? (
              <>
                {title && (
                  <h3 className="mb-3 text-sm font-medium text-foreground/80">{title}</h3>
                )}
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
                      <p className="mt-0.5 truncate text-xs text-muted-foreground/50">
                        {result.url}
                      </p>
                      {result.snippet && (
                        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground/70">
                          {result.snippet}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex h-full flex-col items-center justify-center text-muted-foreground/50">
                <SearchIcon className="mb-3 size-10 opacity-40" />
                <p className="text-sm">No results found</p>
                {url?.startsWith("search://") && (
                  <p className="mt-1 text-xs text-muted-foreground/30">
                    &ldquo;{url.slice(9)}&rdquo;
                  </p>
                )}
              </div>
            )}
          </div>
        ) : screenshot ? (
          /* Priority 3: Screenshot (from agent tool results or polling) */
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={screenshot}
            alt="Browser view"
            className={cn(
              "size-full object-contain",
              isInteractiveMode ? "cursor-crosshair" : "cursor-pointer"
            )}
            onClick={
              isInteractiveMode
                ? handleScreenshotClick
                : () => setOverlayImage(screenshot)
            }
            draggable={false}
          />
        ) : content ? (
          /* Priority 4: Page content text */
          <div className="h-full overflow-y-auto p-4">
            {title && (
              <h3 className="mb-3 text-sm font-medium text-foreground/80">{title}</h3>
            )}
            <div className="whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground/70">
              {content.slice(0, 5000)}
            </div>
          </div>
        ) : (
          /* Priority 5: Placeholder */
          <div className="flex h-full items-center justify-center text-muted-foreground/40">
            <div className="text-center">
              {loading && url?.startsWith("search://") ? (
                <>
                  <SearchIcon className="mx-auto mb-3 size-12 animate-pulse opacity-50" />
                  <p className="text-sm">Searching the web...</p>
                  <p className="mt-1 text-xs text-muted-foreground/30">
                    {url.slice("search://".length)}
                  </p>
                </>
              ) : loading ? (
                <>
                  <GlobeIcon className="mx-auto mb-3 size-12 animate-pulse opacity-50" />
                  <p className="text-sm">Navigating...</p>
                </>
              ) : sandboxId ? (
                <>
                  <MonitorIcon className="mx-auto mb-3 size-12 animate-pulse opacity-50" />
                  <p className="text-sm">Preparing desktop stream...</p>
                  <p className="mt-1 text-xs text-muted-foreground/30">
                    Connecting to virtual computer
                  </p>
                </>
              ) : (
                <>
                  <MonitorIcon className="mx-auto mb-3 size-12 opacity-30" />
                  <p className="text-sm">Desktop will appear when the agent starts browsing</p>
                </>
              )}
            </div>
          </div>
        )}
        {/* Activity overlay on screenshot when browser tool is executing without Neko */}
        {loading && !isLiveStreamMode && screenshot && !searchResults && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/5">
            <div className="rounded-full bg-black/40 px-3 py-1.5 text-xs text-white backdrop-blur-sm">
              <LoaderIcon className="mr-1.5 inline size-3 animate-spin" />
              Working...
            </div>
          </div>
        )}
        {loading && !isLiveStreamMode && (
          <div className="absolute inset-x-0 top-0 h-0.5 overflow-hidden bg-blue-500/10">
            <div className="browser-loading-bar h-full bg-blue-500" />
          </div>
        )}
        {/* User control indicator — screenshot-based Take Control (non-VNC mode) */}
        {isInteractiveMode && !isLiveStreamMode && (
          <div className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-full bg-blue-500/90 px-2.5 py-1 text-xs font-medium text-white shadow-lg">
            <MousePointerIcon className="size-3" />
            You have control
          </div>
        )}
        {/* Interactive control indicator — shown over live Neko stream with Exit button */}
        {isInteractiveMode && isLiveStreamMode && (
          <div className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-full bg-blue-500/90 px-2.5 py-1 text-xs font-medium text-white shadow-lg">
            <MousePointerIcon className="size-3" />
            <span>You have control</span>
            <button
              type="button"
              className="ml-1 flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-medium transition-colors hover:bg-white/30"
              onClick={(e) => {
                e.stopPropagation();
                deactivateUserControl();
              }}
            >
              <XIcon className="size-2.5" />
              Exit &amp; Resume
            </button>
          </div>
        )}
        {/* Live indicator badge */}
        {isLiveStreamMode && (
          <div className="absolute bottom-2 right-2 flex items-center gap-1.5 rounded-full bg-green-500/80 px-2 py-0.5 text-[10px] font-medium text-white shadow-lg">
            <div className="size-1.5 animate-pulse rounded-full bg-white" />
            {isInteractiveMode ? "TAKE CONTROL" : isAgentBrowsing ? "AGENT BROWSING" : "LIVE DESKTOP"}
          </div>
        )}
      </div>

      {/* Screenshot overlay — shown when user clicks a screenshot (non-control mode) */}
      {overlayImage && (
        <ScreenshotOverlay
          imageUrl={overlayImage}
          onClose={() => setOverlayImage(null)}
          onEditInCanvas={() => {
            onEditInCanvas?.(overlayImage);
            setOverlayImage(null);
          }}
        />
      )}
    </div>
  );
}
