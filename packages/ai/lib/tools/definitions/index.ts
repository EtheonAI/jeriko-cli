/**
 * Tool Definitions — Manus-aligned tool schemas for AI SDK streamText
 *
 * These are Zod-validated tool definitions matching the 28 Manus tools.
 * They are used with the AI SDK `streamText()` fallback path so the model
 * can call tools even when the agent service is unavailable.
 *
 * NOTE: In the fallback path these tools have no `execute` handler — they
 * return the tool call metadata to the client for rendering. The real
 * execution happens in the agent service.
 */
import { tool, type Tool } from "ai";

import { communicationTools } from "./communication";
import { fileSystemTools } from "./file-system";
import { shellTools } from "./shell";
import { browserTools } from "./browser";
import { searchTools } from "./search";
import { deploymentTools } from "./deployment";
import { codeTools } from "./code";

// Re-export individual tool groups
export { communicationTools } from "./communication";
export { fileSystemTools } from "./file-system";
export { shellTools } from "./shell";
export { browserTools } from "./browser";
export { searchTools } from "./search";
export { deploymentTools } from "./deployment";
export { codeTools } from "./code";

/**
 * All tool definition objects (description + parameters only).
 */
const allToolDefs = {
  ...communicationTools,
  ...fileSystemTools,
  ...shellTools,
  ...browserTools,
  ...searchTools,
  ...deploymentTools,
  ...codeTools,
} as const;

type ToolDefsMap = typeof allToolDefs;

/** Helper to create a tool from a def */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeTool(def: { description: string; parameters: any }): Tool<any, never> {
  return tool({ description: def.description, inputSchema: def.parameters }) as Tool<any, never>;
}

/**
 * Returns all 28+ tool definitions as AI SDK `tool()` objects
 * suitable for passing to `streamText({ tools })`.
 *
 * No `execute` handler — the tools are schema-only so the model
 * can generate tool calls that stream to the client for rendering.
 */
export function getAllToolDefinitions() {
  return {
    // Communication
    message_notify_user: makeTool(communicationTools.message_notify_user),
    message_ask_user: makeTool(communicationTools.message_ask_user),

    // File system
    file_read: makeTool(fileSystemTools.file_read),
    file_write: makeTool(fileSystemTools.file_write),
    file_str_replace: makeTool(fileSystemTools.file_str_replace),
    file_find_in_content: makeTool(fileSystemTools.file_find_in_content),
    file_find_by_name: makeTool(fileSystemTools.file_find_by_name),

    // Shell
    shell_exec: makeTool(shellTools.shell_exec),
    shell_view: makeTool(shellTools.shell_view),
    shell_wait: makeTool(shellTools.shell_wait),
    shell_write_to_process: makeTool(shellTools.shell_write_to_process),
    shell_kill_process: makeTool(shellTools.shell_kill_process),

    // Browser
    browser_view: makeTool(browserTools.browser_view),
    browser_navigate: makeTool(browserTools.browser_navigate),
    browser_restart: makeTool(browserTools.browser_restart),
    browser_click: makeTool(browserTools.browser_click),
    browser_input: makeTool(browserTools.browser_input),
    browser_move_mouse: makeTool(browserTools.browser_move_mouse),
    browser_press_key: makeTool(browserTools.browser_press_key),
    browser_select_option: makeTool(browserTools.browser_select_option),
    browser_scroll_up: makeTool(browserTools.browser_scroll_up),
    browser_scroll_down: makeTool(browserTools.browser_scroll_down),
    browser_console_exec: makeTool(browserTools.browser_console_exec),
    browser_console_view: makeTool(browserTools.browser_console_view),
    browser_screenshot: makeTool(browserTools.browser_screenshot),

    // Search
    info_search_web: makeTool(searchTools.info_search_web),

    // Deployment
    deploy_expose_port: makeTool(deploymentTools.deploy_expose_port),
    deploy_apply_deployment: makeTool(deploymentTools.deploy_apply_deployment),

    // Code
    code_execute: makeTool(codeTools.code_execute),
  };
}

/**
 * Returns the raw Zod schemas keyed by tool name.
 */
export function getToolSchemas(): ToolDefsMap {
  return allToolDefs;
}

/**
 * List of all tool names.
 */
export const TOOL_NAMES = Object.keys(allToolDefs) as (keyof ToolDefsMap)[];
