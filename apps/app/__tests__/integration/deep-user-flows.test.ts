/**
 * Deep User Flow Integration Tests
 *
 * Tests realistic end-to-end agent sessions simulating actual user tasks:
 *
 * 1. Building a slide presentation (slide_init → slide_modify → slide_present)
 * 2. Building a web app (file_write → shell_exec → deploy_expose_port)
 * 3. Searching online (web_search → browser_navigate → browser_view)
 * 4. Timeline/plan persistence across tool calls
 * 5. Message receiving pipeline: SSE → parts → DB save shape
 * 6. Terminal session: multiple shell commands with output accumulation
 * 7. Code editor/IDE: file_read → file_str_replace → file_read verification
 * 8. Image generation → CDN upload flow
 * 9. Email sending with connections
 * 10. Canvas state persistence: browser screenshots across navigations
 * 11. Neko/sandbox metadata propagation
 * 12. Error recovery: failed tool → retry → success
 * 13. Mixed skill activation: search + code + browser in single session
 */

import { describe, it, expect, beforeEach } from "vitest";
import { SSEProcessor } from "../../lib/chat/sse-processor";
import { TOOL_VIEW_MAP } from "@repo/ai/components/canvas/use-canvas";

// ============================================================================
// Helpers
// ============================================================================

function makeSSE(data: Record<string, unknown>): string {
  return `data: ${JSON.stringify(data)}`;
}

function isToolPart(part: Record<string, unknown>): boolean {
  return typeof part.type === "string" && (part.type as string).startsWith("tool-");
}

function getToolName(part: Record<string, unknown>): string {
  return (part.type as string).slice(5);
}

function toolStart(tool: string, input: Record<string, unknown>, id: string) {
  return makeSSE({ type: "tool_start", toolCallId: id, tool, input });
}

function toolResult(tool: string, result: Record<string, unknown>, id: string, success = true) {
  return makeSSE({ type: "tool_result", toolCallId: id, tool, success, result });
}

function content(text: string) {
  return makeSSE({ type: "content", content: text });
}

function sandboxInfo(sandboxId: string, nekoUrl?: string) {
  return makeSSE({ type: "sandbox_info", sandboxId, ...(nekoUrl ? { nekoUrl } : {}) });
}

function browserFrame(screenshot: string, url: string, title: string) {
  return makeSSE({ type: "browser_frame", screenshot, url, title });
}

// ============================================================================
// 1. Slide Presentation Flow
// ============================================================================

describe("User Flow: Building a Slide Presentation", () => {
  let processor: SSEProcessor;

  beforeEach(() => {
    processor = new SSEProcessor();
  });

  it("should process complete slide creation flow", () => {
    // Plan
    processor.process(toolStart("show_plan", {
      title: "Create Presentation",
      todos: [
        { id: "1", label: "Initialize slide project", status: "in_progress" },
        { id: "2", label: "Add slides with content", status: "pending" },
        { id: "3", label: "Add speaker notes", status: "pending" },
        { id: "4", label: "Start presentation", status: "pending" },
      ],
    }, "plan-1"));
    processor.process(toolResult("show_plan", {}, "plan-1"));

    // Step 1: Initialize
    processor.process(toolStart("slide_init", {
      title: "Q4 Review",
      theme: "corporate",
    }, "slide-init-1"));
    processor.process(toolResult("slide_init", {
      success: true,
      project_dir: "/home/user/q4-review",
      slides: [{ index: 0, title: "Q4 Review" }],
    }, "slide-init-1"));

    // Step 2: Modify slides
    processor.process(toolStart("slide_modify", {
      index: 0,
      title: "Q4 Business Review",
      content: "<h2>Revenue Growth</h2><ul><li>15% YoY increase</li></ul>",
    }, "slide-mod-1"));
    processor.process(toolResult("slide_modify", { success: true }, "slide-mod-1"));

    processor.process(toolStart("slide_modify", {
      index: 1,
      title: "Key Metrics",
      content: "<h2>Highlights</h2><ul><li>1M users</li><li>99.9% uptime</li></ul>",
    }, "slide-mod-2"));
    processor.process(toolResult("slide_modify", { success: true }, "slide-mod-2"));

    // Step 3: Add notes
    processor.process(toolStart("slide_add_notes", {
      index: 0,
      notes: "Emphasize the 15% growth compared to industry average of 8%.",
    }, "slide-notes-1"));
    processor.process(toolResult("slide_add_notes", { success: true }, "slide-notes-1"));

    // Step 4: Present
    processor.process(toolStart("slide_present", {
      project_dir: "/home/user/q4-review",
    }, "slide-present-1"));
    processor.process(toolResult("slide_present", {
      url: "https://3000-sandbox-abc.e2b.dev",
      success: true,
    }, "slide-present-1"));

    // Verify
    const toolParts = processor.collectedParts.filter(isToolPart);
    expect(toolParts).toHaveLength(6); // plan + init + 2 modify + notes + present

    // Verify tool names in order
    const toolNames = toolParts.map(getToolName);
    expect(toolNames).toEqual([
      "show_plan", "slide_init", "slide_modify", "slide_modify",
      "slide_add_notes", "slide_present",
    ]);

    // Verify all completed
    for (const part of toolParts) {
      expect(part.state).toBe("output-available");
    }

    // Verify slide_present has URL in output
    const presentPart = toolParts.find((p) => getToolName(p) === "slide_present");
    expect((presentPart!.output as Record<string, unknown>).url).toBe("https://3000-sandbox-abc.e2b.dev");
  });
});

// ============================================================================
// 2. Web App Building Flow
// ============================================================================

describe("User Flow: Building a Web App", () => {
  let processor: SSEProcessor;

  beforeEach(() => {
    processor = new SSEProcessor();
  });

  it("should process complete web app build flow with canvas transitions", () => {
    // Sandbox setup
    processor.process(sandboxInfo("sandbox-xyz", "https://neko.sandbox-xyz.e2b.dev"));

    // Plan
    processor.process(toolStart("show_plan", {
      title: "Build Todo App",
      todos: [
        { id: "1", label: "Create project files", status: "in_progress" },
        { id: "2", label: "Install dependencies", status: "pending" },
        { id: "3", label: "Start dev server", status: "pending" },
        { id: "4", label: "Verify in browser", status: "pending" },
      ],
    }, "plan-1"));
    processor.process(toolResult("show_plan", {}, "plan-1"));

    // Step 1: Write files → canvas should show "terminal"
    processor.process(toolStart("file_write", {
      file: "/home/user/todo-app/package.json",
      content: '{"name":"todo-app","dependencies":{"react":"^19"}}',
    }, "write-1"));
    processor.process(toolResult("file_write", {
      success: true, path: "/home/user/todo-app/package.json",
    }, "write-1"));
    expect(TOOL_VIEW_MAP["file_write"]).toBe("editor");

    processor.process(toolStart("file_write", {
      file: "/home/user/todo-app/src/App.tsx",
      content: "export default function App() { return <div>Todo App</div>; }",
    }, "write-2"));
    processor.process(toolResult("file_write", {
      success: true, path: "/home/user/todo-app/src/App.tsx",
    }, "write-2"));

    // Step 2: Install deps → canvas should show "terminal"
    processor.process(toolStart("shell_exec", {
      id: "main", exec_dir: "/home/user/todo-app", command: "npm install",
    }, "shell-1"));
    processor.process(toolResult("shell_exec", {
      stdout: "added 834 packages in 12s\n", stderr: "", exitCode: 0,
    }, "shell-1"));
    expect(TOOL_VIEW_MAP["shell_exec"]).toBe("terminal");

    // Step 3: Start dev server
    processor.process(toolStart("shell_exec", {
      id: "dev", exec_dir: "/home/user/todo-app", command: "npm run dev &",
    }, "shell-2"));
    processor.process(toolResult("shell_exec", {
      stdout: "VITE v7.0.0 ready in 534ms\n  ➜ Local: http://localhost:3000/\n",
      exitCode: 0,
    }, "shell-2"));

    // Step 4: Expose port → canvas should show "browser"
    processor.process(toolStart("deploy_expose_port", {
      port: 3000,
    }, "deploy-1"));
    processor.process(toolResult("deploy_expose_port", {
      url: "https://3000-sandbox-xyz.e2b.dev",
      port: 3000,
    }, "deploy-1"));
    expect(TOOL_VIEW_MAP["deploy_expose_port"]).toBe("browser");

    // Step 5: Navigate browser to verify
    processor.process(toolStart("browser_navigate", {
      url: "https://3000-sandbox-xyz.e2b.dev",
    }, "nav-1"));
    processor.process(toolResult("browser_navigate", {
      url: "https://3000-sandbox-xyz.e2b.dev",
      title: "Todo App",
      content: "Todo App",
      screenshot: "iVBOR_todo_app_screenshot",
      elements: [
        { index: 1, tag: "h1", text: "Todo App" },
        { index: 2, tag: "input", hint: "Add a todo" },
      ],
    }, "nav-1"));

    // Browser frame for live preview
    processor.process(browserFrame("iVBOR_live_frame", "https://3000-sandbox-xyz.e2b.dev", "Todo App"));

    // Final message
    processor.process(content("Your Todo app is ready! You can access it at https://3000-sandbox-xyz.e2b.dev"));

    // Verify
    const toolParts = processor.collectedParts.filter(isToolPart);
    expect(toolParts).toHaveLength(7); // plan + 2 writes + 2 shells + deploy + navigate

    const { parts } = processor.finalize();
    const textParts = parts.filter((p) => p.type === "text");
    expect(textParts).toHaveLength(1);
    expect((textParts[0]!.text as string)).toContain("Todo app is ready");
  });
});

// ============================================================================
// 3. Online Search Flow
// ============================================================================

describe("User Flow: Searching Online", () => {
  let processor: SSEProcessor;

  beforeEach(() => {
    processor = new SSEProcessor();
  });

  it("should process web search → navigate → extract info flow", () => {
    // Search
    processor.process(toolStart("web_search", {
      query: "TypeScript 5.9 new features 2026",
    }, "search-1"));
    processor.process(toolResult("web_search", {
      results: [
        { title: "TypeScript 5.9 Release Notes", url: "https://devblogs.microsoft.com/typescript/ts-5-9", snippet: "New features include..." },
        { title: "TS 5.9 Summary - Dev.to", url: "https://dev.to/ts59", snippet: "A comprehensive overview..." },
      ],
    }, "search-1"));
    expect(TOOL_VIEW_MAP["web_search"]).toBe("browser");

    // Navigate to first result
    processor.process(toolStart("browser_navigate", {
      url: "https://devblogs.microsoft.com/typescript/ts-5-9",
    }, "nav-1"));
    processor.process(toolResult("browser_navigate", {
      url: "https://devblogs.microsoft.com/typescript/ts-5-9",
      title: "TypeScript 5.9 Release Notes",
      content: "# TypeScript 5.9\n\n## New Features\n- Decorators\n- Satisfies operator improvements\n- Config file support",
      screenshot: "iVBOR_ts_page",
      elements: [
        { index: 1, tag: "a", text: "Decorators", hint: "Decorators section" },
        { index: 2, tag: "a", text: "Satisfies", hint: "Satisfies section" },
      ],
    }, "nav-1"));

    // Scroll down to read more
    processor.process(toolStart("browser_scroll_down", {}, "scroll-1"));
    processor.process(toolResult("browser_scroll_down", {
      screenshot: "iVBOR_ts_page_scrolled",
      content: "## Performance Improvements\n- 20% faster builds\n- Incremental checks optimized",
    }, "scroll-1"));

    // Screenshot for reference
    processor.process(toolStart("browser_screenshot", { full_page: false }, "ss-1"));
    processor.process(toolResult("browser_screenshot", {
      screenshot: "iVBOR_ts_full_screenshot",
    }, "ss-1"));

    // Verify all tool parts created
    const toolParts = processor.collectedParts.filter(isToolPart);
    expect(toolParts).toHaveLength(4); // search + navigate + scroll + screenshot

    // All should be browser canvas
    for (const part of toolParts) {
      expect(TOOL_VIEW_MAP[getToolName(part)]).toBe("browser");
    }

    // Search result should have results array in output
    const searchPart = toolParts[0]!;
    const output = searchPart.output as Record<string, unknown>;
    const results = output.results as unknown[];
    expect(results).toHaveLength(2);
  });
});

// ============================================================================
// 4. Timeline/Plan Persistence
// ============================================================================

describe("User Flow: Timeline/Plan Persistence", () => {
  let processor: SSEProcessor;

  beforeEach(() => {
    processor = new SSEProcessor();
  });

  it("should track plan status transitions through a full task", () => {
    // Initial plan
    processor.process(toolStart("show_plan", {
      title: "Research & Report",
      todos: [
        { id: "1", label: "Search for data", status: "in_progress" },
        { id: "2", label: "Analyze findings", status: "pending" },
        { id: "3", label: "Write report", status: "pending" },
      ],
    }, "plan-1"));
    processor.process(toolResult("show_plan", {}, "plan-1"));

    // Do search (step 1)
    processor.process(toolStart("web_search", { query: "AI market trends 2026" }, "s1"));
    processor.process(toolResult("web_search", { results: [{ title: "AI Trends" }] }, "s1"));

    // Update plan — step 1 completed, step 2 in progress
    processor.process(toolStart("show_plan", {
      title: "Research & Report",
      todos: [
        { id: "1", label: "Search for data", status: "completed" },
        { id: "2", label: "Analyze findings", status: "in_progress" },
        { id: "3", label: "Write report", status: "pending" },
      ],
    }, "plan-2"));
    processor.process(toolResult("show_plan", {}, "plan-2"));

    // Analyze (step 2)
    processor.process(toolStart("code_execute", {
      code: "import pandas as pd\ndf = pd.DataFrame({'metric': [1,2,3]})\nprint(df.describe())",
      language: "python",
    }, "code-1"));
    processor.process(toolResult("code_execute", {
      stdout: "       metric\ncount     3.0\nmean      2.0\n",
      exitCode: 0,
    }, "code-1"));

    // Update plan — step 2 completed, step 3 in progress
    processor.process(toolStart("show_plan", {
      title: "Research & Report",
      todos: [
        { id: "1", label: "Search for data", status: "completed" },
        { id: "2", label: "Analyze findings", status: "completed" },
        { id: "3", label: "Write report", status: "in_progress" },
      ],
    }, "plan-3"));
    processor.process(toolResult("show_plan", {}, "plan-3"));

    // Write report (step 3)
    processor.process(toolStart("file_write", {
      file: "/home/user/report.md",
      content: "# AI Market Trends 2026\n\n## Key Findings\n...",
    }, "write-1"));
    processor.process(toolResult("file_write", { success: true }, "write-1"));

    // Final plan — all completed
    processor.process(toolStart("show_plan", {
      title: "Research & Report",
      todos: [
        { id: "1", label: "Search for data", status: "completed" },
        { id: "2", label: "Analyze findings", status: "completed" },
        { id: "3", label: "Write report", status: "completed" },
      ],
    }, "plan-4"));
    processor.process(toolResult("show_plan", {}, "plan-4"));

    // Verify plan parts
    const planParts = processor.collectedParts.filter(
      (p) => isToolPart(p) && getToolName(p) === "show_plan"
    );
    expect(planParts).toHaveLength(4);

    // Verify latest plan has all steps completed
    const latestPlan = planParts[planParts.length - 1]!;
    const input = latestPlan.input as Record<string, unknown>;
    const todos = input.todos as Array<{ status: string }>;
    expect(todos.every((t) => t.status === "completed")).toBe(true);

    // Verify usePlannerState would find the LATEST show_plan
    // (walks messages backwards to find last show_plan tool part)
    const allParts = processor.collectedParts.filter(isToolPart);
    let lastPlanPart: Record<string, unknown> | null = null;
    for (let i = allParts.length - 1; i >= 0; i--) {
      if (getToolName(allParts[i]!) === "show_plan") {
        lastPlanPart = allParts[i]!;
        break;
      }
    }
    expect(lastPlanPart).toBe(latestPlan);
  });
});

// ============================================================================
// 5. Message Receiving Pipeline — DB Save Shape
// ============================================================================

describe("User Flow: Message Persistence Shape", () => {
  let processor: SSEProcessor;

  beforeEach(() => {
    processor = new SSEProcessor();
  });

  it("should produce correct parts shape for DB persistence after complete session", () => {
    // Sandbox info (not a part — it's metadata)
    processor.process(sandboxInfo("sandbox-123"));

    // Content
    processor.process(content("I'll help you build that."));

    // Tool
    processor.process(toolStart("file_write", {
      file: "/home/user/hello.py",
      content: "print('hello')",
    }, "t1"));
    processor.process(toolResult("file_write", { success: true }, "t1"));

    // More content
    processor.process(content("File created! Let me run it."));

    // Another tool
    processor.process(toolStart("shell_exec", {
      command: "python3 /home/user/hello.py",
    }, "t2"));
    processor.process(toolResult("shell_exec", {
      stdout: "hello\n", exitCode: 0,
    }, "t2"));

    // Final content
    processor.process(content("Done! The output is: hello"));

    // Finalize
    const { parts, closingSSE } = processor.finalize();

    // Verify parts structure matches what route.ts saves
    const textParts = parts.filter((p) => p.type === "text");
    const toolPartsList = parts.filter(isToolPart);

    expect(textParts).toHaveLength(3);
    expect(toolPartsList).toHaveLength(2);

    // Text parts should have text field
    for (const tp of textParts) {
      expect(typeof tp.text).toBe("string");
      expect((tp.text as string).length).toBeGreaterThan(0);
    }

    // Tool parts should have required fields for normalizeParts compatibility
    for (const toolPart of toolPartsList) {
      expect(toolPart.toolCallId).toBeDefined();
      expect(toolPart.toolName).toBeDefined();
      expect(toolPart.state).toBe("output-available");
      expect(toolPart.input).toBeDefined();
      expect(toolPart.output).toBeDefined();
      expect((toolPart.type as string).startsWith("tool-")).toBe(true);
    }

    // Verify closing SSE has finish-step event (SSEProcessor emits finish-step)
    expect(closingSSE).toContain('"type":"finish-step"');
  });

  it("should correctly serialize parts for JSON storage", () => {
    processor.process(content("Hello"));
    processor.process(toolStart("show_plan", {
      title: "Test", todos: [{ id: "1", label: "Step", status: "completed" }],
    }, "p1"));
    processor.process(toolResult("show_plan", {}, "p1"));

    const { parts } = processor.finalize();

    // Parts must be JSON-serializable (for DB jsonb column)
    const json = JSON.stringify(parts);
    const parsed = JSON.parse(json);
    expect(parsed).toEqual(parts);

    // No undefined values (would be stripped by JSON.stringify)
    for (const part of parts) {
      for (const [key, value] of Object.entries(part)) {
        expect(value).not.toBeUndefined();
      }
    }
  });
});

// ============================================================================
// 6. Terminal Session — Multiple Commands
// ============================================================================

describe("User Flow: Terminal Session", () => {
  let processor: SSEProcessor;

  beforeEach(() => {
    processor = new SSEProcessor();
  });

  it("should accumulate multiple shell commands with different outputs", () => {
    // Multiple shell commands in sequence
    const commands = [
      { cmd: "ls -la", stdout: "total 8\ndrwxr-xr-x 2 user user 4096\n", exit: 0 },
      { cmd: "python3 --version", stdout: "Python 3.12.1\n", exit: 0 },
      { cmd: "node --version", stdout: "v22.0.0\n", exit: 0 },
      { cmd: "cat nonexistent.txt", stdout: "", exit: 1, stderr: "cat: nonexistent.txt: No such file" },
    ];

    for (let i = 0; i < commands.length; i++) {
      const cmd = commands[i]!;
      const id = `shell-${i}`;
      processor.process(toolStart("shell_exec", {
        id: "main", command: cmd.cmd,
      }, id));
      processor.process(toolResult("shell_exec", {
        stdout: cmd.stdout,
        stderr: cmd.stderr || "",
        exitCode: cmd.exit,
      }, id, cmd.exit === 0));
    }

    const toolParts = processor.collectedParts.filter(isToolPart);
    expect(toolParts).toHaveLength(4);

    // All should be terminal view
    for (const part of toolParts) {
      expect(TOOL_VIEW_MAP[getToolName(part)]).toBe("terminal");
    }

    // Last command should be output-error (exit code 1)
    expect(toolParts[3]!.state).toBe("output-error");

    // First three should be output-available
    for (let i = 0; i < 3; i++) {
      expect(toolParts[i]!.state).toBe("output-available");
    }
  });

  it("should handle shell_view and shell_wait for long-running processes", () => {
    // Start long-running process
    processor.process(toolStart("shell_exec", {
      id: "server", command: "python3 -m http.server 8080 &",
    }, "exec-1"));
    processor.process(toolResult("shell_exec", {
      stdout: "Serving HTTP on 0.0.0.0 port 8080 ...\n", exitCode: 0,
    }, "exec-1"));

    // View output
    processor.process(toolStart("shell_view", { id: "server" }, "view-1"));
    processor.process(toolResult("shell_view", {
      content: "Serving HTTP on 0.0.0.0 port 8080 ...\n127.0.0.1 - - [15/Feb/2026] \"GET / HTTP/1.1\" 200 -",
    }, "view-1"));

    // Wait for completion
    processor.process(toolStart("shell_wait", { id: "server", seconds: 5 }, "wait-1"));
    processor.process(toolResult("shell_wait", { exitCode: 0, timedOut: false }, "wait-1"));

    // Kill process
    processor.process(toolStart("shell_kill_process", { id: "server" }, "kill-1"));
    processor.process(toolResult("shell_kill_process", { killed: true }, "kill-1"));

    const toolParts = processor.collectedParts.filter(isToolPart);
    expect(toolParts).toHaveLength(4);
    expect(toolParts.map(getToolName)).toEqual([
      "shell_exec", "shell_view", "shell_wait", "shell_kill_process",
    ]);
  });
});

// ============================================================================
// 7. Code Editor / IDE Flow
// ============================================================================

describe("User Flow: Code Editor / IDE", () => {
  let processor: SSEProcessor;

  beforeEach(() => {
    processor = new SSEProcessor();
  });

  it("should process file read → edit → verify flow", () => {
    // Read existing file
    processor.process(toolStart("file_read", {
      file: "/home/user/project/src/App.tsx",
    }, "read-1"));
    processor.process(toolResult("file_read", {
      content: "export default function App() {\n  return <div>Hello</div>;\n}",
      size: 63,
    }, "read-1"));

    // Edit file with str_replace
    processor.process(toolStart("file_str_replace", {
      file: "/home/user/project/src/App.tsx",
      old_str: "Hello",
      new_str: "Hello World",
    }, "replace-1"));
    processor.process(toolResult("file_str_replace", {
      success: true,
      replacements: 1,
    }, "replace-1"));

    // Verify edit
    processor.process(toolStart("file_read", {
      file: "/home/user/project/src/App.tsx",
    }, "read-2"));
    processor.process(toolResult("file_read", {
      content: "export default function App() {\n  return <div>Hello World</div>;\n}",
      size: 69,
    }, "read-2"));

    // Find related files
    processor.process(toolStart("file_find_by_name", {
      path: "/home/user/project/src",
      glob: "*.tsx",
    }, "find-1"));
    processor.process(toolResult("file_find_by_name", {
      files: ["/home/user/project/src/App.tsx", "/home/user/project/src/main.tsx"],
    }, "find-1"));

    // Search within files
    processor.process(toolStart("file_find_in_content", {
      path: "/home/user/project/src",
      regex: "import.*React",
    }, "grep-1"));
    processor.process(toolResult("file_find_in_content", {
      matches: [
        { file: "/home/user/project/src/main.tsx", line: 1, content: "import React from 'react';" },
      ],
    }, "grep-1"));

    // Text editor unified tool
    processor.process(toolStart("text_editor", {
      command: "view",
      path: "/home/user/project/src/App.tsx",
    }, "te-1"));
    processor.process(toolResult("text_editor", {
      content: "export default function App() {\n  return <div>Hello World</div>;\n}",
    }, "te-1"));

    const toolParts = processor.collectedParts.filter(isToolPart);
    expect(toolParts).toHaveLength(6);

    // All should map to "editor" canvas view (Manus FileToolView parity)
    for (const part of toolParts) {
      const toolName = getToolName(part);
      expect(TOOL_VIEW_MAP[toolName]).toBe("editor");
    }
  });
});

// ============================================================================
// 8. Image Generation Flow
// ============================================================================

describe("User Flow: Image Generation", () => {
  let processor: SSEProcessor;

  beforeEach(() => {
    processor = new SSEProcessor();
  });

  it("should process image generation with CDN upload", () => {
    processor.process(toolStart("generate_image", {
      prompt: "A modern logo for a tech startup called Rubic, minimalist design, purple gradient",
      size: "1024x1024",
    }, "img-1"));
    processor.process(toolResult("generate_image", {
      url: "https://cdn.rubic.dev/images/gen-abc123.png",
      path: "/home/user/rubic-logo.png",
    }, "img-1"));

    const toolParts = processor.collectedParts.filter(isToolPart);
    expect(toolParts).toHaveLength(1);

    const imgPart = toolParts[0]!;
    expect(getToolName(imgPart)).toBe("generate_image");
    expect(imgPart.state).toBe("output-available");

    const output = imgPart.output as Record<string, unknown>;
    expect(output.url).toContain("cdn.rubic.dev");

    // Image generation opens AI Canvas view (Manus parity)
    expect(TOOL_VIEW_MAP["generate_image"]).toBe("aiCanvas");
  });

  it("should process image background removal", () => {
    processor.process(toolStart("image_rmbg", {
      path: "/home/user/rubic-logo.png",
    }, "rmbg-1"));
    processor.process(toolResult("image_rmbg", {
      path: "/home/user/rubic-logo-nobg.png",
      success: true,
    }, "rmbg-1"));

    const toolParts = processor.collectedParts.filter(isToolPart);
    expect(toolParts).toHaveLength(1);
    expect(getToolName(toolParts[0]!)).toBe("image_rmbg");
  });
});

// ============================================================================
// 9. Email Flow with Connections
// ============================================================================

describe("User Flow: Email with Connections", () => {
  let processor: SSEProcessor;

  beforeEach(() => {
    processor = new SSEProcessor();
  });

  it("should process Gmail send flow", () => {
    processor.process(toolStart("gmail_send", {
      to: "alice@example.com",
      subject: "Q4 Report",
      body: "Please find the Q4 report attached.",
      action: "send",
    }, "gmail-1"));
    processor.process(toolResult("gmail_send", {
      success: true,
      messageId: "msg-123",
      threadId: "thread-456",
    }, "gmail-1"));

    const toolParts = processor.collectedParts.filter(isToolPart);
    expect(toolParts).toHaveLength(1);

    const emailPart = toolParts[0]!;
    expect(getToolName(emailPart)).toBe("gmail_send");
    expect(emailPart.state).toBe("output-available");
  });

  it("should process Outlook download flow", () => {
    processor.process(toolStart("outlook_download", {
      messageId: "msg-789",
      attachmentIndex: 0,
    }, "outlook-1"));
    processor.process(toolResult("outlook_download", {
      path: "/home/user/Downloads/report.xlsx",
      filename: "report.xlsx",
      size: 45678,
    }, "outlook-1"));

    const toolParts = processor.collectedParts.filter(isToolPart);
    expect(toolParts).toHaveLength(1);
    expect(getToolName(toolParts[0]!)).toBe("outlook_download");
  });
});

// ============================================================================
// 10. Canvas State Persistence — Browser Screenshots
// ============================================================================

describe("User Flow: Canvas State Persistence", () => {
  let processor: SSEProcessor;

  beforeEach(() => {
    processor = new SSEProcessor();
  });

  it("should persist browser state across multiple navigations", () => {
    // First navigation
    processor.process(toolStart("browser_navigate", {
      url: "https://google.com",
    }, "nav-1"));
    processor.process(toolResult("browser_navigate", {
      url: "https://google.com",
      title: "Google",
      screenshot: "iVBOR_google",
      elements: [{ index: 1, tag: "input", hint: "Search" }],
    }, "nav-1"));

    // Type in search
    processor.process(toolStart("browser_input", {
      index: 1,
      text: "Rubic AI platform",
      press_enter: true,
    }, "input-1"));
    processor.process(toolResult("browser_input", {
      screenshot: "iVBOR_google_results",
      url: "https://google.com/search?q=Rubic+AI+platform",
    }, "input-1"));

    // Click a result
    processor.process(toolStart("browser_click", {
      index: 3,
    }, "click-1"));
    processor.process(toolResult("browser_click", {
      screenshot: "iVBOR_rubic_page",
      url: "https://rubic.dev",
      title: "Rubic - AI Platform",
    }, "click-1"));

    // All three should be browser view
    const toolParts = processor.collectedParts.filter(isToolPart);
    expect(toolParts).toHaveLength(3);

    for (const part of toolParts) {
      expect(TOOL_VIEW_MAP[getToolName(part)]).toBe("browser");
    }

    // Each tool result has a screenshot for canvas rendering
    for (const part of toolParts) {
      const output = part.output as Record<string, unknown>;
      expect(output.screenshot).toBeDefined();
      expect(typeof output.screenshot).toBe("string");
    }

    // URLs progressed through the navigation
    const urls = toolParts.map((p) => (p.output as Record<string, unknown>).url);
    expect(urls).toEqual([
      "https://google.com",
      "https://google.com/search?q=Rubic+AI+platform",
      "https://rubic.dev",
    ]);
  });
});

// ============================================================================
// 11. Sandbox Metadata Propagation
// ============================================================================

describe("User Flow: Sandbox/Neko Metadata", () => {
  let processor: SSEProcessor;

  beforeEach(() => {
    processor = new SSEProcessor();
  });

  it("should propagate sandbox_info with sandboxId and nekoUrl", () => {
    const output = processor.process(sandboxInfo("sandbox-abc-123", "https://neko.sandbox-abc-123.e2b.dev"));

    expect(output).toContain('"type":"message-metadata"');
    expect(output).toContain('"sandboxId":"sandbox-abc-123"');
    expect(output).toContain('"nekoUrl":"https://neko.sandbox-abc-123.e2b.dev"');
  });

  it("should propagate browser_frame with screenshot and URL", () => {
    const output = processor.process(browserFrame(
      "iVBOR_desktop_screenshot",
      "about:blank",
      "New Tab",
    ));

    expect(output).toContain('"type":"message-metadata"');
    expect(output).toContain('"browserFrame"');
  });

  it("should handle session lifecycle events", () => {
    const created = processor.process(makeSSE({
      type: "session_created",
      sessionId: "sess-new",
    }));
    expect(created).toContain("message-metadata");

    const reconnected = processor.process(makeSSE({
      type: "session_reconnected",
      sessionId: "sess-new",
    }));
    expect(reconnected).toContain("message-metadata");
  });
});

// ============================================================================
// 12. Error Recovery — Failed Tool → Retry → Success
// ============================================================================

describe("User Flow: Error Recovery", () => {
  let processor: SSEProcessor;

  beforeEach(() => {
    processor = new SSEProcessor();
  });

  it("should handle tool failure and retry with updated plan", () => {
    // Initial attempt
    processor.process(toolStart("browser_navigate", {
      url: "https://flaky-site.com",
    }, "nav-1"));
    processor.process(toolResult("browser_navigate", {
      error: "Navigation timeout: page took too long to load",
    }, "nav-1", false));

    // Plan update showing retry
    processor.process(toolStart("show_plan", {
      title: "Fetch Data",
      todos: [
        { id: "1", label: "Navigate to website", status: "in_progress" },
        { id: "2", label: "Extract data", status: "pending" },
      ],
    }, "plan-retry"));
    processor.process(toolResult("show_plan", {}, "plan-retry"));

    // Retry
    processor.process(toolStart("browser_navigate", {
      url: "https://flaky-site.com",
    }, "nav-2"));
    processor.process(toolResult("browser_navigate", {
      url: "https://flaky-site.com",
      title: "Flaky Site",
      screenshot: "iVBOR_success",
    }, "nav-2"));

    const toolParts = processor.collectedParts.filter(isToolPart);
    expect(toolParts).toHaveLength(3); // nav-fail + plan + nav-success

    // First nav should be error
    const firstNav = toolParts.find((p) => p.toolCallId === "nav-1")!;
    expect(firstNav.state).toBe("output-error");

    // Second nav should be success
    const secondNav = toolParts.find((p) => p.toolCallId === "nav-2")!;
    expect(secondNav.state).toBe("output-available");
  });
});

// ============================================================================
// 13. Mixed Skills — Search + Code + Browser
// ============================================================================

describe("User Flow: Mixed Skills in Single Session", () => {
  let processor: SSEProcessor;

  beforeEach(() => {
    processor = new SSEProcessor();
  });

  it("should handle interleaved search, code, and browser tools", () => {
    // Search first
    processor.process(toolStart("web_search", {
      query: "pandas dataframe tutorial",
    }, "search-1"));
    processor.process(toolResult("web_search", {
      results: [{ title: "Pandas Guide", url: "https://pandas.pydata.org" }],
    }, "search-1"));

    // Write code based on search
    processor.process(toolStart("file_write", {
      file: "/home/user/analysis.py",
      content: "import pandas as pd\ndf = pd.read_csv('data.csv')\nprint(df.head())",
    }, "write-1"));
    processor.process(toolResult("file_write", { success: true }, "write-1"));

    // Execute the code
    processor.process(toolStart("code_execute", {
      code: "import pandas as pd\ndf = pd.DataFrame({'a': [1,2,3]})\nprint(df.describe())",
      language: "python",
    }, "exec-1"));
    processor.process(toolResult("code_execute", {
      stdout: "         a\ncount  3.0\nmean   2.0\n",
      exitCode: 0,
    }, "exec-1"));

    // Navigate to docs for reference
    processor.process(toolStart("browser_navigate", {
      url: "https://pandas.pydata.org/docs/reference/api/pandas.DataFrame.html",
    }, "nav-1"));
    processor.process(toolResult("browser_navigate", {
      url: "https://pandas.pydata.org/docs/reference/api/pandas.DataFrame.html",
      title: "pandas.DataFrame",
      screenshot: "iVBOR_pandas_docs",
    }, "nav-1"));

    // Generate chart
    processor.process(toolStart("code_execute", {
      code: "import matplotlib.pyplot as plt\nplt.bar([1,2,3], [10,20,15])\nplt.savefig('/home/user/chart.png')",
      language: "python",
    }, "exec-2"));
    processor.process(toolResult("code_execute", {
      stdout: "", exitCode: 0,
    }, "exec-2"));

    // Verify canvas view transitions
    const toolParts = processor.collectedParts.filter(isToolPart);
    expect(toolParts).toHaveLength(5);

    const canvasViews = toolParts.map((p) => TOOL_VIEW_MAP[getToolName(p)]);
    expect(canvasViews).toEqual([
      "browser",   // web_search
      "editor",    // file_write → editor view (Manus FileToolView parity)
      "terminal",  // code_execute
      "browser",   // browser_navigate
      "terminal",  // code_execute
    ]);
  });
});

// ============================================================================
// 14. Skills System Flow
// ============================================================================

describe("User Flow: Skills System", () => {
  let processor: SSEProcessor;

  beforeEach(() => {
    processor = new SSEProcessor();
  });

  it("should process skills sync and package operations", () => {
    processor.process(toolStart("skills_sync", {
      source: "/opt/.rubic/skills/",
      target: "/home/user/skills/",
    }, "sync-1"));
    processor.process(toolResult("skills_sync", {
      synced: 3,
      skills: ["web-scraper", "data-processor", "report-generator"],
    }, "sync-1"));

    processor.process(toolStart("skills_package", {
      skill: "web-scraper",
      output: "/home/user/web-scraper.tar.gz",
    }, "pkg-1"));
    processor.process(toolResult("skills_package", {
      success: true,
      path: "/home/user/web-scraper.tar.gz",
      size: 4567,
    }, "pkg-1"));

    const toolParts = processor.collectedParts.filter(isToolPart);
    expect(toolParts).toHaveLength(2);
    expect(toolParts.map(getToolName)).toEqual(["skills_sync", "skills_package"]);
  });
});

// ============================================================================
// 15. Parallel Tasks Flow
// ============================================================================

describe("User Flow: Parallel Tasks", () => {
  let processor: SSEProcessor;

  beforeEach(() => {
    processor = new SSEProcessor();
  });

  it("should handle parallel_tasks tool call", () => {
    processor.process(toolStart("parallel_tasks", {
      tasks: [
        { id: "t1", description: "Search for React docs" },
        { id: "t2", description: "Search for Vue docs" },
        { id: "t3", description: "Search for Svelte docs" },
      ],
    }, "parallel-1"));
    processor.process(toolResult("parallel_tasks", {
      results: [
        { id: "t1", status: "completed", result: { found: true } },
        { id: "t2", status: "completed", result: { found: true } },
        { id: "t3", status: "completed", result: { found: true } },
      ],
    }, "parallel-1"));

    const toolParts = processor.collectedParts.filter(isToolPart);
    expect(toolParts).toHaveLength(1);
    expect(getToolName(toolParts[0]!)).toBe("parallel_tasks");

    const output = toolParts[0]!.output as Record<string, unknown>;
    const results = output.results as unknown[];
    expect(results).toHaveLength(3);
  });
});
