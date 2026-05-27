/**
 * Browser tool schemas kept for renderer compatibility.
 */
import { z } from "zod";

export const browserTools = {
  browser_view: {
    description:
      "View content of the current browser page. Use for checking the latest state of previously opened pages.",
    inputSchema: z.object({}),
  },
  browser_navigate: {
    description: "Navigate browser to specified URL. Use when accessing new pages is needed.",
    inputSchema: z.object({
      url: z.string().describe("Complete URL to visit. Must include protocol prefix."),
    }),
  },
  browser_restart: {
    description:
      "Restart browser and navigate to specified URL. Use when browser state needs to be reset.",
    inputSchema: z.object({
      url: z
        .string()
        .describe("Complete URL to visit after restart. Must include protocol prefix."),
    }),
  },
  browser_click: {
    description:
      "Click on elements in the current browser page. Use when clicking page elements is needed.",
    inputSchema: z.object({
      index: z.number().int().optional().describe("Index number of the element to click"),
      coordinate_x: z.number().optional().describe("X coordinate of click position"),
      coordinate_y: z.number().optional().describe("Y coordinate of click position"),
    }),
  },
  browser_input: {
    description:
      "Overwrite text in editable elements on the current browser page. Use when filling content in input fields.",
    inputSchema: z.object({
      index: z.number().int().optional().describe("Index number of the element to overwrite text"),
      coordinate_x: z.number().optional().describe("X coordinate of the element"),
      coordinate_y: z.number().optional().describe("Y coordinate of the element"),
      text: z.string().describe("Complete text content to overwrite"),
      press_enter: z.boolean().describe("Whether to press Enter key after input"),
    }),
  },
  browser_move_mouse: {
    description:
      "Move cursor to specified position on the current browser page. Use when simulating user mouse movement.",
    inputSchema: z.object({
      coordinate_x: z.number().describe("X coordinate of target cursor position"),
      coordinate_y: z.number().describe("Y coordinate of target cursor position"),
    }),
  },
  browser_press_key: {
    description:
      "Simulate key press in the current browser page. Use when specific keyboard operations are needed.",
    inputSchema: z.object({
      key: z
        .string()
        .describe(
          "Key name to simulate (e.g., Enter, Tab, ArrowUp), supports key combinations (e.g., Control+Enter)."
        ),
    }),
  },
  browser_select_option: {
    description:
      "Select specified option from dropdown list element in the current browser page. Use when selecting dropdown menu options.",
    inputSchema: z.object({
      index: z.number().int().describe("Index number of the dropdown list element"),
      option: z.number().int().describe("Option number to select, starting from 0"),
    }),
  },
  browser_scroll_up: {
    description:
      "Scroll up the current browser page. Use when viewing content above or returning to page top.",
    inputSchema: z.object({
      to_top: z
        .boolean()
        .optional()
        .describe("Whether to scroll directly to page top instead of one viewport up"),
    }),
  },
  browser_scroll_down: {
    description:
      "Scroll down the current browser page. Use when viewing content below or jumping to page bottom.",
    inputSchema: z.object({
      to_bottom: z
        .boolean()
        .optional()
        .describe("Whether to scroll directly to page bottom instead of one viewport down"),
    }),
  },
  browser_console_exec: {
    description:
      "Execute JavaScript code in browser console. Use when custom scripts need to be executed.",
    inputSchema: z.object({
      javascript: z
        .string()
        .describe(
          "JavaScript code to execute. Note that the runtime environment is browser console."
        ),
    }),
  },
  browser_console_view: {
    description:
      "View browser console output. Use when checking JavaScript logs or debugging page errors.",
    inputSchema: z.object({
      max_lines: z.number().int().optional().describe("Maximum number of log lines to return"),
    }),
  },
  browser_screenshot: {
    description: "Take a screenshot of the current browser page.",
    inputSchema: z.object({}),
  },
} as const;
