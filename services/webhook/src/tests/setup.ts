/**
 * vi.mock calls for the webhook service.
 * These MUST be at the top of each test file (vi.mock is hoisted).
 *
 * Mocks: @repo/service-utils, @repo/service-utils/errors,
 *        ../lib/db.js, ../lib/deliver.js, ../lib/processor.js.
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
    z: (() => {
  const chainable: any = new Proxy({}, {
    get: () => (..._args: unknown[]) => chainable,
  });
  chainable.object = (schema: unknown) => ({ parse: (v: unknown) => v, safeParse: (v: unknown) => ({ success: true, data: v }), ...chainable, _def: { shape: () => schema } });
  chainable.string = () => chainable;
  chainable.number = () => chainable;
  chainable.boolean = () => chainable;
  chainable.array = () => chainable;
  chainable.enum = () => chainable;
  chainable.record = () => chainable;
  chainable.union = () => chainable;
  chainable.optional = () => chainable;
  chainable.default = () => chainable;
  chainable.min = () => chainable;
  chainable.max = () => chainable;
  chainable.url = () => chainable;
  chainable.coerce = chainable;
  chainable.int = () => chainable;
  return chainable;
})(),
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

// Mock the deliver module
vi.mock("../lib/deliver.js", () => ({
  processDelivery: vi.fn().mockResolvedValue(undefined),
}));

// Mock the processor module
vi.mock("../lib/processor.js", () => ({
  startProcessor: vi.fn(),
  stopProcessor: vi.fn(),
}));

// Mock the webhook service's lib/db module
vi.mock("../lib/db.js", () => {
  const mockTable = (name: string) => ({
    _: { name },
    id: { _: { name: "id" } },
    userId: { _: { name: "userId" } },
    webhookId: { _: { name: "webhookId" } },
    eventId: { _: { name: "eventId" } },
    status: { _: { name: "status" } },
    events: { _: { name: "events" } },
    url: { _: { name: "url" } },
    name: { _: { name: "name" } },
    secret: { _: { name: "secret" } },
    createdAt: { _: { name: "createdAt" } },
    nextRetryAt: { _: { name: "nextRetryAt" } },
    eventType: { _: { name: "eventType" } },
    processed: { _: { name: "processed" } },
    processedAt: { _: { name: "processedAt" } },
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
    innerJoin: vi.fn().mockReturnThis(),
    transaction: vi.fn().mockImplementation(async (fn: Function) => fn(mockDb)),
  };

  return {
    db: mockDb,
    webhooks: mockTable("webhooks"),
    webhookDeliveries: mockTable("webhookDeliveries"),
    webhookEvents: mockTable("webhookEvents"),
    initDb: vi.fn().mockResolvedValue(undefined),
    eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
    and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
    desc: vi.fn((col: unknown) => ({ type: "desc", col })),
    sql: Object.assign(vi.fn(), { raw: vi.fn() }),
  };
});
