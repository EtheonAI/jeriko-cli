/**
 * sessions.slice — updateSession metadata deep-merge tests
 *
 * Validates that the updateSession reducer correctly deep-merges the metadata
 * field instead of shallow-replacing it. This prevents losing sandboxId or
 * nekoUrl when separate WS events dispatch updateSession with partial metadata.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { configureStore } from "@reduxjs/toolkit";
import sessionsReducer, {
  updateSession,
  setSessions,
  type AgentSession,
} from "../sessions.slice";

// ============================================================================
// Helpers
// ============================================================================

function makeSession(overrides: Partial<AgentSession> = {}): AgentSession {
  return {
    id: "session-1",
    userId: "user-1",
    title: "Test Session",
    status: "active",
    mode: "agent",
    isShared: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeStore() {
  return configureStore({ reducer: { sessions: sessionsReducer } });
}

// ============================================================================
// Tests
// ============================================================================

describe("sessions.slice — updateSession", () => {
  let store: ReturnType<typeof makeStore>;

  beforeEach(() => {
    store = makeStore();
  });

  // ── Metadata deep-merge ──

  describe("metadata deep-merge", () => {
    it("should deep-merge metadata so sandboxId and nekoUrl dispatched separately are both preserved", () => {
      store.dispatch(
        setSessions({ sessions: [makeSession({ id: "session-1" })] })
      );

      // First dispatch: sandbox.status WS event sets sandboxId
      store.dispatch(
        updateSession({
          id: "session-1",
          updates: { metadata: { sandboxId: "sb-abc123" } },
        })
      );

      const afterFirst = store.getState().sessions.sessions.find(
        (s) => s.id === "session-1"
      );
      expect(afterFirst?.metadata?.sandboxId).toBe("sb-abc123");
      expect(afterFirst?.metadata?.nekoUrl).toBeUndefined();

      // Second dispatch: SSE message-metadata sets nekoUrl
      store.dispatch(
        updateSession({
          id: "session-1",
          updates: { metadata: { nekoUrl: "https://neko.e2b.dev/abc" } },
        })
      );

      // Both fields must coexist — deep-merge, not replace
      const afterSecond = store.getState().sessions.sessions.find(
        (s) => s.id === "session-1"
      );
      expect(afterSecond?.metadata?.sandboxId).toBe("sb-abc123");
      expect(afterSecond?.metadata?.nekoUrl).toBe("https://neko.e2b.dev/abc");
    });

    it("should deep-merge all three metadata keys dispatched in three separate calls", () => {
      store.dispatch(setSessions({ sessions: [makeSession({ id: "session-1" })] }));

      store.dispatch(
        updateSession({
          id: "session-1",
          updates: { metadata: { sandboxId: "sb-xyz" } },
        })
      );
      store.dispatch(
        updateSession({
          id: "session-1",
          updates: { metadata: { nekoUrl: "https://neko.e2b.dev/xyz" } },
        })
      );
      store.dispatch(
        updateSession({
          id: "session-1",
          updates: { metadata: { streamUrl: "https://stream.e2b.dev/xyz" } },
        })
      );

      const session = store.getState().sessions.sessions.find(
        (s) => s.id === "session-1"
      );
      expect(session?.metadata?.sandboxId).toBe("sb-xyz");
      expect(session?.metadata?.nekoUrl).toBe("https://neko.e2b.dev/xyz");
      expect(session?.metadata?.streamUrl).toBe("https://stream.e2b.dev/xyz");
    });

    it("should handle the first metadata dispatch when session has no existing metadata", () => {
      store.dispatch(
        setSessions({
          sessions: [makeSession({ id: "session-1", metadata: undefined })],
        })
      );

      store.dispatch(
        updateSession({
          id: "session-1",
          updates: { metadata: { sandboxId: "sb-first" } },
        })
      );

      const session = store.getState().sessions.sessions.find(
        (s) => s.id === "session-1"
      );
      expect(session?.metadata?.sandboxId).toBe("sb-first");
    });

    it("should handle the first metadata dispatch when session has empty metadata object", () => {
      store.dispatch(
        setSessions({
          sessions: [makeSession({ id: "session-1", metadata: {} })],
        })
      );

      store.dispatch(
        updateSession({
          id: "session-1",
          updates: { metadata: { sandboxId: "sb-empty" } },
        })
      );

      const session = store.getState().sessions.sessions.find(
        (s) => s.id === "session-1"
      );
      expect(session?.metadata?.sandboxId).toBe("sb-empty");
    });

    it("should overwrite an individual metadata key when re-dispatched with a new value", () => {
      store.dispatch(
        setSessions({
          sessions: [
            makeSession({
              id: "session-1",
              metadata: { sandboxId: "sb-old", nekoUrl: "https://old.neko" },
            }),
          ],
        })
      );

      store.dispatch(
        updateSession({
          id: "session-1",
          updates: { metadata: { nekoUrl: "https://new.neko" } },
        })
      );

      const session = store.getState().sessions.sessions.find(
        (s) => s.id === "session-1"
      );
      expect(session?.metadata?.sandboxId).toBe("sb-old"); // unchanged
      expect(session?.metadata?.nekoUrl).toBe("https://new.neko"); // updated
    });

    it("should not lose non-metadata fields when metadata is updated", () => {
      store.dispatch(
        setSessions({
          sessions: [
            makeSession({
              id: "session-1",
              title: "My Session",
              status: "active",
              metadata: { sandboxId: "sb-abc" },
            }),
          ],
        })
      );

      store.dispatch(
        updateSession({
          id: "session-1",
          updates: { metadata: { nekoUrl: "https://neko.e2b.dev" } },
        })
      );

      const session = store.getState().sessions.sessions.find(
        (s) => s.id === "session-1"
      );
      expect(session?.title).toBe("My Session");
      expect(session?.status).toBe("active");
      expect(session?.userId).toBe("user-1");
      expect(session?.metadata?.sandboxId).toBe("sb-abc");
      expect(session?.metadata?.nekoUrl).toBe("https://neko.e2b.dev");
    });

    it("should not lose existing metadata when non-metadata fields are updated alongside", () => {
      store.dispatch(
        setSessions({
          sessions: [
            makeSession({
              id: "session-1",
              title: "Old Title",
              metadata: { sandboxId: "sb-123", nekoUrl: "https://neko.e2b.dev" },
            }),
          ],
        })
      );

      store.dispatch(
        updateSession({
          id: "session-1",
          updates: {
            title: "New Title",
            metadata: { streamUrl: "https://stream.e2b.dev" },
          },
        })
      );

      const session = store.getState().sessions.sessions.find(
        (s) => s.id === "session-1"
      );
      expect(session?.title).toBe("New Title");
      expect(session?.metadata?.sandboxId).toBe("sb-123");
      expect(session?.metadata?.nekoUrl).toBe("https://neko.e2b.dev");
      expect(session?.metadata?.streamUrl).toBe("https://stream.e2b.dev");
    });

    it("should do nothing when the session id does not exist", () => {
      store.dispatch(
        setSessions({ sessions: [makeSession({ id: "session-1" })] })
      );

      store.dispatch(
        updateSession({
          id: "non-existent",
          updates: { metadata: { sandboxId: "sb-xyz" } },
        })
      );

      const session = store.getState().sessions.sessions.find(
        (s) => s.id === "session-1"
      );
      expect(session?.metadata).toBeUndefined();
      expect(store.getState().sessions.sessions).toHaveLength(1);
    });

    it("should update the updatedAt timestamp when metadata is changed", () => {
      const originalUpdatedAt = "2026-01-01T00:00:00.000Z";
      store.dispatch(
        setSessions({
          sessions: [makeSession({ id: "session-1", updatedAt: originalUpdatedAt })],
        })
      );

      store.dispatch(
        updateSession({
          id: "session-1",
          updates: { metadata: { sandboxId: "sb-ts-test" } },
        })
      );

      const session = store.getState().sessions.sessions.find(
        (s) => s.id === "session-1"
      );
      expect(session?.updatedAt).not.toBe(originalUpdatedAt);
      expect(new Date(session!.updatedAt).getTime()).toBeGreaterThan(
        new Date(originalUpdatedAt).getTime()
      );
    });

    it("should preserve arbitrary custom metadata keys during deep-merge", () => {
      store.dispatch(
        setSessions({
          sessions: [
            makeSession({
              id: "session-1",
              metadata: {
                sandboxId: "sb-custom",
                customKey: "customValue",
                anotherKey: 42,
              },
            }),
          ],
        })
      );

      store.dispatch(
        updateSession({
          id: "session-1",
          updates: { metadata: { nekoUrl: "https://neko.e2b.dev" } },
        })
      );

      const session = store.getState().sessions.sessions.find(
        (s) => s.id === "session-1"
      );
      expect(session?.metadata?.sandboxId).toBe("sb-custom");
      expect(session?.metadata?.customKey).toBe("customValue");
      expect(session?.metadata?.anotherKey).toBe(42);
      expect(session?.metadata?.nekoUrl).toBe("https://neko.e2b.dev");
    });
  });

  // ── Regression: shallow-replace bug ──

  describe("regression: previous shallow-replace behavior", () => {
    it("should NOT lose sandboxId when nekoUrl is dispatched second (the original bug)", () => {
      store.dispatch(
        setSessions({
          sessions: [
            makeSession({
              id: "session-1",
              metadata: { sandboxId: "sb-regression-test" },
            }),
          ],
        })
      );

      store.dispatch(
        updateSession({
          id: "session-1",
          updates: { metadata: { nekoUrl: "https://neko.regression.test" } },
        })
      );

      const session = store.getState().sessions.sessions.find(
        (s) => s.id === "session-1"
      );

      // With the fix: both keys exist
      expect(session?.metadata?.sandboxId).toBe("sb-regression-test");
      expect(session?.metadata?.nekoUrl).toBe("https://neko.regression.test");
    });
  });
});
