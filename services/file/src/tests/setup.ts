/**
 * vi.mock calls for the file service.
 * These MUST be at the top of each test file (vi.mock is hoisted).
 *
 * Mocks: @repo/service-utils, @repo/service-utils/errors, @repo/service-utils/security,
 *        @repo/service-utils/circuit-breaker, @repo/database/service-index, @repo/storage,
 *        and @fastify/multipart.
 */
import { vi } from "vitest";

vi.mock("@repo/service-utils", () => {
  const noopLogger = {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
    child: () => noopLogger,
  };

  return {
    createService: vi.fn().mockResolvedValue({
      app: {
        register: vi.fn().mockResolvedValue(undefined),
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
        patch: vi.fn(),
        listen: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
        ready: vi.fn().mockResolvedValue(undefined),
        server: { address: () => ({ port: 0 }) },
      },
      logger: noopLogger,
      start: vi.fn().mockResolvedValue(undefined),
    }),
    createLogger: () => noopLogger,
    getEnv: (_key: string, fallback: string) => fallback,
    createId: () => `test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    typedRoute: (_opts: unknown, handler: Function) => handler,
    dispatchWebhookEvent: vi.fn(),
    getRedisClient: () => ({
      ping: async () => "PONG",
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue("OK"),
      del: vi.fn().mockResolvedValue(1),
      quit: async () => "OK",
    }),
    getRedisPubClient: () => ({
      publish: vi.fn().mockResolvedValue(1),
    }),
    getRedisSubClient: () => ({
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
      on: vi.fn(),
    }),
    extractAuth: vi.fn().mockResolvedValue({ userId: "test-user-id" }),
    subscribe: vi.fn(),
    publish: vi.fn(),
    closeRedis: vi.fn(),
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
      VALIDATION_ERROR: "VALIDATION_ERROR",
      FORBIDDEN: "FORBIDDEN",
    },
  };
});

vi.mock("@repo/service-utils/errors", () => ({
  NotFoundError: class NotFoundError extends Error {
    code = "NOT_FOUND";
  },
  ValidationError: class ValidationError extends Error {
    code = "VALIDATION_ERROR";
  },
  AuthenticationError: class AuthenticationError extends Error {
    code = "UNAUTHORIZED";
  },
  AuthorizationError: class AuthorizationError extends Error {
    code = "FORBIDDEN";
  },
}));

vi.mock("@repo/service-utils/security", () => ({
  sanitizePath: (path: string) => path.replace(/\.\./g, ""),
}));

vi.mock("@repo/service-utils/circuit-breaker", () => ({
  CircuitBreaker: vi.fn().mockImplementation(() => ({
    execute: async (fn: () => Promise<unknown>) => fn(),
    getState: () => "closed",
    getStats: () => ({}),
  })),
}));

// Mock @fastify/multipart
vi.mock("@fastify/multipart", () => ({
  default: vi.fn(),
}));

// Mock @repo/database/service-index (file service uses dynamic import)
vi.mock("@repo/database/service-index", () => {
  const mockTable = (name: string) => ({
    _: { name },
    id: { _: { name: "id" } },
    userId: { _: { name: "userId" } },
    fileId: { _: { name: "fileId" } },
    createdAt: { _: { name: "createdAt" } },
    sessionId: { _: { name: "sessionId" } },
    mimeType: { _: { name: "mimeType" } },
    version: { _: { name: "version" } },
    storageKey: { _: { name: "storageKey" } },
  });

  const mockDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    orderBy: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    transaction: vi.fn().mockImplementation(async (fn: Function) => fn(mockDb)),
  };

  return {
    default: {
      db: mockDb,
      files: mockTable("files"),
      fileVersions: mockTable("fileVersions"),
    },
    db: mockDb,
    files: mockTable("files"),
    fileVersions: mockTable("fileVersions"),
  };
});

// Mock @repo/storage
vi.mock("@repo/storage", () => ({
  default: {
    uploadFile: vi.fn().mockResolvedValue(undefined),
    getPresignedUrl: vi.fn().mockResolvedValue("https://s3.example.com/presigned-url"),
    deleteFiles: vi.fn().mockResolvedValue(undefined),
    getStorageKey: vi.fn().mockReturnValue("users/test-user-id/files/test-file-id/test.txt"),
    getVersionStorageKey: vi.fn().mockReturnValue("users/test-user-id/files/test-file-id/v2/test.txt"),
  },
  uploadFile: vi.fn().mockResolvedValue(undefined),
  getPresignedUrl: vi.fn().mockResolvedValue("https://s3.example.com/presigned-url"),
  deleteFiles: vi.fn().mockResolvedValue(undefined),
  getStorageKey: vi.fn().mockReturnValue("users/test-user-id/files/test-file-id/test.txt"),
  getVersionStorageKey: vi.fn().mockReturnValue("users/test-user-id/files/test-file-id/v2/test.txt"),
}));
