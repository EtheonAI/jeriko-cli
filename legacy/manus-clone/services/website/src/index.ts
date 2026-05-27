import { createService } from "@repo/service-utils";
import { websiteRoutes } from "./routes/websites.js";
import { deployRoutes } from "./routes/deploy.js";
import { databaseRoutes } from "./routes/database.js";

async function main() {
  const { initDb } = await import("./lib/db.js");
  await initDb();

  const { app, logger: _logger, start } = await createService({
    name: "website",
    port: parseInt(process.env.PORT || "4004", 10),
    cors: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(",") : false,
  });

  // Register routes
  await app.register(websiteRoutes);
  await app.register(deployRoutes);
  await app.register(databaseRoutes);

  await start();
}

main();
