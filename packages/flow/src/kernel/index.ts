import { z } from "zod";

export const flowVersionSchema = z.literal("0.1");

export const flowIdentifierSchema = z
  .string()
  .min(1)
  .regex(/^[a-zA-Z_][a-zA-Z0-9_-]*$/);

export const flowPermissionModeSchema = z.enum(["auto", "ask", "block"]);

export const flowPermissionSetSchema = z.object({
  auto: z.array(z.string()).default([]),
  ask: z.array(z.string()).default([]),
  block: z.array(z.string()).default([]),
});

export const flowEventNameSchema = z
  .string()
  .min(1)
  .regex(/^[a-zA-Z0-9_.:/-]+$/);

export const flowAcceptedTaskTypes = [
  "ai_task",
  "tool_call",
  "sandbox_command",
  "human_review",
  "wait_for_event",
  "subflow",
] as const;

export const flowReservedTaskTypes = [
  "sleep",
  "foreach",
  "parallel",
  "condition",
  "verify",
  "emit_event",
  "invoke_workflow",
  "memory_patch",
  "flow_patch",
  "issue_card",
] as const;

export const flowTaskTypeSchema = z.enum(flowAcceptedTaskTypes);

export const flowReservedTaskTypeSchema = z.enum(flowReservedTaskTypes);

export const flowKnownTaskTypeSchema = z.union([flowTaskTypeSchema, flowReservedTaskTypeSchema]);

export const flowAcceptedFailurePolicies = [
  "stop",
  "retry",
  "continue_degraded",
  "ask_user",
  "emit_issue",
] as const;

export const flowReservedFailurePolicies = [
  "retry_then_stop",
  "retry_then_ask",
  "use_cached",
  "fallback",
  "create_issue_card",
  "regenerate_once_then_ask",
  "skip_optional",
] as const;

export const flowFailurePolicySchema = z.enum(flowAcceptedFailurePolicies);

export const flowReservedFailurePolicySchema = z.enum(flowReservedFailurePolicies);

export const flowKnownFailurePolicySchema = z.union([
  flowFailurePolicySchema,
  flowReservedFailurePolicySchema,
]);

export const flowMisfirePolicySchema = z.enum(["skip", "run_once", "catch_up_limited", "ask_user"]);

export const flowMatchRulesSchema = z.record(z.string(), z.unknown()).default({});

const flowTriggerPolicyShape = {
  minIntervalSeconds: z.number().int().positive().optional(),
  jitterSeconds: z.number().int().min(0).max(300).optional(),
  maxRunsPerDay: z.number().int().positive().optional(),
  concurrencyKey: z.string().min(1).optional(),
  dedupeKey: z.string().min(1).optional(),
  misfirePolicy: flowMisfirePolicySchema.default("skip"),
  config: z.record(z.string(), z.unknown()).default({}),
} satisfies z.ZodRawShape;

export const flowTriggerSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("manual"),
    ...flowTriggerPolicyShape,
  }),
  z.object({
    type: z.literal("schedule"),
    cron: z.string().min(1),
    timezone: z.string().min(1).default("UTC"),
    ...flowTriggerPolicyShape,
  }),
  z.object({
    type: z.literal("event"),
    event: flowEventNameSchema,
    matchRules: flowMatchRulesSchema,
    ...flowTriggerPolicyShape,
  }),
  z.object({
    type: z.literal("app_event"),
    event: flowEventNameSchema,
    provider: z.string().min(1).optional(),
    matchRules: flowMatchRulesSchema,
    ...flowTriggerPolicyShape,
  }),
  z.object({
    type: z.literal("workflow_event"),
    event: flowEventNameSchema,
    matchRules: flowMatchRulesSchema,
    ...flowTriggerPolicyShape,
  }),
  z.object({
    type: z.literal("webhook"),
    path: z.string().min(1),
    event: flowEventNameSchema.optional(),
    matchRules: flowMatchRulesSchema,
    ...flowTriggerPolicyShape,
  }),
]);

export const flowTaskSchema = z.object({
  id: flowIdentifierSchema,
  type: flowTaskTypeSchema,
  description: z.string().optional(),
  worker: z.string().optional(),
  uses: z.array(z.string()).default([]),
  dependsOn: z.array(flowIdentifierSchema).default([]),
  input: z.array(z.string()).default([]),
  output: z.array(z.string()).default([]),
  emits: z.array(flowEventNameSchema).default([]),
  listensTo: z.array(flowEventNameSchema).default([]),
  requiresApproval: z.boolean().default(false),
  ifFail: flowFailurePolicySchema.default("stop"),
  config: z.record(z.string(), z.unknown()).default({}),
});

export const flowJobSchema = z.object({
  id: flowIdentifierSchema,
  trigger: flowTriggerSchema,
  tasks: z.array(flowTaskSchema),
});

export type FlowVersion = z.infer<typeof flowVersionSchema>;
export type FlowIdentifier = z.infer<typeof flowIdentifierSchema>;
export type FlowPermissionMode = z.infer<typeof flowPermissionModeSchema>;
export type FlowPermissionSet = z.infer<typeof flowPermissionSetSchema>;
export type FlowEventName = z.infer<typeof flowEventNameSchema>;
export type FlowTaskType = z.infer<typeof flowTaskTypeSchema>;
export type FlowReservedTaskType = z.infer<typeof flowReservedTaskTypeSchema>;
export type FlowKnownTaskType = z.infer<typeof flowKnownTaskTypeSchema>;
export type FlowFailurePolicy = z.infer<typeof flowFailurePolicySchema>;
export type FlowReservedFailurePolicy = z.infer<typeof flowReservedFailurePolicySchema>;
export type FlowKnownFailurePolicy = z.infer<typeof flowKnownFailurePolicySchema>;
export type FlowMisfirePolicy = z.infer<typeof flowMisfirePolicySchema>;
export type FlowMatchRules = z.infer<typeof flowMatchRulesSchema>;
export type FlowTrigger = z.infer<typeof flowTriggerSchema>;
export type FlowTask = z.infer<typeof flowTaskSchema>;
export type FlowJob = z.infer<typeof flowJobSchema>;

export function isFlowAcceptedTaskType(value: string): value is FlowTaskType {
  return flowAcceptedTaskTypes.includes(value as FlowTaskType);
}

export function isFlowReservedTaskType(value: string): value is FlowReservedTaskType {
  return flowReservedTaskTypes.includes(value as FlowReservedTaskType);
}

export function isFlowKnownTaskType(value: string): value is FlowKnownTaskType {
  return isFlowAcceptedTaskType(value) || isFlowReservedTaskType(value);
}

export function isFlowAcceptedFailurePolicy(value: string): value is FlowFailurePolicy {
  return flowAcceptedFailurePolicies.includes(value as FlowFailurePolicy);
}

export function isFlowReservedFailurePolicy(value: string): value is FlowReservedFailurePolicy {
  return flowReservedFailurePolicies.includes(value as FlowReservedFailurePolicy);
}

export function isFlowKnownFailurePolicy(value: string): value is FlowKnownFailurePolicy {
  return isFlowAcceptedFailurePolicy(value) || isFlowReservedFailurePolicy(value);
}
