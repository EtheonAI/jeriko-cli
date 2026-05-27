import { z } from "zod";

export const flowPatchOperationSchema = z.object({
  op: z.enum(["add", "replace", "remove", "move", "copy", "test"]),
  path: z.string().min(1),
  from: z.string().optional(),
  value: z.unknown().optional(),
  reason: z.string().optional(),
});

export const flowPatchSchema = z.object({
  id: z.string().min(1),
  targetVersion: z.string().min(1),
  operations: z.array(flowPatchOperationSchema).min(1),
  author: z.string().optional(),
  createdAt: z.string().datetime(),
});

export type FlowPatchOperation = z.infer<typeof flowPatchOperationSchema>;
export type FlowPatch = z.infer<typeof flowPatchSchema>;
