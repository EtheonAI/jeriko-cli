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

export const flowTaskTypeSchema = z.enum([
  "ai_task",
  "tool_call",
  "sandbox_command",
  "human_review",
  "wait_for_event",
  "subflow",
]);

export const flowFailurePolicySchema = z.enum([
  "stop",
  "retry",
  "continue_degraded",
  "ask_user",
  "emit_issue",
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
export type FlowFailurePolicy = z.infer<typeof flowFailurePolicySchema>;
export type FlowMisfirePolicy = z.infer<typeof flowMisfirePolicySchema>;
export type FlowMatchRules = z.infer<typeof flowMatchRulesSchema>;
export type FlowTrigger = z.infer<typeof flowTriggerSchema>;
export type FlowTask = z.infer<typeof flowTaskSchema>;
export type FlowJob = z.infer<typeof flowJobSchema>;
