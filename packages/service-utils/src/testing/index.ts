import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

/**
 * Test utilities for Fastify services
 */

export interface MockRequest {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  query?: Record<string, string>;
  params?: Record<string, string>;
  body?: unknown;
  user?: { id: string; email: string; [key: string]: unknown };
}

export interface MockReply {
  statusCode: number;
  headers: Record<string, string>;
  body: unknown;
}

/**
 * Create a mock Fastify request for testing
 */
export function createMockRequest(options: MockRequest = {}): FastifyRequest {
  return {
    method: options.method || "GET",
    url: options.url || "/",
    headers: options.headers || {},
    query: options.query || {},
    params: options.params || {},
    body: options.body,
    user: options.user,
    id: `test-${Date.now()}`,
    ip: "127.0.0.1",
    ips: ["127.0.0.1"],
    hostname: "localhost",
    protocol: "http",
    log: createMockLogger(),
  } as unknown as FastifyRequest;
}

/**
 * Create a mock Fastify reply for testing
 */
export function createMockReply(): {
  reply: FastifyReply;
  getResponse: () => MockReply;
} {
  let statusCode = 200;
  const headers: Record<string, string> = {};
  let body: unknown = null;

  const reply = {
    statusCode,
    code(code: number) {
      statusCode = code;
      return this;
    },
    status(code: number) {
      statusCode = code;
      return this;
    },
    header(name: string, value: string) {
      headers[name.toLowerCase()] = value;
      return this;
    },
    type(contentType: string) {
      headers["content-type"] = contentType;
      return this;
    },
    send(payload: unknown) {
      body = payload;
      return this;
    },
    getHeader(name: string) {
      return headers[name.toLowerCase()];
    },
    hasHeader(name: string) {
      return name.toLowerCase() in headers;
    },
  } as unknown as FastifyReply;

  return {
    reply,
    getResponse: () => ({ statusCode, headers, body }),
  };
}

/**
 * Create a mock logger for testing
 */
export function createMockLogger() {
  const logs: Array<{ level: string; msg: string; data?: unknown }> = [];

  const log = (level: string) => (msg: string, data?: unknown) => {
    logs.push({ level, msg, data });
  };

  return {
    trace: log("trace"),
    debug: log("debug"),
    info: log("info"),
    warn: log("warn"),
    error: log("error"),
    fatal: log("fatal"),
    child: () => createMockLogger(),
    getLogs: () => logs,
    clear: () => logs.splice(0, logs.length),
  };
}

/**
 * Test helper to inject requests into Fastify
 */
export async function injectRequest(
  app: FastifyInstance,
  options: {
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    url: string;
    headers?: Record<string, string>;
    payload?: unknown;
    query?: Record<string, string>;
  }
) {
  const queryString = options.query
    ? "?" + new URLSearchParams(options.query).toString()
    : "";

  const response = await app.inject({
    method: options.method,
    url: `${options.url}${queryString}`,
    headers: {
      "content-type": "application/json",
      ...options.headers,
    },
    payload: options.payload ? JSON.stringify(options.payload) : undefined,
  });

  return {
    statusCode: response.statusCode,
    headers: response.headers,
    body: response.json(),
    raw: response.body,
  };
}

/**
 * Create test fixtures
 */
export const fixtures = {
  /**
   * Generate a test user
   */
  user(overrides: Partial<{ id: string; email: string; name: string }> = {}) {
    return {
      id: overrides.id || `user_${Date.now()}`,
      email: overrides.email || `test-${Date.now()}@example.com`,
      name: overrides.name || "Test User",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  },

  /**
   * Generate a test JWT token (for mocking)
   */
  authHeader(userId = "test-user-id") {
    // This is a mock token for testing - not a real JWT
    return {
      authorization: `Bearer mock-token-${userId}`,
    };
  },

  /**
   * Generate pagination params
   */
  pagination(page = 1, limit = 20) {
    return { page: String(page), limit: String(limit) };
  },

  /**
   * Generate a unique ID
   */
  id(prefix = "test") {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  },
};

/**
 * Wait for a condition to be true
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  options: { timeout?: number; interval?: number } = {}
): Promise<void> {
  const { timeout = 5000, interval = 100 } = options;
  const start = Date.now();

  while (Date.now() - start < timeout) {
    if (await condition()) return;
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error(`Timeout waiting for condition after ${timeout}ms`);
}

/**
 * Create a deferred promise for async testing
 */
export function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

/**
 * Mock Redis client for testing
 */
export function createMockRedis() {
  const store = new Map<string, string>();
  const expiry = new Map<string, number>();

  return {
    get: async (key: string) => store.get(key) || null,
    set: async (key: string, value: string, _mode?: string, ttl?: number) => {
      store.set(key, value);
      if (ttl) {
        expiry.set(key, Date.now() + ttl * 1000);
      }
      return "OK";
    },
    del: async (key: string) => {
      store.delete(key);
      expiry.delete(key);
      return 1;
    },
    exists: async (key: string) => (store.has(key) ? 1 : 0),
    expire: async (key: string, seconds: number) => {
      if (store.has(key)) {
        expiry.set(key, Date.now() + seconds * 1000);
        return 1;
      }
      return 0;
    },
    ttl: async (key: string) => {
      const exp = expiry.get(key);
      if (!exp) return -1;
      return Math.max(0, Math.ceil((exp - Date.now()) / 1000));
    },
    keys: async (pattern: string) => {
      const regex = new RegExp(pattern.replace(/\*/g, ".*"));
      return Array.from(store.keys()).filter((k) => regex.test(k));
    },
    flushall: async () => {
      store.clear();
      expiry.clear();
      return "OK";
    },
    quit: async () => "OK",
    _store: store,
    _expiry: expiry,
  };
}
