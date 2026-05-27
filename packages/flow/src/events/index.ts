import { z } from "zod";
import { flowEventNameSchema } from "../kernel/index.js";

export const flowEventTypeSchema = z.enum([
  "flow.started",
  "flow.completed",
  "flow.failed",
  "workflow.run.requested",
  "workflow.run.cancel.requested",
  "job.started",
  "job.completed",
  "job.failed",
  "task.started",
  "task.completed",
  "task.failed",
  "approval.requested",
  "approval.approved",
  "approval.rejected",
  "artifact.created",
  "sandbox.command.started",
  "sandbox.command.completed",
  "issue.created",
  "reflection.proposed",
  "worker.callback.received",
]);

export const flowEventSourceKindSchema = z.enum([
  "user",
  "system",
  "scheduler",
  "app",
  "tool",
  "worker",
  "subagent",
  "workflow",
  "sandbox",
]);

export const flowArtifactRefSchema = z.object({
  id: z.string().min(1).optional(),
  path: z.string().min(1),
  type: z.string().min(1),
  related: z.string().min(1).optional(),
  status: z.enum(["pending", "ready", "ready_for_review", "failed", "expired"]).default("ready"),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const flowQualitySignalsSchema = z.object({
  confidence: z.number().min(0).max(1).optional(),
  verifierStatus: z.enum(["not_run", "passed", "failed", "warning"]).default("not_run"),
  score: z.number().min(0).max(1).optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const flowCostSummarySchema = z.object({
  credits: z.number().nonnegative().default(0),
  modelTokens: z.number().int().nonnegative().optional(),
  toolCalls: z.number().int().nonnegative().optional(),
  sandboxSeconds: z.number().nonnegative().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const flowEventRoutingSchema = z.object({
  notifyUi: z.boolean().default(false),
  notifyTasks: z.array(z.string().min(1)).default([]),
  notifyWorkflows: z.array(z.string().min(1)).default([]),
  notifyMainAi: z.boolean().default(false),
  notificationChannels: z.array(z.enum(["in_app", "email", "slack", "sms", "webhook"])).default([]),
});

export const flowEventContextPacketSchema = z.object({
  id: z.string().min(1),
  type: flowEventNameSchema,
  schemaVersion: z.literal("0.1").default("0.1"),
  orgId: z.string().min(1),
  workflowId: z.string().min(1).optional(),
  workflowVersionId: z.string().min(1).optional(),
  runId: z.string().min(1).optional(),
  jobId: z.string().min(1).optional(),
  taskId: z.string().min(1).optional(),
  workerId: z.string().min(1).optional(),
  source: z.object({
    kind: flowEventSourceKindSchema,
    provider: z.string().min(1).optional(),
    id: z.string().min(1).optional(),
  }),
  correlationId: z.string().min(1).optional(),
  causationId: z.string().min(1).optional(),
  summary: z.string().min(1).optional(),
  payload: z.record(z.string(), z.unknown()).default({}),
  artifacts: z.array(flowArtifactRefSchema).default([]),
  quality: flowQualitySignalsSchema.default({
    verifierStatus: "not_run",
    metadata: {},
  }),
  routing: flowEventRoutingSchema.default({
    notifyUi: false,
    notifyTasks: [],
    notifyWorkflows: [],
    notifyMainAi: false,
    notificationChannels: [],
  }),
  cost: flowCostSummarySchema.default({
    credits: 0,
    metadata: {},
  }),
  occurredAt: z.string().datetime(),
});

export const flowEventSchema = z.object({
  id: z.string().min(1),
  type: flowEventTypeSchema,
  flowId: z.string().optional(),
  runId: z.string().optional(),
  jobId: z.string().optional(),
  taskId: z.string().optional(),
  timestamp: z.string().datetime(),
  payload: z.record(z.string(), z.unknown()).default({}),
  context: flowEventContextPacketSchema.optional(),
});

export const flowTaskReportStatusSchema = z.enum([
  "completed",
  "completed_with_issues",
  "failed",
  "canceled",
  "skipped",
]);

export const flowTaskIssueSchema = z.object({
  id: z.string().min(1).optional(),
  title: z.string().min(1),
  impact: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  reason: z.string().min(1),
  fallbackUsed: z.string().min(1).optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const flowTaskReportSchema = z.object({
  id: z.string().min(1),
  orgId: z.string().min(1),
  workflowId: z.string().min(1),
  workflowVersionId: z.string().min(1).optional(),
  runId: z.string().min(1),
  jobId: z.string().min(1),
  taskId: z.string().min(1),
  workerId: z.string().min(1).optional(),
  status: flowTaskReportStatusSchema,
  summary: z.string().min(1),
  inputsUsed: z.array(z.string().min(1)).default([]),
  outputsCreated: z.array(flowArtifactRefSchema).default([]),
  emittedEvents: z.array(flowEventNameSchema).default([]),
  toolsUsed: z.array(z.string().min(1)).default([]),
  model: z
    .object({
      provider: z.string().min(1).optional(),
      name: z.string().min(1).optional(),
    })
    .optional(),
  tokenUsage: z
    .object({
      inputTokens: z.number().int().nonnegative().default(0),
      outputTokens: z.number().int().nonnegative().default(0),
      reasoningTokens: z.number().int().nonnegative().optional(),
    })
    .default({
      inputTokens: 0,
      outputTokens: 0,
    }),
  cost: flowCostSummarySchema.default({
    credits: 0,
    metadata: {},
  }),
  confidence: z.number().min(0).max(1).optional(),
  issues: z.array(flowTaskIssueSchema).default([]),
  suggestedPatches: z.array(z.unknown()).default([]),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const flowIssueCardSchema = z.object({
  id: z.string().min(1),
  orgId: z.string().min(1),
  workflowId: z.string().min(1),
  runId: z.string().min(1),
  taskId: z.string().min(1).optional(),
  title: z.string().min(1),
  impact: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  reason: z.string().min(1),
  fallbackUsed: z.string().min(1).optional(),
  suggestedActions: z
    .array(
      z.enum(["retry", "skip", "use_fallback", "patch_workflow", "ask_user", "pause_workflow"])
    )
    .default([]),
  createdAt: z.string().datetime(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const flowRunReflectionPacketSchema = z.object({
  id: z.string().min(1),
  orgId: z.string().min(1),
  workflowId: z.string().min(1),
  workflowVersionId: z.string().min(1).optional(),
  runId: z.string().min(1),
  status: z.enum(["completed", "completed_with_issues", "failed", "canceled", "stuck"]),
  summary: z.string().min(1),
  completedTasks: z.number().int().nonnegative().default(0),
  failedTasks: z.number().int().nonnegative().default(0),
  issues: z.array(flowIssueCardSchema).default([]),
  taskReports: z.array(flowTaskReportSchema).default([]),
  cost: flowCostSummarySchema.default({
    credits: 0,
    metadata: {},
  }),
  patchOpportunities: z
    .array(
      z.object({
        target: z.string().min(1),
        change: z.string().min(1),
        reason: z.string().min(1).optional(),
      })
    )
    .default([]),
  shouldWakeMainAi: z.boolean().default(false),
  createdAt: z.string().datetime(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export type FlowEventType = z.infer<typeof flowEventTypeSchema>;
export type FlowEventSourceKind = z.infer<typeof flowEventSourceKindSchema>;
export type FlowArtifactRef = z.infer<typeof flowArtifactRefSchema>;
export type FlowQualitySignals = z.infer<typeof flowQualitySignalsSchema>;
export type FlowCostSummary = z.infer<typeof flowCostSummarySchema>;
export type FlowEventRouting = z.infer<typeof flowEventRoutingSchema>;
export type FlowEventContextPacket = z.infer<typeof flowEventContextPacketSchema>;
export type FlowEvent = z.infer<typeof flowEventSchema>;
export type FlowTaskReportStatus = z.infer<typeof flowTaskReportStatusSchema>;
export type FlowTaskIssue = z.infer<typeof flowTaskIssueSchema>;
export type FlowTaskReport = z.infer<typeof flowTaskReportSchema>;
export type FlowIssueCard = z.infer<typeof flowIssueCardSchema>;
export type FlowRunReflectionPacket = z.infer<typeof flowRunReflectionPacketSchema>;
