import Fastify from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import { createLogger, getEnv } from "@repo/service-utils";
import { deviceRoutes } from "./routes/devices.js";
import { commandRoutes } from "./routes/commands.js";
import { heartbeatRoutes, startStaleDeviceChecker } from "./routes/heartbeat.js";
import { websocketRoutes } from "./routes/websocket.js";
import { hubRoutes } from "./routes/hubs.js";

const logger = createLogger({ service: "device" });

async function main() {
  const port = parseInt(getEnv("PORT", "4001"), 10);
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

  await app.register(websocket);

  // Health check
  app.get("/health", async () => ({ status: "ok", service: "device" }));

  // Register routes
  await app.register(deviceRoutes);
  await app.register(commandRoutes);
  await app.register(heartbeatRoutes);
  await app.register(websocketRoutes);
  await app.register(hubRoutes);

  // Request logging
  app.addHook("onRequest", async (request) => {
    logger.info(
      {
        requestId: request.id,
        method: request.method,
        url: request.url,
        userId: request.headers["x-user-id"],
      },
      "Incoming request"
    );
  });

  // Start server
  try {
    await app.listen({ port, host });
    logger.info({ port, host }, "Device service started");
  } catch (err) {
    logger.error(err, "Failed to start server");
    process.exit(1);
  }

  // Start stale device checker
  const staleChecker = startStaleDeviceChecker();

  // Graceful shutdown
  const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];
  for (const signal of signals) {
    process.on(signal, async () => {
      logger.info({ signal }, "Received shutdown signal");
      clearInterval(staleChecker);
      await app.close();
      process.exit(0);
    });
  }
}

main();
