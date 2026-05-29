import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { lexFlowSource } from "../src/lexer/index.js";
import { createFlowSource } from "../src/source/index.js";

const fixturesRoot = new URL("./fixtures", import.meta.url).pathname;

function fixture(path: string) {
  return readFileSync(join(fixturesRoot, path), "utf8");
}

describe("@repo/flow lexer", () => {
  it("tokenizes a minimal manual workflow with indentation and inline values", () => {
    const source = createFlowSource(fixture("valid/minimal-manual.flow"), {
      id: "minimal-manual.flow",
    });

    const result = lexFlowSource(source);

    expect(result.ok).toBe(true);
    expect(result.diagnostics).toEqual([]);

    const kinds = result.stream?.tokens.map((token) => token.kind);
    expect(kinds).toContain("KEY");
    expect(kinds).toContain("COLON");
    expect(kinds).toContain("SCALAR_DOUBLE_QUOTED");
    expect(kinds).toContain("SCALAR_BARE");
    expect(kinds).toContain("INDENT");
    expect(kinds).toContain("DEDENT");
    expect(kinds?.at(-1)).toBe("EOF");
  });

  it("tokenizes block literals and inline scalar lists", () => {
    const source = createFlowSource(fixture("valid/scheduled-social.flow"), {
      id: "scheduled-social.flow",
    });

    const result = lexFlowSource(source);

    expect(result.ok).toBe(true);
    expect(result.stream?.tokens.some((token) => token.kind === "BLOCK_LITERAL_START")).toBe(true);
    expect(result.stream?.tokens.some((token) => token.kind === "BLOCK_LITERAL_TEXT")).toBe(true);
    expect(result.stream?.tokens.some((token) => token.kind === "INLINE_LIST_START")).toBe(true);
    expect(result.stream?.tokens.some((token) => token.kind === "INLINE_LIST_END")).toBe(true);
  });

  it.each([
    ["invalid/yaml-directive.flow", "YAML_DIRECTIVE"],
    ["invalid/yaml-document-marker.flow", "YAML_DOCUMENT_MARKER"],
    ["invalid/yaml-tag.flow", "YAML_TAG"],
    ["invalid/yaml-anchor.flow", "YAML_ANCHOR"],
    ["invalid/yaml-alias.flow", "YAML_ALIAS"],
    ["invalid/yaml-merge-key.flow", "YAML_MERGE_KEY"],
  ] as const)("rejects YAML-only syntax in %s", (fixturePath, tokenKind) => {
    const source = createFlowSource(fixture(fixturePath), {
      id: fixturePath,
    });

    const result = lexFlowSource(source);

    expect(result.ok).toBe(false);
    expect(result.stream?.tokens.some((token) => token.kind === tokenKind)).toBe(true);
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "FLOW_PARSE_YAML_FEATURE_UNSUPPORTED"
    );
  });

  it.each([
    ["invalid/tab-indent.flow", "FLOW_PARSE_TAB_INDENT"],
    ["invalid/one-space-indent.flow", "FLOW_PARSE_BAD_INDENT"],
    ["invalid/unclosed-string.flow", "FLOW_PARSE_UNTERMINATED_STRING"],
    ["invalid/unclosed-inline-list.flow", "FLOW_PARSE_UNTERMINATED_INLINE_LIST"],
  ] as const)("returns focused lexer diagnostics for %s", (fixturePath, diagnosticCode) => {
    const source = createFlowSource(fixture(fixturePath), {
      id: fixturePath,
    });

    const result = lexFlowSource(source);

    expect(result.ok).toBe(false);
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain(diagnosticCode);
    expect(result.diagnostics.every((diagnostic) => diagnostic.span)).toBe(true);
  });
});
