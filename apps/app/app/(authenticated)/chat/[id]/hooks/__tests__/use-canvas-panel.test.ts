/**
 * useCanvasPanel — tests
 *
 * Validates the canvas panel open/close/fullscreen logic including:
 * - Auto-open when canvas content appears (Manus parity: always show)
 * - Re-open during streaming when user closed and new messages arrive
 * - Session reset when navigating between chats
 * - Force open via callback
 * - Fullscreen toggle
 * - User close sets userClosed flag (suppresses re-open until next message)
 */

import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCanvasPanel } from "../use-canvas-panel";

describe("useCanvasPanel", () => {
  it("should start closed when no canvas content", () => {
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

  it("should auto-open when canvas content appears (Manus parity)", () => {
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

    // Canvas tool arrives — hasCanvasContent becomes true
    rerender({
      sessionId: "s1",
      hasCanvasContent: true,
      isStreaming: true,
      messageCount: 4,
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

  it("should auto-open even when messageCount is 0 if hasCanvasContent is true", () => {
    // Manus parity: panel shows whenever there's canvas content, regardless of messageCount
    const { result } = renderHook(() =>
      useCanvasPanel({
        sessionId: "s1",
        hasCanvasContent: true,
        isStreaming: false,
        messageCount: 0,
      })
    );

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

  it("should force open via callback", () => {
    const { result } = renderHook(() =>
      useCanvasPanel({
        sessionId: "s1",
        hasCanvasContent: true,
        isStreaming: false,
        messageCount: 5,
      })
    );

    // Already auto-opened — close it first
    act(() => result.current.onClose());
    expect(result.current.showCanvas).toBe(false);

    // Force open
    act(() => result.current.forceOpen());
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

    // Make fullscreen
    act(() => {
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

    // Canvas is auto-opened in session 1
    expect(result.current.showCanvas).toBe(true);

    // Navigate to session 2 (hasCanvasContent still true — dep doesn't change)
    rerender({
      sessionId: "s2",
      hasCanvasContent: true,
      isStreaming: false,
      messageCount: 3,
    });

    // Reset effect closes the panel. hasCanvasContent effect doesn't re-fire
    // because the dep value (true) didn't change between renders.
    expect(result.current.showCanvas).toBe(false);
    expect(result.current.canvasFullscreen).toBe(false);
  });

  it("should re-open after session reset when hasCanvasContent transitions false→true", () => {
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

    expect(result.current.showCanvas).toBe(true);

    // Navigate to session 2 — no canvas content initially
    rerender({
      sessionId: "s2",
      hasCanvasContent: false,
      isStreaming: false,
      messageCount: 0,
    });

    expect(result.current.showCanvas).toBe(false);

    // Tool arrives in new session — hasCanvasContent transitions false→true
    rerender({
      sessionId: "s2",
      hasCanvasContent: true,
      isStreaming: true,
      messageCount: 1,
    });

    expect(result.current.showCanvas).toBe(true);
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

  it("should re-open during streaming when new messages arrive after user closed", () => {
    const { result, rerender } = renderHook(
      (props) => useCanvasPanel(props),
      {
        initialProps: {
          sessionId: "s1",
          hasCanvasContent: true,
          isStreaming: true,
          messageCount: 3,
        },
      }
    );

    // Auto-opened
    expect(result.current.showCanvas).toBe(true);

    // User closes
    act(() => result.current.onClose());
    expect(result.current.showCanvas).toBe(false);

    // New message arrives during streaming → re-opens
    rerender({
      sessionId: "s1",
      hasCanvasContent: true,
      isStreaming: true,
      messageCount: 4,
    });

    expect(result.current.showCanvas).toBe(true);
  });
});
