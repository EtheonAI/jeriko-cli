import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================================
// Mock external dependencies that are unavailable in test env
// ============================================================

vi.mock("@repo/database", () => ({
  db: { select: vi.fn(), update: vi.fn() },
  agentSessions: {},
  eq: vi.fn(),
}));

vi.mock("@repo/observability/log", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// ============================================================
// Tests
// ============================================================

describe("resumable-stream", () => {
  // We need to reset module state between tests because
  // getStreamContext uses a module-level _initAttempted flag.
  beforeEach(() => {
    vi.resetModules();
    // Clear any REDIS_URL that might leak between tests
    delete process.env.REDIS_URL;
  });

  // ----------------------------------------------------------
  // getStreamContext
  // ----------------------------------------------------------

  describe("getStreamContext", () => {
    it("returns null when REDIS_URL is not set", async () => {
      // Re-mock after resetModules
      vi.doMock("@repo/database", () => ({
        db: { select: vi.fn(), update: vi.fn() },
        agentSessions: {},
        eq: vi.fn(),
      }));
      vi.doMock("@repo/observability/log", () => ({
        log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      }));

      delete process.env.REDIS_URL;

      const { getStreamContext } = await import("../resumable-stream");
      const result = await getStreamContext();

      expect(result).toBeNull();
    });

    it("returns null when resumable-stream import fails", async () => {
      // Re-mock after resetModules
      vi.doMock("@repo/database", () => ({
        db: { select: vi.fn(), update: vi.fn() },
        agentSessions: {},
        eq: vi.fn(),
      }));
      vi.doMock("@repo/observability/log", () => ({
        log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      }));

      // Make the dynamic import of "resumable-stream/ioredis" throw
      vi.doMock("resumable-stream/ioredis", () => {
        throw new Error("Module not found: resumable-stream/ioredis");
      });

      process.env.REDIS_URL = "redis://localhost:6379";

      const { getStreamContext } = await import("../resumable-stream");
      const result = await getStreamContext();

      expect(result).toBeNull();
    });

    it("caches the result and does not re-initialise on second call", async () => {
      vi.doMock("@repo/database", () => ({
        db: { select: vi.fn(), update: vi.fn() },
        agentSessions: {},
        eq: vi.fn(),
      }));
      const logMock = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
      vi.doMock("@repo/observability/log", () => ({
        log: logMock,
      }));

      delete process.env.REDIS_URL;

      const { getStreamContext } = await import("../resumable-stream");

      const first = await getStreamContext();
      const second = await getStreamContext();

      expect(first).toBeNull();
      expect(second).toBeNull();
      // The info log for "REDIS_URL not set" should only fire once
      expect(logMock.info).toHaveBeenCalledTimes(1);
    });
  });

  // ----------------------------------------------------------
  // getActiveStreamId
  // ----------------------------------------------------------

  describe("getActiveStreamId", () => {
    it("returns null on DB error", async () => {
      const selectMock = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockRejectedValue(new Error("DB connection lost")),
          }),
        }),
      });

      vi.doMock("@repo/database", () => ({
        db: { select: selectMock, update: vi.fn() },
        agentSessions: { activeStreamId: "activeStreamId", id: "id" },
        eq: vi.fn(),
      }));
      vi.doMock("@repo/observability/log", () => ({
        log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      }));

      const { getActiveStreamId } = await import("../resumable-stream");
      const result = await getActiveStreamId("session-123");

      expect(result).toBeNull();
    });

    it("returns null when no row is found", async () => {
      const selectMock = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      vi.doMock("@repo/database", () => ({
        db: { select: selectMock, update: vi.fn() },
        agentSessions: { activeStreamId: "activeStreamId", id: "id" },
        eq: vi.fn(),
      }));
      vi.doMock("@repo/observability/log", () => ({
        log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      }));

      const { getActiveStreamId } = await import("../resumable-stream");
      const result = await getActiveStreamId("nonexistent-session");

      expect(result).toBeNull();
    });

    it("returns the stream ID when a row is found", async () => {
      const selectMock = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ activeStreamId: "stream-abc" }]),
          }),
        }),
      });

      vi.doMock("@repo/database", () => ({
        db: { select: selectMock, update: vi.fn() },
        agentSessions: { activeStreamId: "activeStreamId", id: "id" },
        eq: vi.fn(),
      }));
      vi.doMock("@repo/observability/log", () => ({
        log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      }));

      const { getActiveStreamId } = await import("../resumable-stream");
      const result = await getActiveStreamId("session-123");

      expect(result).toBe("stream-abc");
    });
  });

  // ----------------------------------------------------------
  // setActiveStreamId
  // ----------------------------------------------------------

  describe("setActiveStreamId", () => {
    it("does not throw on DB error", async () => {
      const updateMock = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockRejectedValue(new Error("DB write failed")),
        }),
      });

      vi.doMock("@repo/database", () => ({
        db: { select: vi.fn(), update: updateMock },
        agentSessions: { activeStreamId: "activeStreamId", id: "id" },
        eq: vi.fn(),
      }));
      vi.doMock("@repo/observability/log", () => ({
        log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      }));

      const { setActiveStreamId } = await import("../resumable-stream");

      // Should resolve without throwing
      await expect(
        setActiveStreamId("session-123", "stream-xyz")
      ).resolves.toBeUndefined();
    });

    it("logs an error on DB failure", async () => {
      const dbError = new Error("DB write failed");
      const updateMock = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockRejectedValue(dbError),
        }),
      });

      const logMock = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
      vi.doMock("@repo/database", () => ({
        db: { select: vi.fn(), update: updateMock },
        agentSessions: { activeStreamId: "activeStreamId", id: "id" },
        eq: vi.fn(),
      }));
      vi.doMock("@repo/observability/log", () => ({
        log: logMock,
      }));

      const { setActiveStreamId } = await import("../resumable-stream");
      await setActiveStreamId("session-123", "stream-xyz");

      expect(logMock.error).toHaveBeenCalledWith(
        "Failed to set active stream ID:",
        dbError
      );
    });
  });

  // ----------------------------------------------------------
  // clearActiveStreamId
  // ----------------------------------------------------------

  describe("clearActiveStreamId", () => {
    it("does not throw on DB error", async () => {
      const updateMock = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockRejectedValue(new Error("DB connection reset")),
        }),
      });

      vi.doMock("@repo/database", () => ({
        db: { select: vi.fn(), update: updateMock },
        agentSessions: { activeStreamId: "activeStreamId", id: "id" },
        eq: vi.fn(),
      }));
      vi.doMock("@repo/observability/log", () => ({
        log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      }));

      const { clearActiveStreamId } = await import("../resumable-stream");

      // Should resolve without throwing
      await expect(
        clearActiveStreamId("session-123")
      ).resolves.toBeUndefined();
    });

    it("logs an error on DB failure", async () => {
      const dbError = new Error("DB connection reset");
      const updateMock = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockRejectedValue(dbError),
        }),
      });

      const logMock = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
      vi.doMock("@repo/database", () => ({
        db: { select: vi.fn(), update: updateMock },
        agentSessions: { activeStreamId: "activeStreamId", id: "id" },
        eq: vi.fn(),
      }));
      vi.doMock("@repo/observability/log", () => ({
        log: logMock,
      }));

      const { clearActiveStreamId } = await import("../resumable-stream");
      await clearActiveStreamId("session-123");

      expect(logMock.error).toHaveBeenCalledWith(
        "Failed to clear active stream ID:",
        dbError
      );
    });
  });
});
