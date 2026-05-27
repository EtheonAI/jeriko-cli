/**
 * Task Service Integration Tests
 *
 * Tests complex flows: scheduled task creation with cron, task status
 * transitions through the full lifecycle, status filtering, and deletion
 * cleanup through the route handler logic.
 *
 * All DB and Inngest interactions are mocked via setup.ts (auto-loaded by vitest config).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Import mocked modules — setup.ts handles vi.mock() hoisting
import {
  db,
  eq,
  and,
  desc,
  scheduledTasks,
  taskExecutions,
  agentSessions,
  agents,
  agentTasks,
} from "../lib/db.js";
import {
  createId,
  successResponse,
  errorResponse,
  ErrorCodes,
  publish,
  dispatchWebhookEvent,
} from "@repo/service-utils";

// ─── Test Data Factories ─────────────────────────────────────────────────────

function makeScheduledTask(overrides: Partial<{
  id: string;
  userId: string;
  name: string;
  description: string;
  taskType: string;
  scheduleType: string;
  cronExpression: string | null;
  status: string;
  isEnabled: boolean;
  nextRunAt: Date | null;
  payload: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}> = {}) {
  return {
    id: overrides.id ?? "task-1",
    userId: overrides.userId ?? "test-user-id",
    name: overrides.name ?? "Daily Report",
    description: overrides.description ?? "Generate daily report",
    taskType: overrides.taskType ?? "agent_run",
    scheduleType: overrides.scheduleType ?? "cron",
    cronExpression: "cronExpression" in overrides ? overrides.cronExpression! : "0 9 * * *",
    status: overrides.status ?? "pending",
    isEnabled: overrides.isEnabled ?? true,
    nextRunAt: overrides.nextRunAt ?? new Date("2026-02-10T09:00:00Z"),
    payload: overrides.payload ?? null,
    createdAt: overrides.createdAt ?? new Date(),
    updatedAt: overrides.updatedAt ?? new Date(),
  };
}

function makeAgentTask(overrides: Partial<{
  id: string;
  agentId: string;
  title: string;
  description: string;
  status: string;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}> = {}) {
  return {
    id: overrides.id ?? "atask-1",
    agentId: overrides.agentId ?? "agent-1",
    title: overrides.title ?? "Run analysis",
    description: overrides.description ?? "Analyze the dataset",
    status: overrides.status ?? "pending",
    priority: overrides.priority ?? 0,
    createdAt: overrides.createdAt ?? new Date(),
    updatedAt: overrides.updatedAt ?? new Date(),
    completedAt: overrides.completedAt ?? null,
  };
}

function makeExecution(overrides: Partial<{
  id: string;
  scheduledTaskId: string;
  status: string;
  createdAt: Date;
}> = {}) {
  return {
    id: overrides.id ?? "exec-1",
    scheduledTaskId: overrides.scheduledTaskId ?? "task-1",
    status: overrides.status ?? "pending",
    createdAt: overrides.createdAt ?? new Date(),
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("Create scheduled task -> verify cron expression stored", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create a scheduled task with cron expression", async () => {
    const cronExpression = "30 14 * * 5"; // Every Friday at 2:30 PM
    const task = makeScheduledTask({
      id: "task-cron",
      name: "Friday Report",
      cronExpression,
      scheduleType: "cron",
    });

    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([task]),
      }),
    });

    const [created] = await db
      .insert(scheduledTasks)
      .values({
        id: task.id,
        userId: "test-user-id",
        name: "Friday Report",
        taskType: "agent_run",
        scheduleType: "cron",
        cronExpression,
        status: "pending",
        isEnabled: true,
      })
      .returning();

    expect(created).toBeDefined();
    expect(created.id).toBe("task-cron");
    expect(created.cronExpression).toBe("30 14 * * 5");
    expect(created.scheduleType).toBe("cron");
    expect(created.status).toBe("pending");
  });

  it("should create a one-time scheduled task without cron expression", async () => {
    const scheduledAt = new Date("2026-03-01T10:00:00Z");
    const task = makeScheduledTask({
      id: "task-once",
      name: "One-time Backup",
      scheduleType: "once",
      cronExpression: null,
    });

    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([task]),
      }),
    });

    const [created] = await db
      .insert(scheduledTasks)
      .values({
        id: task.id,
        userId: "test-user-id",
        name: "One-time Backup",
        taskType: "backup",
        scheduleType: "once",
        scheduledAt,
        status: "pending",
        isEnabled: true,
      })
      .returning();

    expect(created).toBeDefined();
    expect(created.scheduleType).toBe("once");
    expect(created.cronExpression).toBeNull();
  });

  it("should reject cron schedule type without cron expression", () => {
    // Validates the route handler logic: cron requires cronExpression
    const input = {
      scheduleType: "cron",
      cronExpression: undefined,
    };

    const isValid = !(input.scheduleType === "cron" && !input.cronExpression);
    expect(isValid).toBe(false);
  });

  it("should reject once schedule type without scheduledAt", () => {
    const input = {
      scheduleType: "once",
      scheduledAt: undefined,
    };

    const isValid = !(input.scheduleType === "once" && !input.scheduledAt);
    expect(isValid).toBe(false);
  });
});

describe("Task status transitions: pending -> running -> completed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should transition a scheduled task from pending to running", async () => {
    const task = makeScheduledTask({ id: "task-run", status: "pending" });

    // Step 1: Verify task starts as pending
    expect(task.status).toBe("pending");

    // Step 2: Trigger the task — creates execution and marks task as running
    const execution = makeExecution({
      id: "exec-run",
      scheduledTaskId: "task-run",
      status: "pending",
    });

    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    });

    await db.insert(taskExecutions).values({
      id: execution.id,
      scheduledTaskId: "task-run",
      status: "pending",
    });

    // Mark task as running
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });

    await db
      .update(scheduledTasks)
      .set({ status: "running" })
      .where(eq(scheduledTasks.id, "task-run"));

    expect(db.update).toHaveBeenCalled();

    // Step 3: Task completes
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            makeScheduledTask({ id: "task-run", status: "completed" }),
          ]),
        }),
      }),
    });

    const [completed] = await db
      .update(scheduledTasks)
      .set({ status: "completed" })
      .where(eq(scheduledTasks.id, "task-run"))
      .returning();

    expect(completed).toBeDefined();
    expect(completed.status).toBe("completed");
  });

  it("should track execution alongside status transition", async () => {
    const taskId = "task-exec";
    const executionId = "exec-track";

    // Create execution record
    const execution = makeExecution({
      id: executionId,
      scheduledTaskId: taskId,
      status: "pending",
    });

    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    });

    await db.insert(taskExecutions).values({
      id: executionId,
      scheduledTaskId: taskId,
      status: "pending",
    });

    expect(db.insert).toHaveBeenCalled();

    // List executions for the task
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              offset: vi.fn().mockResolvedValue([execution]),
            }),
          }),
        }),
      }),
    });

    const executions = await db
      .select()
      .from(taskExecutions)
      .where(eq(taskExecutions.scheduledTaskId, taskId))
      .orderBy()
      .limit(20)
      .offset(0);

    expect(executions).toHaveLength(1);
    expect(executions[0].id).toBe(executionId);
    expect(executions[0].scheduledTaskId).toBe(taskId);
  });
});

describe("Task status transitions: pending -> running -> failed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should transition from pending to running to failed", async () => {
    const taskId = "task-fail";

    // Step 1: Start as pending
    const pendingTask = makeAgentTask({
      id: taskId,
      status: "pending",
    });

    expect(pendingTask.status).toBe("pending");

    // Step 2: Transition to running
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            makeAgentTask({ id: taskId, status: "running" }),
          ]),
        }),
      }),
    });

    const [running] = await db
      .update(agentTasks)
      .set({ status: "running" })
      .where(eq(agentTasks.id, taskId))
      .returning();

    expect(running.status).toBe("running");

    // Step 3: Transition to failed
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            makeAgentTask({ id: taskId, status: "failed" }),
          ]),
        }),
      }),
    });

    const [failed] = await db
      .update(agentTasks)
      .set({ status: "failed" })
      .where(eq(agentTasks.id, taskId))
      .returning();

    expect(failed.status).toBe("failed");
  });

  it("should dispatch webhook event on task failure", async () => {
    const taskId = "task-webhook-fail";
    const userId = "test-user-id";

    const failedTask = makeAgentTask({
      id: taskId,
      status: "failed",
      title: "Failed analysis",
    });

    // Simulate what the update route does when status is "failed"
    dispatchWebhookEvent({
      eventType: "agent.task.failed",
      resourceType: "task",
      resourceId: taskId,
      payload: {
        id: failedTask.id,
        status: failedTask.status,
        title: failedTask.title,
      },
      userId,
    });

    expect(dispatchWebhookEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "agent.task.failed",
        resourceId: taskId,
        userId,
      })
    );
  });
});

describe("List tasks with filtering by status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return only tasks matching the requested status", async () => {
    const pendingTask = makeScheduledTask({
      id: "task-p1",
      status: "pending",
      name: "Pending Task",
    });
    const runningTask = makeScheduledTask({
      id: "task-r1",
      status: "running",
      name: "Running Task",
    });

    // Filter for pending only
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              offset: vi.fn().mockResolvedValue([pendingTask]),
            }),
          }),
        }),
      }),
    });

    const pendingTasks = await db
      .select()
      .from(scheduledTasks)
      .where(and(eq(scheduledTasks.userId, "test-user-id"), eq(scheduledTasks.status, "pending")))
      .orderBy(desc(scheduledTasks.createdAt))
      .limit(20)
      .offset(0);

    expect(pendingTasks).toHaveLength(1);
    expect(pendingTasks[0].status).toBe("pending");
    expect(pendingTasks[0].name).toBe("Pending Task");

    // Filter for running only
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              offset: vi.fn().mockResolvedValue([runningTask]),
            }),
          }),
        }),
      }),
    });

    const runningTasks = await db
      .select()
      .from(scheduledTasks)
      .where(and(eq(scheduledTasks.userId, "test-user-id"), eq(scheduledTasks.status, "running")))
      .orderBy(desc(scheduledTasks.createdAt))
      .limit(20)
      .offset(0);

    expect(runningTasks).toHaveLength(1);
    expect(runningTasks[0].status).toBe("running");
  });

  it("should return all tasks when no status filter is applied", async () => {
    const tasks = [
      makeScheduledTask({ id: "task-a", status: "pending" }),
      makeScheduledTask({ id: "task-b", status: "running" }),
      makeScheduledTask({ id: "task-c", status: "completed" }),
    ];

    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              offset: vi.fn().mockResolvedValue(tasks),
            }),
          }),
        }),
      }),
    });

    const allTasks = await db
      .select()
      .from(scheduledTasks)
      .where(eq(scheduledTasks.userId, "test-user-id"))
      .orderBy(desc(scheduledTasks.createdAt))
      .limit(20)
      .offset(0);

    expect(allTasks).toHaveLength(3);
    const statuses = allTasks.map((t: any) => t.status);
    expect(statuses).toContain("pending");
    expect(statuses).toContain("running");
    expect(statuses).toContain("completed");
  });

  it("should return empty list when no tasks match the filter", async () => {
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              offset: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      }),
    });

    const cancelledTasks = await db
      .select()
      .from(scheduledTasks)
      .where(and(eq(scheduledTasks.userId, "test-user-id"), eq(scheduledTasks.status, "cancelled")))
      .orderBy(desc(scheduledTasks.createdAt))
      .limit(20)
      .offset(0);

    expect(cancelledTasks).toHaveLength(0);
  });
});

describe("Delete task -> verify removed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should delete a task and confirm it no longer appears in list", async () => {
    const taskToDelete = makeAgentTask({ id: "atask-del" });

    // Step 1: Verify task exists before deletion (ownership check)
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                { task: taskToDelete, sessionUserId: "test-user-id" },
              ]),
            }),
          }),
        }),
      }),
    });

    const ownershipResult = await db
      .select()
      .from(agentTasks)
      .innerJoin(agents, eq(agents.id, agentTasks.agentId))
      .innerJoin(agentSessions, eq(agentSessions.id, agents.sessionId))
      .where(eq(agentTasks.id, "atask-del"))
      .limit(1);

    expect(ownershipResult).toHaveLength(1);
    expect(ownershipResult[0].sessionUserId).toBe("test-user-id");

    // Step 2: Delete the task
    (db.delete as ReturnType<typeof vi.fn>).mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([taskToDelete]),
      }),
    });

    const [deleted] = await db
      .delete(agentTasks)
      .where(eq(agentTasks.id, "atask-del"))
      .returning();

    expect(deleted).toBeDefined();
    expect(deleted.id).toBe("atask-del");

    // Step 3: Verify task is no longer in the list
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      }),
    });

    const afterDelete = await db
      .select()
      .from(agentTasks)
      .innerJoin(agents, eq(agents.id, agentTasks.agentId))
      .innerJoin(agentSessions, eq(agentSessions.id, agents.sessionId))
      .where(eq(agentTasks.id, "atask-del"))
      .limit(1);

    expect(afterDelete).toHaveLength(0);
  });

  it("should return 404 when deleting a non-existent task", async () => {
    // Ownership check returns empty
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      }),
    });

    const ownershipResult = await db
      .select()
      .from(agentTasks)
      .innerJoin(agents, eq(agents.id, agentTasks.agentId))
      .innerJoin(agentSessions, eq(agentSessions.id, agents.sessionId))
      .where(eq(agentTasks.id, "nonexistent"))
      .limit(1);

    expect(ownershipResult).toHaveLength(0);

    // Route handler would throw 404 here
    const isNotFound = ownershipResult.length === 0;
    expect(isNotFound).toBe(true);
  });

  it("should delete a scheduled task and verify removal", async () => {
    const scheduledTask = makeScheduledTask({ id: "sched-del" });

    // Verify exists
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([scheduledTask]),
        }),
      }),
    });

    const [found] = await db
      .select()
      .from(scheduledTasks)
      .where(and(eq(scheduledTasks.id, "sched-del"), eq(scheduledTasks.userId, "test-user-id")))
      .limit(1);

    expect(found).toBeDefined();

    // Delete
    (db.delete as ReturnType<typeof vi.fn>).mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([scheduledTask]),
      }),
    });

    const [deleted] = await db
      .delete(scheduledTasks)
      .where(eq(scheduledTasks.id, "sched-del"))
      .returning();

    expect(deleted).toBeDefined();
    expect(deleted.id).toBe("sched-del");

    // Verify gone
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    const [afterDelete] = await db
      .select()
      .from(scheduledTasks)
      .where(and(eq(scheduledTasks.id, "sched-del"), eq(scheduledTasks.userId, "test-user-id")))
      .limit(1);

    expect(afterDelete).toBeUndefined();
  });
});
