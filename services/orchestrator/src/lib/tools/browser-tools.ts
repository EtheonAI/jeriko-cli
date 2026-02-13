/**
 * Browser tools — Control a Chromium browser inside the E2B sandbox.
 *
 * The browser runs inside the sandbox. All tool calls route through the
 * terminal server's /browser/action endpoint on port 8330.
 * Live view is via Neko WebRTC on port 8080.
 */

import { tool } from 'ai';
import { z } from 'zod';
import type { ToolContext } from './types.js';
import { executeSandboxTool } from './executor/sandbox-executor.js';

export function createBrowserTools(ctx: ToolContext) {
  return {
    browser_view: tool({
      description: `View content of the current browser page. Use for checking the latest state of previously opened pages.`,
      inputSchema: z.object({}),
      execute: async () => {
        return executeSandboxTool(ctx, 'browser_view', {});
      },
    }),

    browser_navigate: tool({
      description: `Navigate browser to specified URL. Use when accessing new pages is needed.`,
      inputSchema: z.object({
        url: z.string().describe('Complete URL to visit. Must include protocol prefix.'),
      }),
      execute: async (params) => {
        return executeSandboxTool(ctx, 'browser_navigate', params);
      },
    }),

    browser_restart: tool({
      description: `Restart browser and navigate to specified URL. Use when browser state needs to be reset.`,
      inputSchema: z.object({
        url: z.string().describe('Complete URL to visit after restart. Must include protocol prefix.'),
      }),
      execute: async (params) => {
        return executeSandboxTool(ctx, 'browser_restart', params);
      },
    }),

    browser_click: tool({
      description: `Click on elements in the current browser page. Use when clicking page elements is needed.

Provide either an element index from the page accessibility tree, or coordinate_x/coordinate_y for pixel-precise clicking.`,
      inputSchema: z.object({
        index: z.number().int().optional().describe('Index number of the element to click'),
        coordinate_x: z.number().optional().describe('X coordinate of click position'),
        coordinate_y: z.number().optional().describe('Y coordinate of click position'),
      }),
      execute: async (params) => {
        return executeSandboxTool(ctx, 'browser_click', params);
      },
    }),

    browser_input: tool({
      description: `Overwrite text in editable elements on the current browser page. Use when filling content in input fields.`,
      inputSchema: z.object({
        index: z.number().int().optional().describe('Index number of the element to overwrite text'),
        coordinate_x: z.number().optional().describe('X coordinate of the element to overwrite text'),
        coordinate_y: z.number().optional().describe('Y coordinate of the element to overwrite text'),
        text: z.string().describe('Complete text content to overwrite'),
        press_enter: z.boolean().describe('Whether to press Enter key after input'),
      }),
      execute: async (params) => {
        return executeSandboxTool(ctx, 'browser_input', params);
      },
    }),

    browser_move_mouse: tool({
      description: `Move cursor to specified position on the current browser page. Use when simulating user mouse movement.`,
      inputSchema: z.object({
        coordinate_x: z.number().describe('X coordinate of target cursor position'),
        coordinate_y: z.number().describe('Y coordinate of target cursor position'),
      }),
      execute: async (params) => {
        return executeSandboxTool(ctx, 'browser_move_mouse', params);
      },
    }),

    browser_press_key: tool({
      description: `Simulate key press in the current browser page. Use when specific keyboard operations are needed.`,
      inputSchema: z.object({
        key: z.string().describe('Key name to simulate (e.g., Enter, Tab, ArrowUp), supports key combinations (e.g., Control+Enter).'),
      }),
      execute: async (params) => {
        return executeSandboxTool(ctx, 'browser_press_key', params);
      },
    }),

    browser_select_option: tool({
      description: `Select specified option from dropdown list element in the current browser page.`,
      inputSchema: z.object({
        index: z.number().int().describe('Index number of the dropdown list element'),
        option: z.number().int().describe('Option number to select, starting from 0.'),
      }),
      execute: async (params) => {
        return executeSandboxTool(ctx, 'browser_select_option', params);
      },
    }),

    browser_scroll_up: tool({
      description: `Scroll up the current browser page. Use when viewing content above or returning to page top.`,
      inputSchema: z.object({
        to_top: z.boolean().optional().describe('Whether to scroll directly to page top instead of one viewport up.'),
      }),
      execute: async (params) => {
        return executeSandboxTool(ctx, 'browser_scroll_up', params);
      },
    }),

    browser_scroll_down: tool({
      description: `Scroll down the current browser page. Use when viewing content below or jumping to page bottom.`,
      inputSchema: z.object({
        to_bottom: z.boolean().optional().describe('Whether to scroll directly to page bottom instead of one viewport down.'),
      }),
      execute: async (params) => {
        return executeSandboxTool(ctx, 'browser_scroll_down', params);
      },
    }),

    browser_console_exec: tool({
      description: `Execute JavaScript code in browser console. Use when custom scripts need to be executed.`,
      inputSchema: z.object({
        javascript: z.string().describe('JavaScript code to execute. Note that the runtime environment is browser console.'),
      }),
      execute: async (params) => {
        return executeSandboxTool(ctx, 'browser_console_exec', params);
      },
    }),

    browser_console_view: tool({
      description: `View browser console output. Use when checking JavaScript logs or debugging page errors.`,
      inputSchema: z.object({
        max_lines: z.number().int().optional().describe('Maximum number of log lines to return.'),
      }),
      execute: async (params) => {
        return executeSandboxTool(ctx, 'browser_console_view', params);
      },
    }),

    browser_screenshot: tool({
      description: `Take a screenshot of the current browser viewport. Returns a base64-encoded PNG image.`,
      inputSchema: z.object({}),
      execute: async () => {
        return executeSandboxTool(ctx, 'browser_screenshot', {});
      },
    }),
  };
}
