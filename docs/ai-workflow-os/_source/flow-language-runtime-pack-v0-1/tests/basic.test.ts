import { describe, expect, it } from "vitest";
import { parseFlowSource } from "../src/parser.js";
import { compileFlow } from "../src/compiler.js";
import fs from "node:fs";

describe(".flow parser/compiler", () => {
  it("parses and compiles social example", () => {
    const source = fs.readFileSync("examples/social_media_manager.flow", "utf8");
    const parsed = parseFlowSource(source);
    expect(parsed.ok).toBe(true);
    expect(parsed.document?.flow).toBe("0.1");

    const compiled = compileFlow(parsed.document!, source);
    expect(compiled.ok).toBe(true);
    expect(compiled.compiled?.jobs.daily_content).toBeTruthy();
  });
});
