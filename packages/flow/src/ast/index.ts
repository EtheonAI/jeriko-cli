import { z } from "zod";
import { flowSourceSpanSchema } from "../source/index.js";
import {
  flowJobSchema,
  flowPermissionSetSchema,
  flowTaskSchema,
  flowVersionSchema,
} from "../kernel/index.js";

export const flowAstTaskSchema = flowTaskSchema.extend({
  sourceSpan: flowSourceSpanSchema.optional(),
});

export const flowAstJobSchema = flowJobSchema.extend({
  tasks: z.array(flowAstTaskSchema),
  sourceSpan: flowSourceSpanSchema.optional(),
});

export const flowAstSchema = z.object({
  version: flowVersionSchema,
  name: z.string().min(1),
  goal: z.string().min(1),
  permissions: flowPermissionSetSchema.default({
    auto: [],
    ask: [],
    block: [],
  }),
  jobs: z.array(flowAstJobSchema),
  sourceSpan: flowSourceSpanSchema.optional(),
});

export type FlowAstTask = z.infer<typeof flowAstTaskSchema>;
export type FlowAstJob = z.infer<typeof flowAstJobSchema>;
export type FlowAst = z.infer<typeof flowAstSchema>;
