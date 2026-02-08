/**
 * Comprehensive mock stream flow tests.
 *
 * Simulates full agent tool-calling sequences through the SSE processor and
 * verifies that:
 * 1. AI SDK v6 chunks are emitted in the correct order
 * 2. tool-output-available never contains toolName (strict schema)
 * 3. Collected parts match the format useCanvas expects:
 *    { type: "tool-{name}", toolCallId, state, input, output }
 * 4. Text, reasoning, sources, and metadata events are preserved
 */

import { describe, it, expect, beforeEach } from "vitest";
import { SSEProcessor } from "../sse-processor";

// ── Helpers ──────────────────────────────────────────────────────────────

function sseChunk(data: object | string): string {
  return `data: ${typeof data === "string" ? data : JSON.stringify(data)}\n\n`;
}

function parseSSE(output: string): Array<Record<string, unknown>> {
  return output
    .split("\n\n")
    .filter((line) => line.startsWith("data: "))
    .map((line) => {
      try {
        return JSON.parse(line.slice(6));
      } catch {
        return null;
      }
    })
    .filter(Boolean) as Array<Record<string, unknown>>;
}

/** Process a list of agent events and return all emitted AI SDK chunks. */
function processAll(
  processor: SSEProcessor,
  events: object[]
): Array<Record<string, unknown>> {
  const all: Array<Record<string, unknown>> = [];
  for (const evt of events) {
    const out = processor.process(sseChunk(evt));
    all.push(...parseSSE(out));
  }
  return all;
}

/** Verify no tool-output-available or tool-output-error has toolName. */
function assertNoToolNameInOutput(chunks: Array<Record<string, unknown>>) {
  for (const c of chunks) {
    if (c.type === "tool-output-available" || c.type === "tool-output-error") {
      expect(c).not.toHaveProperty("toolName");
    }
  }
}

/** Find all collected parts matching a tool name. */
function toolParts(parts: Record<string, unknown>[], toolName: string) {
  return parts.filter(
    (p) => p.type === `tool-${toolName}`
  );
}

// ═════════════════════════════════════════════════════════════════════════
// 1. Browser Flow
// ═════════════════════════════════════════════════════════════════════════

describe("Full browser flow — navigate → click → screenshot → content", () => {
  let processor: SSEProcessor;
  let chunks: Array<Record<string, unknown>>;
  let parts: Record<string, unknown>[];

  beforeEach(() => {
    processor = new SSEProcessor();

    const events = [
      // Sandbox info arrives first
      { type: "sandbox_info", sandboxId: "sb_browser_test" },
      // Agent calls show_plan
      {
        type: "tool_start",
        toolCallId: "tc_plan_1",
        tool: "show_plan",
        input: {
          title: "Research AI news",
          steps: [
            { title: "Navigate to news site", status: "in_progress" },
            { title: "Click article", status: "pending" },
            { title: "Summarize findings", status: "pending" },
          ],
        },
      },
      {
        type: "tool_result",
        toolCallId: "tc_plan_1",
        tool: "show_plan",
        success: true,
        result: { displayed: true },
      },
      // browser_navigate with screenshot
      {
        type: "tool_start",
        toolCallId: "tc_nav_1",
        tool: "browser_navigate",
        input: { url: "https://news.ycombinator.com" },
      },
      // browser_frame arrives during navigation
      {
        type: "browser_frame",
        screenshot: "iVBORw0KGgoAAAANSUhEU_FAKE_PNG_DATA",
        url: "https://news.ycombinator.com",
        title: "Hacker News",
      },
      {
        type: "tool_result",
        toolCallId: "tc_nav_1",
        tool: "browser_navigate",
        success: true,
        result: {
          url: "https://news.ycombinator.com",
          title: "Hacker News",
          screenshot: "iVBORw0KGgoAAAANSUhEU_FAKE_PNG_DATA",
        },
      },
      // browser_click
      {
        type: "tool_start",
        toolCallId: "tc_click_1",
        tool: "browser_click",
        input: { coordinate: [320, 150], description: "First article link" },
      },
      {
        type: "tool_result",
        toolCallId: "tc_click_1",
        tool: "browser_click",
        success: true,
        result: {
          url: "https://example.com/article",
          title: "AI Article",
          screenshot: "iVBORw0KGgoAAAANSUhEU_CLICK_SCREENSHOT",
        },
      },
      // browser_screenshot
      {
        type: "tool_start",
        toolCallId: "tc_ss_1",
        tool: "browser_screenshot",
        input: {},
      },
      {
        type: "tool_result",
        toolCallId: "tc_ss_1",
        tool: "browser_screenshot",
        success: true,
        result: {
          screenshot: "iVBORw0KGgoAAAANSUhEU_FINAL_SCREENSHOT",
        },
      },
      // Final content
      { type: "content", content: "Based on the article, " },
      { type: "content", content: "here is a summary of the AI news." },
    ];

    chunks = processAll(processor, events);
    const finalized = processor.finalize();
    parts = finalized.parts;
  });

  it("emits sandbox_info as message-metadata first", () => {
    const meta = chunks.find(
      (c) => c.type === "message-metadata" && (c.messageMetadata as Record<string, unknown>)?.sandboxId
    );
    expect(meta).toBeDefined();
    expect((meta!.messageMetadata as Record<string, unknown>).sandboxId).toBe("sb_browser_test");
  });

  it("emits browser_frame as message-metadata with browserFrame", () => {
    const frame = chunks.find(
      (c) => c.type === "message-metadata" && (c.messageMetadata as Record<string, unknown>)?.browserFrame
    );
    expect(frame).toBeDefined();
    const bf = (frame!.messageMetadata as Record<string, unknown>).browserFrame as Record<string, unknown>;
    expect(bf.url).toBe("https://news.ycombinator.com");
    expect(bf.title).toBe("Hacker News");
    expect(bf.screenshot).toContain("iVBOR");
  });

  it("emits tool events in correct lifecycle order for each tool", () => {
    // Each tool should have: tool-input-start → tool-input-available → tool-output-available
    for (const tcId of ["tc_plan_1", "tc_nav_1", "tc_click_1", "tc_ss_1"]) {
      const toolChunks = chunks.filter(
        (c) => (c.toolCallId as string) === tcId
      );
      const types = toolChunks.map((c) => c.type);
      expect(types).toContain("tool-input-start");
      expect(types).toContain("tool-input-available");
      expect(types).toContain("tool-output-available");

      // Order: input-start before input-available before output-available
      const startIdx = types.indexOf("tool-input-start");
      const availIdx = types.indexOf("tool-input-available");
      const outputIdx = types.indexOf("tool-output-available");
      expect(startIdx).toBeLessThan(availIdx);
      expect(availIdx).toBeLessThan(outputIdx);
    }
  });

  it("no toolName on any tool-output-available", () => {
    assertNoToolNameInOutput(chunks);
  });

  it("collected parts contain all 4 tools + text", () => {
    expect(toolParts(parts, "show_plan")).toHaveLength(1);
    expect(toolParts(parts, "browser_navigate")).toHaveLength(1);
    expect(toolParts(parts, "browser_click")).toHaveLength(1);
    expect(toolParts(parts, "browser_screenshot")).toHaveLength(1);

    const textParts = parts.filter((p) => p.type === "text");
    expect(textParts.length).toBeGreaterThanOrEqual(1);
  });

  it("browser_navigate part has correct output with screenshot + URL", () => {
    const navPart = toolParts(parts, "browser_navigate")[0]!;
    expect(navPart.state).toBe("output-available");
    const output = navPart.output as Record<string, unknown>;
    expect(output.url).toBe("https://news.ycombinator.com");
    expect(output.screenshot).toContain("iVBOR");
  });

  it("browser_click part has correct output", () => {
    const clickPart = toolParts(parts, "browser_click")[0]!;
    expect(clickPart.state).toBe("output-available");
    const output = clickPart.output as Record<string, unknown>;
    expect(output.url).toBe("https://example.com/article");
  });

  it("tool steps track all 4 tools in order", () => {
    const steps = processor.collectedToolSteps;
    expect(steps).toHaveLength(4);
    expect(steps[0]!.toolName).toBe("show_plan");
    expect(steps[1]!.toolName).toBe("browser_navigate");
    expect(steps[2]!.toolName).toBe("browser_click");
    expect(steps[3]!.toolName).toBe("browser_screenshot");
    expect(steps.every((s) => s.status === "completed")).toBe(true);
  });

  it("final text content is accumulated correctly", () => {
    const fullText = processor.collectedText.join("");
    expect(fullText).toContain("Based on the article");
    expect(fullText).toContain("summary of the AI news");
  });
});

// ═════════════════════════════════════════════════════════════════════════
// 2. Terminal Flow
// ═════════════════════════════════════════════════════════════════════════

describe("Full terminal flow — shell_exec → code_execute → content", () => {
  let processor: SSEProcessor;
  let chunks: Array<Record<string, unknown>>;
  let parts: Record<string, unknown>[];

  beforeEach(() => {
    processor = new SSEProcessor();

    const events = [
      // shell_exec: npm install
      {
        type: "tool_start",
        toolCallId: "tc_shell_1",
        tool: "shell_exec",
        input: { command: "npm install express", id: "session-1" },
      },
      {
        type: "tool_result",
        toolCallId: "tc_shell_1",
        tool: "shell_exec",
        success: true,
        result: {
          stdout: "added 64 packages in 2.1s",
          stderr: "",
          exit_code: 0,
        },
      },
      // shell_exec: start server
      {
        type: "tool_start",
        toolCallId: "tc_shell_2",
        tool: "shell_exec",
        input: { command: "node server.js &", id: "session-1" },
      },
      {
        type: "tool_result",
        toolCallId: "tc_shell_2",
        tool: "shell_exec",
        success: true,
        result: {
          stdout: "Server listening on port 3000",
          stderr: "",
          exit_code: 0,
        },
      },
      // code_execute: test endpoint
      {
        type: "tool_start",
        toolCallId: "tc_code_1",
        tool: "code_execute",
        input: { code: "fetch('http://localhost:3000').then(r => r.text()).then(console.log)", language: "javascript" },
      },
      {
        type: "tool_result",
        toolCallId: "tc_code_1",
        tool: "code_execute",
        success: true,
        result: {
          stdout: "Hello, World!",
          stderr: "",
          exit_code: 0,
        },
      },
      // Content summary
      { type: "content", content: "The server is running and responding correctly." },
    ];

    chunks = processAll(processor, events);
    const finalized = processor.finalize();
    parts = finalized.parts;
  });

  it("emits correct lifecycle for all 3 tool calls", () => {
    for (const tcId of ["tc_shell_1", "tc_shell_2", "tc_code_1"]) {
      const toolChunks = chunks.filter((c) => c.toolCallId === tcId);
      const types = toolChunks.map((c) => c.type);
      expect(types).toContain("tool-input-start");
      expect(types).toContain("tool-input-available");
      expect(types).toContain("tool-output-available");
    }
  });

  it("no toolName on output chunks", () => {
    assertNoToolNameInOutput(chunks);
  });

  it("shell_exec parts have stdout in output", () => {
    const shellParts = toolParts(parts, "shell_exec");
    expect(shellParts).toHaveLength(2);

    const output1 = shellParts[0]!.output as Record<string, unknown>;
    expect(output1.stdout).toContain("added 64 packages");

    const output2 = shellParts[1]!.output as Record<string, unknown>;
    expect(output2.stdout).toContain("Server listening");
  });

  it("code_execute part has output", () => {
    const codeParts = toolParts(parts, "code_execute");
    expect(codeParts).toHaveLength(1);
    expect(codeParts[0]!.state).toBe("output-available");
    const output = codeParts[0]!.output as Record<string, unknown>;
    expect(output.stdout).toBe("Hello, World!");
  });

  it("all tool steps are completed", () => {
    expect(processor.collectedToolSteps).toHaveLength(3);
    expect(processor.collectedToolSteps.every((s) => s.status === "completed")).toBe(true);
  });

  it("shell_exec input-available preserves command", () => {
    const inputAvail = chunks.find(
      (c) => c.type === "tool-input-available" && c.toolCallId === "tc_shell_1"
    );
    expect(inputAvail).toBeDefined();
    expect((inputAvail!.input as Record<string, unknown>).command).toBe("npm install express");
  });
});

// ═════════════════════════════════════════════════════════════════════════
// 3. Code/IDE Flow
// ═════════════════════════════════════════════════════════════════════════

describe("Full code/IDE flow — file_write × 2 → file_read → file_str_replace → content", () => {
  let processor: SSEProcessor;
  let chunks: Array<Record<string, unknown>>;
  let parts: Record<string, unknown>[];

  beforeEach(() => {
    processor = new SSEProcessor();

    const events = [
      // file_write: index.html
      {
        type: "tool_start",
        toolCallId: "tc_fw_1",
        tool: "file_write",
        input: {
          path: "/home/user/project/index.html",
          content: "<!DOCTYPE html>\n<html><head><title>Test</title></head><body><h1>Hello</h1></body></html>",
        },
      },
      {
        type: "tool_result",
        toolCallId: "tc_fw_1",
        tool: "file_write",
        success: true,
        result: { success: true, path: "/home/user/project/index.html" },
      },
      // file_write: styles.css
      {
        type: "tool_start",
        toolCallId: "tc_fw_2",
        tool: "file_write",
        input: {
          path: "/home/user/project/styles.css",
          content: "body { font-family: sans-serif; }",
        },
      },
      {
        type: "tool_result",
        toolCallId: "tc_fw_2",
        tool: "file_write",
        success: true,
        result: { success: true, path: "/home/user/project/styles.css" },
      },
      // file_read: read the html back
      {
        type: "tool_start",
        toolCallId: "tc_fr_1",
        tool: "file_read",
        input: { path: "/home/user/project/index.html" },
      },
      {
        type: "tool_result",
        toolCallId: "tc_fr_1",
        tool: "file_read",
        success: true,
        result: {
          content: "<!DOCTYPE html>\n<html><head><title>Test</title></head><body><h1>Hello</h1></body></html>",
        },
      },
      // file_str_replace: update title
      {
        type: "tool_start",
        toolCallId: "tc_fsr_1",
        tool: "file_str_replace",
        input: {
          path: "/home/user/project/index.html",
          old_str: "<title>Test</title>",
          new_str: "<title>My Project</title>",
        },
      },
      {
        type: "tool_result",
        toolCallId: "tc_fsr_1",
        tool: "file_str_replace",
        success: true,
        result: { success: true },
      },
      // file_find_in_content
      {
        type: "tool_start",
        toolCallId: "tc_ffc_1",
        tool: "file_find_in_content",
        input: { pattern: "font-family", path: "/home/user/project" },
      },
      {
        type: "tool_result",
        toolCallId: "tc_ffc_1",
        tool: "file_find_in_content",
        success: true,
        result: {
          matches: [
            { file: "/home/user/project/styles.css", line: 1, text: "body { font-family: sans-serif; }" },
          ],
        },
      },
      // Content
      { type: "content", content: "I've created the project files and updated the title." },
    ];

    chunks = processAll(processor, events);
    const finalized = processor.finalize();
    parts = finalized.parts;
  });

  it("emits 5 tool lifecycles", () => {
    const toolIds = ["tc_fw_1", "tc_fw_2", "tc_fr_1", "tc_fsr_1", "tc_ffc_1"];
    for (const tcId of toolIds) {
      const types = chunks.filter((c) => c.toolCallId === tcId).map((c) => c.type);
      expect(types).toContain("tool-input-start");
      expect(types).toContain("tool-output-available");
    }
  });

  it("no toolName on output chunks", () => {
    assertNoToolNameInOutput(chunks);
  });

  it("collected parts have file_write × 2, file_read × 1, file_str_replace × 1, file_find_in_content × 1", () => {
    expect(toolParts(parts, "file_write")).toHaveLength(2);
    expect(toolParts(parts, "file_read")).toHaveLength(1);
    expect(toolParts(parts, "file_str_replace")).toHaveLength(1);
    expect(toolParts(parts, "file_find_in_content")).toHaveLength(1);
  });

  it("file_write parts preserve path and content in input", () => {
    const fwParts = toolParts(parts, "file_write");
    const input0 = fwParts[0]!.input as Record<string, unknown>;
    expect(input0.path).toBe("/home/user/project/index.html");
    expect(input0.content).toContain("<!DOCTYPE html>");

    const input1 = fwParts[1]!.input as Record<string, unknown>;
    expect(input1.path).toBe("/home/user/project/styles.css");
  });

  it("file_read part has content in output", () => {
    const frPart = toolParts(parts, "file_read")[0]!;
    expect(frPart.state).toBe("output-available");
    const output = frPart.output as Record<string, unknown>;
    expect(output.content).toContain("<!DOCTYPE html>");
  });

  it("file_str_replace part preserves old_str and new_str", () => {
    const fsrPart = toolParts(parts, "file_str_replace")[0]!;
    const input = fsrPart.input as Record<string, unknown>;
    expect(input.old_str).toBe("<title>Test</title>");
    expect(input.new_str).toBe("<title>My Project</title>");
  });

  it("file_find_in_content has matches in output", () => {
    const ffcPart = toolParts(parts, "file_find_in_content")[0]!;
    const output = ffcPart.output as Record<string, unknown>;
    const matches = output.matches as Array<Record<string, unknown>>;
    expect(matches).toHaveLength(1);
    expect(matches[0]!.file).toContain("styles.css");
  });
});

// ═════════════════════════════════════════════════════════════════════════
// 4. Search Flow
// ═════════════════════════════════════════════════════════════════════════

describe("Full search flow — show_plan → web_search → source_url → content", () => {
  let processor: SSEProcessor;
  let chunks: Array<Record<string, unknown>>;
  let parts: Record<string, unknown>[];

  beforeEach(() => {
    processor = new SSEProcessor();

    const events = [
      // show_plan
      {
        type: "tool_start",
        toolCallId: "tc_plan_s",
        tool: "show_plan",
        input: {
          title: "Search for AI trends",
          steps: [
            { title: "Search the web", status: "in_progress" },
            { title: "Summarize findings", status: "pending" },
          ],
        },
      },
      {
        type: "tool_result",
        toolCallId: "tc_plan_s",
        tool: "show_plan",
        success: true,
        result: { displayed: true },
      },
      // web_search with DuckDuckGo results
      {
        type: "tool_start",
        toolCallId: "tc_ws_1",
        tool: "web_search",
        input: { query: "latest AI trends 2026" },
      },
      {
        type: "tool_result",
        toolCallId: "tc_ws_1",
        tool: "web_search",
        success: true,
        result: {
          results: [
            {
              title: "Top AI Trends in 2026",
              url: "https://example.com/ai-trends",
              snippet: "The biggest AI trends shaping the industry...",
            },
            {
              title: "AI Breakthroughs 2026",
              url: "https://example.com/breakthroughs",
              snippet: "Recent breakthroughs in artificial intelligence...",
            },
            {
              title: "Future of AI - 2026 Predictions",
              url: "https://example.com/predictions",
              snippet: "Industry leaders predict major changes...",
            },
          ],
        },
      },
      // Source URLs
      {
        type: "source_url",
        url: "https://example.com/ai-trends",
        title: "Top AI Trends in 2026",
      },
      {
        type: "source_url",
        url: "https://example.com/breakthroughs",
        title: "AI Breakthroughs 2026",
      },
      // Content
      {
        type: "content",
        content: "Based on my research, the top AI trends in 2026 include: ",
      },
      {
        type: "content",
        content: "1. Agentic AI systems, 2. Multimodal reasoning, 3. Edge AI deployment.",
      },
    ];

    chunks = processAll(processor, events);
    const finalized = processor.finalize();
    parts = finalized.parts;
  });

  it("emits show_plan + web_search tool lifecycles", () => {
    for (const tcId of ["tc_plan_s", "tc_ws_1"]) {
      const types = chunks.filter((c) => c.toolCallId === tcId).map((c) => c.type);
      expect(types).toContain("tool-input-start");
      expect(types).toContain("tool-output-available");
    }
  });

  it("no toolName on output chunks", () => {
    assertNoToolNameInOutput(chunks);
  });

  it("web_search input-available has query", () => {
    const inputAvail = chunks.find(
      (c) => c.type === "tool-input-available" && c.toolCallId === "tc_ws_1"
    );
    expect(inputAvail).toBeDefined();
    expect(inputAvail!.toolName).toBe("web_search");
    expect((inputAvail!.input as Record<string, unknown>).query).toBe("latest AI trends 2026");
  });

  it("web_search output has results array with 3 items", () => {
    const outputChunk = chunks.find(
      (c) => c.type === "tool-output-available" && c.toolCallId === "tc_ws_1"
    );
    expect(outputChunk).toBeDefined();
    const output = outputChunk!.output as Record<string, unknown>;
    const results = output.results as Array<Record<string, unknown>>;
    expect(results).toHaveLength(3);
    expect(results[0]!.title).toBe("Top AI Trends in 2026");
    expect(results[0]!.url).toBe("https://example.com/ai-trends");
  });

  it("source_url events are emitted as source-url chunks", () => {
    const sources = chunks.filter((c) => c.type === "source-url");
    expect(sources).toHaveLength(2);
    expect(sources[0]!.url).toBe("https://example.com/ai-trends");
    expect(sources[1]!.url).toBe("https://example.com/breakthroughs");
  });

  it("collected parts include source-url entries", () => {
    const sourceParts = parts.filter((p) => p.type === "source-url");
    expect(sourceParts).toHaveLength(2);
    expect(sourceParts[0]!.url).toBe("https://example.com/ai-trends");
  });

  it("collected parts include web_search tool with results in output", () => {
    const wsParts = toolParts(parts, "web_search");
    expect(wsParts).toHaveLength(1);
    expect(wsParts[0]!.state).toBe("output-available");
    const output = wsParts[0]!.output as Record<string, unknown>;
    expect((output.results as unknown[]).length).toBe(3);
  });
});

// ═════════════════════════════════════════════════════════════════════════
// 5. E2B Full Flow (sandbox → shell → file → browser)
// ═════════════════════════════════════════════════════════════════════════

describe("Full E2B flow — sandbox_info → shell_exec → file_write → browser_navigate", () => {
  let processor: SSEProcessor;
  let chunks: Array<Record<string, unknown>>;
  let parts: Record<string, unknown>[];

  beforeEach(() => {
    processor = new SSEProcessor();

    const events = [
      // Sandbox created
      { type: "sandbox_info", sandboxId: "sb_e2b_full" },
      // Plan
      {
        type: "tool_start",
        toolCallId: "tc_plan_e",
        tool: "show_plan",
        input: {
          title: "Build a web page",
          steps: [
            { title: "Create files", status: "in_progress" },
            { title: "Start server", status: "pending" },
            { title: "View result", status: "pending" },
          ],
        },
      },
      {
        type: "tool_result",
        toolCallId: "tc_plan_e",
        tool: "show_plan",
        success: true,
        result: { displayed: true },
      },
      // file_write in sandbox
      {
        type: "tool_start",
        toolCallId: "tc_fw_e",
        tool: "file_write",
        input: {
          path: "/home/user/app/index.html",
          content: "<html><body><h1>E2B Test</h1></body></html>",
        },
      },
      {
        type: "tool_result",
        toolCallId: "tc_fw_e",
        tool: "file_write",
        success: true,
        result: { success: true },
      },
      // shell_exec: start HTTP server
      {
        type: "tool_start",
        toolCallId: "tc_sh_e",
        tool: "shell_exec",
        input: { command: "cd /home/user/app && python -m http.server 8080 &", id: "s1" },
      },
      {
        type: "tool_result",
        toolCallId: "tc_sh_e",
        tool: "shell_exec",
        success: true,
        result: {
          stdout: "Serving HTTP on 0.0.0.0 port 8080",
          exit_code: 0,
        },
      },
      // browser_navigate to local server
      {
        type: "tool_start",
        toolCallId: "tc_bn_e",
        tool: "browser_navigate",
        input: { url: "http://localhost:8080" },
      },
      {
        type: "browser_frame",
        screenshot: "iVBORw0KGgoAAAANSUhEU_E2B_SCREENSHOT",
        url: "http://localhost:8080",
        title: "E2B Test",
      },
      {
        type: "tool_result",
        toolCallId: "tc_bn_e",
        tool: "browser_navigate",
        success: true,
        result: {
          url: "http://localhost:8080",
          title: "E2B Test",
          screenshot: "iVBORw0KGgoAAAANSUhEU_E2B_SCREENSHOT",
        },
      },
      // Content
      {
        type: "content",
        content: "The web page is live in the sandbox. You can see the E2B Test heading.",
      },
    ];

    chunks = processAll(processor, events);
    const finalized = processor.finalize();
    parts = finalized.parts;
  });

  it("sandbox ID is communicated via message-metadata", () => {
    const meta = chunks.find(
      (c) =>
        c.type === "message-metadata" &&
        (c.messageMetadata as Record<string, unknown>)?.sandboxId === "sb_e2b_full"
    );
    expect(meta).toBeDefined();
  });

  it("all 4 tools complete successfully", () => {
    expect(processor.collectedToolSteps).toHaveLength(4);
    expect(processor.collectedToolSteps.map((s) => s.toolName)).toEqual([
      "show_plan",
      "file_write",
      "shell_exec",
      "browser_navigate",
    ]);
    expect(processor.collectedToolSteps.every((s) => s.status === "completed")).toBe(true);
  });

  it("no toolName on output chunks", () => {
    assertNoToolNameInOutput(chunks);
  });

  it("collected parts span multiple canvas views (code + terminal + browser)", () => {
    const fw = toolParts(parts, "file_write");
    const sh = toolParts(parts, "shell_exec");
    const bn = toolParts(parts, "browser_navigate");
    expect(fw).toHaveLength(1);
    expect(sh).toHaveLength(1);
    expect(bn).toHaveLength(1);
  });

  it("browser_frame emits live screenshot metadata", () => {
    const frames = chunks.filter(
      (c) =>
        c.type === "message-metadata" &&
        (c.messageMetadata as Record<string, unknown>)?.browserFrame
    );
    expect(frames).toHaveLength(1);
    const bf = (frames[0]!.messageMetadata as Record<string, unknown>).browserFrame as Record<string, unknown>;
    expect(bf.screenshot).toContain("E2B_SCREENSHOT");
    expect(bf.url).toBe("http://localhost:8080");
  });
});

// ═════════════════════════════════════════════════════════════════════════
// 6. Mixed Multi-Tool Flow (view switching)
// ═════════════════════════════════════════════════════════════════════════

describe("Mixed multi-tool flow — search → file → terminal → browser", () => {
  let processor: SSEProcessor;
  let chunks: Array<Record<string, unknown>>;

  beforeEach(() => {
    processor = new SSEProcessor();

    const events = [
      // web_search
      {
        type: "tool_start",
        toolCallId: "tc_m_ws",
        tool: "web_search",
        input: { query: "express.js getting started" },
      },
      {
        type: "tool_result",
        toolCallId: "tc_m_ws",
        tool: "web_search",
        success: true,
        result: {
          results: [
            { title: "Express.js Guide", url: "https://expressjs.com", snippet: "Fast, unopinionated" },
          ],
        },
      },
      // file_write
      {
        type: "tool_start",
        toolCallId: "tc_m_fw",
        tool: "file_write",
        input: { path: "/app/server.js", content: "const express = require('express');" },
      },
      {
        type: "tool_result",
        toolCallId: "tc_m_fw",
        tool: "file_write",
        success: true,
        result: { success: true },
      },
      // shell_exec
      {
        type: "tool_start",
        toolCallId: "tc_m_sh",
        tool: "shell_exec",
        input: { command: "node server.js" },
      },
      {
        type: "tool_result",
        toolCallId: "tc_m_sh",
        tool: "shell_exec",
        success: true,
        result: { stdout: "Listening on :3000" },
      },
      // browser_navigate
      {
        type: "tool_start",
        toolCallId: "tc_m_bn",
        tool: "browser_navigate",
        input: { url: "http://localhost:3000" },
      },
      {
        type: "tool_result",
        toolCallId: "tc_m_bn",
        tool: "browser_navigate",
        success: true,
        result: { url: "http://localhost:3000", title: "Express App", screenshot: "iVBORw0Kbase64data" },
      },
      // Content
      { type: "content", content: "Everything is working!" },
    ];

    chunks = processAll(processor, events);
  });

  it("all 4 tools have correct lifecycles", () => {
    for (const tcId of ["tc_m_ws", "tc_m_fw", "tc_m_sh", "tc_m_bn"]) {
      const types = chunks.filter((c) => c.toolCallId === tcId).map((c) => c.type);
      expect(types).toContain("tool-input-start");
      expect(types).toContain("tool-output-available");
    }
  });

  it("tool steps have correct names in order", () => {
    const names = processor.collectedToolSteps.map((s) => s.toolName);
    expect(names).toEqual(["web_search", "file_write", "shell_exec", "browser_navigate"]);
  });

  it("no toolName on output chunks", () => {
    assertNoToolNameInOutput(chunks);
  });

  it("step boundaries are opened correctly", () => {
    const startSteps = chunks.filter((c) => c.type === "start-step");
    // At least one start-step should be present
    expect(startSteps.length).toBeGreaterThanOrEqual(1);
  });

  it("text content emitted after tools", () => {
    const textDeltas = chunks.filter((c) => c.type === "text-delta");
    expect(textDeltas.length).toBeGreaterThanOrEqual(1);
    const text = textDeltas.map((c) => c.delta).join("");
    expect(text).toContain("Everything is working!");
  });
});

// ═════════════════════════════════════════════════════════════════════════
// 7. Error Handling Flow
// ═════════════════════════════════════════════════════════════════════════

describe("Error handling flow — tool failure + error event", () => {
  let processor: SSEProcessor;
  let chunks: Array<Record<string, unknown>>;
  let parts: Record<string, unknown>[];

  beforeEach(() => {
    processor = new SSEProcessor();

    const events = [
      // shell_exec that fails
      {
        type: "tool_start",
        toolCallId: "tc_err_1",
        tool: "shell_exec",
        input: { command: "rm -rf /protected" },
      },
      {
        type: "tool_result",
        toolCallId: "tc_err_1",
        tool: "shell_exec",
        success: false,
        result: { error: "Permission denied" },
      },
      // code_execute that fails
      {
        type: "tool_start",
        toolCallId: "tc_err_2",
        tool: "code_execute",
        input: { code: "import nonexistent_module" },
      },
      {
        type: "tool_result",
        toolCallId: "tc_err_2",
        tool: "code_execute",
        success: false,
        summary: "ModuleNotFoundError: No module named 'nonexistent_module'",
      },
      // Content after errors
      { type: "content", content: "The command failed due to permissions." },
      // Agent-level error
      { type: "error", error: "Rate limit exceeded" },
    ];

    chunks = processAll(processor, events);
    const finalized = processor.finalize();
    parts = finalized.parts;
  });

  it("failed tool emits tool-output-error (not tool-output-available)", () => {
    const error1 = chunks.find(
      (c) => c.type === "tool-output-error" && c.toolCallId === "tc_err_1"
    );
    expect(error1).toBeDefined();
    expect(error1!.errorText).toBe("Permission denied");
    // No toolName
    expect(error1).not.toHaveProperty("toolName");
  });

  it("tool_result with summary fallback produces correct errorText", () => {
    const error2 = chunks.find(
      (c) => c.type === "tool-output-error" && c.toolCallId === "tc_err_2"
    );
    expect(error2).toBeDefined();
    expect(error2!.errorText).toContain("ModuleNotFoundError");
  });

  it("tool steps are marked cancelled on failure", () => {
    expect(processor.collectedToolSteps[0]!.status).toBe("cancelled");
    expect(processor.collectedToolSteps[1]!.status).toBe("cancelled");
  });

  it("agent-level error event emits error chunk", () => {
    const errorChunk = chunks.find((c) => c.type === "error");
    expect(errorChunk).toBeDefined();
    expect(errorChunk!.errorText).toBe("Rate limit exceeded");
  });

  it("collected parts mark failed tools as output-error", () => {
    const shellPart = toolParts(parts, "shell_exec")[0]!;
    expect(shellPart.state).toBe("output-error");

    const codePart = toolParts(parts, "code_execute")[0]!;
    expect(codePart.state).toBe("output-error");
  });
});

// ═════════════════════════════════════════════════════════════════════════
// 8. Reasoning + Content Interleaving
// ═════════════════════════════════════════════════════════════════════════

describe("Reasoning + content interleaving", () => {
  let processor: SSEProcessor;
  let chunks: Array<Record<string, unknown>>;
  let parts: Record<string, unknown>[];

  beforeEach(() => {
    processor = new SSEProcessor();

    const events = [
      { type: "reasoning", content: "Let me think about this..." },
      { type: "reasoning", content: " I should search first." },
      { type: "reasoning_end" },
      {
        type: "tool_start",
        toolCallId: "tc_ws_r",
        tool: "web_search",
        input: { query: "topic" },
      },
      {
        type: "tool_result",
        toolCallId: "tc_ws_r",
        tool: "web_search",
        success: true,
        result: { results: [] },
      },
      { type: "content", content: "No results found." },
    ];

    chunks = processAll(processor, events);
    const finalized = processor.finalize();
    parts = finalized.parts;
  });

  it("reasoning events produce reasoning-start + reasoning-delta + reasoning-end", () => {
    const types = chunks.map((c) => c.type);
    expect(types).toContain("reasoning-start");
    expect(types).toContain("reasoning-delta");
    expect(types).toContain("reasoning-end");

    // reasoning-start before any reasoning-delta
    const startIdx = types.indexOf("reasoning-start");
    const deltaIdx = types.indexOf("reasoning-delta");
    expect(startIdx).toBeLessThan(deltaIdx);
  });

  it("reasoning closes before tool_start", () => {
    const types = chunks.map((c) => c.type);
    const reasoningEndIdx = types.indexOf("reasoning-end");
    const toolStartIdx = types.indexOf("tool-input-start");
    expect(reasoningEndIdx).toBeLessThan(toolStartIdx);
  });

  it("collected parts include reasoning + tool + text in order", () => {
    const partTypes = parts.map((p) => p.type);
    // Should have: reasoning, tool-web_search, text
    expect(partTypes).toContain("reasoning");
    expect(partTypes).toContain("tool-web_search");
    expect(partTypes).toContain("text");
  });

  it("reasoning part has accumulated text", () => {
    const reasoningPart = parts.find((p) => p.type === "reasoning")!;
    expect(reasoningPart.text).toBe("Let me think about this... I should search first.");
  });
});

// ═════════════════════════════════════════════════════════════════════════
// 9. Parts Format Compatibility with useCanvas
// ═════════════════════════════════════════════════════════════════════════

describe("Collected parts format — compatible with useCanvas expectations", () => {
  let processor: SSEProcessor;
  let parts: Record<string, unknown>[];

  beforeEach(() => {
    processor = new SSEProcessor();

    const events = [
      {
        type: "tool_start",
        toolCallId: "tc_compat_1",
        tool: "browser_navigate",
        input: { url: "https://example.com" },
      },
      {
        type: "tool_result",
        toolCallId: "tc_compat_1",
        tool: "browser_navigate",
        success: true,
        result: {
          url: "https://example.com",
          screenshot: "iVBORw0KGgoAAAA",
          title: "Example",
          content: "Example Domain\nThis domain is for illustrations.",
        },
      },
      {
        type: "tool_start",
        toolCallId: "tc_compat_2",
        tool: "shell_exec",
        input: { command: "curl -s https://example.com | head -5" },
      },
      {
        type: "tool_result",
        toolCallId: "tc_compat_2",
        tool: "shell_exec",
        success: true,
        result: { stdout: "<!doctype html>\n<html>...", exit_code: 0 },
      },
      {
        type: "tool_start",
        toolCallId: "tc_compat_3",
        tool: "file_write",
        input: { path: "/home/user/output.txt", content: "Results saved." },
      },
      {
        type: "tool_result",
        toolCallId: "tc_compat_3",
        tool: "file_write",
        success: true,
        result: { success: true },
      },
    ];

    processAll(processor, events);
    const finalized = processor.finalize();
    parts = finalized.parts;
  });

  it("tool parts have type: 'tool-{name}' format (as useCanvas expects via isToolUIPart)", () => {
    const toolTypes = parts.filter((p) => (p.type as string).startsWith("tool-")).map((p) => p.type);
    expect(toolTypes).toContain("tool-browser_navigate");
    expect(toolTypes).toContain("tool-shell_exec");
    expect(toolTypes).toContain("tool-file_write");
  });

  it("each tool part has toolCallId (required by useCanvas)", () => {
    const toolPartsAll = parts.filter((p) => (p.type as string).startsWith("tool-"));
    for (const tp of toolPartsAll) {
      expect(tp.toolCallId).toBeDefined();
      expect(typeof tp.toolCallId).toBe("string");
      expect((tp.toolCallId as string).length).toBeGreaterThan(0);
    }
  });

  it("each completed tool part has state: 'output-available'", () => {
    const toolPartsAll = parts.filter((p) => (p.type as string).startsWith("tool-"));
    for (const tp of toolPartsAll) {
      expect(tp.state).toBe("output-available");
    }
  });

  it("each tool part has input field (required by useCanvas args extraction)", () => {
    const toolPartsAll = parts.filter((p) => (p.type as string).startsWith("tool-"));
    for (const tp of toolPartsAll) {
      expect(tp).toHaveProperty("input");
    }
  });

  it("browser_navigate part output has screenshot, url, title, content for useCanvas extraction", () => {
    const bnPart = parts.find((p) => p.type === "tool-browser_navigate")!;
    const output = bnPart.output as Record<string, unknown>;
    expect(output.screenshot).toContain("iVBOR");
    expect(output.url).toBe("https://example.com");
    expect(output.title).toBe("Example");
    expect(output.content).toContain("Example Domain");
  });

  it("shell_exec part output has stdout for terminal accumulation", () => {
    const shPart = parts.find((p) => p.type === "tool-shell_exec")!;
    const output = shPart.output as Record<string, unknown>;
    expect(output.stdout).toContain("<!doctype html>");
  });

  it("file_write part input has path and content for file tree building", () => {
    const fwPart = parts.find((p) => p.type === "tool-file_write")!;
    const input = fwPart.input as Record<string, unknown>;
    expect(input.path).toBe("/home/user/output.txt");
    expect(input.content).toBe("Results saved.");
  });

  it("tool part toolName field matches type suffix", () => {
    const toolPartsAll = parts.filter((p) => (p.type as string).startsWith("tool-"));
    for (const tp of toolPartsAll) {
      const expectedName = (tp.type as string).slice(5);
      expect(tp.toolName).toBe(expectedName);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════
// 10. Deploy tools flow
// ═════════════════════════════════════════════════════════════════════════

describe("Deploy tools flow — deploy_expose_port → deploy_apply_deployment", () => {
  let processor: SSEProcessor;
  let chunks: Array<Record<string, unknown>>;

  beforeEach(() => {
    processor = new SSEProcessor();

    const events = [
      {
        type: "tool_start",
        toolCallId: "tc_dep_1",
        tool: "deploy_expose_port",
        input: { port: 3000 },
      },
      {
        type: "tool_result",
        toolCallId: "tc_dep_1",
        tool: "deploy_expose_port",
        success: true,
        result: { url: "https://sandbox-abc.e2b.dev:3000" },
      },
      {
        type: "tool_start",
        toolCallId: "tc_dep_2",
        tool: "deploy_apply_deployment",
        input: { name: "my-app", port: 3000 },
      },
      {
        type: "tool_result",
        toolCallId: "tc_dep_2",
        tool: "deploy_apply_deployment",
        success: true,
        result: { url: "https://my-app.rubic.dev", status: "deployed" },
      },
      { type: "content", content: "Your app is deployed at https://my-app.rubic.dev" },
    ];

    chunks = processAll(processor, events);
  });

  it("both deploy tools have correct lifecycles", () => {
    for (const tcId of ["tc_dep_1", "tc_dep_2"]) {
      const types = chunks.filter((c) => c.toolCallId === tcId).map((c) => c.type);
      expect(types).toContain("tool-input-start");
      expect(types).toContain("tool-output-available");
    }
  });

  it("no toolName on output chunks", () => {
    assertNoToolNameInOutput(chunks);
  });

  it("deploy_expose_port input-available has port", () => {
    const ia = chunks.find(
      (c) => c.type === "tool-input-available" && c.toolCallId === "tc_dep_1"
    );
    expect((ia!.input as Record<string, unknown>).port).toBe(3000);
  });

  it("deploy_apply_deployment result has URL", () => {
    const oa = chunks.find(
      (c) => c.type === "tool-output-available" && c.toolCallId === "tc_dep_2"
    );
    expect((oa!.output as Record<string, unknown>).url).toBe("https://my-app.rubic.dev");
  });
});

// ═════════════════════════════════════════════════════════════════════════
// 11. Communication tools (message_notify_user, message_ask_user)
// ═════════════════════════════════════════════════════════════════════════

describe("Communication tools — message_notify_user + message_ask_user", () => {
  let processor: SSEProcessor;
  let chunks: Array<Record<string, unknown>>;
  let parts: Record<string, unknown>[];

  beforeEach(() => {
    processor = new SSEProcessor();

    const events = [
      {
        type: "tool_start",
        toolCallId: "tc_msg_1",
        tool: "message_notify_user",
        input: { text: "I found 5 relevant articles." },
      },
      {
        type: "tool_result",
        toolCallId: "tc_msg_1",
        tool: "message_notify_user",
        success: true,
        result: { delivered: true },
      },
      {
        type: "tool_start",
        toolCallId: "tc_msg_2",
        tool: "message_ask_user",
        input: { question: "Should I continue with the analysis?", options: ["Yes", "No"] },
      },
      {
        type: "tool_result",
        toolCallId: "tc_msg_2",
        tool: "message_ask_user",
        success: true,
        result: { response: "Yes" },
      },
    ];

    chunks = processAll(processor, events);
    const finalized = processor.finalize();
    parts = finalized.parts;
  });

  it("both communication tools have correct lifecycle", () => {
    for (const tcId of ["tc_msg_1", "tc_msg_2"]) {
      const types = chunks.filter((c) => c.toolCallId === tcId).map((c) => c.type);
      expect(types).toContain("tool-input-start");
      expect(types).toContain("tool-output-available");
    }
  });

  it("no toolName on output chunks", () => {
    assertNoToolNameInOutput(chunks);
  });

  it("collected parts have correct tool types", () => {
    expect(toolParts(parts, "message_notify_user")).toHaveLength(1);
    expect(toolParts(parts, "message_ask_user")).toHaveLength(1);
  });

  it("message_ask_user input has question and options", () => {
    const askPart = toolParts(parts, "message_ask_user")[0]!;
    const input = askPart.input as Record<string, unknown>;
    expect(input.question).toBe("Should I continue with the analysis?");
    expect(input.options).toEqual(["Yes", "No"]);
  });
});

// ═════════════════════════════════════════════════════════════════════════
// 12. Finalize with all part types
// ═════════════════════════════════════════════════════════════════════════

describe("Finalize produces complete parts list for DB persistence", () => {
  it("reasoning + tool + source + text all present after full flow", () => {
    const processor = new SSEProcessor();

    const events = [
      { type: "reasoning", content: "Let me plan this." },
      { type: "reasoning_end" },
      {
        type: "tool_start",
        toolCallId: "tc_final_1",
        tool: "web_search",
        input: { query: "test" },
      },
      {
        type: "tool_result",
        toolCallId: "tc_final_1",
        tool: "web_search",
        success: true,
        result: { results: [{ title: "Result", url: "https://r.com", snippet: "..." }] },
      },
      {
        type: "source_url",
        url: "https://r.com",
        title: "Result",
      },
      { type: "content", content: "Here is what I found." },
    ];

    processAll(processor, events);
    const { parts, closingSSE } = processor.finalize();

    // Verify all part types are present
    const types = parts.map((p) => p.type);
    expect(types).toContain("reasoning");
    expect(types).toContain("tool-web_search");
    expect(types).toContain("source-url");
    expect(types).toContain("text");

    // Closing SSE should have text-end + finish-step
    const closingChunks = parseSSE(closingSSE);
    const closingTypes = closingChunks.map((c) => c.type);
    expect(closingTypes).toContain("text-end");
    expect(closingTypes).toContain("finish-step");
  });

  it("empty stream produces no parts", () => {
    const processor = new SSEProcessor();
    const { parts } = processor.finalize();
    expect(parts).toHaveLength(0);
  });

  it("text-only stream produces exactly one text part", () => {
    const processor = new SSEProcessor();
    processAll(processor, [
      { type: "content", content: "Hello " },
      { type: "content", content: "World" },
    ]);
    const { parts } = processor.finalize();
    expect(parts).toHaveLength(1);
    expect(parts[0]!.type).toBe("text");
    expect(parts[0]!.text).toBe("Hello World");
  });
});
