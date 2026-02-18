import { createService } from "@repo/service-utils";
import { initDb } from "./lib/db.js";
import { taskRoutes } from "./routes/tasks.js";
import { inngestRoutes } from "./routes/inngest.js";
import { scheduledTaskRoutes } from "./routes/scheduled-tasks.js";

async function main() {
  // Initialize database (dynamic import for ESM compatibility)
  await initDb();

  const { app, logger: _logger, start } = await createService({
    name: "task",
    port: parseInt(process.env.PORT || "4002", 10),
    publicRoutes: ["/inngest"],
  });

  // Register routes
  await app.register(taskRoutes);
  await app.register(scheduledTaskRoutes);
  await app.register(inngestRoutes, { prefix: "/inngest" });

  await start();
}

main();
