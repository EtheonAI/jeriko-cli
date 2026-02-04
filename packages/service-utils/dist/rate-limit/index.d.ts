import { FastifyRequest, FastifyPluginAsync } from 'fastify';

interface RateLimitConfig {
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
/**
 * In-memory rate limiter for Fastify
 * For production with multiple instances, use Redis-based rate limiting
 */
declare function rateLimitPlugin(config?: RateLimitConfig): FastifyPluginAsync;
/**
 * Create a Redis-based rate limiter (requires ioredis)
 */
declare function createRedisRateLimiter(redis: {
    get: (key: string) => Promise<string | null>;
    set: (key: string, value: string, mode: string, ttl: number) => Promise<unknown>;
    incr: (key: string) => Promise<number>;
    expire: (key: string, seconds: number) => Promise<number>;
}): (key: string, max: number, windowSeconds: number) => Promise<{
    allowed: boolean;
    remaining: number;
    resetTime: number;
}>;
/**
 * Sliding window rate limiter configuration
 */
interface SlidingWindowConfig {
    windowMs: number;
    max: number;
}
/**
 * Create endpoint-specific rate limits
 */
declare function createEndpointLimits(limits: Record<string, SlidingWindowConfig>): Map<string, SlidingWindowConfig>;
/**
 * Common rate limit configurations
 */
declare const rateLimitPresets: {
    /**
     * Standard API rate limit
     */
    readonly standard: {
        readonly max: 100;
        readonly windowMs: 60000;
    };
    /**
     * Strict limit for sensitive endpoints (login, registration)
     */
    readonly strict: {
        readonly max: 10;
        readonly windowMs: 60000;
    };
    /**
     * Relaxed limit for read operations
     */
    readonly relaxed: {
        readonly max: 500;
        readonly windowMs: 60000;
    };
    /**
     * Very strict limit for expensive operations
     */
    readonly expensive: {
        readonly max: 5;
        readonly windowMs: 60000;
    };
    /**
     * Webhook delivery limits
     */
    readonly webhook: {
        readonly max: 1000;
        readonly windowMs: 60000;
    };
};

export { type RateLimitConfig, type SlidingWindowConfig, createEndpointLimits, createRedisRateLimiter, rateLimitPlugin, rateLimitPresets };
