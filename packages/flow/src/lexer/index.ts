import { z } from "zod";
import { flowSourceSpanSchema } from "../source/index.js";

export const flowStructuralTokenKindSchema = z.enum([
  "BOM",
  "NEWLINE",
  "INDENT",
  "DEDENT",
  "KEY",
  "COLON",
  "DASH",
  "COMMA",
  "INLINE_LIST_START",
  "INLINE_LIST_END",
  "BLOCK_LITERAL_START",
  "EOF",
]);

export const flowScalarTokenKindSchema = z.enum([
  "SCALAR_BARE",
  "SCALAR_SINGLE_QUOTED",
  "SCALAR_DOUBLE_QUOTED",
  "BLOCK_LITERAL_TEXT",
  "COMMENT",
]);

export const flowYamlReservedTokenKindSchema = z.enum([
  "YAML_DIRECTIVE",
  "YAML_DOCUMENT_MARKER",
  "YAML_TAG",
  "YAML_ANCHOR",
  "YAML_ALIAS",
  "YAML_MERGE_KEY",
]);

export const flowTokenKindSchema = z.union([
  flowStructuralTokenKindSchema,
  flowScalarTokenKindSchema,
  flowYamlReservedTokenKindSchema,
]);

export const flowTokenSchema = z.object({
  id: z.string().min(1),
  kind: flowTokenKindSchema,
  lexeme: z.string(),
  span: flowSourceSpanSchema,
  indent: z.number().int().nonnegative().optional(),
  value: z.string().optional(),
});

export const flowTokenStreamSchema = z.object({
  sourceId: z.string().min(1),
  tokens: z.array(flowTokenSchema),
});

export type FlowStructuralTokenKind = z.infer<typeof flowStructuralTokenKindSchema>;
export type FlowScalarTokenKind = z.infer<typeof flowScalarTokenKindSchema>;
export type FlowYamlReservedTokenKind = z.infer<typeof flowYamlReservedTokenKindSchema>;
export type FlowTokenKind = z.infer<typeof flowTokenKindSchema>;
export type FlowToken = z.infer<typeof flowTokenSchema>;
export type FlowTokenStream = z.infer<typeof flowTokenStreamSchema>;
