import { createTRPCRouter } from "../init";
import { sessionsRouter } from "./sessions.router";
import { messagesRouter } from "./messages.router";
import { agentsRouter } from "./agents.router";
import { filesRouter } from "./files.router";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  sessions: sessionsRouter,
  messages: messagesRouter,
  agents: agentsRouter,
  files: filesRouter,
});

// Export type definition of API
export type AppRouter = typeof appRouter;
