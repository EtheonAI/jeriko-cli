import { describe, it, expect, beforeEach } from "vitest";
import { PromptBuilder } from "../lib/prompt-builder.js";

describe("PromptBuilder", () => {
  let builder: PromptBuilder;

  beforeEach(() => {
    builder = new PromptBuilder();
  });

  it("should build a basic prompt", () => {
    const result = builder
      .addSystemPrompt("You are a helpful assistant")
      .addUserContext("Help me with a task")
      .build();

    expect(result.systemPrompt).toBe("You are a helpful assistant");
    expect(result.userContext).toBe("Help me with a task");
    expect(result.tools).toEqual([]);
  });

  it("should add multiple system prompts", () => {
    const result = builder.addSystemPrompt("First prompt").addSystemPrompt("Second prompt").build();

    expect(result.systemPrompt).toBe("First prompt\n\nSecond prompt");
  });

  it("should add tools", () => {
    const tool = {
      name: "test-tool",
      description: "A test tool",
      inputSchema: { type: "object" },
    };

    const result = builder.addTool(tool).build();

    expect(result.tools).toHaveLength(1);
    expect(result.tools[0]).toEqual(tool);
  });

  it("should reset builder", () => {
    builder.addSystemPrompt("Test").addUserContext("Context").reset();

    const result = builder.build();

    expect(result.systemPrompt).toBe("");
    expect(result.userContext).toBe("");
    expect(result.tools).toEqual([]);
  });

  it("should create from skills", () => {
    const skills = [
      { name: "skill1", description: "First skill" },
      { name: "skill2", description: "Second skill" },
    ];

    const result = PromptBuilder.fromSkills(skills).build();

    expect(result.systemPrompt).toContain("skill1");
    expect(result.systemPrompt).toContain("skill2");
  });

  it("should build default prompt", () => {
    const result = PromptBuilder.buildDefault();

    expect(result.systemPrompt).toBe("You are a helpful AI assistant.");
    expect(result.tools).toEqual([]);
  });
});
