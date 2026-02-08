import { FastifyPluginAsync } from "fastify";
import { serve } from "inngest/fastify";
import {
  db,
  eq,
  and,
  lte,
  scheduledTasks,
  taskExecutions,
} from "../lib/db.js";
import {
  createId,
  createLogger,
  publish,
  dispatchWebhookEvent,
} from "@repo/service-utils";
import { inngest } from "../lib/inngest-client.js";
import { calculateNextRunAt } from "../lib/schedule-utils.js";

const logger = createLogger({ service: "task-inngest" });

// ─── Function 1: Execute Task ─────────────────────────────────────
const executeTask = inngest.createFunction(
  {
    id: "execute-task",
    name: "Execute Task",
    retries: 3,
    onFailure: async ({ event, error }) => {
      const { taskId, executionId, userId } = event.data.event.data as {
        taskId: string;
        executionId?: string;
        userId: string;
      };

      logger.error({ taskId, executionId, error: error.message }, "Task execution failed");

      try {
        // Mark execution as failed
        if (executionId) {
          await db
            .update(taskExecutions)
            .set({
              status: "failed",
              completedAt: new Date(),
              error: error.message,
              errorStack: error.stack ?? null,
            })
            .where(eq(taskExecutions.id, executionId));
        }

        // Reset scheduled task to pending so cron can retry
        await db
          .update(scheduledTasks)
          .set({
            status: "pending",
            lastRunStatus: "failed",
            lastRunError: error.message,
          })
          .where(eq(scheduledTasks.id, taskId));

        // Notify user via Redis
        await publish(`user:${userId}`, {
          type: "scheduledTask:failed",
          data: { taskId, executionId, error: error.message },
        });
      } catch (dbErr) {
        logger.error({ taskId, error: dbErr }, "Failed to record task failure in DB");
      }
    },
  },
  { event: "task/execute" },
  async ({ event, step }) => {
    const {
      taskId,
      executionId,
      userId,
      prompt,
      targetDeviceId,
    } = event.data;

    logger.info({ taskId, executionId, userId }, "Starting task execution");

    // Step 1: Prepare — mark execution running, update scheduled task
    await step.run("prepare-context", async () => {
      if (executionId) {
        await db
          .update(taskExecutions)
          .set({ status: "running", startedAt: new Date() })
          .where(eq(taskExecutions.id, executionId));
      }

      await db
        .update(scheduledTasks)
        .set({ status: "running" })
        .where(eq(scheduledTasks.id, taskId));

      await publish(`user:${userId}`, {
        type: "scheduledTask:running",
        data: { taskId, executionId },
      });

      return { ready: true };
    });

    // Step 2: Call agent service
    const agentResult = await step.run("call-agent", async () => {
      const agentUrl = process.env.AGENT_SERVICE_URL || "http://localhost:8000";
      const gatewaySecret = process.env.GATEWAY_SECRET || "";

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "x-user-id": userId,
        "x-task-id": taskId,
      };
      if (gatewaySecret) {
        headers["x-gateway-secret"] = gatewaySecret;
      }

      const response = await fetch(`${agentUrl}/v1/complete`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          prompt,
          targetDeviceId,
          stream: false,
        }),
        signal: AbortSignal.timeout(120_000),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        throw new Error(`Agent service error: ${response.status} - ${errorText}`);
      }

      return response.json();
    });

    // Step 3: Process result — mark success, update counters, publish events
    await step.run("process-result", async () => {
      const now = new Date();

      if (executionId) {
        // Calculate duration from startedAt
        const [execution] = await db
          .select({ startedAt: taskExecutions.startedAt })
          .from(taskExecutions)
          .where(eq(taskExecutions.id, executionId))
          .limit(1);

        const durationMs = execution?.startedAt
          ? now.getTime() - execution.startedAt.getTime()
          : null;

        await db
          .update(taskExecutions)
          .set({
            status: "success",
            completedAt: now,
            durationMs,
            output: agentResult as Record<string, unknown>,
          })
          .where(eq(taskExecutions.id, executionId));
      }

      // Fetch task for next run calculation
      const [task] = await db
        .select()
        .from(scheduledTasks)
        .where(eq(scheduledTasks.id, taskId))
        .limit(1);

      if (task) {
        const newRunCount = (task.runCount ?? 0) + 1;
        const nextRunAt = calculateNextRunAt({
          ...task,
          runCount: newRunCount,
        });

        // If no more runs, mark completed; otherwise back to pending
        const newStatus = nextRunAt ? "pending" : "completed";

        await db
          .update(scheduledTasks)
          .set({
            status: newStatus,
            runCount: newRunCount,
            lastRunAt: now,
            lastRunStatus: "success",
            lastRunError: null,
            nextRunAt,
          })
          .where(eq(scheduledTasks.id, taskId));

        // Publish completion event
        await publish(`user:${userId}`, {
          type: "scheduledTask:completed",
          data: { taskId, executionId, runCount: newRunCount, nextRunAt },
        });

        dispatchWebhookEvent({
          eventType: "scheduledTask.executed",
          resourceType: "scheduledTask",
          resourceId: taskId,
          payload: { taskId, executionId, status: "success", runCount: newRunCount },
          userId,
        });
      }

      return { success: true };
    });

    return { taskId, executionId, status: "completed" };
  },
);

// ─── Function 2: Cron Scheduler (runs every minute) ───────────────
const cronScheduler = inngest.createFunction(
  {
    id: "cron-scheduler",
    name: "Cron Scheduler",
  },
  { cron: "* * * * *" },
  async ({ step }) => {
    // Step 1: Find tasks that are due
    const dueTasks = await step.run("find-due-tasks", async () => {
      const now = new Date();

      const tasks = await db
        .select()
        .from(scheduledTasks)
        .where(
          and(
            lte(scheduledTasks.nextRunAt, now),
            eq(scheduledTasks.isEnabled, true),
            eq(scheduledTasks.status, "pending"),
          ),
        );

      // Filter out tasks past endDate or exceeded maxRuns
      return tasks.filter((t) => {
        if (t.endDate && new Date(t.endDate) <= now) return false;
        if (t.maxRuns != null && (t.runCount ?? 0) >= t.maxRuns) return false;
        return true;
      });
    });

    if (dueTasks.length === 0) {
      return { dispatched: 0 };
    }

    // Step 2: Dispatch each due task
    const dispatched = await step.run("dispatch-tasks", async () => {
      let count = 0;

      for (const task of dueTasks) {
        try {
          // Create execution record
          const executionId = createId();
          await db.insert(taskExecutions).values({
            id: executionId,
            scheduledTaskId: task.id,
            status: "pending",
          });

          // Send Inngest event FIRST — only mark running if send succeeds
          await inngest.send({
            name: "task/execute",
            data: {
              taskId: task.id,
              executionId,
              userId: task.userId,
              prompt:
                (task.payload as Record<string, unknown> | null)?.prompt ??
                task.description ??
                task.name,
              targetDeviceId:
                (task.payload as Record<string, unknown> | null)?.targetDeviceId ?? undefined,
            },
          });

          // Mark task as running only after Inngest event confirmed
          await db
            .update(scheduledTasks)
            .set({ status: "running" })
            .where(eq(scheduledTasks.id, task.id));

          // Calculate and update next run time
          const nextRunAt = calculateNextRunAt({
            ...task,
            runCount: (task.runCount ?? 0) + 1,
          });
          await db
            .update(scheduledTasks)
            .set({ nextRunAt })
            .where(eq(scheduledTasks.id, task.id));

          count++;
          logger.info({ taskId: task.id, executionId }, "Dispatched due task");
        } catch (err) {
          logger.error({ taskId: task.id, error: err }, "Failed to dispatch due task");
          // Task stays in "pending" — cron will retry next minute
        }
      }

      return count;
    });

    return { dispatched };
  },
);

// ─── Function 3: Approval Workflow ─────────────────────────────────
const approvalWorkflow = inngest.createFunction(
  {
    id: "approval-workflow",
    name: "Approval Workflow",
    cancelOn: [{ event: "task/cancelled", match: "data.taskId" }],
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

    if (deviceId) {
      const deviceUrl = process.env.DEVICE_SERVICE_URL || "http://localhost:4001";
      const gatewaySecret = process.env.GATEWAY_SECRET || "";

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "x-user-id": userId,
      };
      if (gatewaySecret) {
        headers["x-gateway-secret"] = gatewaySecret;
      }

      const response = await fetch(
        `${deviceUrl}/v1/devices/${deviceId}/command`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ action, approved: true }),
          signal: AbortSignal.timeout(30_000),
        },
      );

      if (!response.ok) {
        logger.error(
          { deviceId, status: response.status },
          "Failed to execute device command",
        );
        throw new Error(`Device service error: ${response.status}`);
      }
    }

    return { taskId, status: "approved", executed: true };
  },
);

// ─── Export Inngest handler ─────────────────────────────────────────
export const inngestRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.route({
    method: ["GET", "POST", "PUT"],
    url: "/",
    handler: serve({
      client: inngest,
      functions: [executeTask, cronScheduler, approvalWorkflow],
    }),
  });
};
