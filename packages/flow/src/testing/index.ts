import { flowAstSchema, type FlowAst } from "../ast/index.js";
import { flowEventContextPacketSchema, type FlowEventContextPacket } from "../events/index.js";
import { flowTriggerRecordSchema, type FlowTriggerRecord } from "../runtime/index.js";
import { createFlowSource, type FlowSource } from "../source/index.js";

export function createMockFlowSource(text = 'flow: "0.1"'): FlowSource {
  return createFlowSource(text, {
    id: "mock.flow",
    path: "mock.flow",
  });
}

export function createMinimalFlowAst(): FlowAst {
  return flowAstSchema.parse({
    version: "0.1",
    name: "minimal_flow",
    goal: "Validate the flow package scaffold.",
    permissions: {
      auto: [],
      ask: [],
      block: [],
    },
    jobs: [
      {
        id: "manual",
        trigger: {
          type: "manual",
        },
        tasks: [
          {
            id: "review",
            type: "human_review",
          },
        ],
      },
    ],
  });
}

export function createMockEventContextPacket(
  overrides: Partial<FlowEventContextPacket> = {}
): FlowEventContextPacket {
  return flowEventContextPacketSchema.parse({
    id: "evt_mock",
    type: "task.completed",
    orgId: "org_mock",
    workflowId: "workflow_mock",
    runId: "run_mock",
    jobId: "job_mock",
    taskId: "task_mock",
    source: {
      kind: "worker",
    },
    summary: "Mock task completed.",
    occurredAt: "2026-05-27T00:00:00.000Z",
    ...overrides,
  });
}

export function createMockTriggerRecord(
  overrides: Partial<FlowTriggerRecord> = {}
): FlowTriggerRecord {
  return flowTriggerRecordSchema.parse({
    id: "trigger_mock",
    orgId: "org_mock",
    workflowId: "workflow_mock",
    workflowVersionId: "version_mock",
    jobId: "job_mock",
    triggerType: "schedule",
    cronExpr: "0 10 * * MON-FRI",
    timezone: "UTC",
    nextRunAt: "2026-05-27T10:00:00.000Z",
    status: "active",
    createdAt: "2026-05-27T00:00:00.000Z",
    updatedAt: "2026-05-27T00:00:00.000Z",
    ...overrides,
  });
}
