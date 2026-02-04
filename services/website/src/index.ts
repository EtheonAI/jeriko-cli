import Fastify from "fastify";
import cors from "@fastify/cors";
import { createLogger, getEnv } from "@repo/service-utils";
import { websiteRoutes } from "./routes/websites.js";
import { deployRoutes } from "./routes/deploy.js";
import { databaseRoutes } from "./routes/database.js";

const logger = createLogger({ service: "website" });

async function main() {
  const port = parseInt(getEnv("PORT", "3004"), 10);
  const host = getEnv("HOST", "0.0.0.0");

  const app = Fastify({
    logger: false,
    requestIdHeader: "x-request-id",
    genReqId: () => crypto.randomUUID(),
  });

  await app.register(cors, {
    origin: true,
    credentials: true,
  });

  // Health check
  app.get("/health", async () => ({ status: "ok", service: "website" }));

  // Register routes
  await app.register(websiteRoutes);
  await app.register(deployRoutes);
  await app.register(databaseRoutes);

  // Request logging
  app.addHook("onRequest", async (request) => {
    logger.info({
      requestId: request.id,
      method: request.method,
      url: request.url,
      userId: request.headers["x-user-id"],
    }, "Incoming request");
  });

  // Start server
  try {
    await app.listen({ port, host });
    logger.info({ port, host }, "Website service started");
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
