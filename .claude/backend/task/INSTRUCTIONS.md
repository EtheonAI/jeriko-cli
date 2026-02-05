# Task Service Instructions

> VERIFIED against actual codebase -- Feb 2026 audit

## Overview

The task service (`services/task/`) manages task lifecycle and orchestrates work between the user, the agent service, and background processing via Inngest. It is responsible for creating tasks, dispatching them to the agent, persisting results, and handling scheduled/recurring tasks.

**Port:** 4002 (configurable via `PORT` env var)
**Framework:** Node.js / Fastify + Inngest
**Total LOC:** 585 (index.ts: 61, tasks.ts: 366, inngest.ts: 158)

---

## Current State (IMPLEMENTED)

### File Structure

```
services/task/src/
  index.ts              # 61 lines - Fastify bootstrap, registers task and inngest routes, CORS, graceful shutdown
  routes/
    tasks.ts            # 366 lines - REST CRUD for tasks with REAL Drizzle DB queries
    inngest.ts          # 158 lines - 3 Inngest functions: execute-task, scheduled-task, approval-workflow
```

### REST Endpoints (`src/routes/tasks.ts`) -- All Wired to Database

All endpoints use real Drizzle ORM queries against `agents` and `agentTasks` tables. Imports `db, eq, desc, and, agentSessions, agents, agentTasks, sql` from `@repo/database`.

| Method                     | Path        | Status                                                                                                                                                              | Description |
| -------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| `POST /tasks`              | IMPLEMENTED | Creates agent (if none exists for session) via `db.insert(agents)`, inserts `agentTasks`, publishes `task:created` via Redis, dispatches webhook event, returns 201 |
| `GET /tasks`               | IMPLEMENTED | Queries `agentTasks` with optional `sessionId` and `status` filters. Looks up agents by session, uses `IN` clause for agent IDs, supports cursor pagination         |
| `GET /tasks/:id`           | IMPLEMENTED | Queries `agentTasks` by ID, returns 404 if not found                                                                                                                |
| `PUT /tasks/:id`           | IMPLEMENTED | Updates `agentTasks` (title, status), dispatches webhook events on completion/failure                                                                               |
| `DELETE /tasks/:id`        | IMPLEMENTED | Hard-deletes from `agentTasks` via `db.delete()`, returns 404 if not found                                                                                          |
| `POST /tasks/:id/continue` | IMPLEMENTED | Publishes `task:continue` event via Redis pub/sub with message body                                                                                                 |
| `POST /tasks/:id/cancel`   | IMPLEMENTED | Updates task status to `cancelled` in DB via `db.update()`, then publishes `task:cancelled` via Redis                                                               |

All endpoints include:

- `getUserId()` helper that extracts `x-user-id` header (throws 401 if missing)
- Zod validation schemas (`CreateTaskSchema`, `UpdateTaskSchema`, `ListTasksSchema`)
- Proper error handling with `errorResponse` / `successResponse` wrappers
- Structured logging via `createLogger`
- Webhook dispatch via `dispatchWebhookEvent` from `@repo/service-utils`

### Inngest Functions (`src/routes/inngest.ts`) -- Structure Working

Three Inngest functions are defined and the handler is mounted at `POST/GET/PUT /inngest/` via the `serve()` function from `inngest/fastify`.

**1. `execute-task`** (event: `task/execute`, retries: 3)

- Step 1: `prepare-context` -- Placeholder. Logs "Context prepared" and returns `{ ready: true }`. Does NOT load user preferences, conversation history, or tools yet.
- Step 2: `call-agent` -- WORKING. Calls `POST {AGENT_SERVICE_URL}/v1/complete` with prompt, userId (x-user-id header), taskId (x-task-id header). Uses `stream: false`.
- Step 3: `process-result` -- Placeholder. Logs the result and returns `{ success: true }`. Does NOT save to messages table, update task status, or deduct credits yet.

**2. `scheduled-task`** (event: `task/scheduled`)

- WORKING but minimal: re-emits a `task/execute` event via `step.sendEvent()` with the same event data
- Does NOT support CRON expressions, recurring scheduling, or execution records

**3. `approval-workflow`** (event: `task/approval-required`)

- WORKING. Full implementation with:
  - `cancelOn` configured to listen for `task/cancelled` event matched by `data.taskId`
  - `step.waitForEvent("wait-for-approval")` waits for `task/approved`, matched by `data.taskId`, timeout 24h
  - Returns `{ status: "timeout" }` if no approval received
  - Returns `{ status: "rejected" }` if `approval.data.approved` is false
  - On approval, calls device service `POST /v1/devices/{deviceId}/command` if `deviceId` is present
  - Returns `{ status: "approved", executed: true }` on success

---

## What Needs Building

### 1. Enhanced Inngest Step 1: Prepare Context

At `src/routes/inngest.ts` line 28, the `prepare-context` step is a placeholder that needs to be fleshed out.

**What it should do:**

```typescript
await step.run("prepare-context", async () => {
  // 1. Load user preferences (system prompt, preferred model, etc.)
  // This would come from a user settings table or the session metadata

  // 2. Load conversation history for multi-turn
  const history = await db
    .select()
    .from(messages)
    .where(eq(messages.sessionId, sessionId))
    .orderBy(messages.createdAt)
    .limit(50);

  // 3. Load available tools based on user's connected integrations
  // Call connector service to get user's active tools

  // 4. Load knowledge context (RAG)
  // If the session has linked knowledge groups, query them

  // 5. Update agent status
  await db
    .update(agents)
    .set({ status: "thinking", currentTask: taskId })
    .where(eq(agents.id, agentId));

  // 6. Publish status via WebSocket
  await publish(`user:${userId}`, {
    type: "agent:status",
    data: { agentId, status: "thinking", taskId },
  });

  return { history, tools: availableTools, systemPrompt };
});
```

Note: The `call-agent` step (Step 2) would need to pass this context to the agent service request body.

### 2. Enhanced Inngest Step 3: Process Result

At `src/routes/inngest.ts` line 63, the `process-result` step is a placeholder that needs to be fleshed out.

**What it should do:**

```typescript
await step.run("process-result", async () => {
  // 1. Save assistant message to messages table
  await db.insert(messages).values({
    sessionId,
    role: "assistant",
    content: agentResult.content,
    metadata: {
      model: agentResult.model,
      tokens: agentResult.usage,
    },
  });

  // 2. Update task status
  await db
    .update(agentTasks)
    .set({
      status: "completed",
      result: { success: true, output: agentResult.content },
      completedAt: new Date(),
    })
    .where(eq(agentTasks.id, taskId));

  // 3. Update agent status
  await db
    .update(agents)
    .set({ status: "idle", currentTask: null, progress: 100 })
    .where(eq(agents.id, agentId));

  // 4. Deduct credits via billing service
  const creditsUsed = calculateCredits(agentResult.usage);
  await fetch(`${process.env.BILLING_SERVICE_URL}/usage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId,
      type: "agent",
      amount: creditsUsed,
      metadata: {
        sessionId,
        taskId,
        model: agentResult.model,
        inputTokens: agentResult.usage.input_tokens,
        outputTokens: agentResult.usage.output_tokens,
      },
    }),
  });

  // 5. Publish completion via WebSocket
  await publish(`user:${userId}`, {
    type: "task:completed",
    data: { taskId, agentId, content: agentResult.content },
  });

  // 6. Update session title (if first message, use LLM to generate title)
  const messageCount = await db
    .select({ count: sql`count(*)` })
    .from(messages)
    .where(eq(messages.sessionId, sessionId));
  if (messageCount[0].count <= 2) {
    const title = agentResult.content.slice(0, 80);
    await db.update(agentSessions).set({ title }).where(eq(agentSessions.id, sessionId));
  }

  return { success: true, creditsUsed };
});
```

### 3. Scheduled Task CRON Support

The `scheduled-task` function at line 74 simply re-emits a `task/execute` event. It needs to:

1. Read the `scheduledTasks` table from `packages/database/src/schema/scheduledTasks.ts`
2. Support `scheduleType: "once" | "recurring" | "cron"`
3. For recurring tasks, use Inngest's `step.sleepUntil()` or emit the next scheduled event
4. Update `lastRunAt`, `nextRunAt`, `runCount` in the `scheduledTasks` table
5. Create entries in `taskExecutions` table for each run

**Implementation approach:**

```typescript
const scheduledTask = inngest.createFunction(
  { id: "scheduled-task", name: "Scheduled Task" },
  { event: "task/scheduled" },
  async ({ event, step }) => {
    const { scheduledTaskId, userId } = event.data;

    // Load scheduled task from DB
    const scheduledTask = await step.run("load-task", async () => {
      const [task] = await db
        .select()
        .from(scheduledTasks)
        .where(eq(scheduledTasks.id, scheduledTaskId));
      return task;
    });

    if (!scheduledTask || !scheduledTask.isEnabled) return;

    // Create execution record
    const executionId = await step.run("create-execution", async () => {
      const [execution] = await db
        .insert(taskExecutions)
        .values({
          scheduledTaskId,
          status: "running",
          startedAt: new Date(),
        })
        .returning();
      return execution.id;
    });

    // Execute the task
    await step.run("execute", async () => {
      await step.sendEvent("trigger", {
        name: "task/execute",
        data: {
          taskId: executionId,
          userId,
          prompt: scheduledTask.payload?.prompt || "",
          ...scheduledTask.payload,
        },
      });
    });

    // Update execution record and schedule next run
    await step.run("finalize", async () => {
      await db
        .update(taskExecutions)
        .set({
          status: "success",
          completedAt: new Date(),
        })
        .where(eq(taskExecutions.id, executionId));

      // Calculate next run time based on schedule
      const nextRun = calculateNextRun(scheduledTask);
      await db
        .update(scheduledTasks)
        .set({
          lastRunAt: new Date(),
          runCount: sql`${scheduledTasks.runCount} + 1`,
          nextRunAt: nextRun,
        })
        .where(eq(scheduledTasks.id, scheduledTaskId));

      // Schedule next run if recurring
      if (nextRun) {
        await inngest.send({
          name: "task/scheduled",
          data: { scheduledTaskId, userId },
          ts: nextRun.getTime(),
        });
      }
    });
  }
);
```

### 4. WebSocket Events After Task Completion

The REST endpoints already publish events via Redis pub/sub (`task:created`, `task:continue`, `task:cancelled`), but the Inngest functions do not yet publish WebSocket events for:

- `agent:status` (thinking, executing, idle) during task execution
- `task:completed` after successful execution
- `task:failed` after max retries exhausted
- `task:progress` for intermediate updates during long-running tasks

These should be added to the `prepare-context` and `process-result` steps as described above.

---

## Database Tables

| Table             | Schema File         | Key Columns                                                         |
| ----------------- | ------------------- | ------------------------------------------------------------------- |
| `agent_sessions`  | `sessions.ts`       | id, userId, title, status, metadata                                 |
| `messages`        | `sessions.ts`       | id, sessionId, role (user/assistant/system/tool), content, metadata |
| `agents`          | `agents.ts`         | id, sessionId, type, status, currentTask, progress                  |
| `agent_tasks`     | `agents.ts`         | id, agentId, parentTaskId, title, status, result, priority          |
| `scheduled_tasks` | `scheduledTasks.ts` | id, userId, scheduleType, cronExpression, payload, nextRunAt        |
| `task_executions` | `scheduledTasks.ts` | id, scheduledTaskId, status, startedAt, output, error               |

---

## Environment Variables

| Variable              | Default                    | Description                          |
| --------------------- | -------------------------- | ------------------------------------ |
| `PORT`                | `4002`                     | Task service port                    |
| `INNGEST_EVENT_KEY`   | None                       | Inngest event key                    |
| `AGENT_SERVICE_URL`   | `http://localhost:8000`    | Agent service for LLM calls          |
| `DEVICE_SERVICE_URL`  | `http://localhost:8080`    | Device service for device commands   |
| `BILLING_SERVICE_URL` | `http://localhost:4008`    | Billing service for credit deduction |
| `DATABASE_URL`        | (from @repo/database)      | PostgreSQL connection                |
| `REDIS_URL`           | (from @repo/service-utils) | Redis for pub/sub events             |

---

## Inter-Service Communication

The task service is called by:

- **Gateway** - Proxies REST requests for task CRUD
- **Gateway WebSocket** - Forwards `task:start`, `task:continue`, `task:cancel` commands via Redis pub/sub

The task service calls:

- **Agent service** - `POST /v1/complete` for LLM completions (during Inngest execution)
- **Device service** - For approved device commands (during approval workflow)
- **Billing service** - For credit deduction after task completion (needs implementation in process-result step)
- **Redis pub/sub** - Publishes events on `user:<userId>` channel for real-time updates
