import { z } from "zod";
import { flowAstSchema, type FlowAst } from "../ast/index.js";
import { flowDiagnosticSchema } from "../parser/index.js";
import { flowEventNameSchema, flowTaskTypeSchema, flowVersionSchema } from "../kernel/index.js";

export const flowSymbolKindSchema = z.enum([
  "job",
  "task",
  "tool",
  "artifact",
  "event",
  "worker",
  "permission",
]);

export const flowSymbolSchema = z.object({
  id: z.string().min(1),
  kind: flowSymbolKindSchema,
  definedBy: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const flowSymbolTableSchema = z.object({
  jobs: z.record(z.string(), flowSymbolSchema).default({}),
  tasks: z.record(z.string(), flowSymbolSchema).default({}),
  tools: z.record(z.string(), flowSymbolSchema).default({}),
  artifacts: z.record(z.string(), flowSymbolSchema).default({}),
  events: z.record(z.string(), flowSymbolSchema).default({}),
  workers: z.record(z.string(), flowSymbolSchema).default({}),
  permissions: z.record(z.string(), flowSymbolSchema).default({}),
});

export const flowExecutionNodeSchema = z.object({
  id: z.string().min(1),
  jobId: z.string().min(1),
  taskId: z.string().min(1),
  type: flowTaskTypeSchema,
  dependsOn: z.array(z.string()).default([]),
  emits: z.array(flowEventNameSchema).default([]),
  waitsFor: z.array(flowEventNameSchema).default([]),
  requiresApproval: z.boolean().default(false),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const flowExecutionPlanSchema = z.object({
  version: flowVersionSchema,
  name: z.string().min(1),
  ast: flowAstSchema,
  nodes: z.array(flowExecutionNodeSchema),
  entrypoints: z.array(z.string()).default([]),
});

export const flowCompileResultSchema = z.object({
  ok: z.boolean(),
  plan: flowExecutionPlanSchema.optional(),
  symbols: flowSymbolTableSchema.optional(),
  diagnostics: z.array(flowDiagnosticSchema).default([]),
});

export type FlowSymbolKind = z.infer<typeof flowSymbolKindSchema>;
export type FlowSymbol = z.infer<typeof flowSymbolSchema>;
export type FlowSymbolTable = z.infer<typeof flowSymbolTableSchema>;
export type FlowExecutionNode = z.infer<typeof flowExecutionNodeSchema>;
export type FlowExecutionPlan = z.infer<typeof flowExecutionPlanSchema>;
export type FlowCompileResult = z.infer<typeof flowCompileResultSchema>;

export type FlowCompiler = {
  compile(ast: FlowAst): FlowCompileResult | Promise<FlowCompileResult>;
};
