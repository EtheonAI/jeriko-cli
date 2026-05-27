/**
 * vi.mock calls for @repo/service-utils.
 * These MUST be at the top of each test file (vi.mock is hoisted).
 *
 * The mocks reference the helpers module for shared state.
 */
import { vi } from "vitest";

// vi.mock is hoisted above ALL imports, so the factory runs before any
// route module tries to import @repo/service-utils.
vi.mock("@repo/service-utils", () => {
  // We can't import helpers.ts here (hoisted), so re-create minimal state inline.
  // Test files will import and mutate these via helpers.ts.
  const noopLogger = {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
    child: () => noopLogger,
  };

  // Shared mutable state — accessed via globalThis for cross-module sharing
  if (!(globalThis as Record<string, unknown>).__wsTestState) {
    (globalThis as Record<string, unknown>).__wsTestState = {
      mockAuthResult: null as { userId: string; email?: string } | null,
      channelCallbacks: new Map<string, Set<(msg: unknown) => void>>(),
      mockPubCalls: [] as Array<{ channel: string; message: string }>,
    };
  }

  const state = (globalThis as Record<string, unknown>).__wsTestState as {
    mockAuthResult: { userId: string; email?: string } | null;
    channelCallbacks: Map<string, Set<(msg: unknown) => void>>;
    mockPubCalls: Array<{ channel: string; message: string }>;
  };

  return {
    createLogger: () => noopLogger,
    getEnv: (_key: string, fallback: string) => fallback,
    getRedisClient: () => ({
      ping: async () => "PONG",
      quit: async () => "OK",
    }),
    getRedisPubClient: () => ({
      publish: (channel: string, message: string) => {
        state.mockPubCalls.push({ channel, message });
        return Promise.resolve(1);
      },
    }),
    getRedisSubClient: () => ({
      subscribe: () => {},
      unsubscribe: () => {},
      on: () => {},
    }),
    extractAuth: async () => state.mockAuthResult,
    subscribe: (channel: string, callback: (msg: unknown) => void) => {
      let cbs = state.channelCallbacks.get(channel);
      if (!cbs) {
        cbs = new Set();
        state.channelCallbacks.set(channel, cbs);
      }
      cbs.add(callback);
      return () => {
        const set = state.channelCallbacks.get(channel);
        if (set) {
          set.delete(callback);
          if (set.size === 0) state.channelCallbacks.delete(channel);
        }
      };
    },
    publish: async (channel: string, message: unknown) => {
      state.mockPubCalls.push({ channel, message: JSON.stringify(message) });
    },
    closeRedis: async () => {},
    createHealthCheck: () => ({ status: "ok" }),
    errorResponse: (err: { code: string; message: string }, reqId: string) => ({
      data: null,
      meta: { requestId: reqId },
      error: { code: err.code, message: err.message },
    }),
    ErrorCodes: {
      NOT_FOUND: "NOT_FOUND",
      UNAUTHORIZED: "UNAUTHORIZED",
      INTERNAL_ERROR: "INTERNAL_ERROR",
    },
  };
});

vi.mock("@repo/service-utils/circuit-breaker", () => ({
  CircuitBreaker: vi.fn().mockImplementation(() => ({
    execute: async (fn: () => Promise<unknown>) => fn(),
    getState: () => "closed",
    getStats: () => ({}),
  })),
}));
