import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { parseFlowCst } from "../src/parser/index.js";
import { createFlowSource } from "../src/source/index.js";

const fixturesRoot = new URL("./fixtures", import.meta.url).pathname;

function fixture(path: string) {
  return readFileSync(join(fixturesRoot, path), "utf8");
}

function parseFixture(path: string) {
  return parseFlowCst(
    createFlowSource(fixture(path), {
      id: path,
      path,
    })
  );
}

function walk(node: NonNullable<ReturnType<typeof parseFlowCst>["cst"]>["root"]) {
  return [node, ...node.children.flatMap((child) => walk(child))];
}

describe("@repo/flow CST parser", () => {
  it("parses a valid minimal workflow into a source-preserving CST", () => {
    const result = parseFixture("valid/minimal-manual.flow");

    expect(result.ok).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(result.cst?.sourceId).toBe("valid/minimal-manual.flow");
    expect(result.cst?.tokens.at(-1)?.kind).toBe("EOF");

    const rootChildren = result.cst?.root.children ?? [];
    expect(rootChildren.map((node) => node.key)).toEqual(["flow", "name", "goal", "jobs"]);
  });

  it("preserves block literals, inline lists, and sequences in scheduled workflows", () => {
    const result = parseFixture("valid/scheduled-social.flow");

    expect(result.ok).toBe(true);

    const nodes = walk(result.cst!.root);
    expect(nodes.some((node) => node.kind === "block_literal")).toBe(true);
    expect(nodes.some((node) => node.kind === "inline_list")).toBe(true);
    expect(nodes.some((node) => node.kind === "sequence")).toBe(true);
    expect(nodes.some((node) => node.kind === "sequence_item")).toBe(true);

    const goalBlock = nodes.find((node) => node.kind === "block_literal");
    expect(goalBlock?.value).toContain("Create daily social posts");
    expect(goalBlock?.tokenIds.length).toBeGreaterThan(1);
  });

  it("preserves comments as CST nodes and document comments", () => {
    const result = parseFlowCst(
      createFlowSource(
        [
          "# top-level comment",
          'flow: "0.1"',
          "name: comment_case # inline comment",
          'goal: "Keep comments."',
          "jobs:",
          "  main:",
          "    trigger:",
          "      type: manual",
          "    tasks:",
          "      - id: draft",
          "        type: ai_task",
        ].join("\n"),
        {
          id: "comments.flow",
        }
      )
    );

    expect(result.ok).toBe(true);
    expect(result.cst?.comments.map((comment) => comment.value)).toEqual([
      "top-level comment",
      "inline comment",
    ]);
  });

  it("returns lexer diagnostics without throwing on invalid source", () => {
    const result = parseFixture("invalid/yaml-anchor.flow");

    expect(result.ok).toBe(false);
    expect(result.cst?.tokens.some((token) => token.kind === "YAML_ANCHOR")).toBe(true);
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "FLOW_PARSE_YAML_FEATURE_UNSUPPORTED"
    );
  });
});
