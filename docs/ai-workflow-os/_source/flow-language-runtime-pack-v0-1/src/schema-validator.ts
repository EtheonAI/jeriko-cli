import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import type { CompileDiagnostic, FlowDocument } from "./types.js";
import schema from "../schemas/flow.schema.json" assert { type: "json" };

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(schema);

export function validateFlowShape(document: FlowDocument): CompileDiagnostic[] {
  const ok = validate(document);
  if (ok) return [];

  return (validate.errors ?? []).map((err) => ({
    code: "FLOW_SCHEMA_ERROR",
    severity: "error",
    path: err.instancePath || "/",
    message: `${err.instancePath || "/"} ${err.message ?? "schema validation failed"}`,
    suggested_fix: err.params ? JSON.stringify(err.params) : undefined,
  }));
}
