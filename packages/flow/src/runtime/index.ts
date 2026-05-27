import { z } from "zod";
import type { FlowExecutionPlan } from "../compiler/index.js";
import {
  flowEventContextPacketSchema,
  flowEventSchema,
  type FlowEvent,
  type FlowEventContextPacket,
} from "../events/index.js";
import { flowEventNameSchema, flowMisfirePolicySchema } from "../kernel/index.js";
import { flowRunStateSchema, type FlowRunState } from "../state/index.js";

export const flowRuntimeInputSchema = z.object({
  runId: z.string().optional(),
  data: z.record(z.string(), z.unknown()).default({}),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const flowRuntimeResultSchema = z.object({
  state: flowRunStateSchema,
  events: z.array(flowEventSchema).default([]),
});

export const flowTriggerRecordTypeSchema = z.enum([
  "manual",
  "schedule",
  "app_event",
  "workflow_event",
  "webhook",
]);

export const flowTriggerStatusSchema = z.enum(["active", "paused", "disabled", "errored"]);

export const flowTriggerRecordSchema = z.object({
  id: z.string().min(1),
  orgId: z.string().min(1),
  workflowId: z.string().min(1),
  workflowVersionId: z.string().min(1),
  jobId: z.string().min(1),
  triggerType: flowTriggerRecordTypeSchema,
  eventType: flowEventNameSchema.optional(),
  matchRules: z.record(z.string(), z.unknown()).default({}),
  cronExpr: z.string().min(1).optional(),
  timezone: z.string().min(1).default("UTC"),
  nextRunAt: z.string().datetime().nullable().optional(),
  lastRunAt: z.string().datetime().nullable().optional(),
  status: flowTriggerStatusSchema.default("active"),
  minIntervalSeconds: z.number().int().positive().optional(),
  jitterSeconds: z.number().int().min(0).max(300).optional(),
  maxRunsPerDay: z.number().int().positive().optional(),
  concurrencyKey: z.string().min(1).optional(),
  misfirePolicy: flowMisfirePolicySchema.default("skip"),
  dedupeKey: z.string().min(1).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const flowSchedulerTickInputSchema = z.object({
  tickId: z.string().min(1),
  now: z.string().datetime(),
  limit: z.number().int().positive().max(1000).default(100),
  orgId: z.string().min(1).optional(),
});

export const flowWorkflowRunRequestSchema = z.object({
  requestId: z.string().min(1),
  orgId: z.string().min(1),
  workflowId: z.string().min(1),
  workflowVersionId: z.string().min(1),
  jobId: z.string().min(1),
  triggerId: z.string().min(1).optional(),
  triggerType: flowTriggerRecordTypeSchema,
  scheduledFor: z.string().datetime().optional(),
  dedupeKey: z.string().min(1),
  input: z.record(z.string(), z.unknown()).default({}),
  context: flowEventContextPacketSchema.optional(),
  requestedAt: z.string().datetime(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const flowSchedulerDecisionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("request_run"),
    trigger: flowTriggerRecordSchema,
    runRequest: flowWorkflowRunRequestSchema,
    nextRunAt: z.string().datetime().nullable().optional(),
  }),
  z.object({
    type: z.literal("skip"),
    triggerId: z.string().min(1),
    reason: z.enum([
      "not_due",
      "paused",
      "disabled",
      "plan_limit",
      "credit_limit",
      "dedupe",
      "rate_limited",
      "misfire_policy",
    ]),
    metadata: z.record(z.string(), z.unknown()).default({}),
  }),
  z.object({
    type: z.literal("pause"),
    triggerId: z.string().min(1),
    reason: z.enum(["event_storm", "repeated_failure", "manual", "abuse"]),
    metadata: z.record(z.string(), z.unknown()).default({}),
  }),
]);

export const flowCancellationReasonSchema = z.enum([
  "user_requested",
  "workflow_paused",
  "approval_rejected",
  "budget_exceeded",
  "timeout",
  "event_cancelled",
  "provider_shutdown",
]);

export const flowRunCancellationRequestSchema = z.object({
  cancellationId: z.string().min(1),
  orgId: z.string().min(1),
  workflowId: z.string().min(1).optional(),
  runId: z.string().min(1),
  reason: flowCancellationReasonSchema,
  requestedBy: z.string().min(1).optional(),
  requestedAt: z.string().datetime(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export type FlowRuntimeInput = z.infer<typeof flowRuntimeInputSchema>;
export type FlowRuntimeResult = z.infer<typeof flowRuntimeResultSchema>;
export type FlowTriggerRecordType = z.infer<typeof flowTriggerRecordTypeSchema>;
export type FlowTriggerStatus = z.infer<typeof flowTriggerStatusSchema>;
export type FlowTriggerRecord = z.infer<typeof flowTriggerRecordSchema>;
export type FlowSchedulerTickInput = z.infer<typeof flowSchedulerTickInputSchema>;
export type FlowWorkflowRunRequest = z.infer<typeof flowWorkflowRunRequestSchema>;
export type FlowSchedulerDecision = z.infer<typeof flowSchedulerDecisionSchema>;
export type FlowCancellationReason = z.infer<typeof flowCancellationReasonSchema>;
export type FlowRunCancellationRequest = z.infer<typeof flowRunCancellationRequestSchema>;

export type FlowRuntime = {
  start(plan: FlowExecutionPlan, input?: FlowRuntimeInput): Promise<FlowRunState>;
  resume(runId: string, event: FlowEvent): Promise<FlowRunState>;
  cancel(runId: string, request?: FlowRunCancellationRequest): Promise<FlowRunState>;
};

export type FlowRuntimeAdapter = {
  requestRun(request: FlowWorkflowRunRequest): Promise<FlowRunState>;
  emitEvent(event: FlowEvent): Promise<void>;
  resumeWithContext(packet: FlowEventContextPacket): Promise<void>;
  cancelRun(request: FlowRunCancellationRequest): Promise<FlowRunState>;
};
