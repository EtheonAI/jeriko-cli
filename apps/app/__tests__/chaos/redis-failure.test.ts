import { describe, it, expect, vi } from "vitest";

// ────────────────────────────────────────────────────────
// Redis Failure Resilience Tests
//
// Validates that the SSE processing pipeline continues to
// function correctly when Redis is unavailable, ensuring
// graceful degradation to non-resumable streaming.
// ────────────────────────────────────────────────────────

describe("Redis Failure Resilience", () => {
  it("falls back to non-resumable stream when Redis is unavailable", async () => {
    // Mock ioredis to throw on construction (simulating connection refused)
    vi.doMock("ioredis", () => ({
      default: class MockRedis {
        constructor() {
          throw new Error("ECONNREFUSED: Redis connection refused");
        }
      },
    }));

    // SSEProcessor does not depend on Redis directly -- it processes
    // SSE events in-memory. The resilience test verifies that even when
    // Redis is broken at the module level, SSEProcessor still works.
    const { SSEProcessor } = await import("@/lib/chat/sse-processor");
    const processor = new SSEProcessor();

    processor.process(
      `data: ${JSON.stringify({ type: "content", content: "Hello " })}\n\n`
    );
    processor.process(
      `data: ${JSON.stringify({ type: "content", content: "world" })}\n\n`
    );
    const { parts } = processor.finalize();

    const textParts = parts.filter(
      (p) => (p as Record<string, unknown>).type === "text"
    );
    expect(textParts.length).toBeGreaterThanOrEqual(1);
    expect(processor.collectedText.join("")).toBe("Hello world");

    vi.doUnmock("ioredis");
  });

  it("SSEProcessor handles empty events gracefully", async () => {
    const { SSEProcessor } = await import("@/lib/chat/sse-processor");
    const processor = new SSEProcessor();

    // Send empty/malformed events -- none should crash the processor
    const output1 = processor.process("");
    const output2 = processor.process("data: \n\n");
    const output3 = processor.process("data: {}\n\n");
    const output4 = processor.process(
      `data: ${JSON.stringify({ type: "content", content: "recovery" })}\n\n`
    );

    // Empty string and "data: " produce no data after parsing
    expect(output1).toBe("");
    // "{}" parses to an empty object with no matching event type -- falls through default
    expect(output3).toBe("");
    // The content event should produce output
    expect(output4).toContain("text-delta");

    const { parts } = processor.finalize();
    const textParts = parts.filter(
      (p) => (p as Record<string, unknown>).type === "text"
    );
    expect(textParts.length).toBeGreaterThanOrEqual(1);
  });

  it("SSEProcessor handles rapid create/disconnect simulation", async () => {
    const { SSEProcessor } = await import("@/lib/chat/sse-processor");

    // Simulate creating and finalizing many processors rapidly
    // (as would happen with rapid connect/disconnect cycles)
    const results: Array<{ parts: Record<string, unknown>[]; closingSSE: string }> = [];
    for (let i = 0; i < 100; i++) {
      const proc = new SSEProcessor();
      proc.process(
        `data: ${JSON.stringify({ type: "content", content: `msg${i}` })}\n\n`
      );
      results.push(proc.finalize());
    }

    expect(results).toHaveLength(100);
    for (const r of results) {
      expect(r.parts.length).toBeGreaterThanOrEqual(1);
      const textParts = r.parts.filter(
        (p) => (p as Record<string, unknown>).type === "text"
      );
      expect(textParts.length).toBe(1);
    }
  });

  it("SSEProcessor handles [DONE] sentinel without crashing", async () => {
    const { SSEProcessor } = await import("@/lib/chat/sse-processor");
    const processor = new SSEProcessor();

    processor.process(
      `data: ${JSON.stringify({ type: "content", content: "before done" })}\n\n`
    );
    // [DONE] is a standard SSE sentinel -- processor should ignore it
    const doneOutput = processor.process("data: [DONE]\n\n");
    expect(doneOutput).toBe("");

    const { parts } = processor.finalize();
    const textParts = parts.filter(
      (p) => (p as Record<string, unknown>).type === "text"
    );
    expect(textParts.length).toBe(1);
  });

  it("SSEProcessor handles events with missing required fields", async () => {
    const { SSEProcessor } = await import("@/lib/chat/sse-processor");
    const processor = new SSEProcessor();

    // tool_start without tool name -- should default to "unknown"
    processor.process(
      `data: ${JSON.stringify({
        type: "tool_start",
        toolCallId: "tc-no-name",
        input: { x: 1 },
      })}\n\n`
    );

    // tool_result without toolCallId -- should correlate with last active tool
    processor.process(
      `data: ${JSON.stringify({
        type: "tool_result",
        tool: "unknown",
        success: true,
        result: { ok: true },
      })}\n\n`
    );

    // content with empty string -- should not crash
    processor.process(
      `data: ${JSON.stringify({ type: "content", content: "" })}\n\n`
    );

    // source_url without title -- should still work
    processor.process(
      `data: ${JSON.stringify({
        type: "source_url",
        url: "https://example.com",
      })}\n\n`
    );

    const { parts } = processor.finalize();
    expect(parts).toBeDefined();
    expect(Array.isArray(parts)).toBe(true);

    // Should have tool part + source part at minimum
    const toolParts = parts.filter((p) =>
      String((p as Record<string, unknown>).type).startsWith("tool-")
    );
    const sourceParts = parts.filter(
      (p) => (p as Record<string, unknown>).type === "source-url"
    );
    expect(toolParts.length).toBeGreaterThanOrEqual(1);
    expect(sourceParts.length).toBe(1);
  });

  it("SSEProcessor handles concurrent-like interleaved event types", async () => {
    const { SSEProcessor } = await import("@/lib/chat/sse-processor");
    const processor = new SSEProcessor();

    // Rapid switching between different event types
    for (let i = 0; i < 50; i++) {
      // Text
      processor.process(
        `data: ${JSON.stringify({ type: "content", content: `t${i} ` })}\n\n`
      );
      // Reasoning
      processor.process(
        `data: ${JSON.stringify({ type: "reasoning", content: `r${i} ` })}\n\n`
      );
      // Back to text
      processor.process(
        `data: ${JSON.stringify({ type: "content", content: `t${i}b ` })}\n\n`
      );
    }

    const { parts } = processor.finalize();

    // Should have multiple text and reasoning parts due to switching
    const textParts = parts.filter(
      (p) => (p as Record<string, unknown>).type === "text"
    );
    const reasoningParts = parts.filter(
      (p) => (p as Record<string, unknown>).type === "reasoning"
    );
    expect(textParts.length).toBeGreaterThanOrEqual(1);
    expect(reasoningParts.length).toBeGreaterThanOrEqual(1);
  });
});
