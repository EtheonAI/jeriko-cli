import type { FastifyRequest, FastifyReply } from "fastify";

/**
 * Fastify request augmentation — extends the standard request with
 * gateway-verified fields that all downstream services can trust.
 */
declare module "fastify" {
  interface FastifyRequest {
    /** User ID extracted from the verified x-user-id header */
    userId: string;
    /** Correlation ID for distributed tracing */
    requestId: string;
    /** High-resolution start time for response timing */
    startTime: bigint;
  }

  interface FastifyReply {
    /** Send a successful ApiResponse<T> */
    success<T>(data: T): FastifyReply;
  }
}

export interface ServiceConfig {
  /** Service name — used in logs, health checks, metrics */
  name: string;

  /**
   * Auth mode:
   * - "gateway" — verifies x-gateway-secret header (internal services behind gateway)
   * - "public"  — no auth hook (for the gateway itself, which does its own auth)
   */
  authMode?: "gateway" | "public";

  /** Port (defaults to PORT env var or 3000) */
  port?: number;

  /** Host (defaults to HOST env var or 0.0.0.0) */
  host?: string;

  /** Log level override (defaults to LOG_LEVEL env var or "info") */
  logLevel?: string;

  /**
   * CORS origins. Defaults to false (no CORS — internal services behind gateway).
   * Set to a string or string[] to enable CORS.
   */
  cors?: boolean | string | string[];

  /** Rate limit — requests per minute. Defaults to 100. Set to 0 to disable. */
  rateLimit?: number;

  /** Additional routes to skip auth for (health routes are always skipped) */
  publicRoutes?: string[];

  /** Cleanup callbacks invoked during graceful shutdown */
  onShutdown?: Array<() => Promise<void> | void>;

  /** Enable Prometheus metrics endpoint at /metrics. Defaults to true. */
  metrics?: boolean;

  /** Max request body size in bytes. Defaults to 1MB (1048576). */
  bodyLimit?: number;

  /** Request timeout in ms. Defaults to 30000 (30s). Set to 0 to disable. */
  requestTimeout?: number;

  /** Enable trustProxy for proper IP detection behind load balancers. Defaults to true. */
  trustProxy?: boolean;

  /** Graceful shutdown timeout in ms. Defaults to 10000 (10s). */
  shutdownTimeout?: number;

  /** Service version for health checks. Defaults to "1.0.0". */
  version?: string;

  /** Database health check function (if service uses DB) */
  dbHealthCheck?: () => Promise<boolean>;

  /** Redis health check function (if service uses Redis) */
  redisHealthCheck?: () => Promise<boolean>;
}
