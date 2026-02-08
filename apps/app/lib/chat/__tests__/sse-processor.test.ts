import { describe, it, expect, beforeEach } from "vitest";
import { SSEProcessor } from "../sse-processor";

// Helper: wrap a JSON payload as an SSE chunk (the format the agent service sends)
function sseChunk(data: object | string): string {
  return `data: ${typeof data === "string" ? data : JSON.stringify(data)}\n\n`;
}

// Helper: parse SSE output into individual JSON events
function parseSSEOutput(output: string): Array<Record<string, unknown>> {
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

describe("SSEProcessor", () => {
  let processor: SSEProcessor;

  beforeEach(() => {
    processor = new SSEProcessor();
  });

  // ────────────────────────────────────────────────────────
  // Content events
  // ────────────────────────────────────────────────────────

  it("content event → text-start + text-delta", () => {
    const output = processor.process(
      sseChunk({ type: "content", content: "Hello" })
    );
    const events = parseSSEOutput(output);

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ type: "text-start" });
    expect(events[0]).toHaveProperty("id");
    expect(events[1]).toMatchObject({
      type: "text-delta",
      delta: "Hello",
    });
  });

  it("multiple content events → single text-start, N text-deltas", () => {
    const out1 = processor.process(
      sseChunk({ type: "content", content: "Hello" })
    );
    const out2 = processor.process(
      sseChunk({ type: "content", content: " world" })
    );
    const out3 = processor.process(
      sseChunk({ type: "content", content: "!" })
    );

    const events1 = parseSSEOutput(out1);
    const events2 = parseSSEOutput(out2);
    const events3 = parseSSEOutput(out3);

    // First chunk opens text-start
    expect(events1).toHaveLength(2);
    expect(events1[0]).toMatchObject({ type: "text-start" });

    // Subsequent chunks only emit text-delta (no duplicate text-start)
    expect(events2).toHaveLength(1);
    expect(events2[0]).toMatchObject({ type: "text-delta", delta: " world" });

    expect(events3).toHaveLength(1);
    expect(events3[0]).toMatchObject({ type: "text-delta", delta: "!" });
  });

  // ────────────────────────────────────────────────────────
  // Reasoning events
  // ────────────────────────────────────────────────────────

  it("reasoning event → reasoning-start + reasoning-delta", () => {
    const output = processor.process(
      sseChunk({ type: "reasoning", content: "Thinking..." })
    );
    const events = parseSSEOutput(output);

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ type: "reasoning-start" });
    expect(events[1]).toMatchObject({
      type: "reasoning-delta",
      delta: "Thinking...",
    });
  });

  it("reasoning_end → closes reasoning part", () => {
    // Open reasoning
    processor.process(sseChunk({ type: "reasoning", content: "hmm" }));

    // Close reasoning
    const output = processor.process(
      sseChunk({ type: "reasoning_end" })
    );
    const events = parseSSEOutput(output);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: "reasoning-end" });
  });

  // ────────────────────────────────────────────────────────
  // Tool events
  // ────────────────────────────────────────────────────────

  it("tool_start → closes text + opens step + tool-input-start + tool-input-available", () => {
    // Open a text part first
    processor.process(sseChunk({ type: "content", content: "Hi" }));

    const output = processor.process(
      sseChunk({
        type: "tool_start",
        toolCallId: "tc_1",
        tool: "web_search",
        input: { query: "test" },
      })
    );
    const events = parseSSEOutput(output);

    // Should close text, open step, then emit tool-input-start and tool-input-available
    const types = events.map((e) => e.type);
    expect(types).toContain("text-end");
    expect(types).toContain("start-step");
    expect(types).toContain("tool-input-start");
    expect(types).toContain("tool-input-available");

    const inputAvailable = events.find(
      (e) => e.type === "tool-input-available"
    );
    expect(inputAvailable).toMatchObject({
      toolCallId: "tc_1",
      toolName: "web_search",
      input: { query: "test" },
    });
  });

  it("tool_result (success) → tool-output-available WITHOUT toolName (AI SDK v6 strict schema)", () => {
    // Start a tool
    processor.process(
      sseChunk({
        type: "tool_start",
        toolCallId: "tc_2",
        tool: "shell_exec",
        input: { command: "ls" },
      })
    );

    const output = processor.process(
      sseChunk({
        type: "tool_result",
        toolCallId: "tc_2",
        tool: "shell_exec",
        success: true,
        result: { stdout: "file1.txt\nfile2.txt" },
      })
    );
    const events = parseSSEOutput(output);

    const toolOutput = events.find(
      (e) => e.type === "tool-output-available"
    );
    expect(toolOutput).toMatchObject({
      type: "tool-output-available",
      toolCallId: "tc_2",
    });
    // CRITICAL: toolName must NOT be present — AI SDK v6 rejects extra fields
    expect(toolOutput).not.toHaveProperty("toolName");
    expect(toolOutput!.output).toEqual({ stdout: "file1.txt\nfile2.txt" });
  });

  it("tool_result (failure) → tool-output-error WITHOUT toolName (AI SDK v6 strict schema)", () => {
    processor.process(
      sseChunk({
        type: "tool_start",
        toolCallId: "tc_3",
        tool: "code_execute",
        input: { code: "1/0" },
      })
    );

    const output = processor.process(
      sseChunk({
        type: "tool_result",
        toolCallId: "tc_3",
        tool: "code_execute",
        success: false,
        result: { error: "ZeroDivisionError" },
      })
    );
    const events = parseSSEOutput(output);

    const toolError = events.find((e) => e.type === "tool-output-error");
    expect(toolError).toMatchObject({
      type: "tool-output-error",
      toolCallId: "tc_3",
      errorText: "ZeroDivisionError",
    });
    // CRITICAL: toolName must NOT be present — AI SDK v6 rejects extra fields
    expect(toolError).not.toHaveProperty("toolName");
  });

  // ────────────────────────────────────────────────────────
  // Special events
  // ────────────────────────────────────────────────────────

  it("source_url → source-url passthrough", () => {
    const output = processor.process(
      sseChunk({
        type: "source_url",
        url: "https://example.com",
        title: "Example",
      })
    );
    const events = parseSSEOutput(output);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "source-url",
      url: "https://example.com",
      title: "Example",
    });
  });

  it("sandbox_info → message-metadata with sandboxId", () => {
    const output = processor.process(
      sseChunk({ type: "sandbox_info", sandboxId: "sb_abc123" })
    );
    const events = parseSSEOutput(output);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "message-metadata",
      messageMetadata: { sandboxId: "sb_abc123" },
    });
  });

  it("browser_frame → message-metadata with browserFrame", () => {
    const output = processor.process(
      sseChunk({
        type: "browser_frame",
        screenshot: "base64data",
        url: "https://example.com",
        title: "Example",
      })
    );
    const events = parseSSEOutput(output);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "message-metadata",
      messageMetadata: {
        browserFrame: {
          screenshot: "base64data",
          url: "https://example.com",
          title: "Example",
        },
      },
    });
  });

  it("usage → message-metadata with usage stats", () => {
    const output = processor.process(
      sseChunk({
        type: "usage",
        usage: { prompt_tokens: 100, completion_tokens: 200 },
        iterations: 3,
        tool_calls_count: 5,
      })
    );
    const events = parseSSEOutput(output);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "message-metadata",
      messageMetadata: {
        usage: { prompt_tokens: 100, completion_tokens: 200 },
        iterations: 3,
        toolCallsCount: 5,
      },
    });
  });

  // ────────────────────────────────────────────────────────
  // Error and warning events
  // ────────────────────────────────────────────────────────

  it("error → closes text + error event", () => {
    // Open text first
    processor.process(sseChunk({ type: "content", content: "Starting..." }));

    const output = processor.process(
      sseChunk({ type: "error", error: "Something went wrong" })
    );
    const events = parseSSEOutput(output);
    const types = events.map((e) => e.type);

    expect(types).toContain("text-end");
    expect(types).toContain("error");

    const errorEvent = events.find((e) => e.type === "error");
    expect(errorEvent).toMatchObject({
      type: "error",
      errorText: "Something went wrong",
    });
  });

  it("warning → text-delta with ⚠️ prefix", () => {
    const output = processor.process(
      sseChunk({ type: "warning", message: "Rate limit approaching" })
    );
    const events = parseSSEOutput(output);

    // Should open text part + emit delta
    const delta = events.find((e) => e.type === "text-delta");
    expect(delta).toBeTruthy();
    expect(delta!.delta).toContain("⚠️");
    expect(delta!.delta).toContain("Rate limit approaching");
  });

  // ────────────────────────────────────────────────────────
  // Finalization
  // ────────────────────────────────────────────────────────

  it("finalize() → closes open text/reasoning/step parts", () => {
    // Open text
    processor.process(sseChunk({ type: "content", content: "Hello" }));

    const { closingSSE, parts } = processor.finalize();
    const events = parseSSEOutput(closingSSE);
    const types = events.map((e) => e.type);

    expect(types).toContain("text-end");
    expect(parts.length).toBeGreaterThan(0);
    expect(parts.some((p) => p.type === "text")).toBe(true);
  });

  it("finalize() closes open reasoning and step parts", () => {
    // Open reasoning + step
    processor.process(sseChunk({ type: "reasoning", content: "thinking" }));
    processor.process(
      sseChunk({
        type: "tool_start",
        toolCallId: "t1",
        tool: "web_search",
        input: {},
      })
    );

    const { closingSSE } = processor.finalize();
    const events = parseSSEOutput(closingSSE);
    const types = events.map((e) => e.type);

    expect(types).toContain("finish-step");
  });

  // ────────────────────────────────────────────────────────
  // collectedParts
  // ────────────────────────────────────────────────────────

  it("collectedParts → accumulates text, tools, sources", () => {
    processor.process(sseChunk({ type: "content", content: "Hello" }));
    processor.process(
      sseChunk({
        type: "tool_start",
        toolCallId: "tc_4",
        tool: "file_read",
        input: { path: "/test.txt" },
      })
    );
    processor.process(
      sseChunk({
        type: "tool_result",
        toolCallId: "tc_4",
        tool: "file_read",
        success: true,
        result: { content: "file contents" },
      })
    );
    processor.process(
      sseChunk({
        type: "source_url",
        url: "https://docs.example.com",
        title: "Docs",
      })
    );
    processor.process(sseChunk({ type: "content", content: " World" }));

    const { parts } = processor.finalize();

    // Should have: text("Hello"), tool(file_read), source-url, text(" World")
    const textParts = parts.filter((p) => p.type === "text");
    const toolParts = parts.filter(
      (p) => typeof p.type === "string" && (p.type as string).startsWith("tool-")
    );
    const sourceParts = parts.filter((p) => p.type === "source-url");

    expect(textParts.length).toBeGreaterThanOrEqual(1);
    expect(toolParts).toHaveLength(1);
    expect(sourceParts).toHaveLength(1);
    expect(sourceParts[0]).toMatchObject({
      url: "https://docs.example.com",
      title: "Docs",
    });
  });

  // ────────────────────────────────────────────────────────
  // Edge cases
  // ────────────────────────────────────────────────────────

  it("[DONE] → returns empty string", () => {
    const output = processor.process("data: [DONE]\n\n");
    expect(output).toBe("");
  });

  it("invalid JSON → returns empty string (no crash)", () => {
    const output = processor.process("data: {invalid json\n\n");
    expect(output).toBe("");
  });

  it("empty data → returns empty string", () => {
    const output = processor.process("");
    expect(output).toBe("");
  });

  it("content event with empty content → no output", () => {
    const output = processor.process(
      sseChunk({ type: "content", content: "" })
    );
    expect(output).toBe("");
  });

  it("tool_result updates collectedToolSteps status", () => {
    processor.process(
      sseChunk({
        type: "tool_start",
        toolCallId: "tc_5",
        tool: "shell_exec",
        input: {},
      })
    );
    expect(processor.collectedToolSteps[0]!.status).toBe("in_progress");

    processor.process(
      sseChunk({
        type: "tool_result",
        toolCallId: "tc_5",
        tool: "shell_exec",
        success: true,
        result: {},
      })
    );
    expect(processor.collectedToolSteps[0]!.status).toBe("completed");
  });

  it("failed tool_result marks step as cancelled", () => {
    processor.process(
      sseChunk({
        type: "tool_start",
        toolCallId: "tc_6",
        tool: "code_execute",
        input: {},
      })
    );

    processor.process(
      sseChunk({
        type: "tool_result",
        toolCallId: "tc_6",
        tool: "code_execute",
        success: false,
        summary: "Execution timed out",
      })
    );
    expect(processor.collectedToolSteps[0]!.status).toBe("cancelled");
  });

  it("tool_result fallback error text when result has no error field", () => {
    processor.process(
      sseChunk({
        type: "tool_start",
        toolCallId: "tc_7",
        tool: "shell_exec",
        input: {},
      })
    );

    const output = processor.process(
      sseChunk({
        type: "tool_result",
        toolCallId: "tc_7",
        tool: "shell_exec",
        success: false,
        summary: "Custom failure message",
      })
    );
    const events = parseSSEOutput(output);
    const toolError = events.find((e) => e.type === "tool-output-error");
    expect(toolError).toMatchObject({
      errorText: "Custom failure message",
    });
  });

  it("error event with nested error object", () => {
    const output = processor.process(
      sseChunk({
        type: "error",
        error: { message: "Rate limit exceeded" },
      })
    );
    const events = parseSSEOutput(output);
    const errorEvent = events.find((e) => e.type === "error");
    expect(errorEvent!.errorText).toBe("Rate limit exceeded");
  });

  it("reasoning closes open text part first", () => {
    processor.process(sseChunk({ type: "content", content: "Text" }));
    const output = processor.process(
      sseChunk({ type: "reasoning", content: "Think" })
    );
    const events = parseSSEOutput(output);
    const types = events.map((e) => e.type);

    // Should close text before opening reasoning
    const textEndIdx = types.indexOf("text-end");
    const reasoningStartIdx = types.indexOf("reasoning-start");
    expect(textEndIdx).toBeLessThan(reasoningStartIdx);
  });

  // ────────────────────────────────────────────────────────
  // AI SDK v6 strict schema compliance
  // ────────────────────────────────────────────────────────

  describe("AI SDK v6 strict schema compliance", () => {
    /**
     * The AI SDK v6 DefaultChatTransport uses strict Zod validation.
     * Each chunk type has an exact schema — extra fields cause
     * AI_TypeValidationError. This test validates every chunk type.
     */

    it("tool-input-start has ONLY { type, toolCallId, toolName }", () => {
      const output = processor.process(
        sseChunk({
          type: "tool_start",
          toolCallId: "strict_1",
          tool: "web_search",
          input: { query: "test" },
        })
      );
      const events = parseSSEOutput(output);
      const chunk = events.find((e) => e.type === "tool-input-start");
      expect(chunk).toBeDefined();
      const keys = Object.keys(chunk!).sort();
      expect(keys).toEqual(["toolCallId", "toolName", "type"]);
    });

    it("tool-input-available has ONLY { type, toolCallId, toolName, input }", () => {
      const output = processor.process(
        sseChunk({
          type: "tool_start",
          toolCallId: "strict_2",
          tool: "file_read",
          input: { path: "/test" },
        })
      );
      const events = parseSSEOutput(output);
      const chunk = events.find((e) => e.type === "tool-input-available");
      expect(chunk).toBeDefined();
      const keys = Object.keys(chunk!).sort();
      expect(keys).toEqual(["input", "toolCallId", "toolName", "type"]);
    });

    it("tool-output-available has ONLY { type, toolCallId, output } — NO toolName", () => {
      processor.process(
        sseChunk({
          type: "tool_start",
          toolCallId: "strict_3",
          tool: "shell_exec",
          input: {},
        })
      );
      const output = processor.process(
        sseChunk({
          type: "tool_result",
          toolCallId: "strict_3",
          tool: "shell_exec",
          success: true,
          result: { stdout: "ok" },
        })
      );
      const events = parseSSEOutput(output);
      const chunk = events.find((e) => e.type === "tool-output-available");
      expect(chunk).toBeDefined();
      const keys = Object.keys(chunk!).sort();
      expect(keys).toEqual(["output", "toolCallId", "type"]);
    });

    it("tool-output-error has ONLY { type, toolCallId, errorText } — NO toolName", () => {
      processor.process(
        sseChunk({
          type: "tool_start",
          toolCallId: "strict_4",
          tool: "code_execute",
          input: {},
        })
      );
      const output = processor.process(
        sseChunk({
          type: "tool_result",
          toolCallId: "strict_4",
          tool: "code_execute",
          success: false,
          result: { error: "Crash" },
        })
      );
      const events = parseSSEOutput(output);
      const chunk = events.find((e) => e.type === "tool-output-error");
      expect(chunk).toBeDefined();
      const keys = Object.keys(chunk!).sort();
      expect(keys).toEqual(["errorText", "toolCallId", "type"]);
    });

    it("text-delta has ONLY { type, id, delta }", () => {
      const output = processor.process(
        sseChunk({ type: "content", content: "hi" })
      );
      const events = parseSSEOutput(output);
      const chunk = events.find((e) => e.type === "text-delta");
      expect(chunk).toBeDefined();
      const keys = Object.keys(chunk!).sort();
      expect(keys).toEqual(["delta", "id", "type"]);
    });

    it("full tool lifecycle — tool_start + tool_result produces valid SDK chunks", () => {
      // Simulate a complete show_plan call (the original failing scenario)
      const startOutput = processor.process(
        sseChunk({
          type: "tool_start",
          toolCallId: "toolu_show_plan",
          tool: "show_plan",
          input: {
            title: "Build website",
            steps: [
              { title: "Create files", status: "in_progress" },
              { title: "Style page", status: "pending" },
            ],
          },
        })
      );
      const resultOutput = processor.process(
        sseChunk({
          type: "tool_result",
          toolCallId: "toolu_show_plan",
          tool: "show_plan",
          success: true,
          result: { displayed: true },
        })
      );

      const allEvents = [
        ...parseSSEOutput(startOutput),
        ...parseSSEOutput(resultOutput),
      ];

      // Verify tool-output-available does NOT have toolName
      const outputChunk = allEvents.find((e) => e.type === "tool-output-available");
      expect(outputChunk).toBeDefined();
      expect(outputChunk).not.toHaveProperty("toolName");
      expect(outputChunk).toMatchObject({
        type: "tool-output-available",
        toolCallId: "toolu_show_plan",
        output: { displayed: true },
      });

      // Verify tool-input-start and tool-input-available DO have toolName
      const inputStart = allEvents.find((e) => e.type === "tool-input-start");
      expect(inputStart).toHaveProperty("toolName", "show_plan");
      const inputAvail = allEvents.find((e) => e.type === "tool-input-available");
      expect(inputAvail).toHaveProperty("toolName", "show_plan");
    });
  });
});
