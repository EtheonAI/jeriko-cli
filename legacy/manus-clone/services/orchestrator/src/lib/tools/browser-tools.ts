/**
 * Browser tools — Control a Chromium browser inside the E2B sandbox.
 *
 * The browser runs inside the sandbox. All tool calls route through the
 * sandbox runtime's /browser/action endpoint on port 8330.
 * Live view is via Neko WebRTC on port 8333.
 *
 * browser_view and browser_navigate return:
 *   - elements: list of interactive elements with indices (e.g. "[1] a {hint:"Login"} Login")
 *   - markdown: page content as markdown
 *   - screenshot: S3 URL of annotated screenshot with numbered bounding boxes
 *   - viewport: {width, height, devicePixelRatio}
 *
 * browser_click and browser_input support clicking by element index.
 */

import { tool, type JSONValue, type ToolSet } from "ai";
import { z } from "zod";
import type { ToolContext } from "./types.js";
import { executeSandboxTool } from "./executor/sandbox-executor.js";

/**
 * Strip screenshot from tool output before feeding back to LLM.
 * The full output (with S3 screenshot URL) goes to the frontend via tool-output-available.
 * The model only gets elements, markdown, status — no screenshot URL in context.
 */
function toJSONValue(value: unknown): JSONValue {
  return value === undefined ? null : (value as JSONValue);
}

async function runBrowserAction(
  ctx: ToolContext,
  action: string,
  params: Record<string, unknown>
): Promise<JSONValue> {
  return toJSONValue(await executeSandboxTool(ctx, action, params));
}

function browserModelOutput({ output }: { toolCallId: string; input: unknown; output: unknown }) {
  if (!output || typeof output !== "object") {
    return { type: "json" as const, value: toJSONValue(output) };
  }
  const o = output as Record<string, unknown>;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { screenshot, ...rest } = o;
  return { type: "json" as const, value: toJSONValue(rest) };
}

export function createBrowserTools(ctx: ToolContext): ToolSet {
  return {
    browser_view: tool({
      description: `View the current browser page. Returns interactive elements with indices, page content as markdown, and an annotated screenshot with numbered bounding boxes. Use element indices from this output to click or interact with elements.`,
      inputSchema: z.object({}),
      execute: async () => {
        return runBrowserAction(ctx, "browser_view", {});
      },
      toModelOutput: browserModelOutput,
    }),

    browser_navigate: tool({
      description: `Navigate browser to specified URL. Returns interactive elements with indices, page content as markdown, and an annotated screenshot. Use element indices from this output to interact with the page.`,
      inputSchema: z.object({
        url: z.string().describe("Complete URL to visit. Must include protocol prefix."),
        intent: z
          .enum(["informational", "transactional", "research"])
          .optional()
          .describe(
            "Navigation intent: informational=read content (default), transactional=fill forms/click buttons, research=detailed analysis"
          ),
        focus: z
          .string()
          .optional()
          .describe(
            "What to prioritize on the page (e.g., 'search box and filters', 'product details'). Helps narrow element indexing."
          ),
      }),
      execute: async (params) => {
        return runBrowserAction(ctx, "browser_navigate", params);
      },
      toModelOutput: browserModelOutput,
    }),

    browser_restart: tool({
      description: `Restart browser and navigate to specified URL. Use when browser state needs to be reset.`,
      inputSchema: z.object({
        url: z
          .string()
          .describe("Complete URL to visit after restart. Must include protocol prefix."),
      }),
      execute: async (params) => {
        return runBrowserAction(ctx, "browser_restart", params);
      },
      toModelOutput: browserModelOutput,
    }),

    browser_click: tool({
      description: `Click on an element in the current browser page. Provide either an element index from browser_view output (preferred), or coordinate_x/coordinate_y for pixel-precise clicking. After clicking, returns the updated page snapshot with new elements and screenshot.`,
      inputSchema: z.object({
        index: z
          .number()
          .int()
          .optional()
          .describe(
            "Index number of the element to click (from browser_view output). Preferred over coordinates."
          ),
        coordinate_x: z
          .number()
          .optional()
          .describe("X coordinate of click position (use only when index is not available)."),
        coordinate_y: z
          .number()
          .optional()
          .describe("Y coordinate of click position (use only when index is not available)."),
      }),
      execute: async (params) => {
        return runBrowserAction(ctx, "browser_click", params);
      },
      toModelOutput: browserModelOutput,
    }),

    browser_input: tool({
      description: `Overwrite text in an input field on the current browser page. Provide either an element index from browser_view output (preferred), or coordinate_x/coordinate_y to target the field.`,
      inputSchema: z.object({
        index: z
          .number()
          .int()
          .optional()
          .describe(
            "Index number of the input element (from browser_view output). Preferred over coordinates."
          ),
        coordinate_x: z.number().optional().describe("X coordinate of the input element."),
        coordinate_y: z.number().optional().describe("Y coordinate of the input element."),
        text: z.string().describe("Complete text content to enter."),
        press_enter: z.boolean().describe("Whether to press Enter key after input."),
      }),
      execute: async (params) => {
        return runBrowserAction(ctx, "browser_input", params);
      },
      toModelOutput: browserModelOutput,
    }),

    browser_move_mouse: tool({
      description: `Move cursor to specified position on the current browser page. Use when simulating user mouse movement.`,
      inputSchema: z.object({
        coordinate_x: z.number().describe("X coordinate of target cursor position"),
        coordinate_y: z.number().describe("Y coordinate of target cursor position"),
      }),
      execute: async (params) => {
        return runBrowserAction(ctx, "browser_move_mouse", params);
      },
      toModelOutput: browserModelOutput,
    }),

    browser_press_key: tool({
      description: `Simulate key press in the current browser page. Use when specific keyboard operations are needed.`,
      inputSchema: z.object({
        key: z
          .string()
          .describe(
            "Key name to simulate (e.g., Enter, Tab, ArrowUp), supports key combinations (e.g., Control+Enter)."
          ),
      }),
      execute: async (params) => {
        return runBrowserAction(ctx, "browser_press_key", params);
      },
      toModelOutput: browserModelOutput,
    }),

    browser_select_option: tool({
      description: `Select specified option from dropdown list element in the current browser page.`,
      inputSchema: z.object({
        index: z
          .number()
          .int()
          .describe("Index number of the dropdown list element (from browser_view output)."),
        option: z.number().int().describe("Option number to select, starting from 0."),
      }),
      execute: async (params) => {
        return runBrowserAction(ctx, "browser_select_option", params);
      },
      toModelOutput: browserModelOutput,
    }),

    browser_scroll_up: tool({
      description: `Scroll up the current browser page. Returns updated page snapshot with new elements after scrolling.`,
      inputSchema: z.object({
        to_top: z
          .boolean()
          .optional()
          .describe("Whether to scroll directly to page top instead of one viewport up."),
      }),
      execute: async (params) => {
        return runBrowserAction(ctx, "browser_scroll_up", params);
      },
      toModelOutput: browserModelOutput,
    }),

    browser_scroll_down: tool({
      description: `Scroll down the current browser page. Returns updated page snapshot with new elements after scrolling.`,
      inputSchema: z.object({
        to_bottom: z
          .boolean()
          .optional()
          .describe("Whether to scroll directly to page bottom instead of one viewport down."),
      }),
      execute: async (params) => {
        return runBrowserAction(ctx, "browser_scroll_down", params);
      },
      toModelOutput: browserModelOutput,
    }),

    browser_console_exec: tool({
      description: `Execute JavaScript code in browser console. Use when custom scripts need to be executed.`,
      inputSchema: z.object({
        javascript: z
          .string()
          .describe(
            "JavaScript code to execute. Note that the runtime environment is browser console."
          ),
      }),
      execute: async (params) => {
        return runBrowserAction(ctx, "browser_console_exec", params);
      },
    }),

    browser_console_view: tool({
      description: `View browser console output. Use when checking JavaScript logs or debugging page errors.`,
      inputSchema: z.object({
        max_lines: z.number().int().optional().describe("Maximum number of log lines to return."),
      }),
      execute: async (params) => {
        return runBrowserAction(ctx, "browser_console_view", params);
      },
    }),

    browser_screenshot: tool({
      description: `Take a screenshot of the current browser viewport. Returns the screenshot URL.`,
      inputSchema: z.object({}),
      execute: async () => {
        return runBrowserAction(ctx, "browser_screenshot", {});
      },
      toModelOutput: browserModelOutput,
    }),

    browser_save_image: tool({
      description: `Save an image from the current browser page to a file in the sandbox.`,
      inputSchema: z.object({
        index: z
          .number()
          .int()
          .describe("Index of the image element to save (from browser_view output)."),
        path: z.string().describe("Absolute file path to save the image to."),
      }),
      execute: async (params) => {
        return runBrowserAction(ctx, "browser_save_image", params);
      },
    }),

    browser_upload_file: tool({
      description: `Upload a file to a file input element on the current browser page.`,
      inputSchema: z.object({
        index: z
          .number()
          .int()
          .describe("Index of the file input element (from browser_view output)."),
        file: z.string().describe("Absolute path of the file to upload from the sandbox."),
      }),
      execute: async (params) => {
        return runBrowserAction(ctx, "browser_upload_file", params);
      },
      toModelOutput: browserModelOutput,
    }),

    browser_fill_form: tool({
      description: `Fill multiple form fields at once on the current browser page.`,
      inputSchema: z.object({
        fields: z
          .array(
            z.object({
              index: z.number().int().describe("Element index from browser_view output."),
              value: z.string().describe("Value to fill into the field."),
            })
          )
          .describe("Array of field index/value pairs to fill."),
      }),
      execute: async (params) => {
        return runBrowserAction(ctx, "browser_fill_form", params);
      },
      toModelOutput: browserModelOutput,
    }),

    browser_find_keyword: tool({
      description: `Search for text on the current browser page and highlight matches.`,
      inputSchema: z.object({
        keyword: z.string().describe("Text to search for on the page."),
      }),
      execute: async (params) => {
        return runBrowserAction(ctx, "browser_find_keyword", params);
      },
      toModelOutput: browserModelOutput,
    }),

    browser_close: tool({
      description: `Close the current browser window. Use when done with browser interaction.`,
      inputSchema: z.object({}),
      execute: async () => {
        return runBrowserAction(ctx, "browser_close", {});
      },
    }),
  };
}
