/**
 * vi.mock calls for the task service.
 * These MUST be at the top of each test file (vi.mock is hoisted).
 *
 * Mocks: @repo/service-utils, @repo/service-utils/errors, @repo/service-utils/circuit-breaker,
 *        inngest, and ../lib/db.js (initDb pattern).
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

vi.mock("@repo/service-utils/circuit-breaker", () => ({
  CircuitBreaker: vi.fn().mockImplementation(() => ({
    execute: async (fn: () => Promise<unknown>) => fn(),
    getState: () => "closed",
    getStats: () => ({}),
  })),
}));

// Mock Inngest
vi.mock("inngest", () => ({
  Inngest: vi.fn().mockImplementation(() => ({
    createFunction: vi.fn(),
    send: vi.fn().mockResolvedValue({ ids: ["test-event-id"] }),
  })),
  EventSchemas: vi.fn(),
  serve: vi.fn().mockReturnValue(async () => new Response("OK")),
}));

// Mock the task service's lib/db module
vi.mock("../lib/db.js", () => {
  const mockTable = (name: string) => ({
    _: { name },
    id: { _: { name: "id" } },
    userId: { _: { name: "userId" } },
    status: { _: { name: "status" } },
    name: { _: { name: "name" } },
    type: { _: { name: "type" } },
    cronExpression: { _: { name: "cronExpression" } },
    nextRunAt: { _: { name: "nextRunAt" } },
    lastRunAt: { _: { name: "lastRunAt" } },
    createdAt: { _: { name: "createdAt" } },
    updatedAt: { _: { name: "updatedAt" } },
    taskId: { _: { name: "taskId" } },
    agentId: { _: { name: "agentId" } },
    sessionId: { _: { name: "sessionId" } },
    isEnabled: { _: { name: "isEnabled" } },
    scheduleType: { _: { name: "scheduleType" } },
    triggerEnabled: { _: { name: "triggerEnabled" } },
    triggerAppName: { _: { name: "triggerAppName" } },
    triggerEventSlug: { _: { name: "triggerEventSlug" } },
    composioTriggerId: { _: { name: "composioTriggerId" } },
    lastTriggerAt: { _: { name: "lastTriggerAt" } },
    lastTriggerEventId: { _: { name: "lastTriggerEventId" } },
    role: { _: { name: "role" } },
    content: { _: { name: "content" } },
    parts: { _: { name: "parts" } },
    metadata: { _: { name: "metadata" } },
    title: { _: { name: "title" } },
    activeStreamId: { _: { name: "activeStreamId" } },
    startedAt: { _: { name: "startedAt" } },
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
    db: mockDb,
    scheduledTasks: mockTable("scheduledTasks"),
    taskExecutions: mockTable("taskExecutions"),
    agentSessions: mockTable("agentSessions"),
    messages: mockTable("messages"),
    agents: mockTable("agents"),
    agentTasks: mockTable("agentTasks"),
    initDb: vi.fn().mockResolvedValue(undefined),
    eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
    and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
    or: vi.fn((...args: unknown[]) => ({ type: "or", args })),
    desc: vi.fn((col: unknown) => ({ type: "desc", col })),
    asc: vi.fn((col: unknown) => ({ type: "asc", col })),
    sql: Object.assign(vi.fn(), { raw: vi.fn() }),
    lte: vi.fn((...args: unknown[]) => ({ type: "lte", args })),
    gte: vi.fn((...args: unknown[]) => ({ type: "gte", args })),
    inArray: vi.fn((...args: unknown[]) => ({ type: "inArray", args })),
  };
});
