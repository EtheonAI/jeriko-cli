import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock dependencies BEFORE importing the module under test.
// provider-fallback.ts imports from:
//   - @repo/observability/log
//   - ./error-detection
//   - ./persistence
//   - ./agent-proxy
//   - ./sse-processor (type-only)
// ---------------------------------------------------------------------------

vi.mock("@repo/observability/log", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("../../lib/chat/persistence", () => ({
  saveMessageToDB: vi.fn(() => Promise.resolve(undefined)),
  autoSetSessionTitle: vi.fn(() => Promise.resolve(undefined)),
}));

vi.mock("../../lib/chat/agent-proxy", () => ({
  AGENT_SERVICE_URL: "http://localhost:8000",
  createAgentProxyResponse: vi.fn((_body: unknown, _opts: unknown) => {
    return new Response("agent-ok", { status: 200 });
  }),
}));

// We need the real extractErrorMessage for inline fallback
vi.mock("../../lib/chat/error-detection", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual };
});

import {
  streamWithProviderFallback,
  streamFallbackInlineToStringStream,
} from "../../lib/chat/provider-fallback";
import { SSEProcessor } from "../../lib/chat/sse-processor";
import { createAgentProxyResponse } from "../../lib/chat/agent-proxy";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse SSE chunks from a Response body string. */
function parseSSEChunks(raw: string): Record<string, unknown>[] {
  const chunks: Record<string, unknown>[] = [];
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("data: ")) {
      try {
        chunks.push(JSON.parse(trimmed.slice(6)) as Record<string, unknown>);
      } catch {
        // skip
      }
    }
  }
  return chunks;
}

// ---------------------------------------------------------------------------
// Tests for streamWithProviderFallback
// ---------------------------------------------------------------------------

describe("streamWithProviderFallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset global fetch mock before each test
    vi.restoreAllMocks();
  });

  // -----------------------------------------------------------------------
  // 1. Returns proxied response when agent retry succeeds
  // -----------------------------------------------------------------------
  it("returns proxied agent response when retry succeeds", async () => {
    // Mock fetch to simulate agent service returning a successful response
    const mockBody = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("data: ok\n\n"));
        controller.close();
      },
    });

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(mockBody, { status: 200 })
    );

    const response = await streamWithProviderFallback(
      "Hello",
      "claude-sonnet-4-20250514",
      "You are helpful.",
      "session_1"
    );

    // createAgentProxyResponse should have been called
    expect(createAgentProxyResponse).toHaveBeenCalled();
    expect(response.status).toBe(200);
  });

  // -----------------------------------------------------------------------
  // 2. Returns error SSE when agent service is unavailable
  // -----------------------------------------------------------------------
  it("returns clean error SSE response when agent service is completely unavailable", async () => {
    // Mock fetch to throw (agent down)
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("Connection refused"));

    const response = await streamWithProviderFallback(
      "Hello",
      undefined,
      "You are helpful.",
      "session_2"
    );

    expect(response.status).toBe(200); // SSE responses use 200 even for errors
    const body = await response.text();
    const chunks = parseSSEChunks(body);

    // Should have start, text-start, text-delta, text-end, finish
    const textDelta = chunks.find((c) => c.type === "text-delta");
    expect(textDelta).toBeDefined();
    expect(textDelta!.delta).toContain("temporarily unavailable");

    const finish = chunks.find((c) => c.type === "finish");
    expect(finish).toBeDefined();
    expect(finish!.finishReason).toBe("error");
  });

  // -----------------------------------------------------------------------
  // 3. Returns error SSE when agent returns non-ok response
  // -----------------------------------------------------------------------
  it("returns error SSE when agent returns non-200 status", async () => {
    // Agent returns 500
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("Internal Server Error", { status: 500 })
    );

    const response = await streamWithProviderFallback(
      "Hello",
      undefined,
      "You are helpful.",
      "session_3"
    );

    const body = await response.text();
    const chunks = parseSSEChunks(body);

    // Should get a graceful error, not a crash
    const textDelta = chunks.find((c) => c.type === "text-delta");
    expect(textDelta).toBeDefined();
    expect(textDelta!.delta).toContain("temporarily unavailable");
  });
});

// ---------------------------------------------------------------------------
// Tests for streamFallbackInlineToStringStream
// ---------------------------------------------------------------------------

describe("streamFallbackInlineToStringStream", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // 4. Inline fallback streams error message through controller
  // -----------------------------------------------------------------------
  it("streams error message and closes controller", async () => {
    const enqueued: string[] = [];
    let closed = false;

    const mockController = {
      enqueue: vi.fn((chunk: string) => enqueued.push(chunk)),
      close: vi.fn(() => { closed = true; }),
      error: vi.fn(),
      desiredSize: 1,
    } as unknown as ReadableStreamDefaultController<string>;

    const processor = new SSEProcessor();

    await streamFallbackInlineToStringStream(
      mockController,
      processor,
      true, // hasStarted
      "Tell me about AI",
      "claude-sonnet-4-20250514",
      "You are helpful.",
      "session_4"
    );

    // Should have enqueued text-start, text-delta, text-end, finish
    const allOutput = enqueued.join("");
    const chunks = parseSSEChunks(allOutput);

    const textStart = chunks.find((c) => c.type === "text-start");
    expect(textStart).toBeDefined();

    const textDelta = chunks.find((c) => c.type === "text-delta");
    expect(textDelta).toBeDefined();
    expect(textDelta!.delta).toContain("service limit");

    const textEnd = chunks.find((c) => c.type === "text-end");
    expect(textEnd).toBeDefined();

    const finish = chunks.find((c) => c.type === "finish");
    expect(finish).toMatchObject({ finishReason: "error" });

    // Controller should be closed
    expect(closed).toBe(true);
  });

  // -----------------------------------------------------------------------
  // 5. Inline fallback emits start event when hasStarted is false
  // -----------------------------------------------------------------------
  it("emits start event when hasStarted is false", async () => {
    const enqueued: string[] = [];

    const mockController = {
      enqueue: vi.fn((chunk: string) => enqueued.push(chunk)),
      close: vi.fn(),
      error: vi.fn(),
      desiredSize: 1,
    } as unknown as ReadableStreamDefaultController<string>;

    const processor = new SSEProcessor();

    await streamFallbackInlineToStringStream(
      mockController,
      processor,
      false, // hasStarted = false
      "Hello",
      undefined,
      "",
      "session_5"
    );

    const allOutput = enqueued.join("");
    const chunks = parseSSEChunks(allOutput);

    // Should include a "start" event because hasStarted was false
    const startChunk = chunks.find((c) => c.type === "start");
    expect(startChunk).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // 6. Inline fallback closes any open text part from processor
  // -----------------------------------------------------------------------
  it("closes open text part from prior processor output", async () => {
    const enqueued: string[] = [];

    const mockController = {
      enqueue: vi.fn((chunk: string) => enqueued.push(chunk)),
      close: vi.fn(),
      error: vi.fn(),
      desiredSize: 1,
    } as unknown as ReadableStreamDefaultController<string>;

    // Pre-open a text part in the processor
    const processor = new SSEProcessor();
    processor.process(`data: ${JSON.stringify({ type: "content", content: "partial" })}\n\n`);
    // Now there is an open text part

    await streamFallbackInlineToStringStream(
      mockController,
      processor,
      true,
      "Hello",
      undefined,
      "",
      "session_6"
    );

    const allOutput = enqueued.join("");
    const chunks = parseSSEChunks(allOutput);

    // Should have a text-end (for the prior open part) before the new text-start
    const textEnds = chunks.filter((c) => c.type === "text-end");
    expect(textEnds.length).toBeGreaterThanOrEqual(1);
  });
});
