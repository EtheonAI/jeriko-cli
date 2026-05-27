import { z } from "zod";
import { flowTokenSchema } from "../lexer/index.js";
import { flowSourceSpanSchema } from "../source/index.js";

export const flowCstNodeKindSchema = z.enum([
  "document",
  "mapping",
  "pair",
  "sequence",
  "sequence_item",
  "scalar",
  "inline_list",
  "block_literal",
  "comment",
]);

export type FlowCstNodeKind = z.infer<typeof flowCstNodeKindSchema>;

export type FlowCstNode = {
  id: string;
  kind: FlowCstNodeKind;
  span: z.infer<typeof flowSourceSpanSchema>;
  key?: string;
  value?: string;
  tokenIds: string[];
  children: FlowCstNode[];
  metadata: Record<string, unknown>;
};

export const flowCstNodeSchema: z.ZodType<FlowCstNode> = z.lazy(() =>
  z.object({
    id: z.string().min(1),
    kind: flowCstNodeKindSchema,
    span: flowSourceSpanSchema,
    key: z.string().min(1).optional(),
    value: z.string().optional(),
    tokenIds: z.array(z.string().min(1)).default([]),
    children: z.array(flowCstNodeSchema).default([]),
    metadata: z.record(z.string(), z.unknown()).default({}),
  })
);

export const flowCstDocumentSchema = z.object({
  sourceId: z.string().min(1),
  root: flowCstNodeSchema,
  tokens: z.array(flowTokenSchema),
  comments: z.array(flowCstNodeSchema).default([]),
});

export type FlowCstDocument = z.infer<typeof flowCstDocumentSchema>;
