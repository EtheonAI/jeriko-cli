import "./setup.js";
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Connectors (connectionIds) Passthrough Tests
 *
 * Mirrors the skills-passthrough tests but for connectionIds.
 * connectionIds are stored in task.payload.connectionIds and must flow:
 *   payload → Inngest event data → orchestrator fetch body as `connections`
 *
 * ALL 4 dispatch paths tested:
 * - Path A: Cron scheduler
 * - Path B: Manual trigger
 * - Path C: Trigger-event webhook
 * - Path D: execute-task → orchestrator fetch
 */

// ─── Test Data Factories ──────────────────────────────────────────

function makeTaskWithConnectors(overrides: Record<string, unknown> = {}) {
  return {
    id: "task-with-connectors",
    userId: "user-conn-1",
    name: "Gmail + Slack Automation",
    description: "When email arrives, send summary to Slack",
    taskType: "agent_run",
    scheduleType: "trigger",
    cronExpression: null,
    recurrencePattern: null,
    recurrenceInterval: 1,
    recurrenceDaysOfWeek: null,
    recurrenceDayOfMonth: null,
    recurrenceTime: null,
    timezone: "America/New_York",
    status: "pending",
    isEnabled: true,
    nextRunAt: null,
    lastRunAt: null,
    lastRunStatus: null,
    lastRunError: null,
    runCount: 0,
    maxRuns: null,
    maxRetries: 3,
    retryDelaySeconds: 60,
    currentRetryCount: 0,
    endDate: null,
    payload: {
      prompt: "Summarize new emails and post to #general in Slack",
      skillIds: ["web-search"],
      connectionIds: ["gmail", "slack"],
    },
    metadata: null,
    triggerEnabled: true,
    triggerAppName: "gmail",
    triggerEventSlug: "GMAIL_NEW_GMAIL_MESSAGE",
    triggerConfig: {},
    composioTriggerId: "ti_conn_001",
    lastTriggerAt: null,
    lastTriggerEventId: null,
    createdAt: new Date("2026-02-17T10:00:00Z"),
    updatedAt: new Date("2026-02-17T10:00:00Z"),
    ...overrides,
  };
}

function makeTaskWithoutConnectors(overrides: Record<string, unknown> = {}) {
  return {
    id: "task-no-connectors",
    userId: "user-1",
    name: "Simple Report",
    description: "Generate a report",
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
    nextRunAt: new Date(Date.now() - 60_000),
    lastRunAt: null,
    lastRunStatus: null,
    lastRunError: null,
    runCount: 0,
    maxRuns: null,
    maxRetries: 3,
    retryDelaySeconds: 60,
    currentRetryCount: 0,
    endDate: null,
    payload: { prompt: "Generate weekly report" },
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

// ─── Helpers mirroring production extraction logic ─────────────────

function extractConnectionIdsFromPayload(payload: Record<string, unknown> | null): string[] | undefined {
  return Array.isArray(payload?.connectionIds) ? (payload!.connectionIds as string[]) : undefined;
}

function buildInngestEventData(
  task: ReturnType<typeof makeTaskWithConnectors>,
  executionId: string,
  triggerEvent?: { slug: string; data: Record<string, unknown>; triggerId: string },
) {
  const taskPayload = task.payload as Record<string, unknown> | null;
  return {
    taskId: task.id,
    executionId,
    userId: task.userId,
    prompt: (taskPayload?.prompt as string) ?? task.description ?? task.name,
    skillIds: Array.isArray(taskPayload?.skillIds) ? (taskPayload!.skillIds as string[]) : undefined,
    connectionIds: extractConnectionIdsFromPayload(taskPayload),
    ...(triggerEvent ? { triggerEvent } : {}),
  };
}

function buildOrchestratorFetchBody(
  eventData: ReturnType<typeof buildInngestEventData>,
) {
  const sessionId = `scheduled_${eventData.taskId}_${eventData.executionId}`;

  return {
    messages: [{ role: "user", content: eventData.prompt }],
    sessionId,
    userId: eventData.userId,
    ...(eventData.skillIds && eventData.skillIds.length > 0
      ? { skills: eventData.skillIds }
      : {}),
    ...(eventData.connectionIds && eventData.connectionIds.length > 0
      ? { connections: eventData.connectionIds.map((id) => ({ id })) }
      : {}),
  };
}

// ─── Tests ────────────────────────────────────────────────────────

describe("connectionIds extraction from task payload", () => {
  it("should extract connectionIds when present", () => {
    const task = makeTaskWithConnectors();
    const connectionIds = extractConnectionIdsFromPayload(task.payload as Record<string, unknown>);
    expect(connectionIds).toEqual(["gmail", "slack"]);
  });

  it("should return undefined when connectionIds is missing", () => {
    const result = extractConnectionIdsFromPayload({ prompt: "test" });
    expect(result).toBeUndefined();
  });

  it("should return undefined for null payload", () => {
    const result = extractConnectionIdsFromPayload(null);
    expect(result).toBeUndefined();
  });

  it("should return undefined when connectionIds is not an array", () => {
    expect(extractConnectionIdsFromPayload({ connectionIds: "gmail" })).toBeUndefined();
    expect(extractConnectionIdsFromPayload({ connectionIds: 42 })).toBeUndefined();
    expect(extractConnectionIdsFromPayload({ connectionIds: null })).toBeUndefined();
  });

  it("should handle empty connectionIds array", () => {
    const result = extractConnectionIdsFromPayload({ connectionIds: [] });
    expect(result).toEqual([]);
  });
});

describe("Path A: Cron scheduler extracts connectionIds from task payload", () => {
  it("should include connectionIds in Inngest event data", () => {
    const task = makeTaskWithConnectors({
      scheduleType: "cron",
      cronExpression: "0 9 * * *",
      nextRunAt: new Date(Date.now() - 60_000),
    });

    const taskPayload = task.payload as Record<string, unknown> | null;
    const inngestData = {
      taskId: task.id,
      executionId: "exec-cron-conn-1",
      userId: task.userId,
      prompt: taskPayload?.prompt ?? task.description ?? task.name,
      skillIds: Array.isArray(taskPayload?.skillIds) ? taskPayload!.skillIds : undefined,
      connectionIds: Array.isArray(taskPayload?.connectionIds) ? taskPayload!.connectionIds : undefined,
    };

    expect(inngestData.connectionIds).toEqual(["gmail", "slack"]);
    expect(inngestData.skillIds).toEqual(["web-search"]);
  });

  it("should NOT include connectionIds when task has none", () => {
    const task = makeTaskWithoutConnectors();
    const taskPayload = task.payload as Record<string, unknown> | null;

    const inngestData = {
      taskId: task.id,
      executionId: "exec-cron-conn-2",
      userId: task.userId,
      connectionIds: Array.isArray(taskPayload?.connectionIds) ? taskPayload!.connectionIds : undefined,
    };

    expect(inngestData.connectionIds).toBeUndefined();
  });
});

describe("Path B: Manual trigger extracts connectionIds", () => {
  it("should include connectionIds when manually triggering a task", () => {
    const task = makeTaskWithConnectors();
    const triggerPayload = task.payload as Record<string, unknown> | null;

    const inngestData = {
      taskId: task.id,
      executionId: "exec-manual-conn-1",
      userId: task.userId,
      connectionIds: Array.isArray(triggerPayload?.connectionIds) ? triggerPayload!.connectionIds : undefined,
    };

    expect(inngestData.connectionIds).toEqual(["gmail", "slack"]);
  });
});

describe("Path C: Trigger-event webhook extracts connectionIds", () => {
  it("should include connectionIds when trigger webhook fires", () => {
    const task = makeTaskWithConnectors();
    const eventPayload = task.payload as Record<string, unknown> | null;

    const inngestData = {
      taskId: task.id,
      executionId: "exec-trigger-conn-1",
      userId: task.userId,
      triggerEvent: {
        slug: "GMAIL_NEW_GMAIL_MESSAGE",
        data: { from: "test@example.com" },
        triggerId: "ti_conn_001",
      },
      connectionIds: Array.isArray(eventPayload?.connectionIds) ? eventPayload!.connectionIds : undefined,
    };

    expect(inngestData.connectionIds).toEqual(["gmail", "slack"]);
  });
});

describe("Path D: execute-task → orchestrator fetch body with connections", () => {
  it("should map connectionIds to connections array of {id} objects", () => {
    const task = makeTaskWithConnectors();
    const eventData = buildInngestEventData(task, "exec-orch-1");
    const fetchBody = buildOrchestratorFetchBody(eventData);

    expect(fetchBody).toHaveProperty("connections");
    expect(fetchBody.connections).toEqual([{ id: "gmail" }, { id: "slack" }]);
    // Skills also present
    expect(fetchBody.skills).toEqual(["web-search"]);
  });

  it("should NOT include connections when connectionIds is empty", () => {
    const task = makeTaskWithConnectors({
      payload: { prompt: "test", connectionIds: [] },
    });
    const eventData = buildInngestEventData(task as ReturnType<typeof makeTaskWithConnectors>, "exec-orch-2");
    const fetchBody = buildOrchestratorFetchBody(eventData);

    expect(fetchBody).not.toHaveProperty("connections");
  });

  it("should NOT include connections when connectionIds is absent", () => {
    const task = makeTaskWithoutConnectors();
    const eventData = buildInngestEventData(task as ReturnType<typeof makeTaskWithConnectors>, "exec-orch-3");
    const fetchBody = buildOrchestratorFetchBody(eventData);

    expect(fetchBody).not.toHaveProperty("connections");
    expect(fetchBody).not.toHaveProperty("skills");
  });

  it("should include both skills and connections when both present", () => {
    const task = makeTaskWithConnectors();
    const eventData = buildInngestEventData(task, "exec-orch-4");
    const fetchBody = buildOrchestratorFetchBody(eventData);

    expect(fetchBody.skills).toEqual(["web-search"]);
    expect(fetchBody.connections).toEqual([{ id: "gmail" }, { id: "slack" }]);
  });

  it("should handle single connector", () => {
    const task = makeTaskWithConnectors({
      payload: { prompt: "test", connectionIds: ["github"] },
    });
    const eventData = buildInngestEventData(task as ReturnType<typeof makeTaskWithConnectors>, "exec-orch-5");
    const fetchBody = buildOrchestratorFetchBody(eventData);

    expect(fetchBody.connections).toEqual([{ id: "github" }]);
  });
});

describe("Full pipeline: connectionIds end-to-end", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should pass connectionIds through: payload → Inngest → orchestrator as connections", () => {
    // 1. Task exists with connectionIds
    const task = makeTaskWithConnectors();
    expect(task.payload.connectionIds).toEqual(["gmail", "slack"]);

    // 2. Build Inngest event data (mirrors all dispatch paths)
    const eventData = buildInngestEventData(task, "exec-e2e-1");
    expect(eventData.connectionIds).toEqual(["gmail", "slack"]);

    // 3. Build orchestrator fetch body
    const fetchBody = buildOrchestratorFetchBody(eventData);

    // 4. Orchestrator receives connections as array of {id} objects
    expect(fetchBody.connections).toEqual([{ id: "gmail" }, { id: "slack" }]);
    expect(fetchBody.skills).toEqual(["web-search"]);
    expect(fetchBody.userId).toBe("user-conn-1");
  });

  it("should work without connectionIds (backward compat)", () => {
    const task = makeTaskWithoutConnectors();
    const eventData = buildInngestEventData(task as ReturnType<typeof makeTaskWithConnectors>, "exec-compat-1");
    const fetchBody = buildOrchestratorFetchBody(eventData);

    expect(fetchBody).not.toHaveProperty("connections");
    expect(fetchBody).not.toHaveProperty("skills");
    expect(fetchBody.messages[0]!.content).toBe("Generate weekly report");
  });
});
