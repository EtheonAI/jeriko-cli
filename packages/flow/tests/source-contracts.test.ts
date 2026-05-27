import { describe, expect, it } from "vitest";

import { flowCstDocumentSchema, flowCstNodeSchema } from "../src/cst/index.js";
import {
  flowTokenSchema,
  flowTokenStreamSchema,
  flowYamlReservedTokenKindSchema,
} from "../src/lexer/index.js";

const span = {
  start: {
    line: 1,
    column: 1,
    offset: 0,
  },
  end: {
    line: 1,
    column: 5,
    offset: 4,
  },
};

describe("@repo/flow source contracts", () => {
  it("validates custom .flow lexer tokens without a YAML parser dependency", () => {
    const token = flowTokenSchema.parse({
      id: "token_1",
      kind: "KEY",
      lexeme: "flow",
      value: "flow",
      span,
      indent: 0,
    });

    const stream = flowTokenStreamSchema.parse({
      sourceId: "workflow.flow",
      tokens: [
        token,
        {
          id: "token_2",
          kind: "COLON",
          lexeme: ":",
          span,
        },
        {
          id: "token_3",
          kind: "SCALAR_DOUBLE_QUOTED",
          lexeme: '"0.1"',
          value: "0.1",
          span,
        },
        {
          id: "token_4",
          kind: "EOF",
          lexeme: "",
          span,
        },
      ],
    });

    expect(stream.tokens.map((item) => item.kind)).toEqual([
      "KEY",
      "COLON",
      "SCALAR_DOUBLE_QUOTED",
      "EOF",
    ]);
  });

  it("keeps YAML-only syntax as reserved token classes for diagnostics", () => {
    expect(flowYamlReservedTokenKindSchema.options).toEqual([
      "YAML_DIRECTIVE",
      "YAML_DOCUMENT_MARKER",
      "YAML_TAG",
      "YAML_ANCHOR",
      "YAML_ALIAS",
      "YAML_MERGE_KEY",
    ]);
  });

  it("validates recursive CST documents with source spans and token references", () => {
    const scalar = flowCstNodeSchema.parse({
      id: "node_scalar_version",
      kind: "scalar",
      value: "0.1",
      span,
      tokenIds: ["token_3"],
    });

    const pair = flowCstNodeSchema.parse({
      id: "node_pair_flow",
      kind: "pair",
      key: "flow",
      span,
      tokenIds: ["token_1", "token_2"],
      children: [scalar],
    });

    const document = flowCstDocumentSchema.parse({
      sourceId: "workflow.flow",
      root: {
        id: "node_document",
        kind: "document",
        span,
        tokenIds: [],
        children: [pair],
      },
      tokens: [
        {
          id: "token_1",
          kind: "KEY",
          lexeme: "flow",
          span,
        },
      ],
    });

    expect(document.root.children[0]?.key).toBe("flow");
    expect(document.root.children[0]?.children[0]?.value).toBe("0.1");
  });
});
