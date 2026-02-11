import type { PromptContext, SkillDefinition, ToolDefinition } from "../types/index.js";

export class PromptBuilder {
  private systemPrompts: string[] = [];
  private userContexts: string[] = [];
  private tools: ToolDefinition[] = [];

  addSystemPrompt(prompt: string): this {
    this.systemPrompts.push(prompt);
    return this;
  }

  addUserContext(context: string): this {
    this.userContexts.push(context);
    return this;
  }

  addTool(tool: ToolDefinition): this {
    this.tools.push(tool);
    return this;
  }

  addTools(tools: ToolDefinition[]): this {
    this.tools.push(...tools);
    return this;
  }

  build(): PromptContext {
    return {
      systemPrompt: this.systemPrompts.join("\n\n"),
      userContext: this.userContexts.join("\n\n"),
      tools: this.tools,
    };
  }

  reset(): this {
    this.systemPrompts = [];
    this.userContexts = [];
    this.tools = [];
    return this;
  }

  static fromSkills(skills: SkillDefinition[]): PromptBuilder {
    const builder = new PromptBuilder();

    for (const skill of skills) {
      builder.addSystemPrompt(`# Skill: ${skill.name}\n${skill.description}`);
    }

    return builder;
  }

  static buildDefault(): PromptContext {
    return new PromptBuilder().addSystemPrompt("You are a helpful AI assistant.").build();
  }
}

export function buildSystemPrompt(input: {
  skills?: string[];
  relatedKnowledge?: string[];
}): string {
  const skills = input.skills ?? [];
  const knowledge = input.relatedKnowledge ?? [];

  const skillSection = skills.length
    ? `Skills:\n${skills.map((s) => `- ${s}`).join("\n")}`
    : "Skills:\n- none";

  const knowledgeSection = knowledge.length
    ? `Related Knowledge:\n${knowledge.map((k) => `- ${k}`).join("\n")}`
    : "Related Knowledge:\n- none";

  return [
    "You are the orchestrator agent.",
    "Follow plan -> act -> observe loop.",
    skillSection,
    knowledgeSection,
  ].join("\n\n");
}
