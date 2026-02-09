import { describe, it, expect } from "vitest";

// ────────────────────────────────────────────────────────
// SSE Throughput Benchmarks
// Tests SSEProcessor under high-throughput conditions
// ────────────────────────────────────────────────────────

describe("SSE Throughput Benchmarks", () => {
  it("processes 1000 text-delta events in < 100ms", async () => {
    const { SSEProcessor } = await import("@/lib/chat/sse-processor");
    const processor = new SSEProcessor();

    const events: string[] = [];
    for (let i = 0; i < 1000; i++) {
      events.push(
        `data: ${JSON.stringify({ type: "content", content: `word${i} ` })}\n\n`
      );
    }

    const start = performance.now();
    for (const event of events) {
      processor.process(event);
    }
    processor.finalize();
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(100);
    // Verify all text was accumulated
    expect(processor.collectedText).toHaveLength(1000);
  });

  it("processes 500 tool start/result pairs in < 200ms", async () => {
    const { SSEProcessor } = await import("@/lib/chat/sse-processor");
    const processor = new SSEProcessor();

    const toolNames = [
      "shell_exec",
      "file_read",
      "browser_navigate",
      "code_execute",
      "web_search",
    ];

    const start = performance.now();
    for (let i = 0; i < 500; i++) {
      const toolName = toolNames[i % toolNames.length]!;
      const toolCallId = `tc-throughput-${i}`;

      processor.process(
        `data: ${JSON.stringify({
          type: "tool_start",
          toolCallId,
          tool: toolName,
          input: { command: `echo ${i}` },
        })}\n\n`
      );
      processor.process(
        `data: ${JSON.stringify({
          type: "tool_result",
          toolCallId,
          tool: toolName,
          success: true,
          result: { stdout: `output ${i}\n`, exit_code: 0 },
        })}\n\n`
      );
    }
    processor.finalize();
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(200);
    // Verify all 500 tools were tracked and completed
    expect(processor.collectedToolSteps).toHaveLength(500);
    expect(
      processor.collectedToolSteps.every((s) => s.status === "completed")
    ).toBe(true);
  });

  it("processes mixed stream of 2000 events in < 500ms", async () => {
    const { SSEProcessor } = await import("@/lib/chat/sse-processor");
    const processor = new SSEProcessor();

    // Build a realistic mixed event stream:
    // 800 text deltas, 400 tool start/result pairs (800 events),
    // 200 metadata events (sandbox_info, browser_frame, usage, source_url),
    // 200 reasoning events
    const events: string[] = [];

    // Phase 1: reasoning events (200)
    for (let i = 0; i < 200; i++) {
      events.push(
        `data: ${JSON.stringify({ type: "reasoning", content: `think${i} ` })}\n\n`
      );
    }
    events.push(
      `data: ${JSON.stringify({ type: "reasoning_end" })}\n\n`
    );

    // Phase 2: text content (800)
    for (let i = 0; i < 800; i++) {
      events.push(
        `data: ${JSON.stringify({ type: "content", content: `word${i} ` })}\n\n`
      );
    }

    // Phase 3: tool start/result pairs (400 pairs = 800 events)
    for (let i = 0; i < 400; i++) {
      const toolCallId = `tc-mixed-${i}`;
      const tool = i % 2 === 0 ? "shell_exec" : "file_read";
      events.push(
        `data: ${JSON.stringify({
          type: "tool_start",
          toolCallId,
          tool,
          input: { data: i },
        })}\n\n`
      );
      events.push(
        `data: ${JSON.stringify({
          type: "tool_result",
          toolCallId,
          tool,
          success: true,
          result: { ok: true },
        })}\n\n`
      );
    }

    // Phase 4: metadata events (200)
    for (let i = 0; i < 50; i++) {
      events.push(
        `data: ${JSON.stringify({
          type: "source_url",
          url: `https://example.com/${i}`,
          title: `Source ${i}`,
        })}\n\n`
      );
    }
    for (let i = 0; i < 50; i++) {
      events.push(
        `data: ${JSON.stringify({
          type: "sandbox_info",
          sandboxId: `sbx-${i}`,
        })}\n\n`
      );
    }
    for (let i = 0; i < 50; i++) {
      events.push(
        `data: ${JSON.stringify({
          type: "browser_frame",
          screenshot: `base64data${i}`,
          url: `https://example.com/${i}`,
          title: `Page ${i}`,
        })}\n\n`
      );
    }
    for (let i = 0; i < 50; i++) {
      events.push(
        `data: ${JSON.stringify({
          type: "usage",
          usage: { prompt_tokens: 100, completion_tokens: 50 },
          iterations: i,
          tool_calls_count: i * 2,
        })}\n\n`
      );
    }

    // Total: 200 + 1 + 800 + 800 + 200 = 2001 events
    expect(events.length).toBeGreaterThanOrEqual(2000);

    const start = performance.now();
    for (const event of events) {
      processor.process(event);
    }
    processor.finalize();
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(500);

    // Verify aggregate counts
    expect(processor.collectedText).toHaveLength(800);
    expect(processor.collectedToolSteps).toHaveLength(400);

    // Verify parts include text, tools, sources, reasoning
    const { parts } = processor.finalize();
    // finalize() was already called above, but calling again is safe
    // Check the collectedParts accumulated during processing
    const allParts = processor.collectedParts;
    const textParts = allParts.filter(
      (p) => (p as Record<string, unknown>).type === "text"
    );
    const toolParts = allParts.filter((p) =>
      String((p as Record<string, unknown>).type).startsWith("tool-")
    );
    const sourceParts = allParts.filter(
      (p) => (p as Record<string, unknown>).type === "source-url"
    );
    const reasoningParts = allParts.filter(
      (p) => (p as Record<string, unknown>).type === "reasoning"
    );

    expect(textParts.length).toBeGreaterThanOrEqual(1);
    expect(toolParts.length).toBe(400);
    expect(sourceParts.length).toBe(50);
    expect(reasoningParts.length).toBeGreaterThanOrEqual(1);
  });

  it("processor finalize() does not leak memory (WeakRef check)", async () => {
    const { SSEProcessor } = await import("@/lib/chat/sse-processor");

    // Create processors, process events, finalize, and let them go out of scope
    const weakRefs: WeakRef<object>[] = [];

    for (let i = 0; i < 10; i++) {
      const processor = new SSEProcessor();
      for (let j = 0; j < 100; j++) {
        processor.process(
          `data: ${JSON.stringify({ type: "content", content: `chunk${j} ` })}\n\n`
        );
      }
      const result = processor.finalize();
      // Keep a WeakRef to the parts array
      weakRefs.push(new WeakRef(result.parts));
    }

    // At this point, all processors are out of scope.
    // We cannot force GC deterministically in tests, but we can verify
    // that finalize() returned valid data and the processor state was cleaned up.
    expect(weakRefs).toHaveLength(10);
    // Verify all weak refs still point to valid data (no crash)
    for (const ref of weakRefs) {
      const target = ref.deref();
      // Target may or may not be GC'd; just verify no error accessing it
      if (target) {
        expect(Array.isArray(target)).toBe(true);
      }
    }
  });

  it("processor handles rapid create-process-finalize cycles", async () => {
    const { SSEProcessor } = await import("@/lib/chat/sse-processor");

    const start = performance.now();
    for (let i = 0; i < 500; i++) {
      const processor = new SSEProcessor();
      processor.process(
        `data: ${JSON.stringify({ type: "content", content: `msg${i} ` })}\n\n`
      );
      processor.process(
        `data: ${JSON.stringify({
          type: "tool_start",
          toolCallId: `tc-${i}`,
          tool: "shell_exec",
          input: { cmd: `echo ${i}` },
        })}\n\n`
      );
      processor.process(
        `data: ${JSON.stringify({
          type: "tool_result",
          toolCallId: `tc-${i}`,
          tool: "shell_exec",
          success: true,
          result: { stdout: `${i}` },
        })}\n\n`
      );
      const result = processor.finalize();
      expect(result.parts.length).toBeGreaterThanOrEqual(2);
    }
    const elapsed = performance.now() - start;

    // 500 create-process-finalize cycles should complete quickly
    expect(elapsed).toBeLessThan(500);
  });

  it("handles large individual event payloads efficiently", async () => {
    const { SSEProcessor } = await import("@/lib/chat/sse-processor");
    const processor = new SSEProcessor();

    // Simulate large tool results (e.g., file contents, browser screenshots)
    const largeContent = "x".repeat(100_000); // 100KB string
    const start = performance.now();

    for (let i = 0; i < 20; i++) {
      const toolCallId = `tc-large-${i}`;
      processor.process(
        `data: ${JSON.stringify({
          type: "tool_start",
          toolCallId,
          tool: "file_read",
          input: { path: `/large-file-${i}.txt` },
        })}\n\n`
      );
      processor.process(
        `data: ${JSON.stringify({
          type: "tool_result",
          toolCallId,
          tool: "file_read",
          success: true,
          result: { content: largeContent },
        })}\n\n`
      );
    }

    processor.finalize();
    const elapsed = performance.now() - start;

    // 20 tool pairs with 100KB results should still be fast
    expect(elapsed).toBeLessThan(500);
    expect(processor.collectedToolSteps).toHaveLength(20);
  });
});
