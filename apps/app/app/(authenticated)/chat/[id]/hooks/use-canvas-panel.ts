"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface UseCanvasPanelOptions {
  sessionId: string;
  /** Whether useCanvas found any canvas-relevant tool in messages */
  hasCanvasContent: boolean;
  isStreaming: boolean;
  /** Current message count — used to distinguish resume hydration from real streaming */
  messageCount: number;
}

/**
 * Manages the canvas panel open/close/fullscreen state.
 *
 * The canvas opens in two ways:
 *  1. Automatically — when a canvas-relevant tool appears during REAL streaming
 *     (messageCount increased = user sent a message, NOT resume hydration).
 *  2. Explicitly — when the user clicks "View in Canvas" on a tool card (forceOpen).
 *
 * It does NOT auto-open on page load for old chats that already have tool history,
 * even though `resume: true` briefly sets isStreaming=true on mount.
 */
export function useCanvasPanel({
  sessionId,
  hasCanvasContent,
  isStreaming,
  messageCount,
}: UseCanvasPanelOptions) {
  const [open, setOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const initialCountRef = useRef(messageCount);

  // Reset when navigating to a different chat
  useEffect(() => {
    setOpen(false);
    setFullscreen(false);
    initialCountRef.current = messageCount;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset baseline on session change only
  }, [sessionId]);

  // Auto-open when:
  // 1. NEW messages arrive during streaming (messageCount increased = user sent a message)
  // 2. Page refresh/load detects historical canvas content (Manus parity: always show canvas
  //    when a session has tool history, even for old chats)
  useEffect(() => {
    if (isStreaming && hasCanvasContent && messageCount > initialCountRef.current) {
      setOpen(true);
    }
  }, [isStreaming, hasCanvasContent, messageCount]);

  // Auto-open on page load when session has historical canvas content.
  // This fires once after useSSEToEntities populates Redux from DB messages.
  const autoOpenedRef = useRef(false);
  useEffect(() => {
    if (!autoOpenedRef.current && hasCanvasContent && !isStreaming && messageCount > 0) {
      autoOpenedRef.current = true;
      setOpen(true);
    }
  }, [hasCanvasContent, isStreaming, messageCount]);

  const forceOpen = useCallback(() => setOpen(true), []);

  const onClose = useCallback(() => {
    setOpen(false);
    setFullscreen(false);
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
