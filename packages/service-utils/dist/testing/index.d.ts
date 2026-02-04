import * as http from 'http';
import { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';

/**
 * Test utilities for Fastify services
 */
interface MockRequest {
    method?: string;
    url?: string;
    headers?: Record<string, string>;
    query?: Record<string, string>;
    params?: Record<string, string>;
    body?: unknown;
    user?: {
        id: string;
        email: string;
        [key: string]: unknown;
    };
}
interface MockReply {
    statusCode: number;
    headers: Record<string, string>;
    body: unknown;
}
/**
 * Create a mock Fastify request for testing
 */
declare function createMockRequest(options?: MockRequest): FastifyRequest;
/**
 * Create a mock Fastify reply for testing
 */
declare function createMockReply(): {
    reply: FastifyReply;
    getResponse: () => MockReply;
};
/**
 * Create a mock logger for testing
 */
declare function createMockLogger(): {
    trace: (msg: string, data?: unknown) => void;
    debug: (msg: string, data?: unknown) => void;
    info: (msg: string, data?: unknown) => void;
    warn: (msg: string, data?: unknown) => void;
    error: (msg: string, data?: unknown) => void;
    fatal: (msg: string, data?: unknown) => void;
    child: () => /*elided*/ any;
    getLogs: () => {
        level: string;
        msg: string;
        data?: unknown;
    }[];
    clear: () => {
        level: string;
        msg: string;
        data?: unknown;
    }[];
};
/**
 * Test helper to inject requests into Fastify
 */
declare function injectRequest(app: FastifyInstance, options: {
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    url: string;
    headers?: Record<string, string>;
    payload?: unknown;
    query?: Record<string, string>;
}): Promise<{
    statusCode: number;
    headers: http.OutgoingHttpHeaders;
    body: any;
    raw: string;
}>;
/**
 * Create test fixtures
 */
declare const fixtures: {
    /**
     * Generate a test user
     */
    user(overrides?: Partial<{
        id: string;
        email: string;
        name: string;
    }>): {
        id: string;
        email: string;
        name: string;
        createdAt: string;
        updatedAt: string;
    };
    /**
     * Generate a test JWT token (for mocking)
     */
    authHeader(userId?: string): {
        authorization: string;
    };
    /**
     * Generate pagination params
     */
    pagination(page?: number, limit?: number): {
        page: string;
        limit: string;
    };
    /**
     * Generate a unique ID
     */
    id(prefix?: string): string;
};
/**
 * Wait for a condition to be true
 */
declare function waitFor(condition: () => boolean | Promise<boolean>, options?: {
    timeout?: number;
    interval?: number;
}): Promise<void>;
/**
 * Create a deferred promise for async testing
 */
declare function createDeferred<T>(): {
    promise: Promise<T>;
    resolve: (value: T) => void;
    reject: (error: Error) => void;
};
/**
 * Mock Redis client for testing
 */
declare function createMockRedis(): {
    get: (key: string) => Promise<string | null>;
    set: (key: string, value: string, _mode?: string, ttl?: number) => Promise<string>;
    del: (key: string) => Promise<number>;
    exists: (key: string) => Promise<1 | 0>;
    expire: (key: string, seconds: number) => Promise<1 | 0>;
    ttl: (key: string) => Promise<number>;
    keys: (pattern: string) => Promise<string[]>;
    flushall: () => Promise<string>;
    quit: () => Promise<string>;
    _store: Map<string, string>;
    _expiry: Map<string, number>;
};

export { type MockReply, type MockRequest, createDeferred, createMockLogger, createMockRedis, createMockReply, createMockRequest, fixtures, injectRequest, waitFor };
