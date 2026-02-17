import { createService } from "@repo/service-utils";
import { initDb } from "./lib/db.js";
import { connectorRoutes } from "./routes/connectors.js";
import { oauthRoutes } from "./routes/oauth.js";
import { integrationRoutes } from "./routes/integrations.js";
import { toolRoutes } from "./routes/tools.js";
import { syncRoutes } from "./routes/sync.js";
import { triggerRoutes } from "./routes/triggers.js";

async function main() {
  // Initialize database (dynamic import for ESM compatibility)
  await initDb();

  const { app, logger, start } = await createService({
    name: "connector",
    port: parseInt(process.env.PORT || "4009", 10),
    cors: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(",") : false,
    publicRoutes: ["/triggers/webhook"],
  });

  logger.info("Database initialized");

  // Register route modules
  await app.register(connectorRoutes);
  await app.register(oauthRoutes);
  await app.register(integrationRoutes);
  await app.register(toolRoutes);
  await app.register(syncRoutes);
  await app.register(triggerRoutes);

  await start();
}

main();
