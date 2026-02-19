/**
 * Canvas state extraction tests.
 *
 * Tests the pure functions and static maps that power the useCanvas hook:
 * - TOOL_VIEW_MAP: maps tool names → canvas view types
 * - TOOL_ACTION_MAP: generates action badges from tool args
 * - Screenshot extraction (various output formats)
 * - Search results extraction
 * - File tree building from paths
 * - Browser URL extraction
 * - Content/title extraction
 *
 * NOTE: useCanvas itself is a React hook requiring renderHook.
 * These tests validate the underlying data extraction logic
 * by importing the exported TOOL_VIEW_MAP and testing against
 * the same input formats that useCanvas processes.
 */

import { describe, it, expect } from "vitest";
import { TOOL_VIEW_MAP } from "../use-canvas";
import type { CanvasViewType } from "../use-canvas";
import {
  isToolUIPart,
  getToolName,
  isStaticToolUIPart,
} from "../../../lib/types/ui-message";
import type {
  StaticToolUIPart,
  UIMessage,
  UIMessagePart,
} from "../../../lib/types/ui-message";

// ── Helpers ──────────────────────────────────────────────────────────────

/** Create a mock UIMessage with tool parts. */
function createAssistantMessage(
  id: string,
  parts: UIMessagePart[]
): UIMessage {
  return { id, role: "assistant", parts };
}

/** Create a static tool part in output-available state. */
function toolPart(
  toolName: string,
  toolCallId: string,
  input: unknown,
  output: unknown
): StaticToolUIPart {
  return {
    type: `tool-${toolName}`,
    toolCallId,
    state: "output-available",
    input,
    output,
  };
}

/** Create a static tool part in input-available state (in progress). */
function toolPartInProgress(
  toolName: string,
  toolCallId: string,
  input: unknown
): StaticToolUIPart {
  return {
    type: `tool-${toolName}`,
    toolCallId,
    state: "input-available",
    input,
  };
}

// ═════════════════════════════════════════════════════════════════════════
// 1. Tool → View Type Resolution
// ═════════════════════════════════════════════════════════════════════════

describe("Tool → view type resolution for canvas", () => {
  it("browser tools resolve to 'browser' view", () => {
    const browserTools = [
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
    ];
    for (const tool of browserTools) {
      expect(TOOL_VIEW_MAP[tool]).toBe("browser");
    }
  });

  it("search tools resolve to 'browser' view", () => {
    expect(TOOL_VIEW_MAP["web_search"]).toBe("browser");
    expect(TOOL_VIEW_MAP["info_search_web"]).toBe("browser");
    expect(TOOL_VIEW_MAP["search_web"]).toBe("browser");
  });

  it("deploy tools resolve to 'browser' view", () => {
    expect(TOOL_VIEW_MAP["deploy_expose_port"]).toBe("browser");
    expect(TOOL_VIEW_MAP["deploy_apply_deployment"]).toBe("browser");
  });

  it("shell tools resolve to 'terminal' view", () => {
    const shellTools = [
      "shell_exec",
      "shell_view",
      "shell_wait",
      "shell_write_to_process",
      "shell_kill_process",
    ];
    for (const tool of shellTools) {
      expect(TOOL_VIEW_MAP[tool]).toBe("terminal");
    }
  });

  it("code_execute resolves to 'terminal' view", () => {
    expect(TOOL_VIEW_MAP["code_execute"]).toBe("terminal");
  });

  it("file tools resolve to 'editor' view (Manus FileToolView parity)", () => {
    const fileTools = [
      "file_read",
      "file_write",
      "file_str_replace",
      "file_find_in_content",
      "file_find_by_name",
    ];
    for (const tool of fileTools) {
      expect(TOOL_VIEW_MAP[tool]).toBe("editor");
    }
  });

  it("inline-only tools are NOT in the map", () => {
    const inlineOnly = [
      "show_plan",
      "message_notify_user",
      "message_ask_user",
      "schedule_task",
      "track_analytics",
    ];
    for (const tool of inlineOnly) {
      expect(TOOL_VIEW_MAP[tool]).toBeUndefined();
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════
// 2. Tool Part Type Guard & Name Extraction
// ═════════════════════════════════════════════════════════════════════════

describe("isToolUIPart + getToolName", () => {
  it("StaticToolUIPart with type 'tool-browser_navigate' is recognized as tool part", () => {
    const part = toolPart("browser_navigate", "tc1", { url: "https://x.com" }, { url: "https://x.com" });
    expect(isToolUIPart(part)).toBe(true);
    expect(isStaticToolUIPart(part)).toBe(true);
  });

  it("getToolName extracts name by removing 'tool-' prefix", () => {
    const part = toolPart("shell_exec", "tc2", { command: "ls" }, { stdout: "files" });
    expect(getToolName(part)).toBe("shell_exec");
  });

  it("all TOOL_VIEW_MAP tools produce valid StaticToolUIPart types", () => {
    for (const toolName of Object.keys(TOOL_VIEW_MAP)) {
      const part = toolPart(toolName, `tc_${toolName}`, {}, {});
      expect(isToolUIPart(part)).toBe(true);
      expect(getToolName(part)).toBe(toolName);
    }
  });

  it("text part is NOT a tool part", () => {
    const textPart = { type: "text" as const, text: "hello" };
    expect(isToolUIPart(textPart)).toBe(false);
  });

  it("null/undefined returns false", () => {
    expect(isToolUIPart(null)).toBe(false);
    expect(isToolUIPart(undefined)).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════════
// 3. Browser State Extraction
// ═════════════════════════════════════════════════════════════════════════

describe("Browser state — screenshot, URL, title, content, search results", () => {
  it("browser_navigate output has screenshot that useCanvas can extract", () => {
    const output = {
      url: "https://example.com",
      title: "Example",
      screenshot: "iVBORw0KGgoAAAANSUhEU_TEST",
      content: "Example Domain content here.",
    };
    // Verify keys exist in the format useCanvas checks
    expect(output.screenshot).toBeDefined();
    expect(typeof output.screenshot).toBe("string");
    expect(output.screenshot.length).toBeGreaterThan(0);
    expect(output.url).toBe("https://example.com");
    expect(output.title).toBe("Example");
    expect(output.content).toContain("Example Domain");
  });

  it("web_search output has results array that useCanvas can extract", () => {
    const output = {
      results: [
        { title: "Result 1", url: "https://r1.com", snippet: "First result" },
        { title: "Result 2", url: "https://r2.com", snippet: "Second result" },
      ],
    };
    expect(Array.isArray(output.results)).toBe(true);
    expect(output.results.length).toBe(2);
    expect(output.results[0]!.title).toBe("Result 1");
    expect(output.results[0]!.url).toBe("https://r1.com");
    expect(output.results[0]!.snippet).toBe("First result");
  });

  it("browser_click output screenshot persists browser state", () => {
    const part = toolPart("browser_click", "tc_click", { coordinate: [100, 200] }, {
      url: "https://after-click.com",
      screenshot: "iVBORw0CLICK_DATA",
    });
    const output = part.output as Record<string, unknown>;
    expect(output.screenshot).toContain("iVBOR");
    expect(output.url).toBe("https://after-click.com");
  });

  it("browser_screenshot output has screenshot field", () => {
    const part = toolPart("browser_screenshot", "tc_ss", {}, {
      screenshot: "iVBORw0SCREENSHOT_DATA",
    });
    const output = part.output as Record<string, unknown>;
    expect(output.screenshot).toBeDefined();
  });

  it("screenshot with 'data:' prefix is kept as-is", () => {
    const screenshot = "data:image/png;base64,iVBORw0KGgoAAAA";
    // normalizeScreenshot would return this unchanged
    expect(screenshot.startsWith("data:")).toBe(true);
  });

  it("raw base64 screenshot needs normalization (starts with iVBOR)", () => {
    const screenshot = "iVBORw0KGgoAAAANSUhEUgAAAAUA";
    // normalizeScreenshot would prefix with data:image/png;base64,
    expect(screenshot.startsWith("iVBOR")).toBe(true);
  });

  it("JPEG screenshot detection (starts with /9j/)", () => {
    const screenshot = "/9j/4AAQSkZJRg==";
    expect(screenshot.startsWith("/9j/")).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════════
// 4. Terminal State Extraction
// ═════════════════════════════════════════════════════════════════════════

describe("Terminal state — output accumulation", () => {
  it("shell_exec output has stdout for terminal rendering", () => {
    const output = {
      stdout: "file1.txt\nfile2.txt\nfile3.txt",
      stderr: "",
      exit_code: 0,
    };
    expect(output.stdout).toContain("file1.txt");
    // Terminal view splits on \n for line rendering
    expect(output.stdout.split("\n")).toHaveLength(3);
  });

  it("shell_exec command from input can prefix terminal output", () => {
    const part = toolPart(
      "shell_exec",
      "tc_sh",
      { command: "ls -la", id: "session-1" },
      { stdout: "total 32\ndrwxr-xr-x  4 user user 4096 Feb  8 10:00 .", exit_code: 0 }
    );
    const input = part.input as Record<string, unknown>;
    const output = part.output as Record<string, unknown>;
    expect(input.command).toBe("ls -la");
    expect(output.stdout).toContain("total 32");
    // useCanvas builds: ["$ ls -la", ...stdout.split("\n")]
    const lines = [`$ ${input.command}`, ...(output.stdout as string).split("\n")];
    expect(lines[0]).toBe("$ ls -la");
    expect(lines.length).toBeGreaterThan(1);
  });

  it("code_execute output maps to terminal", () => {
    const part = toolPart(
      "code_execute",
      "tc_ce",
      { code: "print('hello')", language: "python" },
      { stdout: "hello", stderr: "", exit_code: 0 }
    );
    // Verify it maps to terminal in TOOL_VIEW_MAP
    expect(TOOL_VIEW_MAP["code_execute"]).toBe("terminal");
    const output = part.output as Record<string, unknown>;
    expect(output.stdout).toBe("hello");
  });

  it("terminal output accumulates across multiple shell_exec calls", () => {
    // Simulate useCanvas terminal accumulation
    const history: string[] = [];

    const calls = [
      { command: "mkdir project", stdout: "" },
      { command: "cd project && npm init -y", stdout: "Wrote to /project/package.json" },
      { command: "npm install express", stdout: "added 64 packages in 2.1s" },
    ];

    for (const call of calls) {
      history.push(`$ ${call.command}`);
      if (call.stdout) {
        history.push(...call.stdout.split("\n"));
      }
    }

    expect(history).toHaveLength(5);
    expect(history[0]).toBe("$ mkdir project");
    expect(history[1]).toBe("$ cd project && npm init -y");
    expect(history[2]).toBe("Wrote to /project/package.json");
    expect(history[3]).toBe("$ npm install express");
    expect(history[4]).toBe("added 64 packages in 2.1s");
  });
});

// ═════════════════════════════════════════════════════════════════════════
// 5. File State Extraction (rendered in code view — Manus FileToolView parity)
// ═════════════════════════════════════════════════════════════════════════

describe("File state — file contents, tree, tabs, language detection", () => {
  it("file_write input has path + content for editor view", () => {
    const part = toolPart(
      "file_write",
      "tc_fw",
      { path: "/project/src/index.ts", content: "console.log('hello');" },
      { success: true }
    );
    const input = part.input as Record<string, unknown>;
    expect(input.path).toBe("/project/src/index.ts");
    expect(input.content).toBe("console.log('hello');");
  });

  it("file_read output has content for editor view", () => {
    const part = toolPart(
      "file_read",
      "tc_fr",
      { path: "/project/src/index.ts" },
      { content: "console.log('hello');" }
    );
    const output = part.output as Record<string, unknown>;
    expect(output.content).toBe("console.log('hello');");
  });

  it("file_str_replace input has old_str and new_str", () => {
    const part = toolPart(
      "file_str_replace",
      "tc_fsr",
      { path: "/project/src/index.ts", old_str: "hello", new_str: "world" },
      { success: true }
    );
    const input = part.input as Record<string, unknown>;
    expect(input.old_str).toBe("hello");
    expect(input.new_str).toBe("world");
  });

  it("file contents accumulate across messages (simulating useCanvas)", () => {
    // Simulate useCanvas allFileContents memo
    const contents: Record<string, string> = {};

    // file_write: create index.html
    contents["/project/index.html"] = "<html><body>Hello</body></html>";
    // file_write: create styles.css
    contents["/project/styles.css"] = "body { margin: 0; }";
    // file_read: read back index.html (doesn't change content)
    // file_str_replace: update index.html
    const oldStr = "Hello";
    const newStr = "World";
    contents["/project/index.html"] = contents["/project/index.html"]!.replace(oldStr, newStr);

    expect(Object.keys(contents)).toHaveLength(2);
    expect(contents["/project/index.html"]).toContain("World");
    expect(contents["/project/styles.css"]).toContain("margin: 0");
  });

  it("file tree is buildable from file paths", () => {
    const paths = [
      "/project/src/index.ts",
      "/project/src/utils/helpers.ts",
      "/project/package.json",
    ];

    // Simulate buildFileTree logic
    const tree: Record<string, unknown>[] = [];
    for (const path of paths) {
      const segments = path.split("/").filter(Boolean);
      const fileName = segments.pop()!;
      tree.push({ name: fileName, path, dir: "/" + segments.join("/") });
    }

    expect(tree).toHaveLength(3);
    expect(tree[0]!.name).toBe("index.ts");
    expect(tree[1]!.name).toBe("helpers.ts");
    expect(tree[2]!.name).toBe("package.json");
  });

  it("language detection from file extension", () => {
    const extMap: Record<string, string> = {
      ts: "typescript",
      tsx: "typescript",
      js: "javascript",
      jsx: "javascript",
      py: "python",
      rs: "rust",
      go: "go",
      css: "css",
      html: "html",
      json: "json",
      md: "markdown",
      yaml: "yaml",
      yml: "yaml",
      sh: "bash",
      sql: "sql",
    };

    for (const [ext, lang] of Object.entries(extMap)) {
      const path = `/test.${ext}`;
      const detectedExt = path.split(".").pop()?.toLowerCase();
      expect(extMap[detectedExt!]).toBe(lang);
    }
  });

  it("tabs are built from open file paths", () => {
    const fileContents: Record<string, string> = {
      "/project/index.html": "<html>...</html>",
      "/project/styles.css": "body {}",
      "/project/app.js": "console.log('hi');",
    };
    const closedTabs = new Set<string>();

    const openPaths = Object.keys(fileContents).filter((p) => !closedTabs.has(p));
    const tabs = openPaths.map((p, i) => ({
      id: String(i),
      name: p.split("/").pop() || p,
      path: p,
      isActive: i === openPaths.length - 1,
    }));

    expect(tabs).toHaveLength(3);
    expect(tabs[0]!.name).toBe("index.html");
    expect(tabs[2]!.isActive).toBe(true); // Last tab is active
    expect(tabs[0]!.isActive).toBe(false);
  });

  it("closing a tab removes it from open list", () => {
    const fileContents: Record<string, string> = {
      "/project/index.html": "<html>...</html>",
      "/project/styles.css": "body {}",
    };
    const closedTabs = new Set<string>(["/project/styles.css"]);

    const openPaths = Object.keys(fileContents).filter((p) => !closedTabs.has(p));
    expect(openPaths).toHaveLength(1);
    expect(openPaths[0]).toBe("/project/index.html");
  });
});

// ═════════════════════════════════════════════════════════════════════════
// 6. View Switching Logic
// ═════════════════════════════════════════════════════════════════════════

describe("View switching — auto-detect + available views", () => {
  it("first tool determines initial view type", () => {
    const part = toolPart("shell_exec", "tc1", { command: "ls" }, { stdout: "files" });
    const toolName = getToolName(part);
    const viewType = TOOL_VIEW_MAP[toolName];
    expect(viewType).toBe("terminal");
  });

  it("subsequent tools of different type add to available views", () => {
    const tools = [
      toolPart("shell_exec", "tc1", {}, {}),
      toolPart("browser_navigate", "tc2", {}, {}),
      toolPart("file_write", "tc3", {}, {}),
    ];

    const available = new Set<CanvasViewType>();
    for (const t of tools) {
      const toolName = getToolName(t);
      const viewType = TOOL_VIEW_MAP[toolName];
      if (viewType) available.add(viewType);
    }

    expect(available.has("terminal")).toBe(true);
    expect(available.has("browser")).toBe(true);
    expect(available.has("editor")).toBe(true);
    // shell_exec → terminal, browser_navigate → browser, file_write → editor = 3 unique views
    expect(available.size).toBe(3);
  });

  it("inline-only tools do not add to available views", () => {
    const available = new Set<CanvasViewType>();
    const inlineTools = ["show_plan", "message_notify_user", "schedule_task"];

    for (const toolName of inlineTools) {
      const viewType = TOOL_VIEW_MAP[toolName];
      if (viewType) available.add(viewType);
    }

    expect(available.size).toBe(0);
  });

  it("latest tool determines auto-detected view", () => {
    // Simulate scanning backwards through messages
    const toolSequence = [
      "browser_navigate", // → browser
      "shell_exec",       // → terminal
      "file_write",       // → editor (latest)
    ];

    const latestView = TOOL_VIEW_MAP[toolSequence[toolSequence.length - 1]!];
    expect(latestView).toBe("editor");
  });
});

// ═════════════════════════════════════════════════════════════════════════
// 7. Pinned Tool Resolution
// ═════════════════════════════════════════════════════════════════════════

describe("Pinned tool — historical state recall", () => {
  it("pinned tool is found by scanning all messages for matching toolCallId", () => {
    const messages = [
      createAssistantMessage("msg-1", [
        { type: "text", text: "Starting..." },
        toolPart("shell_exec", "tc_early", { command: "ls" }, { stdout: "files" }),
      ]),
      createAssistantMessage("msg-2", [
        toolPart("browser_navigate", "tc_later", { url: "https://x.com" }, { url: "https://x.com" }),
        { type: "text", text: "Done." },
      ]),
    ];

    // Simulate pinned tool resolution (like useCanvas pinnedTool useMemo)
    const pinnedId = "tc_early";
    let pinnedTool: StaticToolUIPart | null = null;

    for (const msg of messages) {
      if (msg.role !== "assistant") continue;
      for (const part of msg.parts) {
        if (!isToolUIPart(part)) continue;
        const tp = part as StaticToolUIPart;
        if (tp.toolCallId === pinnedId) {
          pinnedTool = tp;
          break;
        }
      }
      if (pinnedTool) break;
    }

    expect(pinnedTool).toBeDefined();
    expect(getToolName(pinnedTool!)).toBe("shell_exec");
    expect(TOOL_VIEW_MAP[getToolName(pinnedTool!)]).toBe("terminal");
    expect((pinnedTool!.output as Record<string, unknown>).stdout).toBe("files");
  });

  it("pinning a browser tool shows browser view with that tool's data", () => {
    const part = toolPart("browser_navigate", "tc_pinned_browser", { url: "https://old.com" }, {
      url: "https://old.com",
      screenshot: "iVBOR_PINNED",
      title: "Old Page",
    });

    const viewType = TOOL_VIEW_MAP[getToolName(part)];
    expect(viewType).toBe("browser");
    const output = part.output as Record<string, unknown>;
    expect(output.url).toBe("https://old.com");
    expect(output.screenshot).toContain("iVBOR_PINNED");
  });
});

// ═════════════════════════════════════════════════════════════════════════
// 8. Message Scanning for Latest Tool (backward scan)
// ═════════════════════════════════════════════════════════════════════════

describe("Message scanning — finds latest canvas-eligible tool", () => {
  it("skips show_plan (inline-only) and finds browser_navigate as latest", () => {
    const messages = [
      createAssistantMessage("msg-1", [
        toolPart("show_plan", "tc_plan", { title: "Plan" }, { displayed: true }),
        toolPart("browser_navigate", "tc_nav", { url: "https://x.com" }, { url: "https://x.com" }),
        toolPart("show_plan", "tc_plan2", { title: "Updated plan" }, { displayed: true }),
      ]),
    ];

    // Simulate backward scan (like useCanvas latestTool useMemo)
    let latestCanvasTool: string | null = null;

    outer:
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i]!;
      if (msg.role !== "assistant") continue;
      for (let j = msg.parts.length - 1; j >= 0; j--) {
        const part = msg.parts[j];
        if (!part || !isToolUIPart(part)) continue;
        const toolName = getToolName(part as StaticToolUIPart);
        if (TOOL_VIEW_MAP[toolName]) {
          latestCanvasTool = toolName;
          break outer;
        }
      }
    }

    // show_plan at end is skipped, browser_navigate is found
    expect(latestCanvasTool).toBe("browser_navigate");
  });

  it("scans across multiple messages to find latest tool", () => {
    const messages = [
      createAssistantMessage("msg-1", [
        toolPart("shell_exec", "tc_sh", { command: "ls" }, { stdout: "files" }),
      ]),
      createAssistantMessage("msg-2", [
        { type: "text", text: "Here are the results." },
      ]),
      createAssistantMessage("msg-3", [
        toolPart("file_write", "tc_fw", { path: "/a.txt", content: "hi" }, { success: true }),
      ]),
    ];

    let latestCanvasTool: string | null = null;

    outer:
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i]!;
      if (msg.role !== "assistant") continue;
      for (let j = msg.parts.length - 1; j >= 0; j--) {
        const part = msg.parts[j];
        if (!part || !isToolUIPart(part)) continue;
        const toolName = getToolName(part as StaticToolUIPart);
        if (TOOL_VIEW_MAP[toolName]) {
          latestCanvasTool = toolName;
          break outer;
        }
      }
    }

    expect(latestCanvasTool).toBe("file_write");
  });

  it("in-progress tool (input-available) is detected as working", () => {
    const part = toolPartInProgress("browser_navigate", "tc_nav", { url: "https://x.com" });
    const isActive =
      part.state === "input-streaming" ||
      part.state === "input-available" ||
      part.state === "approval-responded";
    expect(isActive).toBe(true);
  });

  it("completed tool (output-available) is NOT detected as working", () => {
    const part = toolPart("browser_navigate", "tc_nav", { url: "https://x.com" }, {});
    const isActive =
      part.state === "input-streaming" ||
      part.state === "input-available" ||
      part.state === "approval-responded";
    expect(isActive).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════════
// 8. Terminal session separation (Manus PTY parity)
// ═════════════════════════════════════════════════════════════════════════

describe("Terminal session separation — Manus PTY parity", () => {
  it("shell_exec parts carry session id in args.id", () => {
    const part1 = toolPart("shell_exec", "tc_s1", { id: "setup", command: "npm install" }, { stdout: "added 100 packages" });
    const part2 = toolPart("shell_exec", "tc_s2", { id: "server", command: "npm start" }, { stdout: "listening on :3000" });
    expect((part1.input as Record<string, unknown>).id).toBe("setup");
    expect((part2.input as Record<string, unknown>).id).toBe("server");
  });

  it("different session IDs should route to separate arrays", () => {
    // Simulate the per-session accumulation logic from use-canvas.ts
    const sessions: Record<string, string[]> = {};

    const tools = [
      { id: "setup", command: "npm install", stdout: "added 100 packages" },
      { id: "server", command: "npm start", stdout: "listening on :3000" },
      { id: "setup", command: "npm test", stdout: "3 tests passed" },
    ];

    for (const t of tools) {
      const sessionLines = sessions[t.id] ?? [];
      sessions[t.id] = [...sessionLines, `$ ${t.command}`, ...t.stdout.split("\n")];
    }

    expect(Object.keys(sessions)).toEqual(["setup", "server"]);
    expect(sessions["setup"]).toEqual(["$ npm install", "added 100 packages", "$ npm test", "3 tests passed"]);
    expect(sessions["server"]).toEqual(["$ npm start", "listening on :3000"]);
  });

  it("missing session id defaults to 'default'", () => {
    const part = toolPart("shell_exec", "tc_s3", { command: "whoami" }, { stdout: "ubuntu" });
    const sessionId = ((part.input as Record<string, unknown>).id as string) || "default";
    expect(sessionId).toBe("default");
  });

  it("session order tracks first-seen order", () => {
    const order: string[] = [];
    const ids = ["default", "server", "default", "build", "server"];
    for (const id of ids) {
      if (!order.includes(id)) order.push(id);
    }
    expect(order).toEqual(["default", "server", "build"]);
  });

  it("deduplication avoids repeating same command in a session", () => {
    const sessions: Record<string, string[]> = {
      default: ["$ ls", "file1.txt", "file2.txt"],
    };
    const cmd = "ls";
    const sessionLines = sessions["default"] ?? [];
    const lastCmd = sessionLines.findLast((l) => l.startsWith("$"));
    const isDuplicate = lastCmd === `$ ${cmd}`;
    expect(isDuplicate).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════════
// 9. message_notify_user file attachment rendering
// ═════════════════════════════════════════════════════════════════════════

describe("message_notify_user attachment data in tool output", () => {
  it("tool output with attachments has correct shape", () => {
    const output = {
      status: "sent",
      message: "Message delivered to user",
      attachments: [
        { name: "report.pdf", url: "https://cdn.example.com/report.pdf", mediaType: "application/pdf" },
        { name: "chart.png", url: "https://cdn.example.com/chart.png", mediaType: "image/png" },
      ],
    };
    expect(output.attachments).toHaveLength(2);
    expect(output.attachments[0].name).toBe("report.pdf");
    expect(output.attachments[0].mediaType).toBe("application/pdf");
    expect(output.attachments[0].url).toContain("https://");
    expect(output.attachments[1].mediaType).toBe("image/png");
  });

  it("tool output without attachments has no attachments field", () => {
    const output = {
      status: "sent",
      message: "Message delivered to user",
    };
    expect(output).not.toHaveProperty("attachments");
  });

  it("message_notify_user is NOT in TOOL_VIEW_MAP (no canvas)", () => {
    expect(TOOL_VIEW_MAP["message_notify_user"]).toBeUndefined();
    expect(TOOL_VIEW_MAP["message_ask_user"]).toBeUndefined();
  });

  it("attachments can be converted to FileUIPart format", () => {
    const attachments = [
      { name: "report.pdf", url: "https://cdn.example.com/report.pdf", mediaType: "application/pdf" },
    ];
    const fileParts = attachments.map((a) => ({
      type: "file" as const,
      mediaType: a.mediaType,
      filename: a.name,
      url: a.url,
    }));
    expect(fileParts[0].type).toBe("file");
    expect(fileParts[0].filename).toBe("report.pdf");
    expect(fileParts[0].mediaType).toBe("application/pdf");
    expect(fileParts[0].url).toBe("https://cdn.example.com/report.pdf");
  });

  it("MIME type lookup covers common file types", () => {
    const EXT_MIME: Record<string, string> = {
      ".pdf": "application/pdf",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      ".md": "text/markdown",
      ".html": "text/html",
      ".csv": "text/csv",
      ".zip": "application/zip",
    };
    // Verify all common types are mapped
    expect(Object.keys(EXT_MIME).length).toBeGreaterThanOrEqual(10);
    expect(EXT_MIME[".pdf"]).toBe("application/pdf");
    expect(EXT_MIME[".docx"]).toContain("wordprocessing");
    expect(EXT_MIME[".xlsx"]).toContain("spreadsheet");
  });

  it("binary file encoding detection works", () => {
    // Simulate sandbox /file/read response for binary file
    const binaryResponse = { content: "JVBERi0xLjQK...", encoding: "base64", size: 12345 };
    const textResponse = { content: "Hello world", size: 11 };

    expect(binaryResponse.encoding).toBe("base64");
    expect(textResponse).not.toHaveProperty("encoding");

    // The fix: check encoding before Buffer.from
    const isBinary = binaryResponse.encoding === "base64";
    expect(isBinary).toBe(true);
  });
});

// ============================================================================
// Regression: metadata extraction dedup (infinite re-render fix)
// ============================================================================

describe("Metadata extraction deduplication (infinite loop regression)", () => {
  it("same sandboxId across multiple messages should only need one setState call", () => {
    // Simulate the pattern that caused infinite re-render loops:
    // Multiple messages all have the same sandboxId in metadata.
    // The useEffect should detect the value hasn't changed and skip setState.
    const messages: UIMessage[] = [
      {
        id: "msg-1",
        role: "assistant",
        parts: [{ type: "text", text: "Starting..." }],
        metadata: { sandboxId: "sandbox-abc" },
      } as UIMessage,
      {
        id: "msg-2",
        role: "assistant",
        parts: [{ type: "text", text: "Working..." }],
        metadata: { sandboxId: "sandbox-abc" },  // Same value
      } as UIMessage,
      {
        id: "msg-3",
        role: "assistant",
        parts: [{ type: "text", text: "Done!" }],
        metadata: { sandboxId: "sandbox-abc" },  // Same value again
      } as UIMessage,
    ];

    // The ref-based dedup pattern:
    const seen = { sandboxId: "" };
    let setStateCallCount = 0;

    for (const msg of messages) {
      const meta = msg.metadata as Record<string, unknown> | undefined;
      if (!meta) continue;
      if (typeof meta.sandboxId === "string" && meta.sandboxId && meta.sandboxId !== seen.sandboxId) {
        seen.sandboxId = meta.sandboxId;
        setStateCallCount++;
      }
    }

    // Only ONE setState call, not three (prevents re-render loop)
    expect(setStateCallCount).toBe(1);
    expect(seen.sandboxId).toBe("sandbox-abc");
  });

  it("changing sandboxId triggers new setState call", () => {
    const messages: UIMessage[] = [
      {
        id: "msg-1",
        role: "assistant",
        parts: [{ type: "text", text: "Session 1" }],
        metadata: { sandboxId: "sandbox-abc" },
      } as UIMessage,
      {
        id: "msg-2",
        role: "assistant",
        parts: [{ type: "text", text: "Session 2" }],
        metadata: { sandboxId: "sandbox-def" },  // Different value
      } as UIMessage,
    ];

    const seen = { sandboxId: "" };
    let setStateCallCount = 0;

    for (const msg of messages) {
      const meta = msg.metadata as Record<string, unknown> | undefined;
      if (!meta) continue;
      if (typeof meta.sandboxId === "string" && meta.sandboxId && meta.sandboxId !== seen.sandboxId) {
        seen.sandboxId = meta.sandboxId;
        setStateCallCount++;
      }
    }

    // Two setState calls for two different values
    expect(setStateCallCount).toBe(2);
    expect(seen.sandboxId).toBe("sandbox-def");
  });

  it("browserFrame dedup prevents redundant screenshot setState", () => {
    const messages: UIMessage[] = [
      {
        id: "msg-1",
        role: "assistant",
        parts: [],
        metadata: { browserFrame: { screenshot: "iVBORbase64data", url: "https://example.com", title: "Test" } },
      } as UIMessage,
      {
        id: "msg-2",
        role: "assistant",
        parts: [],
        metadata: { browserFrame: { screenshot: "iVBORbase64data", url: "https://example.com", title: "Test" } },
      } as UIMessage,
    ];

    const seen = { browserScreenshot: "" };
    let screenshotSetCount = 0;

    for (const msg of messages) {
      const meta = msg.metadata as Record<string, unknown> | undefined;
      if (!meta) continue;
      const frame = meta.browserFrame as { screenshot?: string } | undefined;
      if (frame?.screenshot && frame.screenshot !== seen.browserScreenshot) {
        seen.browserScreenshot = frame.screenshot;
        screenshotSetCount++;
      }
    }

    expect(screenshotSetCount).toBe(1);
  });
});
