"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface UseCanvasPanelOptions {
  sessionId: string;
  /** Whether useCanvas found any canvas-relevant tool in messages */
  hasCanvasContent: boolean;
  isStreaming: boolean;
  /** Current message count — used to detect new messages during streaming */
  messageCount: number;
}

/**
 * Manages the canvas panel open/close/fullscreen state.
 *
 * Manus parity: the tool panel is shown whenever canvas content exists.
 *
 * The canvas opens in THREE ways:
 *  1. Automatically — when canvas content first appears (historical or streaming)
 *  2. Re-open — when agent calls a new tool during streaming (even if user closed)
 *  3. Explicitly — when the user clicks "View in Canvas" on a tool card (forceOpen)
 *
 * This matches Manus's ChatPage.vue `handleToolEvent`:
 *   if (realTime.value) { toolPanel.value?.showToolPanel(toolContent, true); }
 *
 * Manus shows the tool panel for EVERY tool event during streaming.
 * The panel is always visible when there's canvas content.
 */
export function useCanvasPanel({
  sessionId,
  hasCanvasContent,
  isStreaming,
  messageCount,
}: UseCanvasPanelOptions) {
  const [open, setOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  // Track whether the user manually closed the panel during this streaming session.
  // Manus: `realTime.value = false` on tool click. Here we use it to suppress
  // re-opening on new tool events UNTIL the next user message starts streaming.
  const userClosedRef = useRef(false);

  // Track message count to detect when user sends a new message (resets userClosed)
  const prevMessageCountRef = useRef(messageCount);

  // Reset when navigating to a different chat
  useEffect(() => {
    setOpen(false);
    setFullscreen(false);
    userClosedRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset on session change only
  }, [sessionId]);

  // ── AUTO-OPEN: canvas content appears (covers both page load and streaming) ──
  // Manus parity: tool panel is always shown when there's canvas content.
  // This is the PRIMARY auto-open trigger — fires whenever hasCanvasContent
  // transitions from false → true (first tool event in a session, or page load
  // after useLayoutEffect populates Redux from DB messages).
  useEffect(() => {
    if (hasCanvasContent) {
      setOpen(true);
      userClosedRef.current = false;
    }
  }, [hasCanvasContent]);

  // ── RE-OPEN: new messages arrive during streaming ──
  // Manus parity: when agent calls a new tool and panel was manually closed,
  // re-open it (like Manus's `realTime.value` auto-show per tool event).
  // Reset the "user closed" flag when the user sends a new message.
  useEffect(() => {
    if (messageCount > prevMessageCountRef.current) {
      // New message arrived — if we're streaming and have canvas content, re-open
      if (isStreaming && hasCanvasContent && userClosedRef.current) {
        setOpen(true);
        userClosedRef.current = false;
      }
    }
    prevMessageCountRef.current = messageCount;
  }, [messageCount, isStreaming, hasCanvasContent]);

  const forceOpen = useCallback(() => {
    setOpen(true);
    userClosedRef.current = false;
  }, []);

  const onClose = useCallback(() => {
    setOpen(false);
    setFullscreen(false);
    userClosedRef.current = true;
  }, []);

  const onToggleFullscreen = useCallback(
    () => setFullscreen((prev) => !prev),
    []
  );

  return {
    showCanvas: open && hasCanvasContent,
    canvasFullscreen: fullscreen,
    forceOpen,
    onClose,
    onToggleFullscreen,
  };
}
