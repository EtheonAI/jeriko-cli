import Fastify, { type FastifyInstance, type FastifyReply } from "fastify";
import { createLogger, type Logger } from "../logger/index.js";
import { createErrorHandler, createNotFoundHandler } from "../errors/index.js";
import { rateLimitPlugin } from "../rate-limit/index.js";
import { Metrics, metricsPlugin } from "../metrics/index.js";
import { HealthManager, healthChecks, healthPlugin } from "../health/index.js";
import { env, getAllowedOrigins } from "../env.js";
import { registerAuthHook } from "./auth-hook.js";
import type { ServiceConfig } from "./types.js";

export { typedRoute, type RouteSchemas } from "./typed-route.js";
export { createServiceClient, type ServiceClient, type ServiceClientConfig } from "./service-client.js";
export type { ServiceConfig } from "./types.js";

/**
 * Creates a fully-configured Fastify service with production-grade features:
 *
 * 1.  Request ID generation/propagation (x-request-id)
 * 2.  Structured logging with sensitive field redaction + per-request child loggers
 * 3.  Prometheus metrics (/metrics endpoint + automatic HTTP tracking)
 * 4.  Rate limiting (in-memory by userId or IP, configurable)
 * 5.  Internal auth (x-gateway-secret verification via timing-safe compare)
 * 6.  Advanced health checks (/health, /health/ready, /health/live) with DB + Redis + memory
 * 7.  Global error handler with ApiResponse<null> envelope
 * 8.  Not-found handler
 * 9.  Request/response logging with response time tracking
 * 10. Graceful shutdown with configurable timeout (SIGINT/SIGTERM)
 * 11. reply.success() helper for consistent response format
 * 12. Security headers via @fastify/helmet
 * 13. Request body size limits
 * 14. Request timeout
 * 15. Trust proxy for load balancer IP detection
 * 16. X-Response-Time header
 */
export async function createService(config: ServiceConfig): Promise<{
  app: FastifyInstance;
  logger: Logger;
  metrics: Metrics;
  healthManager: HealthManager;
  start: () => Promise<void>;
}> {
  const {
    name,
    authMode = "gateway",
    port = env.PORT,
    host = env.HOST,
    logLevel = env.LOG_LEVEL,
    cors = false,
    rateLimit = 100,
    publicRoutes = [],
    onShutdown = [],
    metrics: enableMetrics = true,
    bodyLimit = 1_048_576, // 1MB
    requestTimeout = 30_000, // 30s
    trustProxy = true,
    shutdownTimeout = 10_000, // 10s
    version = env.SERVICE_VERSION,
    dbHealthCheck,
    redisHealthCheck,
  } = config;

  // 1. Create logger with sensitive field redaction
  const logger = createLogger({
    service: name,
    level: logLevel,
  });

  // 2. Create Fastify instance with production settings
  const app = Fastify({
    logger: false, // We use our own Pino logger with redaction
    requestIdHeader: "x-request-id",
    genReqId: () => crypto.randomUUID(),
    bodyLimit,
    trustProxy,
    ...(requestTimeout > 0 && {
      connectionTimeout: requestTimeout + 5_000, // Connection timeout slightly longer
      keepAliveTimeout: requestTimeout + 10_000,
    }),
  });

  // 3. Request decorators
  app.decorateRequest("userId", "");
  app.decorateRequest("requestId", "");
  app.decorateRequest("startTime", BigInt(0));

  // 4. Per-request setup: requestId, startTime, child logger
  app.addHook("onRequest", async (request) => {
    request.requestId = request.id;
    request.startTime = process.hrtime.bigint();
  });

  // 5. CORS (only if explicitly enabled — internal services don't need it)
  if (cors !== false) {
    try {
      const { default: fastifyCors } = await import("@fastify/cors");
      const origins = cors === true
        ? getAllowedOrigins()
        : typeof cors === "string"
          ? cors.split(",").map(s => s.trim())
          : cors;

      await app.register(fastifyCors, {
        origin: origins,
        credentials: true,
        methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
        allowedHeaders: [
          "Content-Type", "Authorization", "X-Request-ID",
          "X-User-ID", "X-Gateway-Secret", "Accept",
        ],
        exposedHeaders: [
          "X-Request-ID", "X-Response-Time",
          "X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset",
          "Retry-After",
        ],
        maxAge: 86400, // 24h preflight cache
      });
    } catch {
      logger.warn("@fastify/cors not installed, skipping CORS setup");
    }
  }

  // 6. Helmet — security headers
  try {
    const { default: fastifyHelmet } = await import("@fastify/helmet");
    await app.register(fastifyHelmet, {
      contentSecurityPolicy: false, // CSP handled by Next.js
      crossOriginEmbedderPolicy: false, // Breaks some browser features
      hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true,
      },
    });
  } catch {
    logger.debug("@fastify/helmet not installed, skipping security headers");
  }

  // 7. Rate limiting
  if (rateLimit > 0) {
    await app.register(rateLimitPlugin({
      max: rateLimit,
      windowMs: 60_000,
      keyGenerator: (request) => {
        return (request.headers["x-user-id"] as string) || request.ip;
      },
    }));
  }

  // 8. Internal auth hook (gateway secret verification)
  if (authMode === "gateway") {
    const gatewaySecret = env.GATEWAY_SECRET;
    if (gatewaySecret) {
      registerAuthHook(app, gatewaySecret, publicRoutes);
    } else {
      logger.warn(
        "GATEWAY_SECRET not set — auth hook disabled. Set GATEWAY_SECRET to enable internal auth."
      );
      // Dev mode fallback: still extract userId from x-user-id header
      // so service-to-service calls work without the gateway
      app.addHook("onRequest", async (request) => {
        const userId = request.headers["x-user-id"] as string | undefined;
        if (userId) {
          request.userId = userId;
        }
      });
    }
  }

  // 9. Prometheus metrics
  const metrics = new Metrics({ serviceName: name });
  if (enableMetrics) {
    await app.register(metricsPlugin(name));
  }

  // 10. Health checks with DB/Redis/memory monitoring
  const healthManager = new HealthManager(name, version);
  healthManager.registerCheck("memory", healthChecks.memory(90));

  if (dbHealthCheck) {
    healthManager.registerCheck("database", healthChecks.database("database", dbHealthCheck), true);
  }
  if (redisHealthCheck) {
    healthManager.registerCheck("redis", healthChecks.redis("redis", redisHealthCheck), true);
  }

  await app.register(healthPlugin(healthManager));

  // 11. reply.success() decorator — ApiResponse<T> envelope
  app.decorateReply("success", function (this: FastifyReply, data: unknown) {
    return this.send({
      data,
      meta: {
        requestId: this.request.id,
        timestamp: new Date().toISOString(),
      },
      error: null,
    });
  });

  // 12. Global error handler
  app.setErrorHandler(createErrorHandler(logger));

  // 13. Not-found handler
  app.setNotFoundHandler(createNotFoundHandler(logger));

  // 14. Request/response logging with response time header
  app.addHook("onRequest", async (request) => {
    logger.info({
      requestId: request.id,
      method: request.method,
      url: request.url,
      userAgent: request.headers["user-agent"],
      ip: request.ip,
      userId: request.headers["x-user-id"] || undefined,
    }, "request.start");
  });

  app.addHook("onResponse", async (request, reply) => {
    const durationNs = process.hrtime.bigint() - request.startTime;
    const durationMs = Number(durationNs) / 1e6;

    // Set response time header
    reply.header("X-Response-Time", `${durationMs.toFixed(2)}ms`);

    // Track metrics
    metrics.httpRequestsTotal(request.method, request.url, reply.statusCode);
    metrics.httpRequestDuration(request.method, request.url, durationMs);

    // Log at appropriate level based on status
    const logData = {
      requestId: request.id,
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      durationMs: Math.round(durationMs * 100) / 100,
      userId: request.userId || undefined,
    };

    if (reply.statusCode >= 500) {
      logger.error(logData, "request.error");
    } else if (reply.statusCode >= 400) {
      logger.warn(logData, "request.clientError");
    } else {
      logger.info(logData, "request.complete");
    }
  });

  // 15. Request timeout hook
  if (requestTimeout > 0) {
    app.addHook("onRequest", async (request, reply) => {
      const timer = setTimeout(() => {
        if (!reply.sent) {
          reply.status(408).send({
            data: null,
            meta: { requestId: request.id, timestamp: new Date().toISOString() },
            error: { code: "REQUEST_TIMEOUT", message: "Request timed out" },
          });
        }
      }, requestTimeout);

      // Clear timeout when response is sent
      reply.raw.on("close", () => clearTimeout(timer));
    });
  }

  // Start function
  let isShuttingDown = false;

  async function start(): Promise<void> {
    try {
      await app.listen({ port, host });
      logger.info({ port, host, service: name, version, pid: process.pid }, `${name} service started`);
    } catch (err) {
      logger.error(err, "Failed to start server");
      process.exit(1);
    }

    // 16. Graceful shutdown with timeout
    const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];
    for (const signal of signals) {
      process.on(signal, async () => {
        if (isShuttingDown) return; // Prevent double shutdown
        isShuttingDown = true;

        logger.info({ signal, service: name }, "Graceful shutdown initiated");

        // Force exit after timeout
        const forceExit = setTimeout(() => {
          logger.error({ service: name, timeoutMs: shutdownTimeout }, "Shutdown timeout exceeded, forcing exit");
          process.exit(1);
        }, shutdownTimeout);
        forceExit.unref(); // Don't keep process alive

        try {
          // Run cleanup callbacks
          for (const cleanup of onShutdown) {
            try {
              await cleanup();
            } catch (err) {
              logger.error(err, "Cleanup callback failed");
            }
          }

          // Close Redis connections
          try {
            const { closeRedis } = await import("../redis/index.js");
            await closeRedis();
          } catch {
            // Redis module may not be initialized
          }

          // Close Fastify (stops accepting new connections, waits for in-flight)
          await app.close();

          logger.info({ service: name }, "Graceful shutdown complete");
          clearTimeout(forceExit);
          process.exit(0);
        } catch (err) {
          logger.error(err, "Error during shutdown");
          clearTimeout(forceExit);
          process.exit(1);
        }
      });
    }
  }

  return { app, logger, metrics, healthManager, start };
}
