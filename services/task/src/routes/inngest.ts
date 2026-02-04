import { FastifyPluginAsync } from "fastify";
import { Inngest } from "inngest";
import { serve } from "inngest/fastify";
import { createLogger } from "@repo/service-utils";

const logger = createLogger({ service: "task-inngest" });

// Initialize Inngest client
export const inngest = new Inngest({
  id: "rubic-task-service",
  eventKey: process.env.INNGEST_EVENT_KEY,
});

// Define task execution function
const executeTask = inngest.createFunction(
  {
    id: "execute-task",
    name: "Execute Task",
    retries: 3,
  },
  { event: "task/execute" },
  async ({ event, step }) => {
    const { taskId, userId, prompt, targetDeviceId } = event.data;

    logger.info({ taskId, userId }, "Starting task execution");

    // Step 1: Prepare context
    await step.run("prepare-context", async () => {
      // Gather relevant context for the task
      // - User preferences
      // - Recent conversations
      // - Available tools
      logger.info({ taskId }, "Context prepared");
      return { ready: true };
    });

    // Step 2: Call Agent Service
    const agentResult = await step.run("call-agent", async () => {
      const agentUrl = process.env.AGENT_SERVICE_URL || "http://localhost:8000";

      const response = await fetch(`${agentUrl}/v1/complete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userId,
          "x-task-id": taskId,
        },
        body: JSON.stringify({
          prompt,
          targetDeviceId,
          stream: false, // For Inngest, we don't stream
        }),
      });

      if (!response.ok) {
        throw new Error(`Agent service error: ${response.status}`);
      }

      return response.json();
    });

    // Step 3: Process result
    await step.run("process-result", async () => {
      // Store result, update task status
      logger.info({ taskId, result: agentResult }, "Task completed");
      return { success: true };
    });

    return { taskId, status: "completed", result: agentResult };
  }
);

// Define scheduled task function
const scheduledTask = inngest.createFunction(
  {
    id: "scheduled-task",
    name: "Scheduled Task",
  },
  { event: "task/scheduled" },
  async ({ event, step }) => {
    const { taskId, userId, schedule } = event.data;

    logger.info({ taskId, userId, schedule }, "Executing scheduled task");

    // Trigger the actual task execution
    await step.sendEvent("trigger-task", {
      name: "task/execute",
      data: event.data,
    });

    return { taskId, triggered: true };
  }
);

// Define approval workflow function
const approvalWorkflow = inngest.createFunction(
  {
    id: "approval-workflow",
    name: "Approval Workflow",
    cancelOn: [
      { event: "task/cancelled", match: "data.taskId" },
    ],
  },
  { event: "task/approval-required" },
  async ({ event, step }) => {
    const { taskId, userId, action, deviceId } = event.data;

    logger.info({ taskId, userId, action }, "Approval required");

    // Wait for approval (with timeout)
    const approval = await step.waitForEvent("wait-for-approval", {
      event: "task/approved",
      match: "data.taskId",
      timeout: "24h",
    });

    if (!approval) {
      logger.info({ taskId }, "Approval timed out");
      return { taskId, status: "timeout" };
    }

    if (!approval.data.approved) {
      logger.info({ taskId }, "Action rejected");
      return { taskId, status: "rejected" };
    }

    // Execute the approved action
    logger.info({ taskId, action }, "Executing approved action");

    // Call device service for device-related actions
    if (deviceId) {
      const deviceUrl = process.env.DEVICE_SERVICE_URL || "http://localhost:8080";

      await fetch(`${deviceUrl}/v1/devices/${deviceId}/command`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userId,
        },
        body: JSON.stringify({ action, approved: true }),
      });
    }

    return { taskId, status: "approved", executed: true };
  }
);

// Export Inngest handler
export const inngestRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.route({
    method: ["GET", "POST", "PUT"],
    url: "/",
    handler: serve({
      client: inngest,
      functions: [executeTask, scheduledTask, approvalWorkflow],
    }),
  });
};
