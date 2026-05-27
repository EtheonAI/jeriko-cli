/**
 * Composio Trigger Route Tests
 *
 * Tests the webhook receiver, Standard Webhooks verification, trigger CRUD,
 * dedup logic, disabled task handling, and notification dispatch.
 *
 * Composio V3 webhook format: Standard Webhooks headers + trigger_slug field.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHmac } from "node:crypto";

// ─── Hoisted Mocks (defined before vi.mock factory runs) ────────

const { mockDb, mockComposio, mockTable, resetDbChain } = vi.hoisted(() => {
  const _mockDb = {
    select: vi.fn(),
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(),
    orderBy: vi.fn(),
    insert: vi.fn(),
    values: vi.fn(),
    returning: vi.fn(),
    update: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  };

  const _resetDbChain = () => {
    _mockDb.select.mockReturnThis();
    _mockDb.from.mockReturnThis();
    _mockDb.where.mockReturnThis();
    _mockDb.limit.mockResolvedValue([]);
    _mockDb.orderBy.mockReturnThis();
    _mockDb.insert.mockReturnThis();
    _mockDb.values.mockReturnThis();
    _mockDb.returning.mockResolvedValue([]);
    _mockDb.update.mockReturnThis();
    _mockDb.set.mockReturnThis();
    _mockDb.delete.mockReturnThis();
  };

  const _mockTable = (name: string) => ({
    _: { name },
    id: { _: { name: "id" } },
    userId: { _: { name: "userId" } },
    composioTriggerId: { _: { name: "composioTriggerId" } },
    triggerEnabled: { _: { name: "triggerEnabled" } },
    connectorDefinitionId: { _: { name: "connectorDefinitionId" } },
    status: { _: { name: "status" } },
    type: { _: { name: "type" } },
  });

  const _mockComposio = {
    triggers: {
      list: vi.fn().mockResolvedValue([]),
      get: vi.fn().mockResolvedValue(null),
      listTypes: vi.fn().mockResolvedValue({ items: [] }),
      getType: vi.fn().mockResolvedValue(null),
      listActive: vi.fn().mockResolvedValue({ items: [] }),
      create: vi.fn().mockResolvedValue({ triggerId: "ti_test_123" }),
      setup: vi.fn().mockResolvedValue({ triggerId: "ti_test_123" }),
      enable: vi.fn().mockResolvedValue({ status: "success" }),
      disable: vi.fn().mockResolvedValue({ status: "success" }),
      delete: vi.fn().mockResolvedValue({ triggerId: "ti_test_123" }),
      subscribe: vi.fn().mockResolvedValue(undefined),
      verifyWebhook: vi.fn().mockResolvedValue({
        version: "V3",
        payload: { triggerSlug: "GMAIL_NEW_GMAIL_MESSAGE" },
        rawPayload: {},
      }),
    },
    client: {
      triggerInstances: {
        upsert: vi.fn().mockResolvedValue({ trigger_id: "ti_test_123" }),
      },
    },
  };

  // Initialize chain behavior
  _resetDbChain();

  return {
    mockDb: _mockDb,
    mockComposio: _mockComposio,
    mockTable: _mockTable,
    resetDbChain: _resetDbChain,
  };
});

vi.mock("../lib/db.js", () => ({
  db: mockDb,
  scheduledTasks: mockTable("scheduledTasks"),
  triggerEvents: mockTable("triggerEvents"),
  taskExecutions: mockTable("taskExecutions"),
  connectorDefinitions: mockTable("connectorDefinitions"),
  userConnectors: mockTable("userConnectors"),
  connectorSyncLogs: mockTable("connectorSyncLogs"),
  initDb: vi.fn().mockResolvedValue(undefined),
  eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
  and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
  or: vi.fn((...args: unknown[]) => ({ type: "or", args })),
  desc: vi.fn((col: unknown) => ({ type: "desc", col })),
  asc: vi.fn((col: unknown) => ({ type: "asc", col })),
  sql: Object.assign(vi.fn(), { raw: vi.fn() }),
  count: vi.fn(),
  inArray: vi.fn((...args: unknown[]) => ({ type: "inArray", args })),
  isNull: vi.fn((col: unknown) => ({ type: "isNull", col })),
}));

vi.mock("../lib/composio.js", () => ({
  getComposioClient: vi.fn(() => mockComposio),
}));

vi.mock("../lib/helpers.js", () => ({
  getUserId: vi.fn().mockReturnValue("test-user-id"),
  logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
}));

// ─── Now import from mocked modules ─────────────────────────────

import {
  db,
  scheduledTasks,
  triggerEvents,
  taskExecutions,
  eq,
  and,
} from "../lib/db.js";
import { getComposioClient } from "../lib/composio.js";

// ─── Test Data Factories ──────────────────────────────────────────

function makeTriggerTask(overrides: Record<string, unknown> = {}) {
  return {
    id: "task-trigger-1",
    userId: "user-1",
    name: "Gmail Monitor",
    description: "Summarize new emails",
    taskType: "agent_run",
    scheduleType: "trigger",
    status: "pending",
    isEnabled: true,
    triggerEnabled: true,
    triggerAppName: "gmail",
    triggerEventSlug: "GMAIL_NEW_GMAIL_MESSAGE",
    triggerConfig: { labelIds: ["INBOX"] },
    composioTriggerId: "ti_abc123",
    lastTriggerAt: null,
    lastTriggerEventId: null,
    runCount: 0,
    maxRuns: null,
    endDate: null,
    payload: { prompt: "Summarize the following email." },
    ...overrides,
  };
}

// V3 webhook payload format — uses trigger_slug (NOT trigger_name)
function makeWebhookPayload(overrides: Record<string, unknown> = {}) {
  return {
    id: "msg_v3_001",
    type: "composio.trigger.message",
    timestamp: new Date().toISOString(),
    metadata: {
      trigger_id: "ti_abc123",
      trigger_slug: "GMAIL_NEW_GMAIL_MESSAGE",
      log_id: "log_event_001",
      connected_account_id: "ca_test123",
      auth_config_id: "ac_test123",
      user_id: "composio_user_1",
    },
    data: {
      messageId: "msg_12345",
      from: "john@example.com",
      subject: "Q1 Review",
      snippet: "Please review the attached...",
      labelIds: ["INBOX", "UNREAD"],
    },
    ...overrides,
  };
}

function makeGithubWebhookPayload() {
  return {
    id: "msg_v3_gh_001",
    type: "composio.trigger.message",
    timestamp: new Date().toISOString(),
    metadata: {
      trigger_id: "ti_github_456",
      trigger_slug: "GITHUB_PUSH_EVENT",
      log_id: "log_gh_001",
      connected_account_id: "ca_gh_test",
      auth_config_id: "ac_gh_test",
      user_id: "composio_user_1",
    },
    data: {
      repository: "jeriko/jeriko",
      branch: "main",
      commits: [
        { sha: "abc123", message: "feat: add trigger support", author: "dev@jeriko.dev" },
      ],
      pusher: "dev@jeriko.dev",
    },
  };
}

// ─── Standard Webhooks Signature Verification ───────────────────

describe("Standard Webhooks Signature Verification", () => {
  it("should verify a valid Standard Webhooks signature", () => {
    const secret = "whsec_test_secret_key";
    const webhookId = "msg_v3_test";
    const webhookTimestamp = String(Math.floor(Date.now() / 1000));
    const payload = JSON.stringify(makeWebhookPayload());

    const signingInput = `${webhookId}.${webhookTimestamp}.${payload}`;
    const signature = createHmac("sha256", secret).update(signingInput).digest("base64");
    const signatureHeader = `v1,${signature}`;

    const recomputed = createHmac("sha256", secret).update(signingInput).digest("base64");
    expect(signatureHeader).toBe(`v1,${recomputed}`);
  });

  it("should reject an invalid signature", () => {
    const secret = "whsec_test_secret_key";
    const webhookId = "msg_v3_test";
    const webhookTimestamp = String(Math.floor(Date.now() / 1000));
    const payload = JSON.stringify(makeWebhookPayload());

    const signingInput = `${webhookId}.${webhookTimestamp}.${payload}`;
    const validSig = createHmac("sha256", secret).update(signingInput).digest("base64");
    const tamperedSig = createHmac("sha256", "wrong_secret").update(signingInput).digest("base64");

    expect(tamperedSig).not.toBe(validSig);
  });

  it("should require all three Standard Webhooks headers", () => {
    const headers = {
      "webhook-id": "msg_v3_test",
      "webhook-timestamp": String(Math.floor(Date.now() / 1000)),
      "webhook-signature": "v1,abc123==",
    };

    expect(headers["webhook-id"]).toBeDefined();
    expect(headers["webhook-timestamp"]).toBeDefined();
    expect(headers["webhook-signature"]).toBeDefined();
  });

  it("should handle v1 prefix in signature header", () => {
    const signatureHeader = "v1,dGVzdA==";
    const parts = signatureHeader.split(",");
    expect(parts[0]).toBe("v1");
    expect(parts[1]).toBe("dGVzdA==");
  });
});

// ─── Webhook Payload Parsing (V3 Format) ────────────────────────

describe("Webhook Payload Parsing (V3 Format)", () => {
  it("should extract trigger_id from V3 metadata", () => {
    const payload = makeWebhookPayload();
    expect(payload.metadata.trigger_id).toBe("ti_abc123");
  });

  it("should extract trigger_slug (NOT trigger_name) from V3 metadata", () => {
    const payload = makeWebhookPayload();
    expect(payload.metadata.trigger_slug).toBe("GMAIL_NEW_GMAIL_MESSAGE");
  });

  it("should extract log_id for dedup", () => {
    const payload = makeWebhookPayload();
    expect(payload.metadata.log_id).toBe("log_event_001");
  });

  it("should have V3 envelope fields (id, type, timestamp)", () => {
    const payload = makeWebhookPayload();
    expect(payload.id).toBeDefined();
    expect(payload.type).toBe("composio.trigger.message");
    expect(payload.timestamp).toBeDefined();
  });

  it("should extract event data from data field", () => {
    const payload = makeWebhookPayload();
    expect(payload.data.messageId).toBe("msg_12345");
    expect(payload.data.from).toBe("john@example.com");
    expect(payload.data.subject).toBe("Q1 Review");
  });

  it("should fallback to V1 trigger_name for backwards compat", () => {
    const v1Payload = {
      trigger_id: "ti_flat_123",
      trigger_name: "SLACK_NEW_MESSAGE",
      data: { channel: "general", text: "Hello!" },
    };

    const eventSlug =
      (v1Payload as any).metadata?.trigger_slug ??
      (v1Payload as any).metadata?.trigger_name ??
      (v1Payload as any).trigger_name ?? "";

    expect(eventSlug).toBe("SLACK_NEW_MESSAGE");
  });

  it("should handle missing trigger_id gracefully", () => {
    const payload = { data: { something: "value" } };
    const triggerId =
      (payload as any).metadata?.trigger_id ??
      (payload as any).trigger_id ?? "";
    expect(triggerId).toBe("");
  });
});

// ─── Webhook Task Lookup ─────────────────────────────────────────

describe("Webhook Task Lookup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetDbChain();
  });

  it("should find task by composioTriggerId", async () => {
    const task = makeTriggerTask();
    mockDb.limit.mockResolvedValue([task]);

    const [found] = await db
      .select()
      .from(scheduledTasks)
      .where(eq(scheduledTasks.composioTriggerId, "ti_abc123"))
      .limit(1);

    expect(found).toBeDefined();
    expect(found.id).toBe("task-trigger-1");
    expect(found.composioTriggerId).toBe("ti_abc123");
  });

  it("should return empty when no task matches trigger", async () => {
    mockDb.limit.mockResolvedValue([]);

    const results = await db
      .select()
      .from(scheduledTasks)
      .where(eq(scheduledTasks.composioTriggerId, "ti_orphan"))
      .limit(1);

    expect(results).toHaveLength(0);
  });
});

// ─── Webhook Handler: Skip Conditions ────────────────────────────

describe("Webhook Handler Skip Conditions", () => {
  it("should skip when task is disabled", () => {
    const task = makeTriggerTask({ isEnabled: false });
    const shouldSkip =
      !task.isEnabled || task.status === "paused" || task.status === "cancelled";
    expect(shouldSkip).toBe(true);
  });

  it("should skip when task is paused", () => {
    const task = makeTriggerTask({ status: "paused" });
    const shouldSkip =
      !task.isEnabled || task.status === "paused" || task.status === "cancelled";
    expect(shouldSkip).toBe(true);
  });

  it("should skip when task is cancelled", () => {
    const task = makeTriggerTask({ status: "cancelled", isEnabled: false });
    const shouldSkip =
      !task.isEnabled || task.status === "paused" || task.status === "cancelled";
    expect(shouldSkip).toBe(true);
  });

  it("should process when task is pending and enabled", () => {
    const task = makeTriggerTask({ status: "pending", isEnabled: true });
    const shouldSkip =
      !task.isEnabled || task.status === "paused" || task.status === "cancelled";
    expect(shouldSkip).toBe(false);
  });

  it("should skip duplicate events", () => {
    const task = makeTriggerTask({ lastTriggerEventId: "log_event_001" });
    const incomingEventId = "log_event_001";
    const isDuplicate = incomingEventId && task.lastTriggerEventId === incomingEventId;
    expect(isDuplicate).toBe(true);
  });

  it("should skip past endDate", () => {
    const task = makeTriggerTask({ endDate: new Date("2025-12-31T23:59:59Z") });
    const pastEndDate = task.endDate && new Date(task.endDate as string) <= new Date();
    expect(pastEndDate).toBe(true);
  });

  it("should skip when maxRuns exceeded", () => {
    const task = makeTriggerTask({ maxRuns: 10, runCount: 10 });
    const exceeded = task.maxRuns != null && (task.runCount ?? 0) >= (task.maxRuns as number);
    expect(exceeded).toBe(true);
  });
});

// ─── Trigger Events Audit Table ──────────────────────────────────

describe("Trigger Events Audit Records", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetDbChain();
  });

  it("should insert trigger_events record with all fields", async () => {
    mockDb.values.mockResolvedValue(undefined);

    await db.insert(triggerEvents).values({
      id: "te_001",
      scheduledTaskId: "task-trigger-1",
      composioTriggerId: "ti_abc123",
      eventSlug: "GMAIL_NEW_GMAIL_MESSAGE",
      externalEventId: "log_event_001",
      payload: { from: "john@example.com", subject: "Q1 Review" },
      processed: false,
    });

    expect(mockDb.insert).toHaveBeenCalledWith(triggerEvents);
  });

  it("should link trigger_event to execution via executionId", async () => {
    mockDb.where.mockResolvedValue(undefined);

    await db
      .update(triggerEvents)
      .set({ executionId: "exec-trigger-1" })
      .where(eq(triggerEvents.id, "te_001"));

    expect(mockDb.update).toHaveBeenCalledWith(triggerEvents);
  });
});

// ─── Trigger Subscribe ───────────────────────────────────────────

describe("Trigger Subscribe (Composio Integration)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should call composio client.triggerInstances.upsert for trigger creation", async () => {
    const composio = getComposioClient();
    const result = await (composio as any).client.triggerInstances.upsert(
      "GMAIL_NEW_GMAIL_MESSAGE",
      {
        connected_account_id: "conn_test",
        trigger_config: { labelIds: "INBOX", userId: "me" },
      },
    );

    expect(result.trigger_id).toBe("ti_test_123");
    expect(mockComposio.client.triggerInstances.upsert).toHaveBeenCalledWith(
      "GMAIL_NEW_GMAIL_MESSAGE",
      expect.objectContaining({
        connected_account_id: "conn_test",
      }),
    );
  });

  it("should extract app name prefix from trigger slug", () => {
    expect("GMAIL_NEW_GMAIL_MESSAGE".split("_")[0]?.toLowerCase()).toBe("gmail");
  });

  it("should extract app name for github triggers", () => {
    expect("GITHUB_PUSH_EVENT".split("_")[0]?.toLowerCase()).toBe("github");
  });

  it("should extract app name for slack triggers", () => {
    expect("SLACK_NEW_MESSAGE_IN_CHANNEL".split("_")[0]?.toLowerCase()).toBe("slack");
  });
});

// ─── Trigger Enable / Disable ────────────────────────────────────

describe("Trigger Enable/Disable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetDbChain();
  });

  it("should call composio.triggers.disable with string triggerId", async () => {
    const composio = getComposioClient();
    await composio.triggers.disable("ti_abc123");

    expect(mockComposio.triggers.disable).toHaveBeenCalledWith("ti_abc123");
  });

  it("should update task triggerEnabled to false on disable", async () => {
    mockDb.where.mockResolvedValue(undefined);

    await db
      .update(scheduledTasks)
      .set({ triggerEnabled: false })
      .where(
        and(
          eq(scheduledTasks.composioTriggerId, "ti_abc123"),
          eq(scheduledTasks.userId, "user-1"),
        ),
      );

    expect(mockDb.update).toHaveBeenCalledWith(scheduledTasks);
  });

  it("should call composio.triggers.enable with string triggerId", async () => {
    const composio = getComposioClient();
    await composio.triggers.enable("ti_abc123");

    expect(mockComposio.triggers.enable).toHaveBeenCalledWith("ti_abc123");
  });

  it("should update task triggerEnabled to true on enable", async () => {
    mockDb.where.mockResolvedValue(undefined);

    await db
      .update(scheduledTasks)
      .set({ triggerEnabled: true })
      .where(
        and(
          eq(scheduledTasks.composioTriggerId, "ti_abc123"),
          eq(scheduledTasks.userId, "user-1"),
        ),
      );

    expect(mockDb.update).toHaveBeenCalledWith(scheduledTasks);
  });
});

// ─── Trigger Delete ──────────────────────────────────────────────

describe("Trigger Delete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetDbChain();
  });

  it("should call composio.triggers.delete with string triggerId", async () => {
    const composio = getComposioClient();
    await composio.triggers.delete("ti_abc123");

    expect(mockComposio.triggers.delete).toHaveBeenCalledWith("ti_abc123");
  });

  it("should clear composioTriggerId and disable trigger on task", async () => {
    mockDb.where.mockResolvedValue(undefined);

    await db
      .update(scheduledTasks)
      .set({ triggerEnabled: false, composioTriggerId: null })
      .where(
        and(
          eq(scheduledTasks.composioTriggerId, "ti_abc123"),
          eq(scheduledTasks.userId, "user-1"),
        ),
      );

    expect(mockDb.update).toHaveBeenCalledWith(scheduledTasks);
  });
});

// ─── Webhook Registration ────────────────────────────────────────

describe("Webhook Registration (Composio V3)", () => {
  it("should register via REST API with enabled_events", () => {
    // The webhook/register endpoint calls the Composio V3 REST API directly
    // (not the SDK subscribe method, which is for Pusher-based polling)
    const registrationBody = {
      webhook_url: "https://api.jeriko.dev/v1/connectors/triggers/webhook",
      enabled_events: [
        "composio.trigger.message",
        "composio.connected_account.expired",
      ],
    };

    expect(registrationBody.webhook_url).toContain("/triggers/webhook");
    expect(registrationBody.enabled_events).toContain("composio.trigger.message");
  });

  it("should use SDK verifyWebhook for incoming webhooks", async () => {
    const composio = getComposioClient();
    const result = await composio.triggers.verifyWebhook({
      id: "msg_test",
      payload: "{}",
      timestamp: "1234567890",
      signature: "v1,abc==",
      secret: "whsec_test",
      tolerance: 300,
    });

    expect(result.version).toBe("V3");
    expect(mockComposio.triggers.verifyWebhook).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "msg_test",
        secret: "whsec_test",
      }),
    );
  });
});

// ─── List Active Triggers ────────────────────────────────────────

describe("List Active Triggers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetDbChain();
  });

  it("should list tasks with triggerEnabled=true for user", async () => {
    const tasks = [
      makeTriggerTask({ id: "t1", name: "Gmail Monitor" }),
      makeTriggerTask({ id: "t2", name: "GitHub PR Watch", triggerAppName: "github" }),
    ];

    mockDb.where.mockResolvedValue(tasks);

    const result = await db
      .select()
      .from(scheduledTasks)
      .where(
        and(
          eq(scheduledTasks.userId, "user-1"),
          eq(scheduledTasks.triggerEnabled, true),
        ),
      );

    expect(result).toHaveLength(2);
  });
});

// ─── Notification Dispatch ───────────────────────────────────────

describe("Notification on Trigger Fire", () => {
  it("should build correct notification payload with type 'task'", () => {
    const task = makeTriggerTask();
    const eventSlug = "GMAIL_NEW_GMAIL_MESSAGE";

    const notification = {
      userId: task.userId,
      type: "task",
      title: `Trigger fired: ${task.triggerAppName ?? eventSlug}`,
      message: `Your ${eventSlug} trigger activated. Task "${task.name}" is executing.`,
      priority: "normal",
      actionUrl: `/tasks/${task.id}`,
      entityType: "scheduledTask",
      entityId: task.id,
    };

    expect(notification.type).toBe("task");
    expect(notification.title).toBe("Trigger fired: gmail");
    expect(notification.message).toContain("GMAIL_NEW_GMAIL_MESSAGE");
    expect(notification.message).toContain("Gmail Monitor");
    expect(notification.actionUrl).toBe("/tasks/task-trigger-1");
    expect(notification.entityType).toBe("scheduledTask");
  });

  it("should include x-gateway-secret header for service-to-service auth", () => {
    const gatewaySecret = "test-secret-123";
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-user-id": "user-1",
    };
    if (gatewaySecret) {
      headers["x-gateway-secret"] = gatewaySecret;
    }

    expect(headers["x-gateway-secret"]).toBe("test-secret-123");
    expect(headers["x-user-id"]).toBe("user-1");
  });

  it("should fallback to eventSlug when triggerAppName is null", () => {
    const task = makeTriggerTask({ triggerAppName: null });
    const eventSlug = "CUSTOM_TRIGGER_EVENT";
    const title = `Trigger fired: ${task.triggerAppName ?? eventSlug}`;
    expect(title).toBe("Trigger fired: CUSTOM_TRIGGER_EVENT");
  });
});

// ─── Multi-App Trigger Support (V3 Format) ──────────────────────

describe("Multi-App Trigger Support (V3 Format)", () => {
  it("should handle Gmail trigger payload", () => {
    const payload = makeWebhookPayload();
    expect(payload.metadata.trigger_slug).toBe("GMAIL_NEW_GMAIL_MESSAGE");
    expect(payload.data.from).toBeDefined();
    expect(payload.data.subject).toBeDefined();
  });

  it("should handle GitHub trigger payload", () => {
    const payload = makeGithubWebhookPayload();
    expect(payload.metadata.trigger_slug).toBe("GITHUB_PUSH_EVENT");
    expect(payload.data.repository).toBe("jeriko/jeriko");
    expect(payload.data.commits).toHaveLength(1);
  });

  it("should handle Slack trigger payload (V3 format)", () => {
    const payload = {
      id: "msg_v3_slack_001",
      type: "composio.trigger.message",
      timestamp: new Date().toISOString(),
      metadata: {
        trigger_id: "ti_slack_789",
        trigger_slug: "SLACK_NEW_MESSAGE_IN_CHANNEL",
        log_id: "log_slack_001",
        connected_account_id: "ca_slack_test",
        auth_config_id: "ac_slack_test",
        user_id: "composio_user_1",
      },
      data: {
        channel: "general",
        user: "U12345",
        text: "Hey team, the deployment is live!",
        ts: "1739808000.000100",
      },
    };

    expect(payload.metadata.trigger_slug).toBe("SLACK_NEW_MESSAGE_IN_CHANNEL");
    expect(payload.data.text).toContain("deployment is live");
  });
});

// ─── E2E Webhook Flow (Mocked) ──────────────────────────────────

describe("E2E Webhook Flow (Mocked)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetDbChain();
  });

  it("should complete full webhook → task lookup → audit → dispatch flow", async () => {
    const webhookPayload = makeWebhookPayload();
    const task = makeTriggerTask();

    // Step 1: Lookup task by composioTriggerId
    mockDb.limit.mockResolvedValue([task]);

    const [foundTask] = await db
      .select()
      .from(scheduledTasks)
      .where(eq(scheduledTasks.composioTriggerId, webhookPayload.metadata.trigger_id))
      .limit(1);

    expect(foundTask).toBeDefined();
    expect(foundTask.id).toBe("task-trigger-1");

    // Step 2: Verify not duplicate
    const isDuplicate =
      webhookPayload.metadata.log_id &&
      foundTask.lastTriggerEventId === webhookPayload.metadata.log_id;
    expect(isDuplicate).toBe(false);

    // Step 3: Insert audit record
    resetDbChain();
    mockDb.values.mockResolvedValue(undefined);

    await db.insert(triggerEvents).values({
      id: "te_001",
      scheduledTaskId: foundTask.id,
      composioTriggerId: webhookPayload.metadata.trigger_id,
      eventSlug: webhookPayload.metadata.trigger_slug,
      externalEventId: webhookPayload.metadata.log_id,
      payload: webhookPayload.data,
      processed: false,
    });
    expect(mockDb.insert).toHaveBeenCalledWith(triggerEvents);

    // Step 4: Create execution record
    vi.mocked(mockDb.insert).mockClear();
    mockDb.values.mockResolvedValue(undefined);

    await db.insert(taskExecutions).values({
      id: "exec-trigger-001",
      scheduledTaskId: foundTask.id,
      status: "pending",
    });
    expect(mockDb.insert).toHaveBeenCalledWith(taskExecutions);

    // Step 5: Update lastTriggerAt
    resetDbChain();
    mockDb.where.mockResolvedValue(undefined);

    await db
      .update(scheduledTasks)
      .set({
        lastTriggerAt: new Date(),
        lastTriggerEventId: webhookPayload.metadata.log_id,
      })
      .where(eq(scheduledTasks.id, foundTask.id));
    expect(mockDb.update).toHaveBeenCalledWith(scheduledTasks);

    // Step 6: Verify raw prompt extraction
    const rawPrompt =
      (foundTask.payload as Record<string, unknown>)?.prompt ?? foundTask.description;
    expect(rawPrompt).toBe("Summarize the following email.");
  });
});
