import Fastify from "fastify";
import cors from "@fastify/cors";
import { getEnv } from "@repo/service-utils";
import { logger } from "./lib/helpers.js";
import { connectorRoutes } from "./routes/connectors.js";
import { oauthRoutes } from "./routes/oauth.js";
import { integrationRoutes } from "./routes/integrations.js";
import { toolRoutes } from "./routes/tools.js";
import { syncRoutes } from "./routes/sync.js";

async function main() {
  const port = parseInt(getEnv("PORT", "4009"), 10);
  const host = getEnv("HOST", "0.0.0.0");

  const app = Fastify({
    logger: false,
    requestIdHeader: "x-request-id",
    genReqId: () => crypto.randomUUID(),
  });

  // Plugins
  await app.register(cors, {
    origin: getEnv("CORS_ORIGIN", "*"),
    credentials: true,
  });

  // Health check
  app.get("/health", async () => {
    return { status: "ok", service: "connector" };
  });

  // Register route modules
  await app.register(connectorRoutes);
  await app.register(oauthRoutes);
  await app.register(integrationRoutes);
  await app.register(toolRoutes);
  await app.register(syncRoutes);

  // Global error handler
  app.setErrorHandler((error: Error & { statusCode?: number; code?: string }, request, reply) => {
    logger.error({ err: error, requestId: request.id }, "Request error");

    const statusCode = error.statusCode || 500;
    reply.status(statusCode).send({
      error: statusCode === 500 ? "Internal server error" : error.message,
    });
  });

  // Request logging
  app.addHook("onRequest", async (request) => {
    logger.info(
      {
        requestId: request.id,
        method: request.method,
        url: request.url,
      },
      "Incoming request"
    );
  });

  app.addHook("onResponse", async (request, reply) => {
    logger.info(
      {
        requestId: request.id,
        statusCode: reply.statusCode,
        responseTime: reply.elapsedTime,
      },
      "Request completed"
    );
  });

  // Start server
  try {
    await app.listen({ port, host });
    logger.info({ port, host }, "Connector service started");
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
