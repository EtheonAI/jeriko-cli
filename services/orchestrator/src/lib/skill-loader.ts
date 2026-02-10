import type { SkillDefinition } from "../types/index.js";

export class SkillLoader {
  private skills: Map<string, SkillDefinition> = new Map();

  register(skill: SkillDefinition): void {
    this.skills.set(skill.name, skill);
  }

  registerMany(skills: SkillDefinition[]): void {
    for (const skill of skills) {
      this.register(skill);
    }
  }

  get(name: string): SkillDefinition | undefined {
    return this.skills.get(name);
  }

  getAll(): SkillDefinition[] {
    return Array.from(this.skills.values());
  }

  has(name: string): boolean {
    return this.skills.has(name);
  }

  remove(name: string): boolean {
    return this.skills.delete(name);
  }

  clear(): void {
    this.skills.clear();
  }

  count(): number {
    return this.skills.size;
  }

  static loadFromDirectory(): SkillLoader {
    const loader = new SkillLoader();

    // Stub implementation - in production would read from filesystem
    // For now, return empty loader

    return loader;
  }

  static createWithDefaults(): SkillLoader {
    const loader = new SkillLoader();

    loader.register({
      name: "plan",
      description: "Create an execution plan for a task",
      parameters: {
        task: "string",
        steps: "array",
      },
    });

    loader.register({
      name: "schedule",
      description: "Schedule a task for later execution",
      parameters: {
        task: "string",
        scheduledTime: "string",
      },
    });

    return loader;
  }
}
