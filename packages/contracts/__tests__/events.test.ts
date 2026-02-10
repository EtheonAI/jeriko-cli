import { describe, it, expect } from "vitest";
import {
  SessionCreatedEventSchema,
  ToolCallStartedEventSchema,
  ToolCallCompletedEventSchema,
  UsageEventSchema,
  ErrorEventSchema,
  SSEEventSchema,
} from "../src/schemas/events";

describe("Event Contract - Session Events", () => {
  it("valid session_created event passes validation", () => {
    const event = {
      type: "session_created",
      sessionId: "sess_abc123",
      sandboxId: "sbx_xyz789",
      nekoUrl: "https://neko.example.com",
      timestamp: Date.now(),
    };

    const result = SessionCreatedEventSchema.safeParse(event);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sessionId).toBe("sess_abc123");
      expect(result.data.sandboxId).toBe("sbx_xyz789");
    }
  });

  it("session_created without optional nekoUrl is valid", () => {
    const event = {
      type: "session_created",
      sessionId: "sess_abc123",
      sandboxId: "sbx_xyz789",
      timestamp: Date.now(),
    };

    const result = SessionCreatedEventSchema.safeParse(event);
    expect(result.success).toBe(true);
  });

  it("missing sessionId fails validation", () => {
    const event = {
      type: "session_created",
      sandboxId: "sbx_xyz789",
      timestamp: Date.now(),
    };

    const result = SessionCreatedEventSchema.safeParse(event);
    expect(result.success).toBe(false);
  });
});

describe("Event Contract - Tool Events", () => {
  it("valid tool_call_started event passes validation", () => {
    const event = {
      type: "tool_call_started",
      toolCallId: "tc_001",
      tool: "file_read",
      input: { path: "/home/user/file.txt" },
      timestamp: Date.now(),
    };

    const result = ToolCallStartedEventSchema.safeParse(event);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.toolCallId).toBe("tc_001");
      expect(result.data.tool).toBe("file_read");
    }
  });

  it("valid tool_call_completed event passes validation", () => {
    const event = {
      type: "tool_call_completed",
      toolCallId: "tc_001",
      tool: "file_read",
      success: true,
      result: { content: "file contents here" },
      timestamp: Date.now(),
    };

    const result = ToolCallCompletedEventSchema.safeParse(event);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.success).toBe(true);
      expect(result.data.result).toBeDefined();
    }
  });

  it("tool_call_completed defaults success to true", () => {
    const event = {
      type: "tool_call_completed",
      toolCallId: "tc_001",
      tool: "file_read",
      result: { content: "file contents" },
      timestamp: Date.now(),
    };

    const result = ToolCallCompletedEventSchema.safeParse(event);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.success).toBe(true);
    }
  });
});

describe("Event Contract - Usage Events", () => {
  it("valid usage event with all tokens passes validation", () => {
    const event = {
      type: "usage",
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
      reasoningTokens: 25,
      timestamp: Date.now(),
    };

    const result = UsageEventSchema.safeParse(event);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.totalTokens).toBe(150);
      expect(result.data.reasoningTokens).toBe(25);
    }
  });

  it("usage event without optional reasoningTokens is valid", () => {
    const event = {
      type: "usage",
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
      timestamp: Date.now(),
    };

    const result = UsageEventSchema.safeParse(event);
    expect(result.success).toBe(true);
  });

  it("negative token counts fail validation", () => {
    const event = {
      type: "usage",
      promptTokens: -10,
      completionTokens: 50,
      totalTokens: 40,
      timestamp: Date.now(),
    };

    const result = UsageEventSchema.safeParse(event);
    expect(result.success).toBe(false);
  });
});

describe("Event Contract - Error Events", () => {
  it("valid error event passes validation", () => {
    const event = {
      type: "error",
      error: "File not found",
      code: "ENOENT",
      timestamp: Date.now(),
    };

    const result = ErrorEventSchema.safeParse(event);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.error).toBe("File not found");
      expect(result.data.code).toBe("ENOENT");
    }
  });

  it("error event without optional code is valid", () => {
    const event = {
      type: "error",
      error: "Something went wrong",
      timestamp: Date.now(),
    };

    const result = ErrorEventSchema.safeParse(event);
    expect(result.success).toBe(true);
  });
});

describe("Event Contract - Discriminated Union", () => {
  it("SSEEventSchema discriminates by type field", () => {
    const sessionEvent = {
      type: "session_created",
      sessionId: "sess_abc",
      sandboxId: "sbx_xyz",
      timestamp: Date.now(),
    };

    const toolEvent = {
      type: "tool_call_started",
      toolCallId: "tc_001",
      tool: "file_read",
      input: {},
      timestamp: Date.now(),
    };

    expect(SSEEventSchema.safeParse(sessionEvent).success).toBe(true);
    expect(SSEEventSchema.safeParse(toolEvent).success).toBe(true);
  });

  it("unknown event type fails validation", () => {
    const unknownEvent = {
      type: "unknown_event_type",
      timestamp: Date.now(),
    };

    const result = SSEEventSchema.safeParse(unknownEvent);
    expect(result.success).toBe(false);
  });
});
