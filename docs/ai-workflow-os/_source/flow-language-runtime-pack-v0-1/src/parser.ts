import { parseDocument, isAlias, isScalar, YAMLMap, YAMLSeq } from "yaml";
import type { CompileDiagnostic, FlowDocument } from "./types.js";

export interface ParseResult {
  ok: boolean;
  document?: FlowDocument;
  raw?: unknown;
  diagnostics: CompileDiagnostic[];
}

/**
 * Parse `.flow` as a restricted YAML-compatible source file.
 *
 * v0 strategy:
 * - Use `yaml` parser for speed.
 * - Reject anchors/aliases/custom tags/multi-doc at validation layer.
 * - Feed the raw object to schema validation + semantic validation.
 *
 * Future:
 * - Replace this with a custom lexer/CST/parser for better fault tolerance and editor positions.
 */
export function parseFlowSource(source: string): ParseResult {
  const diagnostics: CompileDiagnostic[] = [];

  const doc = parseDocument(source, {
    version: "1.2",
    strict: true,
    uniqueKeys: true,
    prettyErrors: true,
  });

  if (doc.errors.length > 0) {
    for (const err of doc.errors) {
      diagnostics.push({
        code: "FLOW_PARSE_ERROR",
        severity: "error",
        message: err.message,
      });
    }
    return { ok: false, diagnostics };
  }

  if (doc.warnings.length > 0) {
    for (const warn of doc.warnings) {
      diagnostics.push({
        code: "FLOW_PARSE_WARNING",
        severity: "warning",
        message: warn.message,
      });
    }
  }

  const unsafe = findUnsafeYamlFeatures(doc.contents);
  diagnostics.push(...unsafe);

  if (unsafe.some((d) => d.severity === "error")) {
    return { ok: false, diagnostics };
  }

  const raw = doc.toJSON();

  return {
    ok: true,
    raw,
    document: raw as FlowDocument,
    diagnostics,
  };
}

function findUnsafeYamlFeatures(node: unknown, path = "$"): CompileDiagnostic[] {
  const diagnostics: CompileDiagnostic[] = [];

  if (!node) return diagnostics;

  if (isAlias(node)) {
    diagnostics.push({
      code: "YAML_ALIAS_FORBIDDEN",
      severity: "error",
      message: "YAML aliases are not allowed in .flow.",
      path,
    });
  }

  // yaml nodes are objects with tags. Reject custom tags.
  const maybeTagged = node as { tag?: string; items?: unknown[] };
  if (typeof maybeTagged.tag === "string") {
    const tag = maybeTagged.tag;
    const allowed = [
      "tag:yaml.org,2002:map",
      "tag:yaml.org,2002:seq",
      "tag:yaml.org,2002:str",
      "tag:yaml.org,2002:int",
      "tag:yaml.org,2002:float",
      "tag:yaml.org,2002:bool",
      "tag:yaml.org,2002:null",
    ];
    if (!allowed.includes(tag)) {
      diagnostics.push({
        code: "YAML_CUSTOM_TAG_FORBIDDEN",
        severity: "error",
        message: `Custom YAML tag is not allowed: ${tag}`,
        path,
      });
    }
  }

  if (node instanceof YAMLMap) {
    for (const item of node.items) {
      const key = isScalar(item.key) ? String(item.key.value) : "<complex-key>";
      diagnostics.push(...findUnsafeYamlFeatures(item.value, `${path}.${key}`));
    }
  } else if (node instanceof YAMLSeq) {
    node.items.forEach((item, index) => {
      diagnostics.push(...findUnsafeYamlFeatures(item, `${path}[${index}]`));
    });
  }

  return diagnostics;
}
