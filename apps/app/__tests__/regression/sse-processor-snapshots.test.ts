import { describe, it, expect, beforeEach } from "vitest";
import { SSEProcessor } from "../../lib/chat/sse-processor";

// ============================================================================
// SSE Processor Snapshot Tests
//
// These tests capture the exact SSE output of the SSEProcessor for various
// event types. Snapshot tests protect against unintentional regressions in
// the SSE protocol transform layer. If the output format changes intentionally,
// update the snapshots with `vitest --update`.
// ============================================================================

/** Wrap a raw JSON payload as an SSE data line (agent service format). */
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

/**
 * Normalize dynamic fields (timestamps, auto-generated IDs) for stable
 * snapshots. Replaces tool_* IDs that contain Date.now() with deterministic
 * values.
 */
function normalizeChunks(
  chunks: Record<string, unknown>[]
): Record<string, unknown>[] {
  return chunks.map((chunk) => {
    const normalized = { ...chunk };
    // Normalize auto-generated toolCallId fields that contain timestamps
    if (
      typeof normalized.toolCallId === "string" &&
      normalized.toolCallId.startsWith("tool_")
    ) {
      normalized.toolCallId = "tool_NORMALIZED_ID";
    }
    return normalized;
  });
}

// ============================================================================
// Tests
// ============================================================================

describe("SSEProcessor Snapshots", () => {
  let processor: SSEProcessor;

  beforeEach(() => {
    processor = new SSEProcessor();
  });

  // -------------------------------------------------------------------------
  // 1. Content event output snapshot
  // -------------------------------------------------------------------------
  it("content event output matches snapshot", () => {
    const output = processor.process(
      sseData({ type: "content", content: "Hello, I can help you with that." })
    );
    const chunks = parseSSEChunks(output);

    expect(chunks).toMatchSnapshot();
  });

  it("multiple content events accumulate correctly (snapshot)", () => {
    const output1 = processor.process(
      sseData({ type: "content", content: "Hello" })
    );
    const output2 = processor.process(
      sseData({ type: "content", content: ", world!" })
    );
    const chunks = [
      ...parseSSEChunks(output1),
      ...parseSSEChunks(output2),
    ];

    expect(chunks).toMatchSnapshot();
  });

  // -------------------------------------------------------------------------
  // 2. Tool start + result sequence snapshot
  // -------------------------------------------------------------------------
  it("tool_start followed by tool_result sequence matches snapshot", () => {
    const startOutput = processor.process(
      sseData({
        type: "tool_start",
        toolCallId: "tc_snap_1",
        tool: "browser_navigate",
        input: { url: "https://example.com" },
      })
    );

    const resultOutput = processor.process(
      sseData({
        type: "tool_result",
        toolCallId: "tc_snap_1",
        tool: "browser_navigate",
        success: true,
        result: {
          url: "https://example.com",
          title: "Example Domain",
          status: 200,
        },
      })
    );

    const chunks = [
      ...parseSSEChunks(startOutput),
      ...parseSSEChunks(resultOutput),
    ];

    expect(chunks).toMatchSnapshot();
  });

  it("failed tool_result sequence matches snapshot", () => {
    const startOutput = processor.process(
      sseData({
        type: "tool_start",
        toolCallId: "tc_snap_fail",
        tool: "file_write",
        input: { path: "/tmp/test.txt", content: "hello" },
      })
    );

    const resultOutput = processor.process(
      sseData({
        type: "tool_result",
        toolCallId: "tc_snap_fail",
        tool: "file_write",
        success: false,
        result: { error: "Permission denied" },
      })
    );

    const chunks = [
      ...parseSSEChunks(startOutput),
      ...parseSSEChunks(resultOutput),
    ];

    expect(chunks).toMatchSnapshot();
  });

  // -------------------------------------------------------------------------
  // 3. Reasoning event output snapshot
  // -------------------------------------------------------------------------
  it("reasoning event output matches snapshot", () => {
    const output = processor.process(
      sseData({
        type: "reasoning",
        content: "Let me analyze this step by step...",
      })
    );
    const chunks = parseSSEChunks(output);

    expect(chunks).toMatchSnapshot();
  });

  it("reasoning followed by reasoning_end matches snapshot", () => {
    const reasonOutput = processor.process(
      sseData({
        type: "reasoning",
        content: "Thinking about the approach...",
      })
    );

    const endOutput = processor.process(
      sseData({ type: "reasoning_end" })
    );

    const chunks = [
      ...parseSSEChunks(reasonOutput),
      ...parseSSEChunks(endOutput),
    ];

    expect(chunks).toMatchSnapshot();
  });

  // -------------------------------------------------------------------------
  // 4. Error event output snapshot
  // -------------------------------------------------------------------------
  it("error event with string error matches snapshot", () => {
    const output = processor.process(
      sseData({ type: "error", error: "Rate limit exceeded" })
    );
    const chunks = parseSSEChunks(output);

    expect(chunks).toMatchSnapshot();
  });

  it("error event with nested object error matches snapshot", () => {
    const output = processor.process(
      sseData({
        type: "error",
        error: { message: "Internal server error", code: "INTERNAL_ERROR" },
      })
    );
    const chunks = parseSSEChunks(output);

    expect(chunks).toMatchSnapshot();
  });

  // -------------------------------------------------------------------------
  // 5. Full conversation sequence snapshot (content + tool + content)
  // -------------------------------------------------------------------------
  it("full conversation (content -> tool -> content) matches snapshot", () => {
    const allChunks: Record<string, unknown>[] = [];

    // Initial content
    const c1 = processor.process(
      sseData({ type: "content", content: "I'll search for that information." })
    );
    allChunks.push(...parseSSEChunks(c1));

    // Tool start
    const ts = processor.process(
      sseData({
        type: "tool_start",
        toolCallId: "tc_conv_1",
        tool: "web_search",
        input: { query: "latest news" },
      })
    );
    allChunks.push(...parseSSEChunks(ts));

    // Tool result
    const tr = processor.process(
      sseData({
        type: "tool_result",
        toolCallId: "tc_conv_1",
        tool: "web_search",
        success: true,
        result: { results: [{ title: "News Article", url: "https://news.com" }] },
      })
    );
    allChunks.push(...parseSSEChunks(tr));

    // Follow-up content
    const c2 = processor.process(
      sseData({ type: "content", content: "Based on the search results, here is what I found." })
    );
    allChunks.push(...parseSSEChunks(c2));

    expect(allChunks).toMatchSnapshot();
  });

  // -------------------------------------------------------------------------
  // Finalize snapshot
  // -------------------------------------------------------------------------
  it("finalize output after mixed content matches snapshot", () => {
    processor.process(sseData({ type: "content", content: "Some text" }));
    processor.process(
      sseData({
        type: "tool_start",
        toolCallId: "tc_fin_1",
        tool: "shell_exec",
        input: { cmd: "ls" },
      })
    );
    processor.process(
      sseData({
        type: "tool_result",
        toolCallId: "tc_fin_1",
        tool: "shell_exec",
        success: true,
        result: { stdout: "file.txt" },
      })
    );

    const { parts, closingSSE } = processor.finalize();
    const closingChunks = parseSSEChunks(closingSSE);

    expect({ parts, closingChunks }).toMatchSnapshot();
  });
});
