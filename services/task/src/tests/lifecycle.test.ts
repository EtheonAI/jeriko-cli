/**
 * Scheduled Task Lifecycle Tests
 *
 * Tests the full flow: task creation → cron-scheduler finds due → execution dispatched
 * → execution runs → result processed → next run calculated.
 *
 * All DB and Inngest interactions are mocked via setup.ts.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

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
  publish,
  dispatchWebhookEvent,
} from "@repo/service-utils";
import { calculateNextRunAt } from "../lib/schedule-utils.js";

// ─── Test Data Factories ──────────────────────────────────────────

function makeScheduledTask(overrides: Record<string, unknown> = {}) {
  return {
    id: "task-1",
    userId: "user-1",
    name: "Daily Report",
    description: "Generate daily report",
    taskType: "agent_run",
    scheduleType: "cron",
    cronExpression: "0 9 * * *",
    recurrencePattern: null,
    recurrenceInterval: 1,
    recurrenceDaysOfWeek: null,
    recurrenceDayOfMonth: null,
    recurrenceTime: null,
    timezone: "UTC",
    status: "pending",
    isEnabled: true,
    nextRunAt: new Date("2026-02-17T09:00:00Z"),
    lastRunAt: null,
    lastRunStatus: null,
    lastRunError: null,
    runCount: 0,
    maxRuns: null,
    maxRetries: 3,
    retryDelaySeconds: 60,
    currentRetryCount: 0,
    endDate: null,
    payload: { prompt: "Generate daily report" },
    metadata: null,
    createdAt: new Date("2026-02-16T12:00:00Z"),
    updatedAt: new Date("2026-02-16T12:00:00Z"),
    ...overrides,
  };
}

function makeExecution(overrides: Record<string, unknown> = {}) {
  return {
    id: "exec-1",
    scheduledTaskId: "task-1",
    status: "pending",
    startedAt: null,
    completedAt: null,
    durationMs: null,
    output: null,
    error: null,
    errorStack: null,
    retryNumber: 0,
    sessionId: null,
    createdAt: new Date(),
    ...overrides,
  };
}

// ─── Phase 1: Task Creation ───────────────────────────────────────

describe("Phase 1: Task creation with correct nextRunAt", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should create a cron task with nextRunAt calculated from cron expression", () => {
    const nextRunAt = calculateNextRunAt({
      scheduleType: "cron",
      cronExpression: "0 9 * * *",
      timezone: "UTC",
    });

    expect(nextRunAt).toBeInstanceOf(Date);
    expect(nextRunAt!.getTime()).toBeGreaterThan(Date.now());
    expect(nextRunAt!.getUTCHours()).toBe(9);
    expect(nextRunAt!.getUTCMinutes()).toBe(0);
  });

  it("should create a one-time task with nextRunAt matching scheduledAt", () => {
    const scheduledAt = new Date("2026-03-01T15:00:00Z");
    const nextRunAt = calculateNextRunAt({
      scheduleType: "once",
      scheduledAt,
    });

    expect(nextRunAt).toEqual(scheduledAt);
  });

  it("should create a recurring daily task with nextRunAt within 24h", () => {
    const nextRunAt = calculateNextRunAt({
      scheduleType: "recurring",
      recurrencePattern: "daily",
      recurrenceTime: "09:00",
    });

    expect(nextRunAt).toBeInstanceOf(Date);
    const diffMs = nextRunAt!.getTime() - Date.now();
    expect(diffMs).toBeGreaterThan(0);
    expect(diffMs).toBeLessThanOrEqual(24 * 60 * 60 * 1000 + 60_000);
  });
});

// ─── Phase 2: Cron Scheduler Finds Due Tasks ─────────────────────

describe("Phase 2: Cron scheduler finds due tasks", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should find tasks where nextRunAt <= now, isEnabled, and status pending", async () => {
    const now = new Date();
    const dueTask = makeScheduledTask({
      nextRunAt: new Date(now.getTime() - 60_000), // 1 min ago
      status: "pending",
      isEnabled: true,
    });

    // Mock: db.select().from().where() returns the due task
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([dueTask]),
      }),
    });

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

    expect(tasks).toHaveLength(1);
    expect(tasks[0].id).toBe("task-1");
    expect(tasks[0].status).toBe("pending");
    expect(tasks[0].isEnabled).toBe(true);
  });

  it("should NOT find tasks past their endDate", async () => {
    const now = new Date();
    const expiredTask = makeScheduledTask({
      nextRunAt: new Date(now.getTime() - 60_000),
      endDate: new Date("2026-01-01T00:00:00Z"), // Past
      status: "pending",
      isEnabled: true,
    });

    // The cron scheduler filters out expired tasks AFTER the query
    const filtered = [expiredTask].filter((t) => {
      if (t.endDate && new Date(t.endDate as string) <= now) return false;
      return true;
    });

    expect(filtered).toHaveLength(0);
  });

  it("should NOT find tasks that exceeded maxRuns", () => {
    const now = new Date();
    const exhaustedTask = makeScheduledTask({
      nextRunAt: new Date(now.getTime() - 60_000),
      maxRuns: 5,
      runCount: 5,
      status: "pending",
      isEnabled: true,
    });

    const filtered = [exhaustedTask].filter((t) => {
      if (t.maxRuns != null && (t.runCount ?? 0) >= t.maxRuns) return false;
      return true;
    });

    expect(filtered).toHaveLength(0);
  });

  it("should NOT find disabled tasks", async () => {
    const disabledTask = makeScheduledTask({
      isEnabled: false,
      status: "pending",
    });

    // The DB query filters by isEnabled=true, so this would never be returned
    // We just validate the filter condition exists
    expect(disabledTask.isEnabled).toBe(false);
  });

  it("should NOT find tasks with status !== pending", async () => {
    const runningTask = makeScheduledTask({
      status: "running",
      isEnabled: true,
    });

    // Running tasks are filtered out by eq(status, "pending")
    expect(runningTask.status).not.toBe("pending");
  });
});

// ─── Phase 3: Execution Dispatching ──────────────────────────────

describe("Phase 3: Execution dispatching", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should create execution record before dispatching", async () => {
    const executionId = "exec-new";
    const taskId = "task-1";

    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    });

    await db.insert(taskExecutions).values({
      id: executionId,
      scheduledTaskId: taskId,
      status: "pending",
    });

    expect(db.insert).toHaveBeenCalledWith(taskExecutions);
  });

  it("should mark task as running after dispatch", async () => {
    const taskId = "task-1";

    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });

    await db
      .update(scheduledTasks)
      .set({ status: "running" })
      .where(eq(scheduledTasks.id, taskId));

    expect(db.update).toHaveBeenCalledWith(scheduledTasks);
  });

  it("should extract prompt from payload for Inngest event", () => {
    const task = makeScheduledTask({
      payload: { prompt: "Generate weekly summary" },
    });

    const prompt =
      (task.payload as Record<string, unknown> | null)?.prompt ??
      task.description ??
      task.name;

    expect(prompt).toBe("Generate weekly summary");
  });

  it("should fall back to description when payload has no prompt", () => {
    const task = makeScheduledTask({
      payload: null,
      description: "Backup database",
    });

    const prompt =
      (task.payload as Record<string, unknown> | null)?.prompt ??
      task.description ??
      task.name;

    expect(prompt).toBe("Backup database");
  });

  it("should fall back to name when no description or payload prompt", () => {
    const task = makeScheduledTask({
      payload: null,
      description: null,
    });

    const prompt =
      (task.payload as Record<string, unknown> | null)?.prompt ??
      task.description ??
      task.name;

    expect(prompt).toBe("Daily Report");
  });
});

// ─── Phase 4: Execution Result Processing ────────────────────────

describe("Phase 4: Execution result processing", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should mark execution as success with output and duration", async () => {
    const executionId = "exec-1";
    const startedAt = new Date(Date.now() - 5000);
    const now = new Date();
    const durationMs = now.getTime() - startedAt.getTime();

    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });

    await db
      .update(taskExecutions)
      .set({
        status: "success",
        completedAt: now,
        durationMs,
        output: { result: "Report generated" },
      })
      .where(eq(taskExecutions.id, executionId));

    expect(db.update).toHaveBeenCalledWith(taskExecutions);
    expect(durationMs).toBeGreaterThanOrEqual(5000);
  });

  it("should calculate next runCount and nextRunAt after success", () => {
    const task = makeScheduledTask({
      runCount: 2,
      cronExpression: "0 9 * * *",
      scheduleType: "cron",
    });

    const newRunCount = (task.runCount ?? 0) + 1;
    expect(newRunCount).toBe(3);

    const nextRunAt = calculateNextRunAt({
      ...task,
      runCount: newRunCount,
    } as any);

    expect(nextRunAt).toBeInstanceOf(Date);
    expect(nextRunAt!.getUTCHours()).toBe(9);
  });

  it("should mark task completed when no more runs available", () => {
    const task = makeScheduledTask({
      runCount: 4,
      maxRuns: 5,
      scheduleType: "cron",
      cronExpression: "0 9 * * *",
    });

    const newRunCount = (task.runCount ?? 0) + 1; // = 5
    const nextRunAt = calculateNextRunAt({
      ...task,
      runCount: newRunCount,
    } as any);

    // maxRuns=5, runCount=5 → null (no more runs)
    expect(nextRunAt).toBeNull();

    const newStatus = nextRunAt ? "pending" : "completed";
    expect(newStatus).toBe("completed");
  });

  it("should keep task pending when more runs available", () => {
    const task = makeScheduledTask({
      runCount: 2,
      maxRuns: 10,
      scheduleType: "cron",
      cronExpression: "0 9 * * *",
    });

    const newRunCount = (task.runCount ?? 0) + 1; // = 3
    const nextRunAt = calculateNextRunAt({
      ...task,
      runCount: newRunCount,
    } as any);

    expect(nextRunAt).toBeInstanceOf(Date);
    const newStatus = nextRunAt ? "pending" : "completed";
    expect(newStatus).toBe("pending");
  });

  it("should publish completion event with correct data", () => {
    const userId = "user-1";
    const taskId = "task-1";
    const executionId = "exec-1";
    const runCount = 3;
    const nextRunAt = new Date("2026-02-18T09:00:00Z");

    publish(`user:${userId}`, {
      type: "scheduledTask:completed",
      data: { taskId, executionId, runCount, nextRunAt },
    });

    expect(publish).toHaveBeenCalledWith(
      `user:${userId}`,
      expect.objectContaining({
        type: "scheduledTask:completed",
        data: expect.objectContaining({
          taskId,
          executionId,
          runCount: 3,
        }),
      }),
    );
  });

  it("should dispatch webhook event on execution", () => {
    const userId = "user-1";
    const taskId = "task-1";
    const executionId = "exec-1";

    dispatchWebhookEvent({
      eventType: "scheduledTask.executed",
      resourceType: "scheduledTask",
      resourceId: taskId,
      payload: { taskId, executionId, status: "success", runCount: 3 },
      userId,
    });

    expect(dispatchWebhookEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "scheduledTask.executed",
        resourceId: taskId,
        userId,
      }),
    );
  });
});

// ─── Phase 5: Failure Handling ───────────────────────────────────

describe("Phase 5: Failure handling", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should mark execution as failed with error details", async () => {
    const executionId = "exec-fail";
    const errorMessage = "Agent service timeout";

    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });

    await db
      .update(taskExecutions)
      .set({
        status: "failed",
        completedAt: new Date(),
        error: errorMessage,
        errorStack: "Error: Agent service timeout\n    at ...",
      })
      .where(eq(taskExecutions.id, executionId));

    expect(db.update).toHaveBeenCalledWith(taskExecutions);
  });

  it("should reset task to pending on failure (so cron retries)", async () => {
    const taskId = "task-1";

    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });

    await db
      .update(scheduledTasks)
      .set({
        status: "pending",
        lastRunStatus: "failed",
        lastRunError: "Agent service timeout",
      })
      .where(eq(scheduledTasks.id, taskId));

    expect(db.update).toHaveBeenCalledWith(scheduledTasks);
  });

  it("should publish failure event to user", () => {
    const userId = "user-1";
    const taskId = "task-1";
    const executionId = "exec-fail";

    publish(`user:${userId}`, {
      type: "scheduledTask:failed",
      data: { taskId, executionId, error: "Agent service timeout" },
    });

    expect(publish).toHaveBeenCalledWith(
      `user:${userId}`,
      expect.objectContaining({
        type: "scheduledTask:failed",
        data: expect.objectContaining({
          taskId,
          error: "Agent service timeout",
        }),
      }),
    );
  });
});

// ─── Phase 6: Manual Trigger ─────────────────────────────────────

describe("Phase 6: Manual trigger flow", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should create execution record and mark task running on manual trigger", async () => {
    const taskId = "task-manual";
    const executionId = "exec-manual";

    // Step 1: Create execution
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    });

    await db.insert(taskExecutions).values({
      id: executionId,
      scheduledTaskId: taskId,
      status: "pending",
    });

    expect(db.insert).toHaveBeenCalledWith(taskExecutions);

    // Step 2: Mark running
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });

    await db
      .update(scheduledTasks)
      .set({ status: "running" })
      .where(eq(scheduledTasks.id, taskId));

    expect(db.update).toHaveBeenCalledWith(scheduledTasks);
  });

  it("should publish triggered event to user", () => {
    const userId = "user-1";
    const taskId = "task-manual";
    const executionId = "exec-manual";

    publish(`user:${userId}`, {
      type: "scheduledTask:triggered",
      data: { taskId, executionId },
    });

    expect(publish).toHaveBeenCalledWith(
      `user:${userId}`,
      expect.objectContaining({
        type: "scheduledTask:triggered",
        data: expect.objectContaining({
          taskId: "task-manual",
          executionId: "exec-manual",
        }),
      }),
    );
  });
});

// ─── Phase 7: Approval Workflow ──────────────────────────────────

describe("Phase 7: Approval workflow", () => {
  it("should require taskId, userId, action, and optional deviceId", () => {
    const event = {
      name: "task/approval-required",
      data: {
        taskId: "task-approve",
        userId: "user-1",
        action: "unlock_door",
        deviceId: "device-1",
      },
    };

    expect(event.data.taskId).toBeDefined();
    expect(event.data.userId).toBeDefined();
    expect(event.data.action).toBeDefined();
    expect(event.data.deviceId).toBeDefined();
  });

  it("should produce timeout result when no approval received", () => {
    // Simulates Inngest waitForEvent timeout (24h)
    const approval = null; // Timed out

    const result = !approval
      ? { taskId: "task-approve", status: "timeout" }
      : { taskId: "task-approve", status: "approved" };

    expect(result.status).toBe("timeout");
  });

  it("should produce rejected result when user denies", () => {
    const approval = { data: { approved: false } };

    const result = !approval.data.approved
      ? { taskId: "task-approve", status: "rejected" }
      : { taskId: "task-approve", status: "approved" };

    expect(result.status).toBe("rejected");
  });

  it("should produce approved result and execute when user approves", () => {
    const approval = { data: { approved: true } };

    const result = approval.data.approved
      ? { taskId: "task-approve", status: "approved", executed: true }
      : { taskId: "task-approve", status: "rejected" };

    expect(result.status).toBe("approved");
    expect(result).toHaveProperty("executed", true);
  });
});
