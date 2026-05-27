/**
 * Schema-only platform tool definitions for AI SDK `streamText`.
 *
 * These tools intentionally omit `execute` so calls can be handed to the
 * workflow runtime, queue, or UI approval flow before side effects occur.
 */
import { tool, type Tool } from "ai";
import type { z } from "zod";

import { browserTools } from "./browser.js";
import { codeTools } from "./code.js";
import { communicationTools } from "./communication.js";
import { deploymentTools } from "./deployment.js";
import { fileSystemTools } from "./file-system.js";
import { searchTools } from "./search.js";
import { shellTools } from "./shell.js";

// Re-export individual tool groups
export { browserTools } from "./browser.js";
export { codeTools } from "./code.js";
export { communicationTools } from "./communication.js";
export { deploymentTools } from "./deployment.js";
export { fileSystemTools } from "./file-system.js";
export { searchTools } from "./search.js";
export { shellTools } from "./shell.js";

/**
 * All tool definition objects (description + inputSchema only).
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

/** Helper to create an AI SDK schema-only tool from a definition. */
function makeTool<TInputSchema extends z.ZodType>(def: {
  description: string;
  inputSchema: TInputSchema;
}): Tool<z.output<TInputSchema>, never> {
  return tool({
    description: def.description,
    inputSchema: def.inputSchema,
  }) as Tool<z.output<TInputSchema>, never>;
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
