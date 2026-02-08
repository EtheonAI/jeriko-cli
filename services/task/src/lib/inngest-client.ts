import { Inngest } from "inngest";

/**
 * Shared Inngest client singleton.
 * Imported by both tasks.ts and inngest.ts routes.
 */
export const inngest = new Inngest({
  id: "rubic-task-service",
  eventKey: process.env.INNGEST_EVENT_KEY,
  baseUrl: process.env.INNGEST_BASE_URL,
});
