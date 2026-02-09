"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// ============================================================================
// Types
// ============================================================================

export interface UseE2BStreamOptions {
  /** Active sandbox ID — required to connect */
  sandboxId?: string;
  /** Whether streaming is enabled (e.g. canvas is visible) */
  enabled?: boolean;
  /** Screenshot polling interval in ms when live stream unavailable (default: 2000) */
  pollInterval?: number;
  /** Pre-resolved Neko WebRTC URL from SSE metadata (primary live stream) */
  nekoUrl?: string;
  /** Pre-resolved E2B stream URL from SSE metadata (noVNC fallback) */
  streamUrl?: string;
}

export interface UseE2BStreamReturn {
  /** Whether the stream (noVNC or polling) is active */
  isConnected: boolean;
  /** Whether we're attempting the initial connection */
  isConnecting: boolean;
  /** Current error (if any) */
  error: string | null;
  /** noVNC iframe URL — when available, embed this in an iframe for live desktop view */
  streamUrl: string | null;
  /** Latest polled screenshot (base64 data URI) — fallback when noVNC unavailable */
  screenshot: string | null;
  /** Latest page URL from the sandbox browser */
  url: string | null;
  /** Latest page title from the sandbox browser */
  title: string | null;
  /** Whether using noVNC live stream (true) or screenshot polling (false) */
  isLiveStream: boolean;
  /** Manually reconnect */
  reconnect: () => void;
  /** Stop streaming */
  disconnect: () => void;
}

// ============================================================================
// Helpers
// ============================================================================

const BASE64_IMAGE_PREFIXES = ["iVBOR", "/9j/", "R0lGO", "UklGR"];

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

// ============================================================================
// Hook
// ============================================================================

/**
 * useE2BStream — Connects to E2B sandbox for live browser viewing.
 *
 * **Dual mode:**
 * 1. **noVNC iframe** (preferred): If the sandbox uses the Desktop template,
 *    fetches the noVNC URL from `/api/sandbox/{id}/browser/stream` and returns
 *    it as `streamUrl` for iframe embedding. This provides true live VNC
 *    streaming with native mouse/keyboard Take Control support.
 *
 * 2. **Screenshot polling** (fallback): If noVNC is unavailable (non-Desktop
 *    sandbox, endpoint failure), falls back to polling `/api/sandbox/browser`
 *    with action "screenshot" every `pollInterval` ms.
 */
export function useE2BStream({
  sandboxId,
  enabled = true,
  pollInterval = 2000,
  nekoUrl: preResolvedNekoUrl,
  streamUrl: preResolvedStreamUrl,
}: UseE2BStreamOptions): UseE2BStreamReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [title, setTitle] = useState<string | null>(null);
  const [isLiveStream, setIsLiveStream] = useState(false);

  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const pollingRef = useRef(false);
  const failCountRef = useRef(0);
  const modeRef = useRef<"unknown" | "vnc" | "polling">("unknown");

  // ---- noVNC: Fetch stream URL from sandbox service ----
  const fetchStreamUrl = useCallback(async (): Promise<string | null> => {
    if (!sandboxId) return null;

    try {
      const resp = await fetch(`/api/sandbox/${sandboxId}/browser/stream`, {
        signal: AbortSignal.timeout(8000),
      });
      if (!resp.ok) return null;
      const data = await resp.json();
      return (data.streamUrl ?? data.data?.streamUrl) as string | null;
    } catch {
      return null;
    }
  }, [sandboxId]);

  // ---- Screenshot polling: fetch from browser action endpoint ----
  const pollScreenshot = useCallback(async () => {
    if (!sandboxId || !mountedRef.current || pollingRef.current) return;

    pollingRef.current = true;

    try {
      const resp = await fetch("/api/sandbox/browser", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sandboxId,
          action: "screenshot",
          params: {},
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (!mountedRef.current) return;

      if (!resp.ok) {
        failCountRef.current++;
        if (failCountRef.current >= 3) {
          setError("Browser not available");
          setIsConnected(false);
        }
        return;
      }

      const data = await resp.json();
      if (!mountedRef.current) return;

      const rawShot = data.screenshot ?? data.data?.screenshot;
      if (typeof rawShot === "string" && rawShot.length > 0) {
        setScreenshot(normalizeScreenshot(rawShot));
        setIsConnected(true);
        setIsConnecting(false);
        setError(null);
        failCountRef.current = 0;
      }

      if (typeof data.url === "string") setUrl(data.url);
      if (typeof data.title === "string") setTitle(data.title);
    } catch {
      if (!mountedRef.current) return;
      failCountRef.current++;
      if (failCountRef.current >= 3) {
        setError("Failed to poll screenshot");
        setIsConnected(false);
      }
    } finally {
      pollingRef.current = false;
    }
  }, [sandboxId]);

  // ---- Start polling loop ----
  const startPolling = useCallback(() => {
    if (!sandboxId || !enabled || !mountedRef.current) return;

    modeRef.current = "polling";
    failCountRef.current = 0;
    pollScreenshot();

    const tick = () => {
      if (!mountedRef.current || !enabled) return;
      const delay = failCountRef.current > 0
        ? Math.min(pollInterval * Math.pow(1.5, failCountRef.current), 10000)
        : pollInterval;
      pollTimerRef.current = setTimeout(async () => {
        await pollScreenshot();
        if (mountedRef.current && enabled) tick();
      }, delay);
    };
    tick();
  }, [sandboxId, enabled, pollInterval, pollScreenshot]);

  // ---- Main connect: try Neko > E2B stream > API fetch > polling ----
  const connect = useCallback(async () => {
    if (!sandboxId || !enabled || !mountedRef.current) return;

    setIsConnecting(true);
    setError(null);
    modeRef.current = "unknown";

    // Step 1: Use pre-resolved Neko URL (primary) or E2B stream URL (fallback)
    // from SSE metadata (instant, no API call). Otherwise try fetching from sandbox service.
    const liveUrl = preResolvedNekoUrl || preResolvedStreamUrl || (await fetchStreamUrl());

    if (!mountedRef.current) return;

    if (liveUrl) {
      // Live stream available — use iframe mode
      modeRef.current = "vnc";
      setStreamUrl(liveUrl);
      setIsLiveStream(true);
      setIsConnected(true);
      setIsConnecting(false);
      setError(null);
      return;
    }

    // Step 2: No live stream — fall back to screenshot polling
    setIsLiveStream(false);
    startPolling();
  }, [sandboxId, enabled, preResolvedNekoUrl, preResolvedStreamUrl, fetchStreamUrl, startPolling]);

  // ---- Stop ----
  const disconnect = useCallback(() => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    setIsConnected(false);
    setIsConnecting(false);
    setStreamUrl(null);
    setIsLiveStream(false);
    modeRef.current = "unknown";
  }, []);

  // ---- Reconnect ----
  const reconnect = useCallback(() => {
    disconnect();
    connect();
  }, [disconnect, connect]);

  // Auto-start/stop — reconnect when sandboxId, enabled, or stream URLs change
  useEffect(() => {
    if (sandboxId && enabled) {
      connect();
    } else {
      disconnect();
    }
    return () => { disconnect(); };
  }, [sandboxId, enabled, preResolvedNekoUrl, preResolvedStreamUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      disconnect();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    isConnected,
    isConnecting,
    error,
    streamUrl,
    screenshot,
    url,
    title,
    isLiveStream,
    reconnect,
    disconnect,
  };
}
