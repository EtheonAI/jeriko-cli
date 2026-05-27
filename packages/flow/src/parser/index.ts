import { z } from "zod";
import { flowAstSchema, type FlowAst } from "../ast/index.js";
import { type FlowSource, flowSourceSpanSchema } from "../source/index.js";

export const flowDiagnosticSeveritySchema = z.enum(["error", "warning", "info"]);

export const flowDiagnosticSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  severity: flowDiagnosticSeveritySchema,
  path: z.array(z.string()).default([]),
  span: flowSourceSpanSchema.optional(),
});

export const flowParseResultSchema = z.object({
  ok: z.boolean(),
  ast: flowAstSchema.optional(),
  diagnostics: z.array(flowDiagnosticSchema).default([]),
});

export type FlowDiagnosticSeverity = z.infer<typeof flowDiagnosticSeveritySchema>;
export type FlowDiagnostic = z.infer<typeof flowDiagnosticSchema>;
export type FlowParseResult = z.infer<typeof flowParseResultSchema>;

export type FlowParser = {
  parse(source: FlowSource): FlowParseResult | Promise<FlowParseResult>;
};

export function createUnimplementedParseResult(message: string): FlowParseResult {
  return flowParseResultSchema.parse({
    ok: false,
    diagnostics: [
      {
        code: "FLOW_PARSER_NOT_IMPLEMENTED",
        message,
        severity: "error",
      },
    ],
  });
}

export function assertFlowAst(value: unknown): FlowAst {
  return flowAstSchema.parse(value);
}
