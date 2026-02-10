import { describe, it, expect } from "vitest";
import {
  parseSSEEvent,
  formatSSEEvent,
  parseSSEChunk,
  formatSSEChunk,
  formatSSEDone,
  isSSEEvent,
  isSSEDone,
} from "../src/adapters/sse-adapter";
import {
  anthropicToOpenAI,
  openAIToAnthropic,
  convertToolsToOpenAI,
  convertToolsToAnthropic,
  validateToolDefinition,
} from "../src/adapters/tool-adapter";
import type { SSEEvent } from "../src/schemas/events";
import type { AnthropicToolDefinition, OpenAIToolDefinition } from "../src/adapters/tool-adapter";

describe("SSE Adapter - Parsing", () => {
  it("parses valid SSE event string", () => {
    const eventString = 'data: {"type":"content","content":"Hello","timestamp":1234567890}\n\n';
    const event = parseSSEEvent(eventString);

    expect(event).toBeDefined();
    expect(event?.type).toBe("content");
    if (event?.type === "content") {
      expect(event.content).toBe("Hello");
    }
  });

  it("returns null for [DONE] sentinel", () => {
    const eventString = "data: [DONE]\n\n";
    const event = parseSSEEvent(eventString);

    expect(event).toBeNull();
  });

  it("returns null for malformed JSON", () => {
    const eventString = "data: {invalid json}\n\n";
    const event = parseSSEEvent(eventString);

    expect(event).toBeNull();
  });

  it("parses multiple events from chunk", () => {
    const chunk =
      'data: {"type":"content","content":"Hello","timestamp":123}\n\n' +
      'data: {"type":"content","content":"World","timestamp":124}\n\n';

    const events = parseSSEChunk(chunk);

    expect(events).toHaveLength(2);
    expect(events[0].type).toBe("content");
    expect(events[1].type).toBe("content");
  });
});

describe("SSE Adapter - Formatting", () => {
  it("formats event object to SSE string", () => {
    const event: SSEEvent = {
      type: "content",
      content: "Test message",
      timestamp: 1234567890,
    };

    const formatted = formatSSEEvent(event);

    expect(formatted).toMatch(/^data: /);
    expect(formatted).toContain('"type":"content"');
    expect(formatted).toContain('"content":"Test message"');
    expect(formatted.endsWith("\n\n")).toBe(true);
  });

  it("formats DONE sentinel", () => {
    const done = formatSSEDone();

    expect(done).toBe("data: [DONE]\n\n");
  });

  it("formats multiple events to chunk", () => {
    const events: SSEEvent[] = [
      { type: "content", content: "First", timestamp: 123 },
      { type: "content", content: "Second", timestamp: 124 },
    ];

    const chunk = formatSSEChunk(events);

    expect(chunk).toContain('"content":"First"');
    expect(chunk).toContain('"content":"Second"');
    expect(chunk.split("\n\n")).toHaveLength(3); // 2 events + trailing newline
  });

  it("roundtrip parse and format preserves event", () => {
    const original: SSEEvent = {
      type: "tool_call_started",
      toolCallId: "tc_001",
      tool: "file_read",
      input: { path: "/test.txt" },
      timestamp: 1234567890,
    };

    const formatted = formatSSEEvent(original);
    const parsed = parseSSEEvent(formatted);

    expect(parsed).toEqual(original);
  });
});

describe("SSE Adapter - Type Guards", () => {
  it("identifies valid SSE event string", () => {
    const valid = 'data: {"type":"content","timestamp":123}\n\n';
    expect(isSSEEvent(valid)).toBe(true);
  });

  it("rejects invalid SSE event string", () => {
    const invalid = "invalid string";
    expect(isSSEEvent(invalid)).toBe(false);
  });

  it("identifies DONE sentinel", () => {
    const done = "data: [DONE]\n\n";
    expect(isSSEDone(done)).toBe(true);
  });

  it("rejects non-DONE string", () => {
    const notDone = 'data: {"type":"content"}\n\n';
    expect(isSSEDone(notDone)).toBe(false);
  });
});

describe("Tool Adapter - Format Conversion", () => {
  const anthropicTool: AnthropicToolDefinition = {
    name: "file_read",
    description: "Read a file from the filesystem",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "File path" },
      },
      required: ["path"],
    },
  };

  const openAITool: OpenAIToolDefinition = {
    type: "function",
    function: {
      name: "file_read",
      description: "Read a file from the filesystem",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path" },
        },
        required: ["path"],
      },
    },
  };

  it("converts Anthropic format to OpenAI format", () => {
    const converted = anthropicToOpenAI(anthropicTool);

    expect(converted.type).toBe("function");
    expect(converted.function.name).toBe("file_read");
    expect(converted.function.parameters.properties.path).toBeDefined();
  });

  it("converts OpenAI format to Anthropic format", () => {
    const converted = openAIToAnthropic(openAITool);

    expect(converted.name).toBe("file_read");
    expect(converted.description).toBe("Read a file from the filesystem");
    expect(converted.input_schema.properties.path).toBeDefined();
  });

  it("roundtrip conversion preserves tool definition", () => {
    const toOpenAI = anthropicToOpenAI(anthropicTool);
    const backToAnthropic = openAIToAnthropic(toOpenAI);

    expect(backToAnthropic).toEqual(anthropicTool);
  });

  it("converts array of Anthropic tools to OpenAI", () => {
    const tools = [anthropicTool, { ...anthropicTool, name: "file_write" }];
    const converted = convertToolsToOpenAI(tools);

    expect(converted).toHaveLength(2);
    expect(converted[0].type).toBe("function");
    expect(converted[1].function.name).toBe("file_write");
  });

  it("converts array of OpenAI tools to Anthropic", () => {
    const tools = [
      openAITool,
      { ...openAITool, function: { ...openAITool.function, name: "file_write" } },
    ];
    const converted = convertToolsToAnthropic(tools);

    expect(converted).toHaveLength(2);
    expect(converted[0].name).toBe("file_read");
    expect(converted[1].name).toBe("file_write");
  });
});

describe("Tool Adapter - Validation", () => {
  it("validates correct tool definition", () => {
    const validTool = {
      name: "test_tool",
      description: "A test tool",
      input_schema: {
        type: "object",
        properties: {},
      },
    };

    expect(validateToolDefinition(validTool)).toBe(true);
  });

  it("rejects tool without name", () => {
    const invalidTool = {
      description: "Missing name",
      input_schema: {},
    };

    expect(validateToolDefinition(invalidTool)).toBe(false);
  });

  it("rejects tool without input_schema", () => {
    const invalidTool = {
      name: "test",
      description: "Missing schema",
    };

    expect(validateToolDefinition(invalidTool)).toBe(false);
  });

  it("rejects non-object input", () => {
    expect(validateToolDefinition(null)).toBe(false);
    expect(validateToolDefinition("string")).toBe(false);
    expect(validateToolDefinition(123)).toBe(false);
  });
});
