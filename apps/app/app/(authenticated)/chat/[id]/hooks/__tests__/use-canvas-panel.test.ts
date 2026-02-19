/**
 * useCanvasPanel — tests
 *
 * Validates the canvas panel open/close/fullscreen logic including:
 * - Auto-open during REAL streaming (new messages)
 * - NOT auto-opening on resume hydration (same message count)
 * - Session reset when navigating between chats
 * - Force open via callback
 * - Fullscreen toggle
 */

import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCanvasPanel } from "../use-canvas-panel";

describe("useCanvasPanel", () => {
  it("should start closed", () => {
    const { result } = renderHook(() =>
      useCanvasPanel({
        sessionId: "s1",
        hasCanvasContent: false,
        isStreaming: false,
        messageCount: 0,
      })
    );

    expect(result.current.showCanvas).toBe(false);
    expect(result.current.canvasFullscreen).toBe(false);
  });

  it("should auto-open when streaming + canvas content + new messages", () => {
    const { result, rerender } = renderHook(
      (props) => useCanvasPanel(props),
      {
        initialProps: {
          sessionId: "s1",
          hasCanvasContent: false,
          isStreaming: false,
          messageCount: 3,
        },
      }
    );

    expect(result.current.showCanvas).toBe(false);

    // User sends message → messageCount increases + streaming starts + canvas tool arrives
    rerender({
      sessionId: "s1",
      hasCanvasContent: true,
      isStreaming: true,
      messageCount: 4, // new message
    });

    expect(result.current.showCanvas).toBe(true);
  });

  it("should auto-open for historical canvas content on page load (Manus parity)", () => {
    // Old chat with tool history → canvas auto-opens on load
    const { result } = renderHook(() =>
      useCanvasPanel({
        sessionId: "s1",
        hasCanvasContent: true,
        isStreaming: false,
        messageCount: 10,
      })
    );

    // Manus parity: always show canvas when session has tool history
    expect(result.current.showCanvas).toBe(true);
  });

  it("should NOT auto-open when no canvas content even with messages", () => {
    const { result } = renderHook(() =>
      useCanvasPanel({
        sessionId: "s1",
        hasCanvasContent: false,
        isStreaming: false,
        messageCount: 10,
      })
    );

    expect(result.current.showCanvas).toBe(false);
  });

  it("should NOT auto-open when messageCount is 0", () => {
    const { result } = renderHook(() =>
      useCanvasPanel({
        sessionId: "s1",
        hasCanvasContent: true,
        isStreaming: false,
        messageCount: 0,
      })
    );

    expect(result.current.showCanvas).toBe(false);
  });

  it("should force open via callback (when auto-open hasn't fired)", () => {
    // messageCount=0 prevents auto-open, so we can test forceOpen in isolation
    const { result } = renderHook(() =>
      useCanvasPanel({
        sessionId: "s1",
        hasCanvasContent: true,
        isStreaming: false,
        messageCount: 0,
      })
    );

    expect(result.current.showCanvas).toBe(false);

    act(() => {
      result.current.forceOpen();
    });

    expect(result.current.showCanvas).toBe(true);
  });

  it("should close and reset fullscreen via onClose", () => {
    const { result } = renderHook(() =>
      useCanvasPanel({
        sessionId: "s1",
        hasCanvasContent: true,
        isStreaming: false,
        messageCount: 5,
      })
    );

    // Open and make fullscreen
    act(() => {
      result.current.forceOpen();
      result.current.onToggleFullscreen();
    });

    expect(result.current.showCanvas).toBe(true);
    expect(result.current.canvasFullscreen).toBe(true);

    // Close
    act(() => {
      result.current.onClose();
    });

    expect(result.current.showCanvas).toBe(false);
    expect(result.current.canvasFullscreen).toBe(false);
  });

  it("should toggle fullscreen", () => {
    const { result } = renderHook(() =>
      useCanvasPanel({
        sessionId: "s1",
        hasCanvasContent: true,
        isStreaming: false,
        messageCount: 5,
      })
    );

    act(() => result.current.forceOpen());

    expect(result.current.canvasFullscreen).toBe(false);

    act(() => result.current.onToggleFullscreen());
    expect(result.current.canvasFullscreen).toBe(true);

    act(() => result.current.onToggleFullscreen());
    expect(result.current.canvasFullscreen).toBe(false);
  });

  it("should reset when navigating to a different session", () => {
    const { result, rerender } = renderHook(
      (props) => useCanvasPanel(props),
      {
        initialProps: {
          sessionId: "s1",
          hasCanvasContent: true,
          isStreaming: false,
          messageCount: 5,
        },
      }
    );

    // Open canvas in session 1
    act(() => result.current.forceOpen());
    expect(result.current.showCanvas).toBe(true);

    // Navigate to session 2
    rerender({
      sessionId: "s2",
      hasCanvasContent: true,
      isStreaming: false,
      messageCount: 3,
    });

    expect(result.current.showCanvas).toBe(false);
    expect(result.current.canvasFullscreen).toBe(false);
  });

  it("should show false when open but no canvas content", () => {
    const { result } = renderHook(() =>
      useCanvasPanel({
        sessionId: "s1",
        hasCanvasContent: false,
        isStreaming: false,
        messageCount: 5,
      })
    );

    act(() => result.current.forceOpen());

    // Even though open=true, showCanvas=false because hasCanvasContent=false
    expect(result.current.showCanvas).toBe(false);
  });
});
