import { describe, it, expect } from "vitest";
import { TOOL_VIEW_MAP } from "../use-canvas";
import type { CanvasViewType } from "../use-canvas";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Collect all keys in TOOL_VIEW_MAP that map to a given view type. */
function keysForView(view: CanvasViewType): string[] {
  return Object.entries(TOOL_VIEW_MAP)
    .filter(([, v]) => v === view)
    .map(([k]) => k)
    .sort();
}

// ---------------------------------------------------------------------------
// 1. Browser tools -> "browser" (21 entries)
// ---------------------------------------------------------------------------

describe("TOOL_VIEW_MAP — browser tools", () => {
  const EXPECTED_BROWSER_TOOLS = [
    // Core browser interactions (15)
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
    "browser_console_view",
    "browser_screenshot",
    "browser_restart",
    // Search tools that surface in browser canvas (3)
    "info_search_web",
    "web_search",
    "search_web",
    // Deploy tools shown in browser canvas (2)
    "deploy_expose_port",
    "deploy_apply_deployment",
    // Manus page (1)
    "make_manus_page",
  ].sort();

  it("should contain exactly 21 browser entries", () => {
    const browserKeys = keysForView("browser");
    expect(browserKeys).toHaveLength(21);
  });

  it("should map every expected browser tool to 'browser'", () => {
    for (const tool of EXPECTED_BROWSER_TOOLS) {
      expect(TOOL_VIEW_MAP[tool], `${tool} should map to "browser"`).toBe(
        "browser"
      );
    }
  });

  it("should not have any extra browser entries beyond the expected set", () => {
    const browserKeys = keysForView("browser");
    expect(browserKeys).toEqual(EXPECTED_BROWSER_TOOLS);
  });
});

// ---------------------------------------------------------------------------
// 2. Terminal tools -> "terminal" (6 entries)
// ---------------------------------------------------------------------------

describe("TOOL_VIEW_MAP — terminal tools", () => {
  const EXPECTED_TERMINAL_TOOLS = [
    "shell_exec",
    "shell_view",
    "shell_wait",
    "shell_write_to_process",
    "shell_kill_process",
    "code_execute",
  ].sort();

  it("should contain exactly 6 terminal entries", () => {
    const terminalKeys = keysForView("terminal");
    expect(terminalKeys).toHaveLength(6);
  });

  it("should map every expected terminal tool to 'terminal'", () => {
    for (const tool of EXPECTED_TERMINAL_TOOLS) {
      expect(TOOL_VIEW_MAP[tool], `${tool} should map to "terminal"`).toBe(
        "terminal"
      );
    }
  });

  it("should not have any extra terminal entries beyond the expected set", () => {
    const terminalKeys = keysForView("terminal");
    expect(terminalKeys).toEqual(EXPECTED_TERMINAL_TOOLS);
  });
});

// ---------------------------------------------------------------------------
// 3. Code tools -> "code" (5 entries)
// ---------------------------------------------------------------------------

describe("TOOL_VIEW_MAP — code tools", () => {
  const EXPECTED_CODE_TOOLS = [
    "file_read",
    "file_write",
    "file_str_replace",
    "file_find_in_content",
    "file_find_by_name",
  ].sort();

  it("should contain exactly 5 code entries", () => {
    const codeKeys = keysForView("code");
    expect(codeKeys).toHaveLength(5);
  });

  it("should map every expected code tool to 'code'", () => {
    for (const tool of EXPECTED_CODE_TOOLS) {
      expect(TOOL_VIEW_MAP[tool], `${tool} should map to "code"`).toBe("code");
    }
  });

  it("should not have any extra code entries beyond the expected set", () => {
    const codeKeys = keysForView("code");
    expect(codeKeys).toEqual(EXPECTED_CODE_TOOLS);
  });
});

// ---------------------------------------------------------------------------
// 4. Inline-only tools should NOT be in the map
// ---------------------------------------------------------------------------

describe("TOOL_VIEW_MAP — inline-only tools are absent", () => {
  const INLINE_ONLY_TOOLS = [
    "show_plan",
    "message_notify_user",
    "message_ask_user",
    "generate_image",
    "schedule_task",
    "track_analytics",
  ];

  it.each(INLINE_ONLY_TOOLS)(
    "%s should NOT appear in TOOL_VIEW_MAP",
    (tool) => {
      expect(TOOL_VIEW_MAP[tool]).toBeUndefined();
    }
  );
});

// ---------------------------------------------------------------------------
// 5. Total entry count
// ---------------------------------------------------------------------------

describe("TOOL_VIEW_MAP — total count", () => {
  it("should have exactly 32 entries (21 browser + 6 terminal + 5 code)", () => {
    const totalKeys = Object.keys(TOOL_VIEW_MAP);
    expect(totalKeys).toHaveLength(32);
  });

  it("should have counts that add up: browser + terminal + code = total", () => {
    const browserCount = keysForView("browser").length;
    const terminalCount = keysForView("terminal").length;
    const codeCount = keysForView("code").length;
    const total = Object.keys(TOOL_VIEW_MAP).length;

    expect(browserCount + terminalCount + codeCount).toBe(total);
  });
});

// ---------------------------------------------------------------------------
// 6. No unexpected view types
// ---------------------------------------------------------------------------

describe("TOOL_VIEW_MAP — no unexpected view types", () => {
  const ALLOWED_VIEW_TYPES: CanvasViewType[] = ["browser", "terminal", "code"];

  it("every value should be one of: browser, terminal, code", () => {
    const viewTypes = new Set(Object.values(TOOL_VIEW_MAP));

    for (const vt of viewTypes) {
      expect(
        ALLOWED_VIEW_TYPES.includes(vt),
        `unexpected view type "${vt}" found in TOOL_VIEW_MAP`
      ).toBe(true);
    }
  });

  it("should use exactly the three expected view types", () => {
    const viewTypes = [...new Set(Object.values(TOOL_VIEW_MAP))].sort();
    expect(viewTypes).toEqual(["browser", "code", "terminal"]);
  });
});
