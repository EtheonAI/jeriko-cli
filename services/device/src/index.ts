import websocket from "@fastify/websocket";
import { createService } from "@repo/service-utils";
import { initDb } from "./lib/db.js";
import { deviceRoutes } from "./routes/devices.js";
import { commandRoutes } from "./routes/commands.js";
import { heartbeatRoutes, startStaleDeviceChecker } from "./routes/heartbeat.js";
import { websocketRoutes } from "./routes/websocket.js";
import { hubRoutes } from "./routes/hubs.js";

async function main() {
  // Initialize database connection before starting the server
  await initDb();

  // Start stale device checker before createService so we can pass cleanup to onShutdown
  const staleChecker = startStaleDeviceChecker();

  const { app, logger, start } = await createService({
    name: "device",
    port: parseInt(process.env.PORT || "4001", 10),
    cors: true,
    onShutdown: [() => clearInterval(staleChecker)],
  });

  logger.info("Database initialized");

  // Register WebSocket plugin after createService
  await app.register(websocket);

  // Register routes
  await app.register(deviceRoutes);
  await app.register(commandRoutes);
  await app.register(heartbeatRoutes);
  await app.register(websocketRoutes);
  await app.register(hubRoutes);

  await start();
}

main();
