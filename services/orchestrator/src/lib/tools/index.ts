/**
 * Tool index — aggregates all tool categories into a single registry
 */

import type { ToolContext } from './types.js';
import { createMessageNotifyUserTool, createMessageAskUserTool } from './message-tools.js';
import { createFileTools } from './file-tools.js';
import { createShellTools } from './shell-tools.js';
import { createBrowserTools } from './browser-tools.js';
import { createCodeTools } from './code-tools.js';
import { createSearchTools } from './search-tools.js';
import { createDeployTools } from './deploy-tools.js';
import { createImageTools } from './image-tools.js';
import { createPlanTools } from './plan-tools.js';
import { createPageTools } from './page-tools.js';
import { createExtraTools } from './extra-tools.js';
import { createParallelTasksTool } from './parallel-tasks.js';

export type { ToolContext } from './types.js';

/**
 * Agent mode determines which tools are available.
 *
 * Manus pattern:
 *   - base: 29 core tools (always available)
 *   - browser: base + 13 browser tools (when browser task detected)
 *   - webdev: browser + 7 webdev tools (when webdev project detected)
 */
export type AgentMode = 'base' | 'browser' | 'webdev';

/**
 * Create all tools for a session context.
 * Returns a flat Record<string, Tool> ready to pass to streamText/generateText.
 *
 * @param ctx - Tool context
 * @param mode - Agent mode (defaults to 'browser' for full tool access)
 */
export function createAllTools(ctx: ToolContext, mode: AgentMode = 'browser') {
  // Base tools (always available)
  const baseTools = {
    // Communication (2)
    message_notify_user: createMessageNotifyUserTool(ctx),
    message_ask_user: createMessageAskUserTool(ctx),

    // File operations (5)
    ...createFileTools(ctx),

    // Shell operations (5)
    ...createShellTools(ctx),

    // Code execution (1)
    ...createCodeTools(ctx),

    // Web search (1)
    ...createSearchTools(ctx),

    // Image generation (1)
    ...createImageTools(ctx),

    // Plan, schedule, analytics (3)
    ...createPlanTools(ctx),

    // Page creation + idle (2)
    ...createPageTools(ctx),

    // Extra tools: text_editor, image utils, email, skills (9)
    ...createExtraTools(ctx),

    // Parallel tasks (1)
    ...createParallelTasksTool(ctx),
  };

  if (mode === 'base') {
    return baseTools as Record<string, unknown>;
  }

  // Browser mode: base + browser + deploy
  const browserTools = {
    ...baseTools,
    ...createBrowserTools(ctx),
    ...createDeployTools(ctx),
  };

  if (mode === 'browser') {
    return browserTools as Record<string, unknown>;
  }

  // Webdev mode: browser + all (same for now, extensible)
  return browserTools as Record<string, unknown>;
}

/**
 * Get the list of all tool names
 */
export function getAllToolNames(): string[] {
  return [
    // Communication
    'message_notify_user',
    'message_ask_user',
    // File
    'file_read',
    'file_write',
    'file_str_replace',
    'file_find_in_content',
    'file_find_by_name',
    // Shell
    'shell_exec',
    'shell_view',
    'shell_wait',
    'shell_write_to_process',
    'shell_kill_process',
    // Browser
    'browser_navigate',
    'browser_view',
    'browser_click',
    'browser_input',
    'browser_scroll_up',
    'browser_scroll_down',
    'browser_move_mouse',
    'browser_press_key',
    'browser_select_option',
    'browser_console_exec',
    'browser_console_view',
    'browser_screenshot',
    'browser_restart',
    // Code
    'code_execute',
    // Search
    'info_search_web',
    // Deploy
    'deploy_expose_port',
    'deploy_apply_deployment',
    // Image
    'generate_image',
    // Plan/Schedule/Analytics
    'show_plan',
    'schedule_task',
    'track_analytics',
    // Page/Idle
    'make_manus_page',
    'idle',
    // Extra: text editor, image utils, email, skills
    'text_editor',
    'image_rmbg',
    'image_search_upload',
    'gmail_send',
    'gmail_download',
    'outlook_send',
    'outlook_download',
    'skills_sync',
    'skills_package',
  ];
}
