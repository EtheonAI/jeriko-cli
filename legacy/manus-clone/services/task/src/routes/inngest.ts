import { FastifyPluginAsync } from "fastify";
import { serve } from "inngest/fastify";
import {
  db,
  eq,
  and,
  lte,
  scheduledTasks,
  taskExecutions,
  agentSessions,
  messages,
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
    retries: 2, // Safe with idempotency key — orchestrator Redis lock prevents duplicate tool executions
    onFailure: async ({ event, error }) => {
      const { taskId, executionId, userId } = event.data.event.data as {
        taskId: string;
        executionId?: string;
        userId: string;
      };

      logger.error({ taskId, executionId, error: error.message }, "Task execution failed");

      try {
        // Mark execution as failed + find linked session
        let linkedSessionId: string | null = null;
        if (executionId) {
          const [exec] = await db
            .select({ sessionId: taskExecutions.sessionId })
            .from(taskExecutions)
            .where(eq(taskExecutions.id, executionId))
            .limit(1);
          linkedSessionId = exec?.sessionId ?? null;

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

        // Log error to the shared session (don't mark session failed — it's reused)
        if (linkedSessionId) {
          await db.insert(messages).values({
            id: createId(),
            sessionId: linkedSessionId,
            role: "assistant",
            content: `Automation failed: ${error.message}`,
            parts: [{ type: "text", text: `Automation failed: ${error.message}` }],
            metadata: { source: "automation", error: true, executionId },
          });
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

        // Notify user via Redis (real-time WebSocket)
        await publish(`user:${userId}`, {
          type: "scheduledTask:failed",
          data: { taskId, executionId, sessionId: linkedSessionId, error: error.message },
        });

        // Notify user via Knock (email + push + in-app)
        const notificationUrl = process.env.NOTIFICATION_SERVICE_URL || "http://localhost:4006";
        const notifHeaders: Record<string, string> = { "Content-Type": "application/json", "x-user-id": userId };
        const gatewaySecret = process.env.GATEWAY_SECRET;
        if (gatewaySecret) notifHeaders["x-gateway-secret"] = gatewaySecret;
        await fetch(`${notificationUrl}/send`, {
          method: "POST",
          headers: notifHeaders,
          body: JSON.stringify({
            userId,
            type: "task",
            title: "Task failed",
            message: `Task execution failed: ${error.message}`,
            priority: "high",
            actionUrl: linkedSessionId ? `/chat/${linkedSessionId}` : `/actions`,
            entityType: "scheduledTask",
            entityId: taskId,
          }),
          signal: AbortSignal.timeout(5_000),
        }).catch(() => {}); // Non-fatal
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
      triggerEvent,
      skillIds,
      connectionIds,
    } = event.data as {
      taskId: string;
      executionId?: string;
      userId: string;
      prompt: string;
      targetDeviceId?: string;
      triggerEvent?: {
        slug: string;
        data: Record<string, unknown>;
        triggerId: string;
      };
      skillIds?: string[];
      connectionIds?: string[];
    };

    logger.info(
      { taskId, executionId, userId, hasTrigger: !!triggerEvent },
      "Starting task execution",
    );

    // Build user content (deterministic — safe outside steps)
    let userContent = prompt;
    if (triggerEvent) {
      const eventSummary = JSON.stringify(triggerEvent.data, null, 2);
      userContent = `[Trigger Event: ${triggerEvent.slug}]\nEvent data:\n${eventSummary}\n\nTask instructions: ${userContent}`;
    }
    if (targetDeviceId) {
      userContent += `\n\n[Target device: ${targetDeviceId}]`;
    }

    // Step 1: Reuse existing session or create one, save user message, mark running
    const sessionId = await step.run("create-session", async () => {
      // Fetch task — check if it already has a linked session
      const [task] = await db
        .select({ name: scheduledTasks.name, sessionId: scheduledTasks.sessionId })
        .from(scheduledTasks)
        .where(eq(scheduledTasks.id, taskId))
        .limit(1);
      const taskName = task?.name || "Automated Task";

      let sid = task?.sessionId as string | null;

      if (sid) {
        // Reuse existing session — make sure it's active
        await db
          .update(agentSessions)
          .set({ status: "active", updatedAt: new Date() })
          .where(eq(agentSessions.id, sid));
      } else {
        // First execution — create session and link it to the scheduled task
        sid = createId();
        await db.insert(agentSessions).values({
          id: sid,
          userId,
          status: "active",
          title: taskName,
          metadata: {
            scheduledTaskId: taskId,
            source: "automation",
            ...(skillIds?.length ? { skills: skillIds } : {}),
          },
        });

        // Save sessionId back to the scheduled task so all future executions reuse it
        await db
          .update(scheduledTasks)
          .set({ sessionId: sid })
          .where(eq(scheduledTasks.id, taskId));
      }

      // Save user message (each execution adds a new message to the shared session)
      await db.insert(messages).values({
        id: createId(),
        sessionId: sid,
        role: "user",
        content: userContent,
        parts: [{ type: "text", text: userContent }],
        metadata: {
          executionId: executionId ?? undefined,
          source: "automation",
          ...(triggerEvent ? { triggerEvent: { slug: triggerEvent.slug } } : {}),
        },
      });

      // Mark execution running + link to session
      if (executionId) {
        await db
          .update(taskExecutions)
          .set({ status: "running", startedAt: new Date(), sessionId: sid })
          .where(eq(taskExecutions.id, executionId));
      }

      // Mark task running
      await db
        .update(scheduledTasks)
        .set({ status: "running" })
        .where(eq(scheduledTasks.id, taskId));

      await publish(`user:${userId}`, {
        type: "scheduledTask:running",
        data: { taskId, executionId, sessionId: sid, triggerEvent: triggerEvent?.slug },
      });

      return sid;
    });

    // Step 2: Call orchestrator for LLM completion
    const agentResult = await step.run("call-agent", async () => {
      const orchestratorUrl =
        process.env.ORCHESTRATOR_SERVICE_URL || "http://localhost:4014";
      const gatewaySecret = process.env.GATEWAY_SECRET || "";

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "x-user-id": userId,
        "x-task-id": taskId,
      };
      // Idempotency key prevents duplicate tool executions on Inngest retry
      if (executionId) {
        headers["x-idempotency-key"] = executionId;
      }
      if (gatewaySecret) {
        headers["x-gateway-secret"] = gatewaySecret;
      }

      const response = await fetch(`${orchestratorUrl}/v1/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          messages: [{ role: "user", content: userContent }],
          sessionId,
          userId,
          ...(skillIds && skillIds.length > 0 ? { skills: skillIds } : {}),
          ...(connectionIds && connectionIds.length > 0
            ? { connections: connectionIds.map((id) => ({ id })) }
            : {}),
        }),
        signal: AbortSignal.timeout(300_000), // 5 min for complex agent tasks
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        // 409 = idempotency lock (already in progress) — throw retryable error
        if (response.status === 409) {
          throw new Error(`Orchestrator busy (idempotency lock) — will retry`);
        }
        // 200 with already-completed is handled below
        throw new Error(
          `Orchestrator error: ${response.status} - ${errorText}`,
        );
      }

      // Check for idempotency already-completed response (JSON, not SSE)
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const json = await response.json().catch(() => ({}));
        if (json.status === "already-completed") {
          logger.info({ executionId }, "Orchestrator returned already-completed (idempotency)");
          return { text: "[Execution already completed]", toolCalls: [] };
        }
      }

      // Orchestrator returns SSE stream — consume it and collect text + tool calls
      const body = response.body;
      if (!body) {
        throw new Error("Orchestrator returned empty response body");
      }

      let fullText = "";
      const toolCalls: Array<{
        toolCallId: string;
        toolName?: string;
        input?: unknown;
        output?: unknown;
        errorText?: string;
        state: string;
      }> = [];
      const decoder = new TextDecoder();
      const reader = body.getReader();

      try {
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Parse SSE events from buffer
          const lines = buffer.split("\n");
          buffer = lines.pop() || ""; // Keep incomplete line in buffer

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6);
            if (data === "[DONE]") continue;

            try {
              const evt = JSON.parse(data);
              // AI SDK v6 UIMessage stream protocol
              if (evt.type === "text-delta" && evt.delta) {
                fullText += evt.delta;
              }
              if (evt.type === "tool-input-available") {
                toolCalls.push({
                  toolCallId: evt.toolCallId,
                  toolName: evt.toolName,
                  input: evt.input,
                  state: "input-available",
                });
              }
              if (evt.type === "tool-output-available") {
                const existing = toolCalls.find(
                  (tc) => tc.toolCallId === evt.toolCallId,
                );
                if (existing) {
                  existing.output = evt.output;
                  existing.state = "output-available";
                } else {
                  toolCalls.push({
                    toolCallId: evt.toolCallId,
                    output: evt.output,
                    state: "output-available",
                  });
                }
              }
              if (evt.type === "tool-output-error") {
                const existing = toolCalls.find(
                  (tc) => tc.toolCallId === evt.toolCallId,
                );
                if (existing) {
                  existing.errorText = evt.error;
                  existing.state = "output-error";
                }
              }
            } catch {
              // Skip non-JSON lines (SSE comments, etc.)
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      return { text: fullText, toolCalls };
    });

    // Step 3: Save assistant message, update session, finalize execution
    await step.run("process-result", async () => {
      const now = new Date();

      // Build parts array for the assistant message
      const parts: Record<string, unknown>[] = [];
      if (agentResult.text) {
        parts.push({ type: "text", text: agentResult.text });
      }
      for (const tc of agentResult.toolCalls) {
        parts.push({
          type: tc.toolName ? `tool-${tc.toolName}` : "tool-unknown",
          toolCallId: tc.toolCallId,
          toolName: tc.toolName,
          state: tc.state,
          input: tc.input,
          output: tc.output,
          ...(tc.errorText ? { errorText: tc.errorText } : {}),
        });
      }

      // Save assistant message to DB
      await db.insert(messages).values({
        id: createId(),
        sessionId,
        role: "assistant",
        content: agentResult.text || "",
        parts: parts.length > 0 ? parts : null,
        metadata: { model: "agent", source: "automation" },
      });

      // Keep session active (shared across all executions of this task)
      await db
        .update(agentSessions)
        .set({ updatedAt: now })
        .where(eq(agentSessions.id, sessionId));

      // Mark execution success
      if (executionId) {
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

        // For trigger-only tasks, no time-based nextRunAt — stay pending for next trigger
        const isTriggerOnly = task.scheduleType === "trigger";
        const nextRunAt = isTriggerOnly
          ? null
          : calculateNextRunAt({ ...task, runCount: newRunCount });

        // Trigger-only tasks go back to pending (waiting for next trigger);
        // time-based tasks complete if no nextRunAt
        const newStatus =
          isTriggerOnly ? "pending" : nextRunAt ? "pending" : "completed";

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

        // Publish completion event with sessionId (real-time WebSocket)
        await publish(`user:${userId}`, {
          type: "scheduledTask:completed",
          data: { taskId, executionId, sessionId, runCount: newRunCount, nextRunAt },
        });

        // Notify user via Knock (email + push + in-app)
        const notificationUrl = process.env.NOTIFICATION_SERVICE_URL || "http://localhost:4006";
        const gatewaySecret = process.env.GATEWAY_SECRET;
        const notifHeaders: Record<string, string> = { "Content-Type": "application/json", "x-user-id": userId };
        if (gatewaySecret) notifHeaders["x-gateway-secret"] = gatewaySecret;
        await fetch(`${notificationUrl}/send`, {
          method: "POST",
          headers: notifHeaders,
          body: JSON.stringify({
            userId,
            type: "task",
            title: `Task completed: ${task.name}`,
            message: `"${task.name}" finished successfully. Run #${newRunCount}.`,
            priority: "normal",
            actionUrl: `/chat/${sessionId}`,
            entityType: "scheduledTask",
            entityId: taskId,
          }),
          signal: AbortSignal.timeout(5_000),
        }).catch(() => {}); // Non-fatal

        dispatchWebhookEvent({
          eventType: "scheduledTask.executed",
          resourceType: "scheduledTask",
          resourceId: taskId,
          payload: { taskId, executionId, sessionId, status: "success", runCount: newRunCount },
          userId,
        });
      }

      return { success: true };
    });

    return { taskId, executionId, sessionId, status: "completed" };
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
          const taskPayload = task.payload as Record<string, unknown> | null;
          await inngest.send({
            name: "task/execute",
            data: {
              taskId: task.id,
              executionId,
              userId: task.userId,
              prompt:
                taskPayload?.prompt ??
                task.description ??
                task.name,
              targetDeviceId:
                taskPayload?.targetDeviceId ?? undefined,
              skillIds:
                Array.isArray(taskPayload?.skillIds) ? taskPayload.skillIds : undefined,
              connectionIds:
                Array.isArray(taskPayload?.connectionIds) ? taskPayload.connectionIds : undefined,
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
