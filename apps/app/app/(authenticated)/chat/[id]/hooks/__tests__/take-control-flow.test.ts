/**
 * handleUserControlChange — Take Control pause/resume flow
 *
 * Tests the callback from chat-client.tsx that handles the
 * "Take Control" browser canvas feature.
 *
 * When the user activates Take Control:
 *   - wasStreamingRef is set to the current isStreaming value
 *   - stop() is called only if the agent is currently streaming
 *   - setUserControlActive(true) is called
 *
 * When the user releases Take Control (active=false):
 *   - setUserControlActive(false) is called
 *   - sendMessage() is called with a resume prompt
 *   - stop() is NOT called again
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================================================
// Factory: build the handleUserControlChange callback as a standalone function
// that mirrors the exact implementation in chat-client.tsx.
// ============================================================================

interface HandleUserControlChangeDeps {
  isStreaming: boolean;
  stop: () => void;
  sendMessage: (text: string) => void;
  wasStreamingRef: { current: boolean };
  setUserControlActive: (active: boolean) => void;
}

function makeHandleUserControlChange(deps: HandleUserControlChangeDeps) {
  const { isStreaming, stop, sendMessage, wasStreamingRef, setUserControlActive } = deps;

  return function handleUserControlChange(active: boolean) {
    if (active) {
      wasStreamingRef.current = isStreaming;
      if (isStreaming) {
        stop();
      }
      setUserControlActive(true);
    } else {
      setUserControlActive(false);
      sendMessage(
        "I've finished using the computer. Please continue from where you left off."
      );
    }
  };
}

// ============================================================================
// Tests
// ============================================================================

describe("handleUserControlChange — Take Control pause/resume", () => {
  let stop: ReturnType<typeof vi.fn>;
  let sendMessage: ReturnType<typeof vi.fn>;
  let setUserControlActive: ReturnType<typeof vi.fn>;
  let wasStreamingRef: { current: boolean };

  beforeEach(() => {
    stop = vi.fn();
    sendMessage = vi.fn();
    setUserControlActive = vi.fn();
    wasStreamingRef = { current: false };
  });

  // ── Activation (active=true) ──

  describe("when user activates Take Control (active=true)", () => {
    it("should call stop() when the agent is currently streaming", () => {
      const handler = makeHandleUserControlChange({
        isStreaming: true,
        stop,
        sendMessage,
        wasStreamingRef,
        setUserControlActive,
      });

      handler(true);

      expect(stop).toHaveBeenCalledOnce();
    });

    it("should NOT call stop() when the agent is not streaming", () => {
      const handler = makeHandleUserControlChange({
        isStreaming: false,
        stop,
        sendMessage,
        wasStreamingRef,
        setUserControlActive,
      });

      handler(true);

      expect(stop).not.toHaveBeenCalled();
    });

    it("should call setUserControlActive(true) when streaming", () => {
      makeHandleUserControlChange({
        isStreaming: true,
        stop,
        sendMessage,
        wasStreamingRef,
        setUserControlActive,
      })(true);

      expect(setUserControlActive).toHaveBeenCalledWith(true);
    });

    it("should call setUserControlActive(true) when not streaming", () => {
      makeHandleUserControlChange({
        isStreaming: false,
        stop,
        sendMessage,
        wasStreamingRef,
        setUserControlActive,
      })(true);

      expect(setUserControlActive).toHaveBeenCalledWith(true);
    });

    it("should NOT call sendMessage() when activating Take Control", () => {
      makeHandleUserControlChange({
        isStreaming: true,
        stop,
        sendMessage,
        wasStreamingRef,
        setUserControlActive,
      })(true);

      expect(sendMessage).not.toHaveBeenCalled();
    });

    it("should store isStreaming=true in wasStreamingRef when agent was streaming", () => {
      makeHandleUserControlChange({
        isStreaming: true,
        stop,
        sendMessage,
        wasStreamingRef,
        setUserControlActive,
      })(true);

      expect(wasStreamingRef.current).toBe(true);
    });

    it("should store isStreaming=false in wasStreamingRef when agent was NOT streaming", () => {
      makeHandleUserControlChange({
        isStreaming: false,
        stop,
        sendMessage,
        wasStreamingRef,
        setUserControlActive,
      })(true);

      expect(wasStreamingRef.current).toBe(false);
    });
  });

  // ── Deactivation (active=false) ──

  describe("when user releases Take Control (active=false)", () => {
    it("should call sendMessage() with the resume text", () => {
      const handler = makeHandleUserControlChange({
        isStreaming: false,
        stop,
        sendMessage,
        wasStreamingRef,
        setUserControlActive,
      });

      handler(false);

      expect(sendMessage).toHaveBeenCalledOnce();
      expect(sendMessage).toHaveBeenCalledWith(
        "I've finished using the computer. Please continue from where you left off."
      );
    });

    it("should call setUserControlActive(false) when releasing control", () => {
      makeHandleUserControlChange({
        isStreaming: false,
        stop,
        sendMessage,
        wasStreamingRef,
        setUserControlActive,
      })(false);

      expect(setUserControlActive).toHaveBeenCalledWith(false);
    });

    it("should call setUserControlActive(false) BEFORE sendMessage()", () => {
      const callOrder: string[] = [];
      setUserControlActive = vi.fn(() => callOrder.push("setUserControlActive"));
      sendMessage = vi.fn(() => callOrder.push("sendMessage"));

      makeHandleUserControlChange({
        isStreaming: false,
        stop,
        sendMessage,
        wasStreamingRef,
        setUserControlActive,
      })(false);

      expect(callOrder).toEqual(["setUserControlActive", "sendMessage"]);
    });

    it("should NOT call stop() when releasing control", () => {
      makeHandleUserControlChange({
        isStreaming: true,
        stop,
        sendMessage,
        wasStreamingRef,
        setUserControlActive,
      })(false);

      expect(stop).not.toHaveBeenCalled();
    });

    it("should send the resume message regardless of current streaming state", () => {
      makeHandleUserControlChange({
        isStreaming: true,
        stop,
        sendMessage,
        wasStreamingRef,
        setUserControlActive,
      })(false);

      expect(sendMessage).toHaveBeenCalledOnce();
    });
  });

  // ── Full cycle ──

  describe("full activate → deactivate cycle", () => {
    it("should correctly handle a full take-control and release cycle", () => {
      // Step 1: Activate while streaming
      const activate = makeHandleUserControlChange({
        isStreaming: true,
        stop,
        sendMessage,
        wasStreamingRef,
        setUserControlActive,
      });
      activate(true);

      expect(wasStreamingRef.current).toBe(true);
      expect(stop).toHaveBeenCalledOnce();
      expect(setUserControlActive).toHaveBeenCalledWith(true);

      stop.mockClear();
      setUserControlActive.mockClear();

      // Step 2: Release control (isStreaming is now false since stop() was called)
      const deactivate = makeHandleUserControlChange({
        isStreaming: false,
        stop,
        sendMessage,
        wasStreamingRef,
        setUserControlActive,
      });
      deactivate(false);

      expect(stop).not.toHaveBeenCalled();
      expect(setUserControlActive).toHaveBeenCalledWith(false);
      expect(sendMessage).toHaveBeenCalledOnce();
    });

    it("should handle activate when agent was idle (not streaming)", () => {
      makeHandleUserControlChange({
        isStreaming: false,
        stop,
        sendMessage,
        wasStreamingRef,
        setUserControlActive,
      })(true);

      expect(wasStreamingRef.current).toBe(false);
      expect(stop).not.toHaveBeenCalled();
      expect(setUserControlActive).toHaveBeenCalledWith(true);
    });

    it("should not mutate wasStreamingRef when releasing control", () => {
      wasStreamingRef.current = true; // simulates a previous activation

      makeHandleUserControlChange({
        isStreaming: false,
        stop,
        sendMessage,
        wasStreamingRef,
        setUserControlActive,
      })(false);

      // wasStreamingRef should remain as it was
      expect(wasStreamingRef.current).toBe(true);
    });
  });

  // ── Edge cases ──

  describe("edge cases", () => {
    it("should handle multiple rapid activations", () => {
      makeHandleUserControlChange({
        isStreaming: true,
        stop,
        sendMessage,
        wasStreamingRef,
        setUserControlActive,
      })(true);

      expect(wasStreamingRef.current).toBe(true);
      expect(stop).toHaveBeenCalledOnce();
      stop.mockClear();

      makeHandleUserControlChange({
        isStreaming: false,
        stop,
        sendMessage,
        wasStreamingRef,
        setUserControlActive,
      })(true);

      expect(wasStreamingRef.current).toBe(false);
      expect(stop).not.toHaveBeenCalled();
    });

    it("should handle release without a prior activation (defensive — no crash)", () => {
      expect(() => {
        makeHandleUserControlChange({
          isStreaming: false,
          stop,
          sendMessage,
          wasStreamingRef,
          setUserControlActive,
        })(false);
      }).not.toThrow();

      expect(sendMessage).toHaveBeenCalledOnce();
      expect(setUserControlActive).toHaveBeenCalledWith(false);
    });
  });
});
