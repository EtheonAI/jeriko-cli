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
    registry.registerMany(getBaseTools());
    return registry;
  }
}

const ENTRANCE_TOOLS: ToolDefinition[] = [
  { name: "file", description: "Read/write/edit files", inputSchema: { type: "object" } },
  { name: "match", description: "Search files/content", inputSchema: { type: "object" } },
  { name: "shell", description: "Execute shell commands", inputSchema: { type: "object" } },
  { name: "browser", description: "Start browser mode", inputSchema: { type: "object" } },
  { name: "search", description: "Search the web", inputSchema: { type: "object" } },
  { name: "message", description: "Emit user-facing messages", inputSchema: { type: "object" } },
  { name: "plan", description: "Create/update/advance plan", inputSchema: { type: "object" } },
  { name: "schedule", description: "Create/list/cancel schedules", inputSchema: { type: "object" } },
  { name: "map", description: "Run parallel subtasks", inputSchema: { type: "object" } },
  { name: "expose", description: "Expose sandbox service port", inputSchema: { type: "object" } },
  { name: "generate", description: "Enter generation mode", inputSchema: { type: "object" } },
  { name: "slides", description: "Enter slides mode", inputSchema: { type: "object" } },
];

export function getBaseTools(): ToolDefinition[] {
  return [...ENTRANCE_TOOLS];
}
