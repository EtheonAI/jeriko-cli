import { z } from "zod";

export const flowRunStatusSchema = z.enum([
  "queued",
  "running",
  "waiting",
  "completed",
  "failed",
  "canceled",
]);

export const flowTaskStatusSchema = z.enum([
  "pending",
  "running",
  "waiting",
  "completed",
  "failed",
  "skipped",
  "canceled",
]);

export const flowRunStateSchema = z.object({
  runId: z.string().min(1),
  flowName: z.string().min(1),
  status: flowRunStatusSchema,
  currentNodeIds: z.array(z.string()).default([]),
  taskStates: z.record(z.string(), flowTaskStatusSchema).default({}),
  metadata: z.record(z.string(), z.unknown()).default({}),
  updatedAt: z.string().datetime(),
});

export type FlowRunStatus = z.infer<typeof flowRunStatusSchema>;
export type FlowTaskStatus = z.infer<typeof flowTaskStatusSchema>;
export type FlowRunState = z.infer<typeof flowRunStateSchema>;
