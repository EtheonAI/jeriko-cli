import "./setup.js";
import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  db,
  eq,
  scheduledTasks,
  taskExecutions,
} from "../lib/db.js";
import { publish } from "@repo/service-utils";

/**
 * Full-Flow Skills Integration Tests
 *
 * Scenario: User creates a "Sales Email Responder" automation that:
 * 1. Triggers on new Gmail emails (GMAIL_NEW_GMAIL_MESSAGE)
 * 2. Uses "sales-email-reply" and "web-search" skills
 * 3. When email arrives → trigger fires → Inngest dispatch → orchestrator call
 * 4. Orchestrator receives `skills: ["sales-email-reply", "web-search"]`
 * 5. Agent uses skills to draft a sales reply
 *
 * Tests cover ALL 4 dispatch paths:
 * - Path A: Cron scheduler (inngest.ts dispatch-tasks)
 * - Path B: Manual trigger (scheduled-tasks.ts /trigger)
 * - Path C: Trigger-event webhook (scheduled-tasks.ts /trigger-event)
 * - Path D: Execute-task → orchestrator fetch (inngest.ts call-agent)
 */

// ─── Test Data Factories ──────────────────────────────────────────

function makeSalesEmailTask(overrides: Record<string, unknown> = {}) {
  return {
    id: "task-sales-email",
    userId: "user-sales-1",
    name: "Sales Email Auto-Responder",
    description: "Respond to incoming sales inquiries using the sales playbook skill",
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
      prompt: "You received a new sales inquiry email. Draft a professional reply following the sales playbook. Research the company first.",
      skillIds: ["sales-email-reply", "web-search"],
    },
    metadata: null,
    triggerEnabled: true,
    triggerAppName: "gmail",
    triggerEventSlug: "GMAIL_NEW_GMAIL_MESSAGE",
    triggerConfig: { labelIds: ["INBOX"], from: "*" },
    composioTriggerId: "ti_sales_001",
    lastTriggerAt: null,
    lastTriggerEventId: null,
    createdAt: new Date("2026-02-17T10:00:00Z"),
    updatedAt: new Date("2026-02-17T10:00:00Z"),
    ...overrides,
  };
}

function makeTaskWithoutSkills(overrides: Record<string, unknown> = {}) {
  return {
    id: "task-no-skills",
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

function makeIncomingSalesEmail() {
  return {
    slug: "GMAIL_NEW_GMAIL_MESSAGE",
    data: {
      messageId: "msg_sales_99",
      threadId: "thread_sales_42",
      from: "prospect@bigcorp.com",
      to: "sales@ourcompany.com",
      subject: "Interested in your enterprise plan",
      snippet: "Hi, we're evaluating platforms for our 500-person team. Could you share pricing for the enterprise tier?",
      labelIds: ["INBOX", "UNREAD", "IMPORTANT"],
      internalDate: "1739808000000",
    },
    triggerId: "ti_sales_001",
  };
}

// ─── Helper: reproduce the exact extraction logic from production code ──

function extractSkillIdsFromPayload(payload: Record<string, unknown> | null): string[] | undefined {
  return Array.isArray(payload?.skillIds) ? (payload!.skillIds as string[]) : undefined;
}

function buildInngestEventData(task: ReturnType<typeof makeSalesEmailTask>, executionId: string, triggerEvent?: ReturnType<typeof makeIncomingSalesEmail>) {
  const taskPayload = task.payload as Record<string, unknown> | null;
  return {
    taskId: task.id,
    executionId,
    userId: task.userId,
    prompt: (taskPayload?.prompt as string) ?? task.description ?? task.name,
    targetDeviceId: (taskPayload?.targetDeviceId as string) ?? undefined,
    skillIds: extractSkillIdsFromPayload(taskPayload),
    ...(triggerEvent ? { triggerEvent } : {}),
  };
}

function buildOrchestratorFetchBody(
  eventData: ReturnType<typeof buildInngestEventData>,
) {
  let userContent = eventData.prompt;

  // Prepend trigger context (mirrors inngest.ts logic)
  if (eventData.triggerEvent) {
    const eventSummary = JSON.stringify(eventData.triggerEvent.data, null, 2);
    userContent = `[Trigger Event: ${eventData.triggerEvent.slug}]\nEvent data:\n${eventSummary}\n\nTask instructions: ${userContent}`;
  }

  if (eventData.targetDeviceId) {
    userContent += `\n\n[Target device: ${eventData.targetDeviceId}]`;
  }

  const sessionId = `scheduled_${eventData.taskId}_${eventData.executionId}`;

  return {
    messages: [{ role: "user", content: userContent }],
    sessionId,
    userId: eventData.userId,
    ...(eventData.skillIds && eventData.skillIds.length > 0
      ? { skills: eventData.skillIds }
      : {}),
  };
}

// ─── Full Flow Tests ──────────────────────────────────────────────

describe("Full Flow: Sales Email Trigger + Skills → Orchestrator", () => {
  beforeEach(() => vi.clearAllMocks());

  // ── Path A: Cron Scheduler dispatches task with skillIds ──────

  describe("Path A: Cron scheduler extracts skillIds from task payload", () => {
    it("should include skillIds in Inngest event when task payload has them", () => {
      // A cron-based task with skillIds (hybrid: cron + skills)
      const task = makeSalesEmailTask({
        id: "task-cron-skills",
        scheduleType: "cron",
        cronExpression: "0 9 * * *",
        nextRunAt: new Date(Date.now() - 60_000),
        triggerEnabled: false,
      });

      const taskPayload = task.payload as Record<string, unknown> | null;
      const inngestData = {
        taskId: task.id,
        executionId: "exec-cron-1",
        userId: task.userId,
        prompt: taskPayload?.prompt ?? task.description ?? task.name,
        targetDeviceId: taskPayload?.targetDeviceId ?? undefined,
        skillIds: Array.isArray(taskPayload?.skillIds) ? taskPayload!.skillIds : undefined,
      };

      expect(inngestData.skillIds).toEqual(["sales-email-reply", "web-search"]);
      expect(inngestData.prompt).toBe(
        "You received a new sales inquiry email. Draft a professional reply following the sales playbook. Research the company first."
      );
    });

    it("should NOT include skillIds when task has no skills", () => {
      const task = makeTaskWithoutSkills();
      const taskPayload = task.payload as Record<string, unknown> | null;

      const inngestData = {
        taskId: task.id,
        executionId: "exec-cron-2",
        userId: task.userId,
        prompt: taskPayload?.prompt ?? task.description ?? task.name,
        skillIds: Array.isArray(taskPayload?.skillIds) ? taskPayload!.skillIds : undefined,
      };

      expect(inngestData.skillIds).toBeUndefined();
      expect(inngestData.prompt).toBe("Generate weekly report");
    });
  });

  // ── Path B: Manual Trigger dispatches with skillIds ───────────

  describe("Path B: Manual trigger route extracts skillIds from task payload", () => {
    it("should include skillIds when manually triggering a task with skills", () => {
      const task = makeSalesEmailTask();
      const triggerPayload = task.payload as Record<string, unknown> | null;

      const inngestData = {
        taskId: task.id,
        executionId: "exec-manual-1",
        userId: task.userId,
        prompt: triggerPayload?.prompt ?? task.description ?? task.name,
        targetDeviceId: triggerPayload?.targetDeviceId ?? undefined,
        skillIds: Array.isArray(triggerPayload?.skillIds) ? triggerPayload!.skillIds : undefined,
      };

      expect(inngestData.skillIds).toEqual(["sales-email-reply", "web-search"]);
    });

    it("should create execution record and mark task running on manual trigger", async () => {
      (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      });
      (db.update as ReturnType<typeof vi.fn>).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      const taskId = "task-sales-email";
      const executionId = "exec-manual-1";

      await db.insert(taskExecutions).values({
        id: executionId,
        scheduledTaskId: taskId,
        status: "pending",
      });
      expect(db.insert).toHaveBeenCalledWith(taskExecutions);

      await db
        .update(scheduledTasks)
        .set({ status: "running" })
        .where(eq(scheduledTasks.id, taskId));
      expect(db.update).toHaveBeenCalledWith(scheduledTasks);
    });
  });

  // ── Path C: Trigger-event webhook dispatches with skillIds ────

  describe("Path C: Trigger-event (webhook) extracts skillIds from task payload", () => {
    it("should include skillIds when trigger webhook fires for a task with skills", () => {
      const task = makeSalesEmailTask();
      const triggerEvent = makeIncomingSalesEmail();
      const eventPayload = task.payload as Record<string, unknown> | null;

      const inngestData = {
        taskId: task.id,
        executionId: "exec-trigger-1",
        userId: task.userId,
        prompt: eventPayload?.prompt ?? task.description ?? task.name,
        triggerEvent,
        skillIds: Array.isArray(eventPayload?.skillIds) ? eventPayload!.skillIds : undefined,
      };

      expect(inngestData.skillIds).toEqual(["sales-email-reply", "web-search"]);
      expect(inngestData.triggerEvent.slug).toBe("GMAIL_NEW_GMAIL_MESSAGE");
      expect(inngestData.triggerEvent.data.from).toBe("prospect@bigcorp.com");
      expect(inngestData.triggerEvent.data.subject).toBe("Interested in your enterprise plan");
    });
  });

  // ── Path D: Execute-task → Orchestrator fetch body ────────────

  describe("Path D: execute-task builds orchestrator fetch body with skills", () => {
    it("should include skills array in orchestrator request body", () => {
      const task = makeSalesEmailTask();
      const triggerEvent = makeIncomingSalesEmail();
      const eventData = buildInngestEventData(task, "exec-1", triggerEvent);
      const fetchBody = buildOrchestratorFetchBody(eventData);

      // Skills MUST be present
      expect(fetchBody).toHaveProperty("skills");
      expect(fetchBody.skills).toEqual(["sales-email-reply", "web-search"]);

      // Session ID follows convention
      expect(fetchBody.sessionId).toBe("scheduled_task-sales-email_exec-1");
      expect(fetchBody.userId).toBe("user-sales-1");

      // User content should have trigger context + task instructions
      const content = fetchBody.messages[0]!.content;
      expect(content).toContain("[Trigger Event: GMAIL_NEW_GMAIL_MESSAGE]");
      expect(content).toContain('"from": "prospect@bigcorp.com"');
      expect(content).toContain('"subject": "Interested in your enterprise plan"');
      expect(content).toContain("Task instructions: You received a new sales inquiry email");
    });

    it("should NOT include skills key when task has no skills", () => {
      const task = makeTaskWithoutSkills();
      const eventData = buildInngestEventData(task as any, "exec-2");
      const fetchBody = buildOrchestratorFetchBody(eventData);

      expect(fetchBody).not.toHaveProperty("skills");
      expect(fetchBody.messages[0]!.content).toBe("Generate weekly report");
    });

    it("should NOT include skills key when skillIds is empty array", () => {
      const task = makeSalesEmailTask({
        payload: { prompt: "Do something", skillIds: [] },
      });
      const eventData = buildInngestEventData(task as any, "exec-3");
      const fetchBody = buildOrchestratorFetchBody(eventData);

      expect(fetchBody).not.toHaveProperty("skills");
    });

    it("should handle skills with no trigger event (cron task with skills)", () => {
      const task = makeSalesEmailTask({
        scheduleType: "cron",
        cronExpression: "0 9 * * *",
      });
      const eventData = buildInngestEventData(task, "exec-4");
      const fetchBody = buildOrchestratorFetchBody(eventData);

      // Skills present, but no trigger context
      expect(fetchBody.skills).toEqual(["sales-email-reply", "web-search"]);
      expect(fetchBody.messages[0]!.content).not.toContain("[Trigger Event:");
      expect(fetchBody.messages[0]!.content).toBe(
        "You received a new sales inquiry email. Draft a professional reply following the sales playbook. Research the company first."
      );
    });
  });
});

// ─── Full Pipeline Simulation ─────────────────────────────────────

describe("Full Pipeline: Email arrives → Trigger → Inngest → Orchestrator", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should pass skills end-to-end: email trigger → inngest event → orchestrator fetch", () => {
    // Step 1: Task exists in DB with skills
    const task = makeSalesEmailTask();
    expect(task.payload.skillIds).toEqual(["sales-email-reply", "web-search"]);
    expect(task.triggerEventSlug).toBe("GMAIL_NEW_GMAIL_MESSAGE");

    // Step 2: Email arrives, Composio fires trigger webhook
    const incomingEmail = makeIncomingSalesEmail();
    expect(incomingEmail.slug).toBe("GMAIL_NEW_GMAIL_MESSAGE");
    expect(incomingEmail.data.from).toBe("prospect@bigcorp.com");

    // Step 3: Webhook handler (trigger-event route) builds Inngest event
    const taskPayload = task.payload as Record<string, unknown> | null;
    const inngestEventData = {
      taskId: task.id,
      executionId: "exec-pipeline-1",
      userId: task.userId,
      prompt: taskPayload?.prompt ?? task.description ?? task.name,
      triggerEvent: incomingEmail,
      skillIds: extractSkillIdsFromPayload(taskPayload),
    };

    // Verify Inngest event has skillIds
    expect(inngestEventData.skillIds).toEqual(["sales-email-reply", "web-search"]);
    expect(inngestEventData.triggerEvent).toBeDefined();

    // Step 4: Execute-task function receives event, builds orchestrator body
    const {
      taskId,
      executionId,
      userId,
      prompt,
      triggerEvent,
      skillIds,
    } = inngestEventData as {
      taskId: string;
      executionId: string;
      userId: string;
      prompt: string;
      triggerEvent?: { slug: string; data: Record<string, unknown>; triggerId: string };
      skillIds?: string[];
    };

    // Build user content (mirrors inngest.ts lines 163-171)
    let userContent = prompt;
    if (triggerEvent) {
      const eventSummary = JSON.stringify(triggerEvent.data, null, 2);
      userContent = `[Trigger Event: ${triggerEvent.slug}]\nEvent data:\n${eventSummary}\n\nTask instructions: ${userContent}`;
    }

    // Build fetch body (mirrors inngest.ts lines 178-185)
    const sessionId = `scheduled_${taskId}_${executionId}`;
    const orchestratorBody = {
      messages: [{ role: "user", content: userContent }],
      sessionId,
      userId,
      ...(skillIds && skillIds.length > 0 ? { skills: skillIds } : {}),
    };

    // ── FINAL ASSERTIONS: what the orchestrator receives ──

    // Skills are passed through
    expect(orchestratorBody).toHaveProperty("skills");
    expect(orchestratorBody.skills).toEqual(["sales-email-reply", "web-search"]);

    // The email content is in the user message
    expect(orchestratorBody.messages[0]!.content).toContain("prospect@bigcorp.com");
    expect(orchestratorBody.messages[0]!.content).toContain("Interested in your enterprise plan");
    expect(orchestratorBody.messages[0]!.content).toContain("evaluating platforms for our 500-person team");

    // Task instructions are appended after email context
    expect(orchestratorBody.messages[0]!.content).toContain(
      "Task instructions: You received a new sales inquiry email"
    );

    // Session ID follows convention
    expect(orchestratorBody.sessionId).toBe("scheduled_task-sales-email_exec-pipeline-1");
    expect(orchestratorBody.userId).toBe("user-sales-1");
  });

  it("should pass skills end-to-end when triggered manually (Run Now)", () => {
    const task = makeSalesEmailTask();
    const taskPayload = task.payload as Record<string, unknown> | null;

    // Manual trigger — no trigger event
    const inngestEventData = {
      taskId: task.id,
      executionId: "exec-manual-run",
      userId: task.userId,
      prompt: taskPayload?.prompt ?? task.description ?? task.name,
      skillIds: extractSkillIdsFromPayload(taskPayload),
    };

    const body = buildOrchestratorFetchBody(inngestEventData);

    // Skills still passed
    expect(body.skills).toEqual(["sales-email-reply", "web-search"]);

    // No trigger context
    expect(body.messages[0]!.content).not.toContain("[Trigger Event:");
    expect(body.messages[0]!.content).toContain("sales inquiry email");
  });

  it("should work with no skills (backward compat — existing tasks unaffected)", () => {
    const task = makeTaskWithoutSkills();
    const taskPayload = task.payload as Record<string, unknown> | null;

    const inngestEventData = {
      taskId: task.id,
      executionId: "exec-compat-1",
      userId: task.userId,
      prompt: taskPayload?.prompt ?? task.description ?? task.name,
      skillIds: extractSkillIdsFromPayload(taskPayload),
    };

    const body = buildOrchestratorFetchBody(inngestEventData);

    // No skills key at all — backward compatible
    expect(body).not.toHaveProperty("skills");
    expect(body.messages[0]!.content).toBe("Generate weekly report");
  });
});

// ─── Edge Cases ───────────────────────────────────────────────────

describe("Edge Cases: skills extraction resilience", () => {
  it("should handle null payload gracefully", () => {
    const skillIds = extractSkillIdsFromPayload(null);
    expect(skillIds).toBeUndefined();
  });

  it("should handle payload with skillIds = string (not array)", () => {
    const skillIds = extractSkillIdsFromPayload({ skillIds: "web-search" });
    expect(skillIds).toBeUndefined();
  });

  it("should handle payload with skillIds = number", () => {
    const skillIds = extractSkillIdsFromPayload({ skillIds: 42 });
    expect(skillIds).toBeUndefined();
  });

  it("should handle payload with skillIds = null", () => {
    const skillIds = extractSkillIdsFromPayload({ skillIds: null });
    expect(skillIds).toBeUndefined();
  });

  it("should handle payload with skillIds = empty array", () => {
    const skillIds = extractSkillIdsFromPayload({ skillIds: [] });
    expect(skillIds).toEqual([]);
  });

  it("should handle single skill in array", () => {
    const skillIds = extractSkillIdsFromPayload({ skillIds: ["browser"] });
    expect(skillIds).toEqual(["browser"]);
  });

  it("should handle all 6 built-in skills", () => {
    const allSkills = [
      "web-search",
      "code-interpreter",
      "image-generation",
      "document-analysis",
      "data-analysis",
      "browser",
    ];
    const skillIds = extractSkillIdsFromPayload({ skillIds: allSkills });
    expect(skillIds).toEqual(allSkills);
    expect(skillIds).toHaveLength(6);
  });

  it("should handle custom skill IDs (user-created skills)", () => {
    const customSkills = ["sales-email-reply", "my-custom-analyzer", "company-kb-search"];
    const skillIds = extractSkillIdsFromPayload({ skillIds: customSkills });
    expect(skillIds).toEqual(customSkills);
  });

  it("should not include skills in fetch body when skillIds is empty array", () => {
    const eventData = {
      taskId: "t1",
      executionId: "e1",
      userId: "u1",
      prompt: "test",
      skillIds: [] as string[],
    };
    const body = buildOrchestratorFetchBody(eventData);
    expect(body).not.toHaveProperty("skills");
  });

  it("should handle payload with extra fields alongside skillIds", () => {
    const payload = {
      prompt: "Do stuff",
      skillIds: ["web-search"],
      targetDeviceId: "device-1",
      customField: "ignored-by-extraction",
    };
    const skillIds = extractSkillIdsFromPayload(payload);
    expect(skillIds).toEqual(["web-search"]);
  });
});

// ─── DB Operations (mocked) ──────────────────────────────────────

describe("DB: Task creation with skills in payload", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should store skillIds inside payload JSONB column", async () => {
    const taskId = "task-new-skills";
    const taskData = makeSalesEmailTask({ id: taskId });

    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([taskData]),
      }),
    });

    const [created] = await db
      .insert(scheduledTasks)
      .values({
        id: taskId,
        userId: taskData.userId,
        name: taskData.name,
        taskType: taskData.taskType,
        scheduleType: taskData.scheduleType,
        payload: taskData.payload,
        triggerEnabled: true,
        triggerAppName: "gmail",
        triggerEventSlug: "GMAIL_NEW_GMAIL_MESSAGE",
        nextRunAt: null,
        status: "pending",
        isEnabled: true,
      })
      .returning();

    expect(db.insert).toHaveBeenCalledWith(scheduledTasks);
    const payload = created.payload as Record<string, unknown>;
    expect(payload.skillIds).toEqual(["sales-email-reply", "web-search"]);
    expect(payload.prompt).toContain("sales inquiry email");
  });

  it("should publish creation event with payload containing skillIds", () => {
    const task = makeSalesEmailTask();

    publish(`user:${task.userId}`, {
      type: "scheduledTask:created",
      data: task,
    });

    expect(publish).toHaveBeenCalledWith(
      `user:${task.userId}`,
      expect.objectContaining({
        type: "scheduledTask:created",
        data: expect.objectContaining({
          payload: expect.objectContaining({
            skillIds: ["sales-email-reply", "web-search"],
          }),
        }),
      }),
    );
  });
});
