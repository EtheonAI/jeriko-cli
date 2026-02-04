import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import websocket from "@fastify/websocket";
import { createLogger, createHealthCheck, getEnv, requireEnv } from "@repo/service-utils";
import { authPlugin } from "./plugins/auth.js";
import { healthRoutes } from "./routes/health.js";
import { proxyRoutes } from "./routes/proxy.js";
import { websocketRoutes } from "./routes/websocket.js";

const logger = createLogger({ service: "gateway" });

async function main() {
  const port = parseInt(getEnv("PORT", "3001"), 10);
  const host = getEnv("HOST", "0.0.0.0");

  const app = Fastify({
    logger: false, // We use our own logger
    requestIdHeader: "x-request-id",
    genReqId: () => crypto.randomUUID(),
  });

  // Register plugins
  await app.register(cors, {
    origin: getEnv("CORS_ORIGIN", "*"),
    credentials: true,
  });

  await app.register(helmet, {
    contentSecurityPolicy: false, // We handle this in Next.js
  });

  await app.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
    keyGenerator: (request) => {
      return request.headers["x-api-key"]?.toString() ||
             request.headers["authorization"]?.toString() ||
             request.ip;
    },
  });

  await app.register(websocket, {
    options: {
      maxPayload: 1048576, // 1MB
    },
  });

  // Auth plugin
  await app.register(authPlugin);

  // Register routes
  await app.register(healthRoutes);
  await app.register(proxyRoutes, { prefix: "/v1" });
  await app.register(websocketRoutes, { prefix: "/v1" });

  // Global error handler
  app.setErrorHandler((error, request, reply) => {
    logger.error({ err: error, requestId: request.id }, "Request error");

    const statusCode = error.statusCode || 500;
    reply.status(statusCode).send({
      data: null,
      meta: {
        requestId: request.id,
        timestamp: new Date().toISOString(),
      },
      error: {
        code: error.code || "INTERNAL_ERROR",
        message: statusCode === 500 ? "Internal server error" : error.message,
      },
    });
  });

  // Request logging
  app.addHook("onRequest", async (request) => {
    logger.info({
      requestId: request.id,
      method: request.method,
      url: request.url,
      ip: request.ip,
    }, "Incoming request");
  });

  app.addHook("onResponse", async (request, reply) => {
    logger.info({
      requestId: request.id,
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      responseTime: reply.elapsedTime,
    }, "Request completed");
  });

  // Start server
  try {
    await app.listen({ port, host });
    logger.info({ port, host }, "Gateway service started");
  } catch (err) {
    logger.error(err, "Failed to start server");
    process.exit(1);
  }

  // Graceful shutdown
  const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];
  for (const signal of signals) {
    process.on(signal, async () => {
      logger.info({ signal }, "Received shutdown signal");
      await app.close();
      process.exit(0);
    });
  }
}

main();
