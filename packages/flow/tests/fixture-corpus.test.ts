import { readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { describe, expect, it } from "vitest";

const fixturesRoot = new URL("./fixtures", import.meta.url).pathname;
const validRoot = join(fixturesRoot, "valid");
const invalidRoot = join(fixturesRoot, "invalid");

const expectedValidFixtures = [
  "event-trigger.flow",
  "minimal-manual.flow",
  "scheduled-social.flow",
  "webhook-trigger.flow",
];

const expectedInvalidFixtures = [
  "duplicate-task-id.flow",
  "invalid-task-type.flow",
  "missing-flow.flow",
  "one-space-indent.flow",
  "tab-indent.flow",
  "unclosed-inline-list.flow",
  "unclosed-string.flow",
  "unknown-top-level-key.flow",
  "yaml-alias.flow",
  "yaml-anchor.flow",
  "yaml-directive.flow",
  "yaml-document-marker.flow",
  "yaml-merge-key.flow",
  "yaml-tag.flow",
];

function listFlowFixtures(root: string) {
  return readdirSync(root)
    .filter((file) => file.endsWith(".flow"))
    .sort();
}

function readFixture(root: string, file: string) {
  return readFileSync(join(root, file), "utf8");
}

describe("@repo/flow fixture corpus", () => {
  it("keeps a deterministic valid fixture set", () => {
    expect(listFlowFixtures(validRoot)).toEqual(expectedValidFixtures);

    for (const file of expectedValidFixtures) {
      const source = readFixture(validRoot, file);

      expect(source).toContain('flow: "0.1"');
      expect(source).toContain("jobs:");
      expect(source.trim().length).toBeGreaterThan(0);
    }
  });

  it("keeps a deterministic invalid fixture set with expected diagnostics", () => {
    expect(listFlowFixtures(invalidRoot)).toEqual(expectedInvalidFixtures);

    for (const file of expectedInvalidFixtures) {
      const source = readFixture(invalidRoot, file);
      const firstLine = source.split("\n")[0];

      expect(firstLine).toMatch(/^# expected: FLOW_PARSE_/);
      expect(source.trim().length).toBeGreaterThan(0);
    }
  });

  it("covers all YAML-only reserved syntax cases", () => {
    const reservedCases = new Map([
      ["yaml-alias.flow", "*shared_goal"],
      ["yaml-anchor.flow", "&shared_goal"],
      ["yaml-directive.flow", "%YAML 1.2"],
      ["yaml-document-marker.flow", "---"],
      ["yaml-merge-key.flow", "<<:"],
      ["yaml-tag.flow", "!unsafe"],
    ]);

    for (const [file, marker] of reservedCases) {
      const source = readFixture(invalidRoot, file);

      expect(basename(file)).toBe(file);
      expect(source).toContain(marker);
    }
  });
});
