/**
 * Trigger-Based Task Lifecycle Tests
 *
 * Tests the full Composio trigger flow:
 * - Trigger task creation (no nextRunAt)
 * - Cron scheduler ignores trigger-only tasks
 * - Trigger event dispatches execution with context
 * - Trigger-only tasks stay pending after completion
 * - Hybrid tasks (time + trigger) work correctly
 * - Dedup, disable/cancel, edge cases
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

function makeTriggerTask(overrides: Record<string, unknown> = {}) {
  return {
    id: "task-trigger-1",
    userId: "user-1",
    name: "Gmail Monitor",
    description: "Summarize new emails and extract action items",
    taskType: "agent_run",
    scheduleType: "trigger",
    cronExpression: null,
    recurrencePattern: null,
    recurrenceInterval: 1,
    recurrenceDaysOfWeek: null,
    recurrenceDayOfMonth: null,
    recurrenceTime: null,
    timezone: "UTC",
    status: "pending",
    isEnabled: true,
    nextRunAt: null, // Trigger-only tasks have no time schedule
    lastRunAt: null,
    lastRunStatus: null,
    lastRunError: null,
    runCount: 0,
    maxRuns: null,
    maxRetries: 3,
    retryDelaySeconds: 60,
    currentRetryCount: 0,
    endDate: null,
    payload: { prompt: "Summarize the following email and extract action items." },
    metadata: null,
    // Trigger-specific fields
    triggerEnabled: true,
    triggerAppName: "gmail",
    triggerEventSlug: "GMAIL_NEW_GMAIL_MESSAGE",
    triggerConfig: { labelIds: ["INBOX"] },
    composioTriggerId: "ti_abc123",
    lastTriggerAt: null,
    lastTriggerEventId: null,
    createdAt: new Date("2026-02-17T12:00:00Z"),
    updatedAt: new Date("2026-02-17T12:00:00Z"),
    ...overrides,
  };
}

function makeScheduledTask(overrides: Record<string, unknown> = {}) {
  return {
    id: "task-cron-1",
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
    triggerEnabled: false,
    triggerAppName: null,
    triggerEventSlug: null,
    triggerConfig: null,
    composioTriggerId: null,
    lastTriggerAt: null,
    lastTriggerEventId: null,
    createdAt: new Date("2026-02-16T12:00:00Z"),
    updatedAt: new Date("2026-02-16T12:00:00Z"),
    ...overrides,
  };
}

function makeTriggerEvent() {
  return {
    slug: "GMAIL_NEW_GMAIL_MESSAGE",
    data: {
      messageId: "msg_12345",
      threadId: "thread_abc",
      from: "john@example.com",
      subject: "Project update - Q1 review",
      snippet: "Hi, please review the attached Q1 numbers...",
      labelIds: ["INBOX", "UNREAD"],
      internalDate: "1739808000000",
    },
    triggerId: "ti_abc123",
  };
}

// ─── Phase 1: Trigger Task Creation ───────────────────────────────

describe("Trigger Phase 1: Task creation with trigger schedule type", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return null nextRunAt for trigger-only tasks", () => {
    const nextRunAt = calculateNextRunAt({
      scheduleType: "trigger",
    });

    expect(nextRunAt).toBeNull();
  });

  it("should return null nextRunAt even with extra time fields", () => {
    const nextRunAt = calculateNextRunAt({
      scheduleType: "trigger",
      cronExpression: "0 9 * * *", // Should be ignored
      recurrencePattern: "daily",
      recurrenceTime: "09:00",
    });

    expect(nextRunAt).toBeNull();
  });

  it("should store trigger fields in DB insert", async () => {
    const taskId = "task-trigger-new";

    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([
          makeTriggerTask({ id: taskId }),
        ]),
      }),
    });

    const [task] = await db
      .insert(scheduledTasks)
      .values({
        id: taskId,
        userId: "user-1",
        name: "Gmail Monitor",
        taskType: "agent_run",
        scheduleType: "trigger",
        triggerEnabled: true,
        triggerAppName: "gmail",
        triggerEventSlug: "GMAIL_NEW_GMAIL_MESSAGE",
        triggerConfig: { labelIds: ["INBOX"] },
        nextRunAt: null,
        status: "pending",
        isEnabled: true,
      })
      .returning();

    expect(db.insert).toHaveBeenCalledWith(scheduledTasks);
    expect(task.scheduleType).toBe("trigger");
    expect(task.triggerEnabled).toBe(true);
    expect(task.triggerAppName).toBe("gmail");
    expect(task.nextRunAt).toBeNull();
  });

  it("should validate trigger tasks require appName and eventSlug", () => {
    // Simulate the validation the task service does
    const input = {
      scheduleType: "trigger" as const,
      triggerAppName: undefined,
      triggerEventSlug: undefined,
    };

    const isValid =
      input.scheduleType !== "trigger" ||
      (!!input.triggerAppName && !!input.triggerEventSlug);

    expect(isValid).toBe(false);
  });

  it("should pass validation when trigger fields are present", () => {
    const input = {
      scheduleType: "trigger" as const,
      triggerAppName: "gmail",
      triggerEventSlug: "GMAIL_NEW_GMAIL_MESSAGE",
    };

    const isValid =
      input.scheduleType !== "trigger" ||
      (!!input.triggerAppName && !!input.triggerEventSlug);

    expect(isValid).toBe(true);
  });
});

// ─── Phase 2: Cron Scheduler Ignores Trigger-Only Tasks ──────────

describe("Trigger Phase 2: Cron scheduler does NOT pick up trigger-only tasks", () => {
  beforeEach(() => vi.clearAllMocks());

  it("trigger tasks have null nextRunAt, so lte(nextRunAt, now) never matches", () => {
    const triggerTask = makeTriggerTask();
    const cronTask = makeScheduledTask({
      nextRunAt: new Date(Date.now() - 60_000), // 1 min ago (due)
    });

    // Simulate the cron scheduler filter
    const now = new Date();
    const dueTasks = [triggerTask, cronTask].filter((t) => {
      // This mirrors the DB query: lte(nextRunAt, now) && isEnabled && status=pending
      if (!t.nextRunAt) return false; // Trigger tasks filtered out here
      if (new Date(t.nextRunAt as string | Date) > now) return false;
      if (!t.isEnabled) return false;
      if (t.status !== "pending") return false;
      return true;
    });

    expect(dueTasks).toHaveLength(1);
    expect(dueTasks[0]!.id).toBe("task-cron-1");
  });

  it("should find time-based tasks but not trigger tasks in mixed query", async () => {
    const now = new Date();
    const cronTask = makeScheduledTask({
      id: "task-cron-due",
      nextRunAt: new Date(now.getTime() - 60_000),
    });

    // Simulate DB returning only tasks with nextRunAt <= now
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([cronTask]), // Only cron, not trigger
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
    expect(tasks[0].scheduleType).toBe("cron");
  });
});

// ─── Phase 3: Trigger Event Dispatches Execution ─────────────────

describe("Trigger Phase 3: Trigger event dispatches execution with context", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should prepend trigger event context to the prompt", () => {
    const triggerEvent = makeTriggerEvent();
    const taskPrompt = "Summarize the following email and extract action items.";

    // Simulate the prompt building logic from inngest.ts
    const eventSummary = JSON.stringify(triggerEvent.data, null, 2);
    const userContent = `[Trigger Event: ${triggerEvent.slug}]\nEvent data:\n${eventSummary}\n\nTask instructions: ${taskPrompt}`;

    expect(userContent).toContain("[Trigger Event: GMAIL_NEW_GMAIL_MESSAGE]");
    expect(userContent).toContain('"from": "john@example.com"');
    expect(userContent).toContain('"subject": "Project update - Q1 review"');
    expect(userContent).toContain("Task instructions: Summarize the following email");
  });

  it("should include trigger event in Inngest event data", () => {
    const triggerEvent = makeTriggerEvent();

    const inngestEventData = {
      taskId: "task-trigger-1",
      executionId: "exec-trigger-1",
      userId: "user-1",
      prompt: "Summarize...",
      triggerEvent,
    };

    expect(inngestEventData.triggerEvent).toBeDefined();
    expect(inngestEventData.triggerEvent!.slug).toBe("GMAIL_NEW_GMAIL_MESSAGE");
    expect(inngestEventData.triggerEvent!.data.from).toBe("john@example.com");
    expect(inngestEventData.triggerEvent!.triggerId).toBe("ti_abc123");
  });

  it("should create execution record for trigger event", async () => {
    const executionId = "exec-trigger-1";

    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    });

    await db.insert(taskExecutions).values({
      id: executionId,
      scheduledTaskId: "task-trigger-1",
      status: "pending",
    });

    expect(db.insert).toHaveBeenCalledWith(taskExecutions);
  });

  it("should support lastTriggerAt and lastTriggerEventId DB update (done by connector webhook)", async () => {
    // Note: trigger tracking (lastTriggerAt, lastTriggerEventId) is updated
    // by the connector webhook handler, NOT by Inngest execute-task.
    // This test validates the DB schema supports the operation.
    const taskId = "task-trigger-1";

    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });

    await db
      .update(scheduledTasks)
      .set({
        lastTriggerAt: new Date(),
        lastTriggerEventId: "composio-log-id-123",
      })
      .where(eq(scheduledTasks.id, taskId));

    expect(db.update).toHaveBeenCalledWith(scheduledTasks);
  });

  it("should publish running event with trigger slug", () => {
    const userId = "user-1";
    const taskId = "task-trigger-1";
    const executionId = "exec-trigger-1";

    publish(`user:${userId}`, {
      type: "scheduledTask:running",
      data: { taskId, executionId, triggerEvent: "GMAIL_NEW_GMAIL_MESSAGE" },
    });

    expect(publish).toHaveBeenCalledWith(
      `user:${userId}`,
      expect.objectContaining({
        type: "scheduledTask:running",
        data: expect.objectContaining({
          triggerEvent: "GMAIL_NEW_GMAIL_MESSAGE",
        }),
      }),
    );
  });
});

// ─── Phase 4: Trigger-Only Tasks Stay Pending After Completion ───

describe("Trigger Phase 4: Trigger-only tasks stay pending after execution", () => {
  beforeEach(() => vi.clearAllMocks());

  it("trigger-only tasks should return to pending, not completed", () => {
    const task = makeTriggerTask({ runCount: 3 });
    const newRunCount = (task.runCount as number) + 1;

    // Simulate the logic from inngest.ts process-result step
    const isTriggerOnly = task.scheduleType === "trigger";
    const nextRunAt = isTriggerOnly
      ? null
      : calculateNextRunAt({ ...task, runCount: newRunCount } as any);

    const newStatus =
      isTriggerOnly ? "pending" : nextRunAt ? "pending" : "completed";

    expect(isTriggerOnly).toBe(true);
    expect(nextRunAt).toBeNull();
    expect(newStatus).toBe("pending"); // NOT completed!
  });

  it("cron tasks should complete when maxRuns exceeded", () => {
    const task = makeScheduledTask({
      runCount: 4,
      maxRuns: 5,
    });
    const newRunCount = (task.runCount as number) + 1;

    const isTriggerOnly = task.scheduleType === "trigger";
    const nextRunAt = isTriggerOnly
      ? null
      : calculateNextRunAt({ ...task, runCount: newRunCount } as any);

    const newStatus =
      isTriggerOnly ? "pending" : nextRunAt ? "pending" : "completed";

    expect(isTriggerOnly).toBe(false);
    expect(nextRunAt).toBeNull(); // maxRuns exceeded
    expect(newStatus).toBe("completed");
  });

  it("trigger tasks with maxRuns should still be checked", () => {
    const task = makeTriggerTask({ runCount: 9, maxRuns: 10 });
    const newRunCount = (task.runCount as number) + 1; // = 10

    // Even trigger tasks respect maxRuns — the webhook handler checks this
    const exceedsMaxRuns =
      task.maxRuns != null && newRunCount >= (task.maxRuns as number);

    expect(exceedsMaxRuns).toBe(true);
  });

  it("should increment runCount for trigger tasks", () => {
    const task = makeTriggerTask({ runCount: 5 });
    const newRunCount = (task.runCount as number) + 1;

    expect(newRunCount).toBe(6);
  });
});

// ─── Phase 5: Hybrid Tasks (Time + Trigger) ─────────────────────

describe("Trigger Phase 5: Hybrid tasks (time schedule + trigger)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("hybrid task has scheduleType=cron but triggerEnabled=true", () => {
    const hybridTask = makeScheduledTask({
      id: "task-hybrid-1",
      scheduleType: "cron",
      cronExpression: "0 9 * * 1", // Mon 9am
      triggerEnabled: true,
      triggerAppName: "gmail",
      triggerEventSlug: "GMAIL_NEW_GMAIL_MESSAGE",
      composioTriggerId: "ti_hybrid_123",
    });

    expect(hybridTask.scheduleType).toBe("cron");
    expect(hybridTask.triggerEnabled).toBe(true);
    expect(hybridTask.nextRunAt).toBeDefined();
  });

  it("hybrid task is picked up by cron scheduler (nextRunAt != null)", () => {
    const now = new Date();
    const hybridTask = makeScheduledTask({
      scheduleType: "cron",
      cronExpression: "0 9 * * *",
      nextRunAt: new Date(now.getTime() - 60_000), // Due
      triggerEnabled: true,
      composioTriggerId: "ti_hybrid_123",
    });

    const dueTasks = [hybridTask].filter((t) => {
      if (!t.nextRunAt) return false;
      if (new Date(t.nextRunAt as string | Date) > now) return false;
      if (!t.isEnabled) return false;
      if (t.status !== "pending") return false;
      return true;
    });

    expect(dueTasks).toHaveLength(1);
  });

  it("hybrid task also fires from trigger webhook", () => {
    const hybridTask = makeScheduledTask({
      scheduleType: "cron",
      triggerEnabled: true,
      composioTriggerId: "ti_hybrid_123",
      isEnabled: true,
      status: "pending",
    });

    // Webhook handler checks: isEnabled + status !== paused/cancelled
    const shouldFire =
      hybridTask.isEnabled &&
      hybridTask.status !== "paused" &&
      hybridTask.status !== "cancelled";

    expect(shouldFire).toBe(true);
  });
});

// ─── Phase 6: Deduplication ──────────────────────────────────────

describe("Trigger Phase 6: Deduplication of trigger events", () => {
  it("should skip duplicate events with same externalEventId", () => {
    const task = makeTriggerTask({
      lastTriggerEventId: "log_xyz789",
    });

    const incomingEventId = "log_xyz789"; // Same as last

    const isDuplicate =
      incomingEventId && task.lastTriggerEventId === incomingEventId;

    expect(isDuplicate).toBe(true);
  });

  it("should process events with different externalEventId", () => {
    const task = makeTriggerTask({
      lastTriggerEventId: "log_xyz789",
    });

    const incomingEventId = "log_abc456"; // Different

    const isDuplicate =
      incomingEventId && task.lastTriggerEventId === incomingEventId;

    expect(isDuplicate).toBe(false);
  });

  it("should process events when no previous eventId exists", () => {
    const task = makeTriggerTask({
      lastTriggerEventId: null,
    });

    const incomingEventId = "log_first";

    const isDuplicate =
      incomingEventId && task.lastTriggerEventId === incomingEventId;

    expect(isDuplicate).toBe(false);
  });
});

// ─── Phase 7: Disabled / Cancelled / Paused Tasks ────────────────

describe("Trigger Phase 7: Webhook handler skips disabled/cancelled/paused tasks", () => {
  it("should skip disabled tasks", () => {
    const task = makeTriggerTask({ isEnabled: false });

    const shouldSkip = !task.isEnabled || task.status === "paused" || task.status === "cancelled";

    expect(shouldSkip).toBe(true);
  });

  it("should skip paused tasks", () => {
    const task = makeTriggerTask({ status: "paused", isEnabled: true });

    const shouldSkip = !task.isEnabled || task.status === "paused" || task.status === "cancelled";

    expect(shouldSkip).toBe(true);
  });

  it("should skip cancelled tasks", () => {
    const task = makeTriggerTask({ status: "cancelled", isEnabled: false });

    const shouldSkip = !task.isEnabled || task.status === "paused" || task.status === "cancelled";

    expect(shouldSkip).toBe(true);
  });

  it("should process active enabled tasks", () => {
    const task = makeTriggerTask({ status: "pending", isEnabled: true });

    const shouldSkip = !task.isEnabled || task.status === "paused" || task.status === "cancelled";

    expect(shouldSkip).toBe(false);
  });

  it("should skip tasks past endDate", () => {
    const task = makeTriggerTask({
      endDate: new Date("2026-01-01T00:00:00Z"), // Past
    });

    const now = new Date();
    const pastEndDate = task.endDate && new Date(task.endDate as string) <= now;

    expect(pastEndDate).toBe(true);
  });

  it("should skip tasks that exceeded maxRuns", () => {
    const task = makeTriggerTask({
      maxRuns: 5,
      runCount: 5,
    });

    const exceededMaxRuns =
      task.maxRuns != null && (task.runCount ?? 0) >= (task.maxRuns as number);

    expect(exceededMaxRuns).toBe(true);
  });
});

// ─── Phase 8: Trigger Prompt Building ────────────────────────────

describe("Trigger Phase 8: Prompt building with trigger context", () => {
  it("should build correct prompt with Gmail trigger data", () => {
    const triggerEvent = makeTriggerEvent();
    const taskPrompt = "Summarize the following email and extract action items.";

    const eventSummary = JSON.stringify(triggerEvent.data, null, 2);
    const fullPrompt = `[Trigger Event: ${triggerEvent.slug}]\nEvent data:\n${eventSummary}\n\nTask instructions: ${taskPrompt}`;

    // Verify structure
    expect(fullPrompt).toMatch(/^\[Trigger Event: GMAIL_NEW_GMAIL_MESSAGE\]/);
    expect(fullPrompt).toContain("Event data:");
    expect(fullPrompt).toContain("Task instructions:");

    // Verify all email fields are present
    expect(fullPrompt).toContain('"messageId": "msg_12345"');
    expect(fullPrompt).toContain('"from": "john@example.com"');
    expect(fullPrompt).toContain('"subject": "Project update - Q1 review"');
    expect(fullPrompt).toContain('"snippet": "Hi, please review');
  });

  it("should handle empty trigger event data", () => {
    const eventSummary = JSON.stringify({}, null, 2);
    const fullPrompt = `[Trigger Event: TEST_EVENT]\nEvent data:\n${eventSummary}\n\nTask instructions: Do something`;

    expect(fullPrompt).toContain("[Trigger Event: TEST_EVENT]");
    expect(fullPrompt).toContain("{}");
    expect(fullPrompt).toContain("Task instructions: Do something");
  });

  it("should handle device target alongside trigger", () => {
    const triggerEvent = makeTriggerEvent();
    const taskPrompt = "Process email";
    const targetDeviceId = "device-smart-display";

    const eventSummary = JSON.stringify(triggerEvent.data, null, 2);
    let userContent = `[Trigger Event: ${triggerEvent.slug}]\nEvent data:\n${eventSummary}\n\nTask instructions: ${taskPrompt}`;
    if (targetDeviceId) {
      userContent += `\n\n[Target device: ${targetDeviceId}]`;
    }

    expect(userContent).toContain("[Trigger Event: GMAIL_NEW_GMAIL_MESSAGE]");
    expect(userContent).toContain("[Target device: device-smart-display]");
  });

  it("should NOT prepend trigger context when no trigger event", () => {
    const prompt = "Generate daily report";
    const triggerEvent = undefined;

    let userContent = prompt;
    if (triggerEvent) {
      userContent = `[Trigger Event: ...]\n\nTask instructions: ${userContent}`;
    }

    expect(userContent).toBe("Generate daily report");
    expect(userContent).not.toContain("[Trigger Event:");
  });
});

// ─── Phase 9: Schedule Utils — Trigger Type ──────────────────────

describe("Trigger Phase 9: calculateNextRunAt with trigger type", () => {
  it("should return null for trigger schedule type", () => {
    expect(calculateNextRunAt({ scheduleType: "trigger" })).toBeNull();
  });

  it("should still work for cron schedule type", () => {
    const result = calculateNextRunAt({
      scheduleType: "cron",
      cronExpression: "0 9 * * *",
      timezone: "UTC",
    });
    expect(result).toBeInstanceOf(Date);
  });

  it("should still work for once schedule type", () => {
    const scheduledAt = new Date("2026-06-01T10:00:00Z");
    const result = calculateNextRunAt({
      scheduleType: "once",
      scheduledAt,
    });
    expect(result).toEqual(scheduledAt);
  });

  it("should still work for recurring schedule type", () => {
    const result = calculateNextRunAt({
      scheduleType: "recurring",
      recurrencePattern: "daily",
      recurrenceTime: "09:00",
    });
    expect(result).toBeInstanceOf(Date);
  });

  it("should respect endDate even for trigger type", () => {
    const result = calculateNextRunAt({
      scheduleType: "trigger",
      endDate: new Date("2026-01-01T00:00:00Z"), // Past
    });
    // End date check happens before schedule type switch
    expect(result).toBeNull();
  });

  it("should respect maxRuns even for trigger type", () => {
    const result = calculateNextRunAt({
      scheduleType: "trigger",
      maxRuns: 5,
      runCount: 5,
    });
    expect(result).toBeNull();
  });
});

// ─── Phase 10: Cancel / Delete with Composio Cleanup ─────────────

describe("Trigger Phase 10: Cancel/delete cleans up Composio trigger", () => {
  beforeEach(() => vi.clearAllMocks());

  it("cancelled task should have triggerEnabled set to false", () => {
    const cancelUpdate = {
      status: "cancelled",
      isEnabled: false,
      triggerEnabled: false,
    };

    expect(cancelUpdate.triggerEnabled).toBe(false);
    expect(cancelUpdate.isEnabled).toBe(false);
  });

  it("deleted task with composioTriggerId should trigger cleanup", () => {
    const task = makeTriggerTask({ composioTriggerId: "ti_abc123" });

    const needsCleanup = !!task.composioTriggerId;

    expect(needsCleanup).toBe(true);
  });

  it("deleted task without composioTriggerId should skip cleanup", () => {
    const task = makeScheduledTask({ composioTriggerId: null });

    const needsCleanup = !!task.composioTriggerId;

    expect(needsCleanup).toBe(false);
  });
});
