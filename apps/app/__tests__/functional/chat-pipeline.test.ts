import { describe, it, expect, beforeEach } from "vitest";
import { SSEProcessor } from "../../lib/chat/sse-processor";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Wrap raw JSON payload as SSE data line (how the agent service sends it). */
function sseData(payload: object): string {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

/** Parse all `data: {...}` chunks from an SSE string into objects. */
function parseSSEChunks(raw: string): Record<string, unknown>[] {
  const chunks: Record<string, unknown>[] = [];
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("data: ")) {
      try {
        chunks.push(JSON.parse(trimmed.slice(6)) as Record<string, unknown>);
      } catch {
        // skip non-JSON
      }
    }
  }
  return chunks;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SSEProcessor", () => {
  let processor: SSEProcessor;

  beforeEach(() => {
    processor = new SSEProcessor();
  });

  // -----------------------------------------------------------------------
  // 1. Content events produce text-start + text-delta
  // -----------------------------------------------------------------------
  it("emits text-start and text-delta for content events", () => {
    const output = processor.process(sseData({ type: "content", content: "hello" }));
    const chunks = parseSSEChunks(output);

    expect(chunks.length).toBe(2);
    expect(chunks[0]).toMatchObject({ type: "text-start" });
    expect(chunks[0]).toHaveProperty("id");
    expect(chunks[1]).toMatchObject({ type: "text-delta", delta: "hello" });
  });

  // -----------------------------------------------------------------------
  // 2. Multiple content events accumulate in collectedText
  // -----------------------------------------------------------------------
  it("accumulates content in collectedText across multiple events", () => {
    processor.process(sseData({ type: "content", content: "Hello " }));
    processor.process(sseData({ type: "content", content: "world" }));

    expect(processor.collectedText).toEqual(["Hello ", "world"]);
  });

  // -----------------------------------------------------------------------
  // 3. tool_start events produce tool-input-start + tool-input-available
  // -----------------------------------------------------------------------
  it("emits tool-input-start and tool-input-available for tool_start events", () => {
    const output = processor.process(
      sseData({
        type: "tool_start",
        toolCallId: "tc_1",
        tool: "browser_navigate",
        input: { url: "https://example.com" },
      })
    );
    const chunks = parseSSEChunks(output);

    // Should have: start-step, tool-input-start, tool-input-available
    const inputStart = chunks.find((c) => c.type === "tool-input-start");
    const inputAvail = chunks.find((c) => c.type === "tool-input-available");

    expect(inputStart).toBeDefined();
    expect(inputStart).toMatchObject({ toolCallId: "tc_1", toolName: "browser_navigate" });

    expect(inputAvail).toBeDefined();
    expect(inputAvail).toMatchObject({
      toolCallId: "tc_1",
      toolName: "browser_navigate",
      input: { url: "https://example.com" },
    });
  });

  // -----------------------------------------------------------------------
  // 4. tool_result with success=true produces tool-output-available
  // -----------------------------------------------------------------------
  it("emits tool-output-available for successful tool_result", () => {
    // First send tool_start
    processor.process(
      sseData({ type: "tool_start", toolCallId: "tc_1", tool: "shell_exec", input: { cmd: "ls" } })
    );

    // Then send tool_result with success=true
    const output = processor.process(
      sseData({
        type: "tool_result",
        toolCallId: "tc_1",
        tool: "shell_exec",
        success: true,
        result: { stdout: "file1.txt\nfile2.txt" },
      })
    );
    const chunks = parseSSEChunks(output);

    const outputAvail = chunks.find((c) => c.type === "tool-output-available");
    expect(outputAvail).toBeDefined();
    expect(outputAvail).toMatchObject({
      toolCallId: "tc_1",
      output: { stdout: "file1.txt\nfile2.txt" },
    });
  });

  // -----------------------------------------------------------------------
  // 5. tool_result with success=false produces tool-output-error
  // -----------------------------------------------------------------------
  it("emits tool-output-error for failed tool_result", () => {
    processor.process(
      sseData({ type: "tool_start", toolCallId: "tc_2", tool: "file_write", input: {} })
    );

    const output = processor.process(
      sseData({
        type: "tool_result",
        toolCallId: "tc_2",
        tool: "file_write",
        success: false,
        result: { error: "Permission denied" },
      })
    );
    const chunks = parseSSEChunks(output);

    const outputErr = chunks.find((c) => c.type === "tool-output-error");
    expect(outputErr).toBeDefined();
    expect(outputErr).toMatchObject({
      toolCallId: "tc_2",
      errorText: "Permission denied",
    });
  });

  // -----------------------------------------------------------------------
  // 6. tool_result without matching tool_start emits synthetic tool_start
  // -----------------------------------------------------------------------
  it("emits synthetic tool_start when tool_result has no matching start", () => {
    const output = processor.process(
      sseData({
        type: "tool_result",
        toolCallId: "orphan_1",
        tool: "code_execute",
        success: true,
        result: { output: "42" },
      })
    );
    const chunks = parseSSEChunks(output);

    // Should have synthetic: start-step, tool-input-start, tool-input-available, then tool-output-available
    const inputStart = chunks.find((c) => c.type === "tool-input-start");
    const inputAvail = chunks.find((c) => c.type === "tool-input-available");
    const outputAvail = chunks.find((c) => c.type === "tool-output-available");

    expect(inputStart).toBeDefined();
    expect(inputStart).toMatchObject({ toolName: "code_execute" });

    expect(inputAvail).toBeDefined();
    expect(inputAvail).toMatchObject({ toolName: "code_execute", input: {} });

    expect(outputAvail).toBeDefined();
    expect(outputAvail).toMatchObject({ output: { output: "42" } });
  });

  // -----------------------------------------------------------------------
  // 7. Reasoning events produce reasoning-start + reasoning-delta
  // -----------------------------------------------------------------------
  it("emits reasoning-start and reasoning-delta for reasoning events", () => {
    const output = processor.process(
      sseData({ type: "reasoning", content: "Let me think about this..." })
    );
    const chunks = parseSSEChunks(output);

    expect(chunks.length).toBe(2);
    expect(chunks[0]).toMatchObject({ type: "reasoning-start" });
    expect(chunks[0]).toHaveProperty("id");
    expect(chunks[1]).toMatchObject({
      type: "reasoning-delta",
      delta: "Let me think about this...",
    });
  });

  // -----------------------------------------------------------------------
  // 8. sandbox_info produces message-metadata with sandboxId
  // -----------------------------------------------------------------------
  it("emits message-metadata for sandbox_info events", () => {
    const output = processor.process(
      sseData({
        type: "sandbox_info",
        sandboxId: "sbx_abc123",
        nekoUrl: "https://neko.example.com",
      })
    );
    const chunks = parseSSEChunks(output);

    expect(chunks.length).toBe(1);
    expect(chunks[0]).toMatchObject({
      type: "message-metadata",
      messageMetadata: {
        sandboxId: "sbx_abc123",
        nekoUrl: "https://neko.example.com",
      },
    });
  });

  // -----------------------------------------------------------------------
  // 9. browser_frame produces message-metadata with browserFrame
  // -----------------------------------------------------------------------
  it("emits message-metadata with browserFrame for browser_frame events", () => {
    const output = processor.process(
      sseData({
        type: "browser_frame",
        screenshot: "base64data==",
        url: "https://example.com",
        title: "Example",
      })
    );
    const chunks = parseSSEChunks(output);

    expect(chunks.length).toBe(1);
    expect(chunks[0]).toMatchObject({
      type: "message-metadata",
      messageMetadata: {
        browserFrame: {
          screenshot: "base64data==",
          url: "https://example.com",
          title: "Example",
        },
      },
    });
  });

  // -----------------------------------------------------------------------
  // 10. Error events produce error SSE
  // -----------------------------------------------------------------------
  it("emits error SSE for error events", () => {
    const output = processor.process(
      sseData({ type: "error", error: "Something went wrong" })
    );
    const chunks = parseSSEChunks(output);

    const errorChunk = chunks.find((c) => c.type === "error");
    expect(errorChunk).toBeDefined();
    expect(errorChunk).toMatchObject({
      type: "error",
      errorText: "Something went wrong",
    });
  });

  // -----------------------------------------------------------------------
  // 11. finalize() closes open text parts and returns collectedParts
  // -----------------------------------------------------------------------
  it("finalize() closes open text parts and returns collectedParts", () => {
    processor.process(sseData({ type: "content", content: "Hello world" }));

    const { parts, closingSSE } = processor.finalize();

    // closingSSE should contain text-end
    const closingChunks = parseSSEChunks(closingSSE);
    const textEnd = closingChunks.find((c) => c.type === "text-end");
    expect(textEnd).toBeDefined();

    // parts should contain the accumulated text
    expect(parts.length).toBeGreaterThanOrEqual(1);
    const textPart = parts.find((p) => p.type === "text");
    expect(textPart).toBeDefined();
    expect(textPart).toMatchObject({ type: "text", text: "Hello world" });
  });

  // -----------------------------------------------------------------------
  // 12. Content after tool_result opens a new text part (text-start)
  // -----------------------------------------------------------------------
  it("opens a new text part after tool_result", () => {
    // Send content first
    processor.process(sseData({ type: "content", content: "Before tool" }));

    // Tool start and result close the text part
    processor.process(
      sseData({ type: "tool_start", toolCallId: "tc_x", tool: "shell_exec", input: {} })
    );
    processor.process(
      sseData({
        type: "tool_result",
        toolCallId: "tc_x",
        tool: "shell_exec",
        success: true,
        result: "ok",
      })
    );

    // Content after tool should open a NEW text part
    const output = processor.process(
      sseData({ type: "content", content: "After tool" })
    );
    const chunks = parseSSEChunks(output);

    const textStart = chunks.find((c) => c.type === "text-start");
    expect(textStart).toBeDefined();
    // The new text part should have a different id than "text-1"
    expect(textStart!.id).not.toBe("text-0");

    const textDelta = chunks.find((c) => c.type === "text-delta");
    expect(textDelta).toMatchObject({ delta: "After tool" });
  });

  // -----------------------------------------------------------------------
  // 13. "[DONE]" data returns empty string
  // -----------------------------------------------------------------------
  it("returns empty string for [DONE] signal", () => {
    const output = processor.process("data: [DONE]\n\n");
    expect(output).toBe("");
  });

  // -----------------------------------------------------------------------
  // 14. Invalid JSON returns empty string (no crash)
  // -----------------------------------------------------------------------
  it("returns empty string for invalid JSON without crashing", () => {
    const output = processor.process("data: {invalid json\n\n");
    expect(output).toBe("");
  });

  // -----------------------------------------------------------------------
  // Bonus: collectedToolSteps tracking
  // -----------------------------------------------------------------------
  it("tracks tool steps in collectedToolSteps", () => {
    processor.process(
      sseData({
        type: "tool_start",
        toolCallId: "tc_t1",
        tool: "browser_navigate",
        input: { url: "https://example.com" },
      })
    );

    expect(processor.collectedToolSteps).toHaveLength(1);
    expect(processor.collectedToolSteps[0]).toMatchObject({
      id: "tc_t1",
      toolName: "browser_navigate",
      status: "in_progress",
    });

    processor.process(
      sseData({
        type: "tool_result",
        toolCallId: "tc_t1",
        tool: "browser_navigate",
        success: true,
        result: { url: "https://example.com" },
      })
    );

    expect(processor.collectedToolSteps[0]!.status).toBe("completed");
  });
});
