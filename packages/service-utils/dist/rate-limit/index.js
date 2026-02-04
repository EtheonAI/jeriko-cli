// src/rate-limit/index.ts
function rateLimitPlugin(config = {}) {
  const {
    max = 100,
    windowMs = 6e4,
    keyGenerator = (request) => request.ip,
    skip,
    message = "Too many requests, please try again later",
    headers = true,
    excludeRoutes = ["/health", "/metrics", "/ready", "/live"]
  } = config;
  const store = /* @__PURE__ */ new Map();
  const cleanup = () => {
    const now = Date.now();
    for (const [key, value] of store.entries()) {
      if (value.resetTime < now) {
        store.delete(key);
      }
    }
  };
  return async (fastify) => {
    const cleanupInterval = setInterval(cleanup, 6e4);
    fastify.addHook("onClose", () => clearInterval(cleanupInterval));
    fastify.addHook("onRequest", async (request, reply) => {
      if (excludeRoutes.some((route) => request.url.startsWith(route))) {
        return;
      }
      if (skip && skip(request)) {
        return;
      }
      const key = keyGenerator(request);
      const now = Date.now();
      let state = store.get(key);
      if (!state || state.resetTime < now) {
        state = {
          count: 1,
          resetTime: now + windowMs
        };
        store.set(key, state);
      } else {
        state.count++;
      }
      if (headers) {
        reply.header("X-RateLimit-Limit", max);
        reply.header("X-RateLimit-Remaining", Math.max(0, max - state.count));
        reply.header("X-RateLimit-Reset", Math.ceil(state.resetTime / 1e3));
      }
      if (state.count > max) {
        reply.header("Retry-After", Math.ceil((state.resetTime - now) / 1e3));
        return reply.status(429).send({
          error: "Too Many Requests",
          message,
          retryAfter: Math.ceil((state.resetTime - now) / 1e3)
        });
      }
    });
    fastify.log.info(`Rate limiting enabled: ${max} requests per ${windowMs / 1e3}s`);
  };
}
function createRedisRateLimiter(redis) {
  return async function checkRateLimit(key, max, windowSeconds) {
    const redisKey = `ratelimit:${key}`;
    const now = Math.floor(Date.now() / 1e3);
    const windowStart = now - now % windowSeconds;
    const windowKey = `${redisKey}:${windowStart}`;
    const count = await redis.incr(windowKey);
    if (count === 1) {
      await redis.expire(windowKey, windowSeconds + 1);
    }
    return {
      allowed: count <= max,
      remaining: Math.max(0, max - count),
      resetTime: windowStart + windowSeconds
    };
  };
}
function createEndpointLimits(limits) {
  return new Map(Object.entries(limits));
}
var rateLimitPresets = {
  /**
   * Standard API rate limit
   */
  standard: {
    max: 100,
    windowMs: 6e4
    // 1 minute
  },
  /**
   * Strict limit for sensitive endpoints (login, registration)
   */
  strict: {
    max: 10,
    windowMs: 6e4
    // 1 minute
  },
  /**
   * Relaxed limit for read operations
   */
  relaxed: {
    max: 500,
    windowMs: 6e4
    // 1 minute
  },
  /**
   * Very strict limit for expensive operations
   */
  expensive: {
    max: 5,
    windowMs: 6e4
    // 1 minute
  },
  /**
   * Webhook delivery limits
   */
  webhook: {
    max: 1e3,
    windowMs: 6e4
    // 1 minute
  }
};
export {
  createEndpointLimits,
  createRedisRateLimiter,
  rateLimitPlugin,
  rateLimitPresets
};
//# sourceMappingURL=index.js.map