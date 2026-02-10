import type { ToolDefinition } from "../types/index.js";

export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();

  register(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
  }

  registerMany(tools: ToolDefinition[]): void {
    for (const tool of tools) {
      this.register(tool);
    }
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  getAll(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  remove(name: string): boolean {
    return this.tools.delete(name);
  }

  clear(): void {
    this.tools.clear();
  }

  count(): number {
    return this.tools.size;
  }

  filterByCategory(category: string): ToolDefinition[] {
    return this.getAll().filter((tool) => {
      const schema = tool.inputSchema as { category?: string };
      return schema.category === category;
    });
  }

  static createWithEntranceTools(): ToolRegistry {
    const registry = new ToolRegistry();

    const entranceTools: ToolDefinition[] = [
      {
        name: "plan",
        description: "Create a structured plan for completing a task",
        inputSchema: {
          type: "object",
          properties: {
            task: { type: "string" },
            steps: { type: "array", items: { type: "string" } },
          },
          required: ["task", "steps"],
        },
      },
      {
        name: "schedule",
        description: "Schedule a task for execution at a specific time",
        inputSchema: {
          type: "object",
          properties: {
            task: { type: "string" },
            scheduledTime: { type: "string", format: "date-time" },
          },
          required: ["task", "scheduledTime"],
        },
      },
    ];

    registry.registerMany(entranceTools);
    return registry;
  }
}
