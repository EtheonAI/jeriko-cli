import { createTRPCRouter } from "../init";
import { sessionsRouter } from "./sessions.router";
import { messagesRouter } from "./messages.router";
import { agentsRouter } from "./agents.router";
import { filesRouter } from "./files.router";
import { connectorsRouter } from "./connectors.router";
import { notificationsRouter } from "./notifications.router";
import { scheduledTasksRouter } from "./scheduledTasks.router";
import { projectsRouter } from "./projects.router";
import { knowledgeRouter } from "./knowledge.router";
import { billingRouter } from "./billing.router";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  // Core routers
  sessions: sessionsRouter,
  messages: messagesRouter,
  agents: agentsRouter,
  files: filesRouter,
  // Feature routers (Manus-style)
  connectors: connectorsRouter,
  notifications: notificationsRouter,
  scheduledTasks: scheduledTasksRouter,
  projects: projectsRouter,
  knowledge: knowledgeRouter,
  billing: billingRouter,
});

// Export type definition of API
export type AppRouter = typeof appRouter;
