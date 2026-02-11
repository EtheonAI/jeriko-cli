import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import { createLogger, getEnv } from "@repo/service-utils";
import { healthRoutes } from "./routes/health.js";
import { mediaRoutes } from "./routes/media.js";
import { sessionRoutes } from "./routes/sessions.js";

const logger = createLogger({ service: "orchestrator" });

export async function buildApp() {
  const port = parseInt(getEnv("PORT", "4014"), 10);
  const host = getEnv("HOST", "0.0.0.0");

  const app = Fastify({
    logger: false,
    requestIdHeader: "x-request-id",
    genReqId: () => crypto.randomUUID(),
    bodyLimit: 10 * 1024 * 1024,
    trustProxy: true,
  });

  const allowedOrigins = getEnv("ALLOWED_ORIGINS", "http://localhost:3000")
    .split(",")
    .map((o: string) => o.trim())
    .filter(Boolean);

  await app.register(cors, {
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-api-key", "x-request-id"],
  });

  await app.register(helmet, {
    contentSecurityPolicy: false,
  });

  await app.register(healthRoutes);
  await app.register(sessionRoutes);
  await app.register(mediaRoutes);

  return { app, port, host };
}

async function main() {
  const { app, port, host } = await buildApp();

  app.setErrorHandler((error: Error & { statusCode?: number; code?: string }, request, reply) => {
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

  app.addHook("onRequest", async (request) => {
    logger.info(
      {
        requestId: request.id,
        method: request.method,
        url: request.url,
        ip: request.ip,
      },
      "Incoming request"
    );
  });

  app.addHook("onResponse", async (request, reply) => {
    logger.info(
      {
        requestId: request.id,
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        responseTime: reply.elapsedTime,
      },
      "Request completed"
    );
  });

  try {
    await app.listen({ port, host });
    logger.info({ port, host }, "Orchestrator service started");
  } catch (err) {
    logger.error(err, "Failed to start server");
    process.exit(1);
  }

  const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];
  for (const signal of signals) {
    process.on(signal, async () => {
      logger.info({ signal }, "Received shutdown signal");
      await app.close();
      process.exit(0);
    });
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void main();
}
