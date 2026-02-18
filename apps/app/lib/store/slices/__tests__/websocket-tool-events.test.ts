/**
 * websocket.slice — toolEvents reducers
 *
 * Tests the Manus-parity normalized tool event store:
 * - upsertToolEvent: adds new events, updates existing
 * - clearToolEvents: clears all tool events
 * - clearSessionToolEvents: clears events for a specific session
 * - toolEventsBySession: correct session-scoped indexing
 */

import { describe, it, expect, beforeEach } from "vitest";
import websocketReducer, {
  upsertToolEvent,
  clearToolEvents,
  clearSessionToolEvents,
  type WebSocketState,
  type ToolEventEntity,
} from "../websocket.slice";

function makeToolEvent(overrides: Partial<ToolEventEntity> = {}): ToolEventEntity {
  return {
    id: "tc-1",
    sessionId: "session-1",
    timestamp: Date.now(),
    toolName: "browser_navigate",
    state: "running",
    input: { url: "https://example.com" },
    ...overrides,
  };
}

describe("websocket.slice — toolEvents", () => {
  let state: WebSocketState;

  beforeEach(() => {
    state = websocketReducer(undefined, { type: "@@INIT" });
  });

  describe("upsertToolEvent", () => {
    it("should add a new tool event", () => {
      const event = makeToolEvent();
      state = websocketReducer(state, upsertToolEvent(event));

      expect(state.toolEventIds).toEqual(["tc-1"]);
      expect(state.toolEvents["tc-1"]).toEqual(event);
      expect(state.toolEventsBySession["session-1"]).toEqual(["tc-1"]);
    });

    it("should update an existing tool event (same id)", () => {
      const event = makeToolEvent({ state: "running" });
      state = websocketReducer(state, upsertToolEvent(event));

      const updated = makeToolEvent({
        state: "complete",
        output: { screenshot: "base64..." },
      });
      state = websocketReducer(state, upsertToolEvent(updated));

      // ID should NOT be duplicated
      expect(state.toolEventIds).toEqual(["tc-1"]);
      expect(state.toolEvents["tc-1"]!.state).toBe("complete");
      expect(state.toolEvents["tc-1"]!.output).toEqual({ screenshot: "base64..." });
      // Session index should NOT be duplicated
      expect(state.toolEventsBySession["session-1"]).toEqual(["tc-1"]);
    });

    it("should track multiple events across sessions", () => {
      state = websocketReducer(state, upsertToolEvent(makeToolEvent({ id: "tc-1", sessionId: "s1" })));
      state = websocketReducer(state, upsertToolEvent(makeToolEvent({ id: "tc-2", sessionId: "s1" })));
      state = websocketReducer(state, upsertToolEvent(makeToolEvent({ id: "tc-3", sessionId: "s2" })));

      expect(state.toolEventIds).toEqual(["tc-1", "tc-2", "tc-3"]);
      expect(state.toolEventsBySession["s1"]).toEqual(["tc-1", "tc-2"]);
      expect(state.toolEventsBySession["s2"]).toEqual(["tc-3"]);
    });

    it("should preserve arrival order in toolEventIds", () => {
      state = websocketReducer(state, upsertToolEvent(makeToolEvent({ id: "a" })));
      state = websocketReducer(state, upsertToolEvent(makeToolEvent({ id: "b" })));
      state = websocketReducer(state, upsertToolEvent(makeToolEvent({ id: "c" })));

      expect(state.toolEventIds).toEqual(["a", "b", "c"]);
    });
  });

  describe("clearToolEvents", () => {
    it("should clear all tool events", () => {
      state = websocketReducer(state, upsertToolEvent(makeToolEvent({ id: "tc-1", sessionId: "s1" })));
      state = websocketReducer(state, upsertToolEvent(makeToolEvent({ id: "tc-2", sessionId: "s2" })));

      state = websocketReducer(state, clearToolEvents());

      expect(state.toolEventIds).toEqual([]);
      expect(state.toolEvents).toEqual({});
      expect(state.toolEventsBySession).toEqual({});
    });
  });

  describe("clearSessionToolEvents", () => {
    it("should clear events for a specific session only", () => {
      state = websocketReducer(state, upsertToolEvent(makeToolEvent({ id: "tc-1", sessionId: "s1" })));
      state = websocketReducer(state, upsertToolEvent(makeToolEvent({ id: "tc-2", sessionId: "s1" })));
      state = websocketReducer(state, upsertToolEvent(makeToolEvent({ id: "tc-3", sessionId: "s2" })));

      state = websocketReducer(state, clearSessionToolEvents("s1"));

      // s1 events should be removed
      expect(state.toolEvents["tc-1"]).toBeUndefined();
      expect(state.toolEvents["tc-2"]).toBeUndefined();
      expect(state.toolEventsBySession["s1"]).toBeUndefined();

      // s2 events should remain
      expect(state.toolEvents["tc-3"]).toBeDefined();
      expect(state.toolEventsBySession["s2"]).toEqual(["tc-3"]);
      expect(state.toolEventIds).toEqual(["tc-3"]);
    });

    it("should handle clearing a non-existent session gracefully", () => {
      state = websocketReducer(state, upsertToolEvent(makeToolEvent({ id: "tc-1", sessionId: "s1" })));

      // Should not throw
      state = websocketReducer(state, clearSessionToolEvents("non-existent"));

      expect(state.toolEventIds).toEqual(["tc-1"]);
      expect(state.toolEvents["tc-1"]).toBeDefined();
    });
  });

  describe("tool event entity fields", () => {
    it("should store all entity fields correctly", () => {
      const event = makeToolEvent({
        id: "tc-full",
        sessionId: "s-full",
        toolName: "browser_view",
        state: "complete",
        input: { selector: "#main" },
        output: { content: "page content" },
        screenshot: "data:image/png;base64,iVBOR...",
        url: "https://example.com",
        title: "Example",
        content: "page content text",
      });
      state = websocketReducer(state, upsertToolEvent(event));

      const stored = state.toolEvents["tc-full"]!;
      expect(stored.screenshot).toBe("data:image/png;base64,iVBOR...");
      expect(stored.url).toBe("https://example.com");
      expect(stored.title).toBe("Example");
      expect(stored.content).toBe("page content text");
    });
  });
});
