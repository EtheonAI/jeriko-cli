import { describe, expect, it } from "vitest";

import {
  flowEventContextPacketSchema,
  flowRunReflectionPacketSchema,
  flowTaskReportSchema,
} from "../src/events/index.js";
import { flowAstSchema } from "../src/ast/index.js";
import {
  flowRunCancellationRequestSchema,
  flowSchedulerDecisionSchema,
  flowTriggerRecordSchema,
  flowWorkflowRunRequestSchema,
} from "../src/runtime/index.js";
import { createMockEventContextPacket, createMockTriggerRecord } from "../src/testing/index.js";

const now = "2026-05-27T10:00:00.000Z";

describe("@repo/flow runtime contracts", () => {
  it("accepts the v3 scale-trigger schedule vocabulary", () => {
    const ast = flowAstSchema.parse({
      version: "0.1",
      name: "social_manager",
      goal: "Create daily social posts and ask before publishing.",
      permissions: {
        auto: ["read_public_web", "create_drafts"],
        ask: ["publish_social_post"],
        block: ["delete_data"],
      },
      jobs: [
        {
          id: "daily_content",
          trigger: {
            type: "schedule",
            cron: "0 10 * * MON-FRI",
            timezone: "America/Los_Angeles",
            jitterSeconds: 300,
            minIntervalSeconds: 3600,
            maxRunsPerDay: 1,
            concurrencyKey: "org:social",
            dedupeKey: "daily_content:${scheduled_for}",
            misfirePolicy: "run_once",
          },
          tasks: [
            {
              id: "research",
              type: "ai_task",
              worker: "researcher",
              uses: ["web.search"],
              output: ["artifacts/research.json"],
              emits: ["research.completed"],
              ifFail: "continue_degraded",
            },
          ],
        },
      ],
    });

    const trigger = ast.jobs[0]?.trigger;

    expect(trigger?.type).toBe("schedule");
    if (trigger?.type === "schedule") {
      expect(trigger.timezone).toBe("America/Los_Angeles");
      expect(trigger.jitterSeconds).toBe(300);
      expect(trigger.misfirePolicy).toBe("run_once");
    }
    expect(ast.jobs[0]?.tasks[0]?.emits).toEqual(["research.completed"]);
  });

  it("validates DB-backed trigger registry records and run requests", () => {
    const trigger = createMockTriggerRecord({
      jitterSeconds: 120,
      misfirePolicy: "catch_up_limited",
      dedupeKey: "workflow_mock:trigger_mock:2026-05-27T10:00:00.000Z",
    });

    const runRequest = flowWorkflowRunRequestSchema.parse({
      requestId: "request_mock",
      orgId: trigger.orgId,
      workflowId: trigger.workflowId,
      workflowVersionId: trigger.workflowVersionId,
      jobId: trigger.jobId,
      triggerId: trigger.id,
      triggerType: trigger.triggerType,
      scheduledFor: now,
      dedupeKey: trigger.dedupeKey,
      requestedAt: now,
    });

    const decision = flowSchedulerDecisionSchema.parse({
      type: "request_run",
      trigger,
      runRequest,
      nextRunAt: "2026-05-28T10:00:00.000Z",
    });

    expect(flowTriggerRecordSchema.safeParse(trigger).success).toBe(true);
    expect(decision.type).toBe("request_run");
    if (decision.type === "request_run") {
      expect(decision.runRequest.triggerId).toBe("trigger_mock");
      expect(decision.runRequest.dedupeKey).toContain("trigger_mock");
    }
  });

  it("validates EventContextPackets for worker-to-worker routing", () => {
    const packet = createMockEventContextPacket({
      id: "ecp_image_generated",
      type: "artifact.image.generated",
      source: {
        kind: "subagent",
        provider: "internal",
      },
      summary: "Generated an Instagram image.",
      artifacts: [
        {
          path: "artifacts/images/instagram.png",
          type: "image",
          related: "artifacts/posts/instagram.json",
          status: "ready_for_review",
        },
      ],
      quality: {
        confidence: 0.88,
        verifierStatus: "passed",
      },
      routing: {
        notifyUi: true,
        notifyTasks: ["approval", "schedule_posts"],
        notifyMainAi: false,
      },
      cost: {
        credits: 8,
      },
    });

    expect(flowEventContextPacketSchema.safeParse(packet).success).toBe(true);
    expect(packet.routing.notifyTasks).toEqual(["approval", "schedule_posts"]);
    expect(packet.routing.notifyMainAi).toBe(false);
  });

  it("validates TaskReports and RunReflectionPackets", () => {
    const taskReport = flowTaskReportSchema.parse({
      id: "report_research",
      orgId: "org_mock",
      workflowId: "workflow_mock",
      runId: "run_mock",
      jobId: "daily_content",
      taskId: "research",
      workerId: "researcher",
      status: "completed_with_issues",
      summary: "Research completed but one source failed.",
      inputsUsed: ["brand.md"],
      emittedEvents: ["research.completed", "issue.created"],
      issues: [
        {
          title: "One source failed",
          impact: "low",
          reason: "The source timed out.",
          fallbackUsed: "Used cached search results.",
        },
      ],
      cost: {
        credits: 2,
        modelTokens: 1200,
      },
      completedAt: now,
    });

    const reflection = flowRunReflectionPacketSchema.parse({
      id: "reflection_run_mock",
      orgId: "org_mock",
      workflowId: "workflow_mock",
      runId: "run_mock",
      status: "completed_with_issues",
      summary: "Run completed with one degraded research source.",
      completedTasks: 1,
      failedTasks: 0,
      taskReports: [taskReport],
      shouldWakeMainAi: true,
      patchOpportunities: [
        {
          target: "workflow.flow",
          change: "Add fallback search provider for research task.",
        },
      ],
      createdAt: now,
    });

    expect(taskReport.issues).toHaveLength(1);
    expect(reflection.shouldWakeMainAi).toBe(true);
    expect(reflection.patchOpportunities[0]?.target).toBe("workflow.flow");
  });

  it("validates cancellation requests as runtime events, not client-only aborts", () => {
    const request = flowRunCancellationRequestSchema.parse({
      cancellationId: "cancel_mock",
      orgId: "org_mock",
      workflowId: "workflow_mock",
      runId: "run_mock",
      reason: "user_requested",
      requestedBy: "user_mock",
      requestedAt: now,
    });

    expect(request.reason).toBe("user_requested");
  });
});
