import { z } from "zod";
import { flowSourceSpanSchema } from "../source/index.js";

export const flowDiagnosticSeveritySchema = z.enum(["error", "warning", "info"]);

export const flowDiagnosticCodeSchema = z.enum([
  "FLOW_PARSER_NOT_IMPLEMENTED",
  "FLOW_PARSE_UNEXPECTED_TOKEN",
  "FLOW_PARSE_BAD_INDENT",
  "FLOW_PARSE_TAB_INDENT",
  "FLOW_PARSE_UNTERMINATED_STRING",
  "FLOW_PARSE_UNTERMINATED_INLINE_LIST",
  "FLOW_PARSE_UNKNOWN_TOP_LEVEL_KEY",
  "FLOW_PARSE_DUPLICATE_KEY",
  "FLOW_PARSE_YAML_FEATURE_UNSUPPORTED",
  "FLOW_PARSE_EMPTY_DOCUMENT",
  "FLOW_PARSE_MISSING_REQUIRED_FIELD",
  "FLOW_PARSE_INVALID_FIELD_VALUE",
  "FLOW_PARSE_RESERVED_TASK_TYPE_UNSUPPORTED",
  "FLOW_PARSE_RESERVED_FAILURE_POLICY_UNSUPPORTED",
]);

export const flowDiagnosticSchema = z.object({
  code: flowDiagnosticCodeSchema,
  message: z.string().min(1),
  severity: flowDiagnosticSeveritySchema,
  path: z.array(z.string()).default([]),
  span: flowSourceSpanSchema.optional(),
});

export type FlowDiagnosticSeverity = z.infer<typeof flowDiagnosticSeveritySchema>;
export type FlowDiagnosticCode = z.infer<typeof flowDiagnosticCodeSchema>;
export type FlowDiagnostic = z.infer<typeof flowDiagnosticSchema>;
