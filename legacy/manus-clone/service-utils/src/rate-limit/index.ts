import type { FastifyInstance, FastifyPluginAsync, FastifyRequest } from "fastify";

export interface RateLimitConfig {
  /**
   * Maximum number of requests allowed in the window
   * @default 100
   */
  max?: number;

  /**
   * Time window in milliseconds
   * @default 60000 (1 minute)
   */
  windowMs?: number;

  /**
   * Key generator function for identifying clients
   * @default Uses IP address
   */
  keyGenerator?: (request: FastifyRequest) => string;

  /**
   * Skip certain requests from rate limiting
   */
  skip?: (request: FastifyRequest) => boolean;

  /**
   * Custom error message
   */
  message?: string;

  /**
   * Headers to add to response
   */
  headers?: boolean;

  /**
   * Routes to exclude from rate limiting
   */
  excludeRoutes?: string[];
}

interface RateLimitState {
  count: number;
  resetTime: number;
}

/**
 * In-memory rate limiter for Fastify
 * For production with multiple instances, use Redis-based rate limiting
 */
export function rateLimitPlugin(config: RateLimitConfig = {}): FastifyPluginAsync {
  const {
    max = 100,
    windowMs = 60000,
    keyGenerator = (request) => request.ip,
    skip,
    message = "Too many requests, please try again later",
    headers = true,
    excludeRoutes = ["/health", "/metrics", "/ready", "/live"],
  } = config;

  // In-memory store - replace with Redis for distributed systems
  const store = new Map<string, RateLimitState>();

  // Cleanup old entries periodically
  const cleanup = () => {
    const now = Date.now();
    for (const [key, value] of store.entries()) {
      if (value.resetTime < now) {
        store.delete(key);
      }
    }
  };

  return async (fastify: FastifyInstance) => {
    // Run cleanup every minute
    const cleanupInterval = setInterval(cleanup, 60000);
    fastify.addHook("onClose", () => clearInterval(cleanupInterval));

    fastify.addHook("onRequest", async (request, reply) => {
      // Skip excluded routes
      if (excludeRoutes.some((route) => request.url.startsWith(route))) {
        return;
      }

      // Skip if custom skip function returns true
      if (skip && skip(request)) {
        return;
      }

      const key = keyGenerator(request);
      const now = Date.now();

      let state = store.get(key);

      if (!state || state.resetTime < now) {
        // Create new window
        state = {
          count: 1,
          resetTime: now + windowMs,
        };
        store.set(key, state);
      } else {
        // Increment counter
        state.count++;
      }

      // Add rate limit headers
      if (headers) {
        reply.header("X-RateLimit-Limit", max);
        reply.header("X-RateLimit-Remaining", Math.max(0, max - state.count));
        reply.header("X-RateLimit-Reset", Math.ceil(state.resetTime / 1000));
      }

      // Check if rate limit exceeded
      if (state.count > max) {
        reply.header("Retry-After", Math.ceil((state.resetTime - now) / 1000));
        return reply.status(429).send({
          error: "Too Many Requests",
          message,
          retryAfter: Math.ceil((state.resetTime - now) / 1000),
        });
      }
    });

    fastify.log.info(`Rate limiting enabled: ${max} requests per ${windowMs / 1000}s`);
  };
}

/**
 * Create a Redis-based rate limiter (requires ioredis)
 */
export function createRedisRateLimiter(redis: {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string, mode: string, ttl: number) => Promise<unknown>;
  incr: (key: string) => Promise<number>;
  expire: (key: string, seconds: number) => Promise<number>;
}) {
  return async function checkRateLimit(
    key: string,
    max: number,
    windowSeconds: number
  ): Promise<{
    allowed: boolean;
    remaining: number;
    resetTime: number;
  }> {
    const redisKey = `ratelimit:${key}`;
    const now = Math.floor(Date.now() / 1000);
    const windowStart = now - (now % windowSeconds);
    const windowKey = `${redisKey}:${windowStart}`;

    const count = await redis.incr(windowKey);

    // Set expiry on first request
    if (count === 1) {
      await redis.expire(windowKey, windowSeconds + 1);
    }

    return {
      allowed: count <= max,
      remaining: Math.max(0, max - count),
      resetTime: windowStart + windowSeconds,
    };
  };
}

/**
 * Sliding window rate limiter configuration
 */
export interface SlidingWindowConfig {
  windowMs: number;
  max: number;
}

/**
 * Create endpoint-specific rate limits
 */
export function createEndpointLimits(
  limits: Record<string, SlidingWindowConfig>
): Map<string, SlidingWindowConfig> {
  return new Map(Object.entries(limits));
}

/**
 * Common rate limit configurations
 */
export const rateLimitPresets = {
  /**
   * Standard API rate limit
   */
  standard: {
    max: 100,
    windowMs: 60000, // 1 minute
  },

  /**
   * Strict limit for sensitive endpoints (login, registration)
   */
  strict: {
    max: 10,
    windowMs: 60000, // 1 minute
  },

  /**
   * Relaxed limit for read operations
   */
  relaxed: {
    max: 500,
    windowMs: 60000, // 1 minute
  },

  /**
   * Very strict limit for expensive operations
   */
  expensive: {
    max: 5,
    windowMs: 60000, // 1 minute
  },

  /**
   * Webhook delivery limits
   */
  webhook: {
    max: 1000,
    windowMs: 60000, // 1 minute
  },
} as const;
