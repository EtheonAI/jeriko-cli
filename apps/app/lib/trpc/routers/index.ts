import { createTRPCRouter } from "../init";
import { sessionsRouter } from "./sessions.router";
import { messagesRouter } from "./messages.router";
import { agentsRouter } from "./agents.router";
import { filesRouter } from "./files.router";
import { connectorsRouter } from "./connectors.router";
import { notificationsRouter } from "./notifications.router";
import { scheduledTasksRouter } from "./scheduledTasks.router";
import { projectsRouter } from "./projects.router";

import { apiKeysRouter } from "./apiKeys.router";
import { billingRouter } from "./billing.router";
import { mailRouter } from "./mail.router";
import { searchRouter } from "./search.router";
import { userRouter } from "./user.router";
import { devicesRouter } from "./devices.router";
import { smartHomeRouter } from "./smartHome.router";
import { webhooksRouter } from "./webhooks.router";
import { websiteBuilderRouter } from "./websiteBuilder.router";
import { skillsRouter } from "./skills.router";
import { communityRouter } from "./community.router";
import { knowledgeRouter } from "./knowledge.router";

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
  search: searchRouter,
  // Feature routers (Manus-style)
  connectors: connectorsRouter,
  notifications: notificationsRouter,
  scheduledTasks: scheduledTasksRouter,
  projects: projectsRouter,
  skills: skillsRouter,

  // API Keys (Rubic AI)
  apiKeys: apiKeysRouter,
  billing: billingRouter,
  mail: mailRouter,
  // User management
  user: userRouter,
  // Device management
  devices: devicesRouter,
  // Smart Home
  smartHome: smartHomeRouter,
  // Integrations
  webhooks: webhooksRouter,
  // Website Builder
  websiteBuilder: websiteBuilderRouter,
  // Community (shared sessions)
  community: communityRouter,
  // Knowledge base
  knowledge: knowledgeRouter,
});

// Export type definition of API
export type AppRouter = typeof appRouter;
