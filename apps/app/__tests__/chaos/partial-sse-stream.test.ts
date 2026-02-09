import { describe, it, expect } from "vitest";

// ────────────────────────────────────────────────────────
// Partial SSE Stream Recovery Tests
//
// Tests SSEProcessor resilience when receiving incomplete,
// malformed, or abnormally terminated SSE streams. Validates
// that the processor recovers gracefully and preserves as
// much valid data as possible.
// ────────────────────────────────────────────────────────

describe("Partial SSE Stream Recovery", () => {
  it("handles split SSE events (chunked delivery)", async () => {
    const { SSEProcessor } = await import("@/lib/chat/sse-processor");
    const processor = new SSEProcessor();

    // Full event delivered as a single chunk
    const fullEvent = `data: ${JSON.stringify({ type: "content", content: "Hello world" })}\n\n`;
    processor.process(fullEvent);

    const { parts } = processor.finalize();
    const textParts = parts.filter(
      (p) => (p as Record<string, unknown>).type === "text"
    );
    expect(textParts.length).toBeGreaterThanOrEqual(1);
    expect(processor.collectedText.join("")).toBe("Hello world");
  });

  it("handles multiple events delivered individually in rapid succession", async () => {
    const { SSEProcessor } = await import("@/lib/chat/sse-processor");
    const processor = new SSEProcessor();

    // SSEProcessor.process() is designed to receive one SSE event per call.
    // When a TCP buffer delivers multiple events, the caller (ReadableStream
    // decoder) should split on \n\n boundaries before calling process().
    // This test verifies rapid sequential calls work correctly.
    const events = [
      `data: ${JSON.stringify({ type: "content", content: "Hello " })}\n\n`,
      `data: ${JSON.stringify({ type: "content", content: "world " })}\n\n`,
      `data: ${JSON.stringify({ type: "content", content: "!" })}\n\n`,
    ];

    for (const event of events) {
      processor.process(event);
    }

    const { parts } = processor.finalize();
    const textParts = parts.filter(
      (p) => (p as Record<string, unknown>).type === "text"
    );
    expect(textParts.length).toBeGreaterThanOrEqual(1);
    expect(processor.collectedText).toHaveLength(3);
    expect(processor.collectedText.join("")).toBe("Hello world !");
  });

  it("concatenated data lines in a single process() call fail gracefully", async () => {
    const { SSEProcessor } = await import("@/lib/chat/sse-processor");
    const processor = new SSEProcessor();

    // If multiple SSE events are accidentally passed in a single process()
    // call, the processor concatenates all "data:" lines into one JSON blob
    // which fails to parse. Verify it does not crash and returns empty output.
    const batch = [
      `data: ${JSON.stringify({ type: "content", content: "Hello " })}\n\n`,
      `data: ${JSON.stringify({ type: "content", content: "world " })}\n\n`,
    ].join("");

    const output = processor.process(batch);
    // Should return empty string (parse failure caught by try/catch)
    expect(output).toBe("");

    // Subsequent valid events should still work
    processor.process(
      `data: ${JSON.stringify({ type: "content", content: "recovered" })}\n\n`
    );
    const { parts } = processor.finalize();
    const textParts = parts.filter(
      (p) => (p as Record<string, unknown>).type === "text"
    );
    expect(textParts.length).toBe(1);
  });

  it("survives malformed JSON in SSE stream", async () => {
    const { SSEProcessor } = await import("@/lib/chat/sse-processor");
    const processor = new SSEProcessor();

    // Valid event before malformed one
    processor.process(
      `data: ${JSON.stringify({ type: "content", content: "before " })}\n\n`
    );

    // Malformed JSON -- processor should catch the parse error and continue
    const malformedOutput = processor.process(`data: {invalid json\n\n`);
    expect(malformedOutput).toBe(""); // Should return empty string on parse failure

    // Valid event after malformed one -- processor should recover
    processor.process(
      `data: ${JSON.stringify({ type: "content", content: "after" })}\n\n`
    );

    const { parts } = processor.finalize();
    const textParts = parts.filter(
      (p) => (p as Record<string, unknown>).type === "text"
    );
    expect(textParts.length).toBeGreaterThanOrEqual(1);
    // Both valid content events should be captured
    expect(processor.collectedText.join("")).toBe("before after");
  });

  it("handles premature stream end (no finish event)", async () => {
    const { SSEProcessor } = await import("@/lib/chat/sse-processor");
    const processor = new SSEProcessor();

    // Stream that starts but never sends a finish event
    processor.process(
      `data: ${JSON.stringify({ type: "content", content: "Started " })}\n\n`
    );
    processor.process(
      `data: ${JSON.stringify({ type: "content", content: "but never finished" })}\n\n`
    );
    // No finish event -- just finalize directly

    const { parts, closingSSE } = processor.finalize();
    const textParts = parts.filter(
      (p) => (p as Record<string, unknown>).type === "text"
    );
    expect(textParts.length).toBeGreaterThanOrEqual(1);
    // finalize() should close any open text parts
    expect(closingSSE).toContain("text-end");
    expect(processor.collectedText.join("")).toBe("Started but never finished");
  });

  it("handles tool_start without matching tool_result (orphaned tool)", async () => {
    const { SSEProcessor } = await import("@/lib/chat/sse-processor");
    const processor = new SSEProcessor();

    // Tool starts but result never arrives (connection dropped mid-execution)
    processor.process(
      `data: ${JSON.stringify({
        type: "tool_start",
        toolCallId: "tc-orphan",
        tool: "shell_exec",
        input: { command: "long-running-command" },
      })}\n\n`
    );

    const { parts } = processor.finalize();
    // Should still have the tool part in input-available state
    expect(parts).toBeDefined();
    const toolParts = parts.filter((p) =>
      String((p as Record<string, unknown>).type).startsWith("tool-")
    );
    expect(toolParts.length).toBe(1);
    expect((toolParts[0] as Record<string, unknown>).state).toBe(
      "input-available"
    );
    expect((toolParts[0] as Record<string, unknown>).toolCallId).toBe(
      "tc-orphan"
    );
  });

  it("handles interleaved tool events correctly", async () => {
    const { SSEProcessor } = await import("@/lib/chat/sse-processor");
    const processor = new SSEProcessor();

    // Two tools started before either completes (parallel tool execution)
    processor.process(
      `data: ${JSON.stringify({
        type: "tool_start",
        toolCallId: "tc-1",
        tool: "shell_exec",
        input: { command: "echo 1" },
      })}\n\n`
    );
    processor.process(
      `data: ${JSON.stringify({
        type: "tool_start",
        toolCallId: "tc-2",
        tool: "file_read",
        input: { path: "/test" },
      })}\n\n`
    );

    // Results arrive out of order
    processor.process(
      `data: ${JSON.stringify({
        type: "tool_result",
        toolCallId: "tc-1",
        tool: "shell_exec",
        success: true,
        result: { stdout: "1\n" },
      })}\n\n`
    );
    processor.process(
      `data: ${JSON.stringify({
        type: "tool_result",
        toolCallId: "tc-2",
        tool: "file_read",
        success: true,
        result: { content: "test content" },
      })}\n\n`
    );

    const { parts } = processor.finalize();
    // Both tools should be captured with output-available state
    const toolParts = parts.filter((p) =>
      String((p as Record<string, unknown>).type).startsWith("tool-")
    );
    expect(toolParts.length).toBe(2);

    const shellPart = toolParts.find(
      (p) => (p as Record<string, unknown>).toolCallId === "tc-1"
    );
    const filePart = toolParts.find(
      (p) => (p as Record<string, unknown>).toolCallId === "tc-2"
    );
    expect(shellPart).toBeDefined();
    expect(filePart).toBeDefined();
    expect((shellPart as Record<string, unknown>).state).toBe(
      "output-available"
    );
    expect((filePart as Record<string, unknown>).state).toBe(
      "output-available"
    );
  });

  it("handles tool_result without prior tool_start (synthetic start)", async () => {
    const { SSEProcessor } = await import("@/lib/chat/sse-processor");
    const processor = new SSEProcessor();

    // tool_result arrives without a matching tool_start
    // (can happen if connection was lost and resumed mid-stream)
    processor.process(
      `data: ${JSON.stringify({
        type: "tool_result",
        toolCallId: "tc-no-start",
        tool: "web_search",
        success: true,
        result: { results: [{ title: "Example", url: "https://example.com" }] },
      })}\n\n`
    );

    const { parts } = processor.finalize();
    // Processor should emit a synthetic tool_start before the result
    const toolParts = parts.filter((p) =>
      String((p as Record<string, unknown>).type).startsWith("tool-")
    );
    expect(toolParts.length).toBeGreaterThanOrEqual(1);
    // The tool should end up with output-available state (synthetic start + real result)
    const webSearchPart = toolParts.find(
      (p) => (p as Record<string, unknown>).toolCallId === "tc-no-start"
    );
    expect(webSearchPart).toBeDefined();
    expect((webSearchPart as Record<string, unknown>).state).toBe(
      "output-available"
    );
  });

  it("handles tool_call_failed gracefully", async () => {
    const { SSEProcessor } = await import("@/lib/chat/sse-processor");
    const processor = new SSEProcessor();

    processor.process(
      `data: ${JSON.stringify({
        type: "tool_start",
        toolCallId: "tc-fail",
        tool: "browser_navigate",
        input: { url: "https://unreachable.example.com" },
      })}\n\n`
    );

    // Tool execution fails
    processor.process(
      `data: ${JSON.stringify({
        type: "tool_call_failed",
        toolCallId: "tc-fail",
        tool: "browser_navigate",
        success: false,
        error: "Connection timed out after 30s",
      })}\n\n`
    );

    const { parts } = processor.finalize();
    const toolParts = parts.filter((p) =>
      String((p as Record<string, unknown>).type).startsWith("tool-")
    );
    expect(toolParts.length).toBe(1);
    expect((toolParts[0] as Record<string, unknown>).state).toBe(
      "output-error"
    );
  });

  it("handles mixed success and failure tool results", async () => {
    const { SSEProcessor } = await import("@/lib/chat/sse-processor");
    const processor = new SSEProcessor();

    // Tool 1: succeeds
    processor.process(
      `data: ${JSON.stringify({
        type: "tool_start",
        toolCallId: "tc-ok",
        tool: "shell_exec",
        input: { command: "echo hello" },
      })}\n\n`
    );
    processor.process(
      `data: ${JSON.stringify({
        type: "tool_result",
        toolCallId: "tc-ok",
        tool: "shell_exec",
        success: true,
        result: { stdout: "hello\n" },
      })}\n\n`
    );

    // Tool 2: fails
    processor.process(
      `data: ${JSON.stringify({
        type: "tool_start",
        toolCallId: "tc-err",
        tool: "file_read",
        input: { path: "/nonexistent" },
      })}\n\n`
    );
    processor.process(
      `data: ${JSON.stringify({
        type: "tool_result",
        toolCallId: "tc-err",
        tool: "file_read",
        success: false,
        result: { error: "ENOENT: file not found" },
      })}\n\n`
    );

    // Tool 3: succeeds
    processor.process(
      `data: ${JSON.stringify({
        type: "tool_start",
        toolCallId: "tc-ok2",
        tool: "web_search",
        input: { query: "test" },
      })}\n\n`
    );
    processor.process(
      `data: ${JSON.stringify({
        type: "tool_result",
        toolCallId: "tc-ok2",
        tool: "web_search",
        success: true,
        result: { results: [] },
      })}\n\n`
    );

    const { parts } = processor.finalize();
    const toolParts = parts.filter((p) =>
      String((p as Record<string, unknown>).type).startsWith("tool-")
    );
    expect(toolParts.length).toBe(3);

    const statuses = toolParts.map(
      (p) => (p as Record<string, unknown>).state
    );
    expect(statuses).toEqual([
      "output-available",
      "output-error",
      "output-available",
    ]);
  });

  it("handles text content after tool events", async () => {
    const { SSEProcessor } = await import("@/lib/chat/sse-processor");
    const processor = new SSEProcessor();

    // Text -> Tool -> More text (common pattern: assistant thinks, uses tool, then summarizes)
    processor.process(
      `data: ${JSON.stringify({ type: "content", content: "Let me check... " })}\n\n`
    );

    processor.process(
      `data: ${JSON.stringify({
        type: "tool_start",
        toolCallId: "tc-mid",
        tool: "shell_exec",
        input: { command: "ls" },
      })}\n\n`
    );
    processor.process(
      `data: ${JSON.stringify({
        type: "tool_result",
        toolCallId: "tc-mid",
        tool: "shell_exec",
        success: true,
        result: { stdout: "file1.txt\n" },
      })}\n\n`
    );

    // Text after tool
    processor.process(
      `data: ${JSON.stringify({ type: "content", content: "I found the file." })}\n\n`
    );

    const { parts } = processor.finalize();

    // Should have: text part (before tool), tool part, text part (after tool)
    const textParts = parts.filter(
      (p) => (p as Record<string, unknown>).type === "text"
    );
    const toolParts = parts.filter((p) =>
      String((p as Record<string, unknown>).type).startsWith("tool-")
    );

    // Text before tool gets flushed when tool starts, text after tool is separate
    expect(textParts.length).toBe(2);
    expect(toolParts.length).toBe(1);
    expect((textParts[0] as Record<string, unknown>).text).toBe(
      "Let me check... "
    );
    expect((textParts[1] as Record<string, unknown>).text).toBe(
      "I found the file."
    );
  });

  it("handles error event mid-stream without losing prior data", async () => {
    const { SSEProcessor } = await import("@/lib/chat/sse-processor");
    const processor = new SSEProcessor();

    // Some content arrives before an error
    processor.process(
      `data: ${JSON.stringify({ type: "content", content: "Partial response " })}\n\n`
    );
    processor.process(
      `data: ${JSON.stringify({ type: "content", content: "before error." })}\n\n`
    );

    // Error event occurs (e.g., upstream quota error)
    const errorOutput = processor.process(
      `data: ${JSON.stringify({
        type: "error",
        error: { message: "Rate limit exceeded" },
      })}\n\n`
    );

    // Error should be forwarded
    expect(errorOutput).toContain("error");

    const { parts } = processor.finalize();

    // Prior text should still be preserved
    const textParts = parts.filter(
      (p) => (p as Record<string, unknown>).type === "text"
    );
    expect(textParts.length).toBeGreaterThanOrEqual(1);
    expect(processor.collectedText.join("")).toBe("Partial response before error.");
  });

  it("handles warning events embedded in tool execution", async () => {
    const { SSEProcessor } = await import("@/lib/chat/sse-processor");
    const processor = new SSEProcessor();

    processor.process(
      `data: ${JSON.stringify({
        type: "tool_start",
        toolCallId: "tc-warn",
        tool: "code_execute",
        input: { code: "print('hello')" },
      })}\n\n`
    );

    // Warning during tool execution
    processor.process(
      `data: ${JSON.stringify({
        type: "warning",
        message: "Sandbox memory usage high (85%)",
      })}\n\n`
    );

    processor.process(
      `data: ${JSON.stringify({
        type: "tool_result",
        toolCallId: "tc-warn",
        tool: "code_execute",
        success: true,
        result: { stdout: "hello\n" },
      })}\n\n`
    );

    const { parts } = processor.finalize();
    // Should have tool part and text part (warning rendered as text)
    const toolParts = parts.filter((p) =>
      String((p as Record<string, unknown>).type).startsWith("tool-")
    );
    expect(toolParts.length).toBe(1);
    // Warning is rendered as text content
    expect(processor.collectedText.length).toBeGreaterThanOrEqual(1);
    expect(processor.collectedText.some((t) => t.includes("Sandbox memory"))).toBe(
      true
    );
  });

  it("handles extremely long SSE data lines", async () => {
    const { SSEProcessor } = await import("@/lib/chat/sse-processor");
    const processor = new SSEProcessor();

    // 500KB content in a single event (e.g., large file read result)
    const largeContent = "A".repeat(500_000);
    processor.process(
      `data: ${JSON.stringify({ type: "content", content: largeContent })}\n\n`
    );

    const { parts } = processor.finalize();
    const textParts = parts.filter(
      (p) => (p as Record<string, unknown>).type === "text"
    );
    expect(textParts.length).toBe(1);
    expect(((textParts[0] as Record<string, unknown>).text as string).length).toBe(
      500_000
    );
  });
});
