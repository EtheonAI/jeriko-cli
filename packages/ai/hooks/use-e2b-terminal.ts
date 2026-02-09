"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// ============================================================================
// Types
// ============================================================================

export interface UseE2BTerminalOptions {
  /** Active sandbox ID — required to connect */
  sandboxId?: string;
  /** Whether streaming is enabled (e.g. canvas is visible) */
  enabled?: boolean;
  /** Reconnection interval in ms (default: 3000) */
  reconnectInterval?: number;
}

export interface UseE2BTerminalReturn {
  /** Whether the WebSocket is connected */
  isConnected: boolean;
  /** Whether we're attempting to connect */
  isConnecting: boolean;
  /** Current error (if any) */
  error: string | null;
  /** The WebSocket stream URL (for xterm.js attachment) */
  streamUrl: string | null;
  /** Accumulated terminal output lines */
  output: string[];
  /** Send user keyboard input to the PTY */
  sendInput: (data: string) => void;
  /** Manually trigger reconnect */
  reconnect: () => void;
  /** Disconnect the stream */
  disconnect: () => void;
  /** Clear terminal output */
  clear: () => void;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * useE2BTerminal — Connects to E2B sandbox PTY WebSocket for live terminal streaming.
 *
 * Fetches the PTY stream URL from the sandbox service, connects via WebSocket,
 * and accumulates output for rendering in xterm.js or plain text.
 */
export function useE2BTerminal({
  sandboxId,
  enabled = true,
  reconnectInterval = 3000,
}: UseE2BTerminalOptions): UseE2BTerminalReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [output, setOutput] = useState<string[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  // Fetch the PTY stream URL from the sandbox service
  const fetchStreamUrl = useCallback(async () => {
    if (!sandboxId) return null;

    try {
      const resp = await fetch(`/api/sandbox/${sandboxId}/terminal/stream`);
      if (!resp.ok) return null;
      const data = await resp.json();
      return (data.data?.streamUrl ?? data.streamUrl) as string | null;
    } catch {
      return null;
    }
  }, [sandboxId]);

  // Connect to the PTY WebSocket
  const connect = useCallback(async () => {
    if (!sandboxId || !enabled || !mountedRef.current) return;

    setIsConnecting(true);
    setError(null);

    const url = await fetchStreamUrl();
    if (!url || !mountedRef.current) {
      setIsConnecting(false);
      setError("Could not get terminal stream URL");
      return;
    }

    setStreamUrl(url);

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) return;
        setIsConnected(true);
        setIsConnecting(false);
        setError(null);
      };

      ws.onmessage = (event) => {
        if (!mountedRef.current) return;
        const data = typeof event.data === "string" ? event.data : "";
        if (!data) return;

        // Split into lines (preserving partial lines from previous chunks)
        setOutput((prev) => {
          const lines = data.split("\n");
          if (lines.length === 0) return prev;

          // Append to the last line if it's a continuation
          const newOutput = [...prev];
          if (newOutput.length > 0 && lines[0] !== "") {
            newOutput[newOutput.length - 1] += lines[0]!;
            lines.shift();
          }

          // Add remaining lines
          for (const line of lines) {
            newOutput.push(line);
          }

          // Cap at 5000 lines
          if (newOutput.length > 5000) {
            return newOutput.slice(-5000);
          }

          return newOutput;
        });
      };

      ws.onerror = () => {
        if (!mountedRef.current) return;
        setError("Terminal WebSocket connection error");
        setIsConnected(false);
        setIsConnecting(false);
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        setIsConnected(false);
        setIsConnecting(false);
        wsRef.current = null;

        // Auto-reconnect
        if (enabled && sandboxId) {
          reconnectTimerRef.current = setTimeout(() => {
            if (mountedRef.current) connect();
          }, reconnectInterval);
        }
      };
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : "Connection failed");
      setIsConnecting(false);
    }
  }, [sandboxId, enabled, fetchStreamUrl, reconnectInterval]);

  // Disconnect
  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
    setStreamUrl(null);
  }, []);

  // Reconnect
  const reconnect = useCallback(() => {
    disconnect();
    connect();
  }, [disconnect, connect]);

  // Send user input to the PTY
  const sendInput = useCallback((data: string) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(data);
  }, []);

  // Clear output
  const clear = useCallback(() => {
    setOutput([]);
  }, []);

  // Auto-connect when sandboxId/enabled changes
  useEffect(() => {
    if (sandboxId && enabled) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [sandboxId, enabled]); // eslint-disable-line react-hooks/exhaustive-deps

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
    output,
    sendInput,
    reconnect,
    disconnect,
    clear,
  };
}
