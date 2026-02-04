// src/testing/index.ts
function createMockRequest(options = {}) {
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
    log: createMockLogger()
  };
}
function createMockReply() {
  let statusCode = 200;
  const headers = {};
  let body = null;
  const reply = {
    statusCode,
    code(code) {
      statusCode = code;
      return this;
    },
    status(code) {
      statusCode = code;
      return this;
    },
    header(name, value) {
      headers[name.toLowerCase()] = value;
      return this;
    },
    type(contentType) {
      headers["content-type"] = contentType;
      return this;
    },
    send(payload) {
      body = payload;
      return this;
    },
    getHeader(name) {
      return headers[name.toLowerCase()];
    },
    hasHeader(name) {
      return name.toLowerCase() in headers;
    }
  };
  return {
    reply,
    getResponse: () => ({ statusCode, headers, body })
  };
}
function createMockLogger() {
  const logs = [];
  const log = (level) => (msg, data) => {
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
    clear: () => logs.splice(0, logs.length)
  };
}
async function injectRequest(app, options) {
  const queryString = options.query ? "?" + new URLSearchParams(options.query).toString() : "";
  const response = await app.inject({
    method: options.method,
    url: `${options.url}${queryString}`,
    headers: {
      "content-type": "application/json",
      ...options.headers
    },
    payload: options.payload ? JSON.stringify(options.payload) : void 0
  });
  return {
    statusCode: response.statusCode,
    headers: response.headers,
    body: response.json(),
    raw: response.body
  };
}
var fixtures = {
  /**
   * Generate a test user
   */
  user(overrides = {}) {
    return {
      id: overrides.id || `user_${Date.now()}`,
      email: overrides.email || `test-${Date.now()}@example.com`,
      name: overrides.name || "Test User",
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
  },
  /**
   * Generate a test JWT token (for mocking)
   */
  authHeader(userId = "test-user-id") {
    return {
      authorization: `Bearer mock-token-${userId}`
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
  }
};
async function waitFor(condition, options = {}) {
  const { timeout = 5e3, interval = 100 } = options;
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await condition()) return;
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
  throw new Error(`Timeout waiting for condition after ${timeout}ms`);
}
function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
function createMockRedis() {
  const store = /* @__PURE__ */ new Map();
  const expiry = /* @__PURE__ */ new Map();
  return {
    get: async (key) => store.get(key) || null,
    set: async (key, value, _mode, ttl) => {
      store.set(key, value);
      if (ttl) {
        expiry.set(key, Date.now() + ttl * 1e3);
      }
      return "OK";
    },
    del: async (key) => {
      store.delete(key);
      expiry.delete(key);
      return 1;
    },
    exists: async (key) => store.has(key) ? 1 : 0,
    expire: async (key, seconds) => {
      if (store.has(key)) {
        expiry.set(key, Date.now() + seconds * 1e3);
        return 1;
      }
      return 0;
    },
    ttl: async (key) => {
      const exp = expiry.get(key);
      if (!exp) return -1;
      return Math.max(0, Math.ceil((exp - Date.now()) / 1e3));
    },
    keys: async (pattern) => {
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
    _expiry: expiry
  };
}
export {
  createDeferred,
  createMockLogger,
  createMockRedis,
  createMockReply,
  createMockRequest,
  fixtures,
  injectRequest,
  waitFor
};
//# sourceMappingURL=index.js.map