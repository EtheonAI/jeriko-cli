# Task Service Instructions

## Overview

The task service (`services/task/`) manages task lifecycle and orchestrates work between the user, the agent service, and background processing via Inngest. It is responsible for creating tasks, dispatching them to the agent, persisting results, and handling scheduled/recurring tasks.

**Port:** 4002 (configurable via `PORT` env var)
**Framework:** Node.js / Fastify + Inngest
**Status:** Inngest functions are defined with real step structure. REST endpoints exist but are in-memory only. THE #1 PROBLEM: No database queries anywhere.

---

## Current File Structure

```
services/task/src/
  index.ts              # 61 lines - Fastify bootstrap, registers task and inngest routes
  routes/
    tasks.ts            # 197 lines - REST CRUD for tasks (all in-memory, every query is a TODO)
    inngest.ts          # 159 lines - 3 Inngest functions: execute-task, scheduled-task, approval-workflow
```

---

## How the Task Service Works Today

### REST Endpoints (`src/routes/tasks.ts`)

| Method                     | Path    | Status                                                                                               | Description |
| -------------------------- | ------- | ---------------------------------------------------------------------------------------------------- | ----------- |
| `POST /tasks`              | PARTIAL | Creates task object in memory, publishes `task:created` via Redis, returns 201. Does NOT save to DB. |
| `GET /tasks`               | STUB    | Returns empty array. Should query `agentTasks` table.                                                |
| `GET /tasks/:id`           | STUB    | Returns 404. Should query by ID.                                                                     |
| `PUT /tasks/:id`           | STUB    | Returns 404. Should update task.                                                                     |
| `DELETE /tasks/:id`        | STUB    | Returns 404. Should soft-delete or hard-delete.                                                      |
| `POST /tasks/:id/continue` | PARTIAL | Publishes `task:continue` event via Redis pub/sub. No DB write.                                      |
| `POST /tasks/:id/cancel`   | PARTIAL | Publishes `task:cancelled` event via Redis pub/sub. No DB write.                                     |

The `CreateTaskSchema` validates incoming requests with zod:

```typescript
const CreateTaskSchema = z.object({
  sessionId: z.string(),
  title: z.string().optional(),
  prompt: z.string().min(1),
  priority: TaskPrioritySchema.optional().default("normal"),
  targetDeviceId: z.string().optional(),
  targetPlatform: z.string().optional(),
  requiredCapabilities: z.array(z.string()).optional().default([]),
  metadata: z.record(z.unknown()).optional().default({}),
});
```

The service already imports from `@repo/database` (line 3: `import { db, eq, desc, and } from "@repo/database"`) and `@repo/service-utils` (line 8: `publish`), but never uses `db`.

### Inngest Functions (`src/routes/inngest.ts`)

Three Inngest functions are defined:

**1. `execute-task`** (event: `task/execute`)

- Step 1: `prepare-context` - Placeholder. Should load user context, tools, preferences from DB.
- Step 2: `call-agent` - WORKING. Calls `POST {AGENT_SERVICE_URL}/v1/complete` with prompt, userId, taskId. Uses `stream: false`.
- Step 3: `process-result` - Placeholder. Should save result to DB, update task status, deduct credits.
- Retries: 3

**2. `scheduled-task`** (event: `task/scheduled`)

- Simply re-emits a `task/execute` event with the same data
- Should be enhanced to handle CRON scheduling

**3. `approval-workflow`** (event: `task/approval-required`)

- Waits for `task/approved` event (matched by `data.taskId`)
- Timeout: 24 hours
- On approval, forwards the command to the device service
- On rejection or timeout, returns appropriate status
- Can be cancelled via `task/cancelled` event

The Inngest handler is mounted at `POST/GET/PUT /inngest/` via the `serve()` function from `inngest/fastify`.

---

## What Needs to Be Built

### 1. Wire REST Endpoints to Database (CRITICAL)

Every REST endpoint in `src/routes/tasks.ts` needs to be connected to the Drizzle ORM tables.

**Target tables** (from `packages/database/src/schema/`):

- `agentSessions` (`sessions.ts`) - The parent session containing messages and agents
- `agents` (`agents.ts`) - Individual agent instances within a session
- `agentTasks` (`agents.ts`) - Tasks assigned to agents
- `messages` (`sessions.ts`) - Conversation messages

**POST /tasks - Create Task:**

```typescript
// 1. Find or create the session
let session = await db
  .select()
  .from(agentSessions)
  .where(and(eq(agentSessions.id, input.sessionId), eq(agentSessions.userId, userId)))
  .limit(1)
  .then((r) => r[0]);

if (!session) {
  [session] = await db
    .insert(agentSessions)
    .values({
      id: input.sessionId,
      userId,
      title: input.title || "New Task",
      status: "active",
    })
    .returning();
}

// 2. Create an agent for this session (if none exists)
let [agent] = await db.select().from(agents).where(eq(agents.sessionId, input.sessionId)).limit(1);

if (!agent) {
  [agent] = await db
    .insert(agents)
    .values({
      sessionId: input.sessionId,
      type: "orchestrator",
      name: "Rubic Agent",
      status: "idle",
    })
    .returning();
}

// 3. Create the agent task
const [task] = await db
  .insert(agentTasks)
  .values({
    agentId: agent.id,
    title: input.title || input.prompt.slice(0, 100),
    description: input.prompt,
    status: "pending",
    priority: input.priority === "high" ? 1 : input.priority === "low" ? -1 : 0,
  })
  .returning();

// 4. Save the user message
await db.insert(messages).values({
  sessionId: input.sessionId,
  role: "user",
  content: input.prompt,
});

// 5. Trigger Inngest execution
await inngest.send({
  name: "task/execute",
  data: {
    taskId: task.id,
    agentId: agent.id,
    sessionId: input.sessionId,
    userId,
    prompt: input.prompt,
    targetDeviceId: input.targetDeviceId,
  },
});
```

**GET /tasks - List Tasks:**

```typescript
const conditions = [eq(agents.sessionId, query.sessionId)]; // if sessionId provided
// Join agentTasks with agents to filter by userId through session
const tasks = await db
  .select({
    task: agentTasks,
    agent: agents,
  })
  .from(agentTasks)
  .innerJoin(agents, eq(agentTasks.agentId, agents.id))
  .innerJoin(agentSessions, eq(agents.sessionId, agentSessions.id))
  .where(eq(agentSessions.userId, userId))
  .orderBy(desc(agentTasks.createdAt))
  .limit(query.limit);
```

**GET /tasks/:id, PUT /tasks/:id, DELETE /tasks/:id** - Similar patterns using `agentTasks` table.

### 2. Enhance Inngest Step 1: Prepare Context

At `src/routes/inngest.ts` line 28, the `prepare-context` step is a placeholder.

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

### 3. Enhance Inngest Step 3: Process Result

At `src/routes/inngest.ts` line 63, the `process-result` step is a placeholder.

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
    // Generate a title from the conversation
    const title = agentResult.content.slice(0, 80);
    await db.update(agentSessions).set({ title }).where(eq(agentSessions.id, sessionId));
  }

  return { success: true, creditsUsed };
});
```

### 4. Scheduled Task CRON Support

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
    const result = await step.run("execute", async () => {
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

### 5. Task Cancellation and Retry Logic

**Cancellation:**

- `POST /tasks/:id/cancel` should update the task status in DB to `cancelled`
- Send `task/cancelled` Inngest event to cancel the `approval-workflow` function
- If the agent is mid-execution, the agent service needs a cancellation endpoint

**Retry:**

- On `execute-task` failure, Inngest handles retries (configured as `retries: 3`)
- The error should be logged in the `agentTasks.result` field
- After max retries, update task status to `failed` and notify user via WebSocket

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
- **Billing service** - For credit deduction after task completion
- **Redis pub/sub** - Publishes events on `user:<userId>` channel for real-time updates
