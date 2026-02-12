/**
 * Browser tools - Control a Playwright Chromium browser inside an E2B sandbox
 *
 * The browser runs inside the sandbox with a Playwright controller HTTP server
 * on port 9821. All tool calls are routed through the sandbox service which
 * proxies requests to the browser controller.
 *
 * Visual actions (navigate, click, input, scroll, select) automatically capture
 * a base64 PNG screenshot in the response so the AI can see the result.
 */

import { tool } from 'ai';
import { z } from 'zod';
import type { ToolContext } from './types.js';
import { executeSandboxTool } from './executor/sandbox-executor.js';

export function createBrowserTools(ctx: ToolContext) {
  return {
    browser_navigate: tool({
      description: `Navigate the browser to a specified URL. Returns the page title, URL, a text snapshot of the visible page content, and a screenshot (base64 PNG).

Use this to:
- Open a website or web application
- Navigate to a specific page by URL
- Load a local file served from the sandbox (e.g. http://localhost:PORT/path)

The returned content is a simplified text representation of the page. Use browser_screenshot if you need a fresh visual capture without navigating.`,
      inputSchema: z.object({
        url: z.string().describe('The URL to navigate to. Must be a fully qualified URL (e.g. https://example.com).'),
      }),
      execute: async (params) => {
        return executeSandboxTool(ctx, 'browser_navigate', {
          action: 'navigate',
          url: params.url,
        });
      },
    }),

    browser_view: tool({
      description: `Get the current page content, URL, and title without navigating away. Returns a text snapshot of the visible page content and a screenshot.

Use this to:
- Re-read the current page after waiting for dynamic content to load
- Check the current state of the page after a previous action
- Get an updated text representation of the page

This does NOT navigate or reload the page. It captures the current DOM state as-is.`,
      inputSchema: z.object({
        _: z.literal(true).optional().describe('No parameters needed'),
      }),
      execute: async () => {
        return executeSandboxTool(ctx, 'browser_view', {
          action: 'view',
        });
      },
    }),

    browser_click: tool({
      description: `Click at specific coordinates on the current page. Returns a screenshot after the click so you can see the result.

Use this to:
- Click buttons, links, tabs, checkboxes, radio buttons
- Open menus and dropdowns
- Interact with any clickable element

Coordinates are relative to the viewport (1280x720). Use a previous screenshot to identify the position of the element you want to click.

After clicking, the returned screenshot will show the result (e.g. a new page loaded, a dropdown opened, a modal appeared).`,
      inputSchema: z.object({
        x: z.number().describe('X coordinate in pixels from the left edge of the viewport (0-1280).'),
        y: z.number().describe('Y coordinate in pixels from the top edge of the viewport (0-720).'),
        button: z
          .enum(['left', 'right', 'middle'])
          .optional()
          .default('left')
          .describe('Mouse button to click. Defaults to left click.'),
      }),
      execute: async (params) => {
        return executeSandboxTool(ctx, 'browser_click', {
          action: 'click',
          x: params.x,
          y: params.y,
          button: params.button,
        });
      },
    }),

    browser_input: tool({
      description: `Click at coordinates to focus an input field, then type text into it. Returns a screenshot after typing.

Use this to:
- Fill in form fields (text inputs, textareas, search boxes)
- Type into content-editable areas
- Enter text into any focusable input element

The click happens first to focus the element, then the text is typed character by character. This clears any existing text in the field before typing.

If you need to append to existing text rather than replace it, use browser_click to position the cursor first, then browser_press_key to type individual characters.`,
      inputSchema: z.object({
        x: z.number().describe('X coordinate of the input field to click and focus (0-1280).'),
        y: z.number().describe('Y coordinate of the input field to click and focus (0-720).'),
        text: z.string().describe('The text to type into the focused input field.'),
      }),
      execute: async (params) => {
        return executeSandboxTool(ctx, 'browser_input', {
          action: 'input',
          x: params.x,
          y: params.y,
          text: params.text,
        });
      },
    }),

    browser_scroll_up: tool({
      description: `Scroll the page up by a specified number of pixels. Returns a screenshot of the new viewport position.

Use this to:
- Scroll back to content above the current viewport
- Return to the top of the page (use a large amount)
- View content that was previously scrolled past`,
      inputSchema: z.object({
        amount: z
          .number()
          .optional()
          .default(300)
          .describe('Number of pixels to scroll up. Defaults to 300. Use larger values (e.g. 1000) to scroll quickly.'),
      }),
      execute: async (params) => {
        return executeSandboxTool(ctx, 'browser_scroll_up', {
          action: 'scroll_up',
          amount: params.amount,
        });
      },
    }),

    browser_scroll_down: tool({
      description: `Scroll the page down by a specified number of pixels. Returns a screenshot of the new viewport position.

Use this to:
- View content below the current viewport
- Load lazy-loaded content by scrolling down
- Navigate through long pages, articles, or search results`,
      inputSchema: z.object({
        amount: z
          .number()
          .optional()
          .default(300)
          .describe('Number of pixels to scroll down. Defaults to 300. Use larger values (e.g. 1000) to scroll quickly.'),
      }),
      execute: async (params) => {
        return executeSandboxTool(ctx, 'browser_scroll_down', {
          action: 'scroll_down',
          amount: params.amount,
        });
      },
    }),

    browser_move_mouse: tool({
      description: `Move the mouse cursor to specific coordinates without clicking. Returns a screenshot showing the hover state.

Use this to:
- Hover over elements to reveal tooltips or dropdown menus
- Trigger hover states on interactive elements
- Preview what an element does before clicking it

Some UI elements only appear on hover (e.g. edit buttons, close icons, submenus).`,
      inputSchema: z.object({
        x: z.number().describe('X coordinate to move the mouse to (0-1280).'),
        y: z.number().describe('Y coordinate to move the mouse to (0-720).'),
      }),
      execute: async (params) => {
        return executeSandboxTool(ctx, 'browser_move_mouse', {
          action: 'move_mouse',
          x: params.x,
          y: params.y,
        });
      },
    }),

    browser_press_key: tool({
      description: `Press a keyboard key or key combination. Returns a screenshot after the key press.

Use this to:
- Submit forms (Enter)
- Navigate between fields (Tab)
- Close modals or cancel actions (Escape)
- Delete text (Backspace, Delete)
- Use keyboard shortcuts (e.g. Control+A, Control+C, Control+V)
- Navigate browser history (Alt+ArrowLeft, Alt+ArrowRight)

Key names follow Playwright conventions: Enter, Tab, Escape, Backspace, Delete, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Home, End, PageUp, PageDown, Control+A, etc.`,
      inputSchema: z.object({
        key: z.string().describe('Key to press. Examples: "Enter", "Tab", "Escape", "Backspace", "Control+A", "Control+C", "Control+V", "ArrowDown".'),
      }),
      execute: async (params) => {
        return executeSandboxTool(ctx, 'browser_press_key', {
          action: 'key_press',
          key: params.key,
        });
      },
    }),

    browser_select_option: tool({
      description: `Select an option from a <select> dropdown element. Clicks the dropdown at the given coordinates, then selects the option by value.

Use this to:
- Choose an item from a native HTML select dropdown
- Set form select fields to a specific value

First identify the <select> element position from a screenshot, then provide the value attribute of the <option> you want to select.`,
      inputSchema: z.object({
        x: z.number().describe('X coordinate of the <select> element (0-1280).'),
        y: z.number().describe('Y coordinate of the <select> element (0-720).'),
        value: z.string().describe('The value attribute of the <option> to select.'),
      }),
      execute: async (params) => {
        return executeSandboxTool(ctx, 'browser_select_option', {
          action: 'select_option',
          x: params.x,
          y: params.y,
          value: params.value,
        });
      },
    }),

    browser_console_exec: tool({
      description: `Execute a JavaScript expression in the browser's console context and return the result.

Use this to:
- Extract data from the page (e.g. document.title, document.querySelectorAll)
- Manipulate the DOM programmatically
- Read JavaScript variables or application state
- Run complex queries that are easier in JS than visual interaction
- Debug page behavior

The expression is evaluated in the page context with access to the full DOM and any global JS variables. Return values are serialized to JSON.`,
      inputSchema: z.object({
        expression: z.string().describe('JavaScript expression to evaluate in the browser console. The result is returned as a serialized value.'),
      }),
      execute: async (params) => {
        return executeSandboxTool(ctx, 'browser_console_exec', {
          action: 'console_exec',
          expression: params.expression,
        });
      },
    }),

    browser_console_view: tool({
      description: `View recent browser console log entries (console.log, console.warn, console.error, etc.).

Use this to:
- Debug JavaScript errors on the page
- View application logs
- Check for warnings or errors after a page interaction
- Monitor network request failures logged to console

Returns the most recent console entries in chronological order.`,
      inputSchema: z.object({
        count: z
          .number()
          .optional()
          .default(20)
          .describe('Number of recent console entries to retrieve. Defaults to 20.'),
      }),
      execute: async (params) => {
        return executeSandboxTool(ctx, 'browser_console_view', {
          action: 'console_view',
          count: params.count,
        });
      },
    }),

    browser_screenshot: tool({
      description: `Take a screenshot of the current browser viewport. Returns a base64-encoded PNG image.

Use this to:
- Get a fresh visual capture of the current page state
- Verify the result of previous actions
- Capture the page for visual analysis without any side effects

This does not navigate, scroll, or interact with the page in any way. It purely captures what is currently visible in the 1280x720 viewport.`,
      inputSchema: z.object({
        _: z.literal(true).optional().describe('No parameters needed'),
      }),
      execute: async () => {
        return executeSandboxTool(ctx, 'browser_screenshot', {
          action: 'screenshot',
        });
      },
    }),

    browser_restart: tool({
      description: `Restart the browser instance inside the sandbox. This closes all tabs and creates a fresh browser session.

Use this when:
- The browser becomes unresponsive or crashes
- You need a clean browser state (clear cookies, storage, cache)
- A page is stuck in an infinite loop or consuming too many resources
- Browser actions are timing out repeatedly

After restart, you will need to navigate to a URL again. All previous browser state (cookies, localStorage, open tabs) will be lost.`,
      inputSchema: z.object({
        _: z.literal(true).optional().describe('No parameters needed'),
      }),
      execute: async () => {
        return executeSandboxTool(ctx, 'browser_restart', {
          action: 'restart',
        });
      },
    }),
  };
}
