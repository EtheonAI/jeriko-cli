import type { ToolDefinition } from "../types/index.js";

type Mode = "plan" | "execute" | "normal";
type ExpansionMode = "browser" | "webdev" | "normal";

interface ModeState {
  current: Mode;
  previousMode?: Mode;
  transitionedAt: string;
}

export class ModeManager {
  private state: ModeState = {
    current: "normal",
    transitionedAt: new Date().toISOString(),
  };

  getCurrentMode(): Mode {
    return this.state.current;
  }

  setMode(mode: Mode): void {
    this.state.previousMode = this.state.current;
    this.state.current = mode;
    this.state.transitionedAt = new Date().toISOString();
  }

  isPlanMode(): boolean {
    return this.state.current === "plan";
  }

  isExecuteMode(): boolean {
    return this.state.current === "execute";
  }

  isNormalMode(): boolean {
    return this.state.current === "normal";
  }

  enterPlanMode(): void {
    this.setMode("plan");
  }

  enterExecuteMode(): void {
    this.setMode("execute");
  }

  enterNormalMode(): void {
    this.setMode("normal");
  }

  getState(): ModeState {
    return { ...this.state };
  }

  reset(): void {
    this.state = {
      current: "normal",
      transitionedAt: new Date().toISOString(),
    };
  }
}

const BROWSER_SUBTOOLS: ToolDefinition[] = [
  "browser_navigate",
  "browser_view",
  "browser_click",
  "browser_input",
  "browser_scroll",
  "browser_scroll_up",
  "browser_scroll_down",
  "browser_move_mouse",
  "browser_key_press",
  "browser_press_key",
  "browser_select_option",
  "browser_console_exec",
].map((name) => ({ name, description: `Browser subtool: ${name}`, inputSchema: { type: "object" } }));

const WEBDEV_TOOLS: ToolDefinition[] = [
  "webdev_init_project",
  "webdev_add_feature",
  "webdev_save_checkpoint",
  "webdev_check_status",
  "webdev_restart_server",
  "webdev_rollback_checkpoint",
  "webdev_execute_sql",
].map((name) => ({ name, description: `Webdev tool: ${name}`, inputSchema: { type: "object" } }));

export function expandToolsForMode(base: ToolDefinition[], mode: ExpansionMode): ToolDefinition[] {
  if (mode === "browser") return [...base, ...BROWSER_SUBTOOLS];
  if (mode === "webdev") return [...base, ...WEBDEV_TOOLS];
  return base;
}

export function isNestedSubcallTool(toolName: string): boolean {
  return toolName === "generate" || toolName === "slides";
}
