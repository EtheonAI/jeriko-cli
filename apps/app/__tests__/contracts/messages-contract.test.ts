import { describe, it, expect } from "vitest";
import { z } from "zod";

const MessagePartSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), text: z.string() }),
  z.object({ type: z.literal("reasoning"), text: z.string() }),
  z.object({
    type: z.literal("source-url"),
    url: z.string(),
    sourceId: z.string().optional(),
    title: z.string().optional(),
  }),
]);

const MessageSchema = z.object({
  id: z.string().min(1),
  sessionId: z.string().min(1),
  role: z.enum(["user", "assistant", "system", "tool"]),
  content: z.string(),
  parts: z.array(z.record(z.string(), z.unknown())).nullable().optional(),
  createdAt: z.union([z.string(), z.date()]),
});

describe("Message contract", () => {
  const validUserMessage = {
    id: "msg_001",
    sessionId: "sess_abc123",
    role: "user" as const,
    content: "What is the weather today?",
    parts: null,
    createdAt: "2026-02-09T00:00:00.000Z",
  };

  const validAssistantMessage = {
    id: "msg_002",
    sessionId: "sess_abc123",
    role: "assistant" as const,
    content: "The weather today is sunny with a high of 72F.",
    parts: [
      { type: "text", text: "The weather today is sunny with a high of 72F." },
      {
        type: "source-url",
        url: "https://weather.example.com",
        title: "Weather Service",
      },
    ],
    createdAt: "2026-02-09T00:00:01.000Z",
  };

  it("user message with text passes validation", () => {
    const result = MessageSchema.safeParse(validUserMessage);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.role).toBe("user");
      expect(result.data.content).toBe("What is the weather today?");
    }
  });

  it("assistant message with parts passes validation", () => {
    const result = MessageSchema.safeParse(validAssistantMessage);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.role).toBe("assistant");
      expect(result.data.parts).toHaveLength(2);
    }
  });

  it("invalid role fails validation", () => {
    const result = MessageSchema.safeParse({
      ...validUserMessage,
      role: "moderator",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const roleIssue = result.error.issues.find((i) =>
        i.path.includes("role"),
      );
      expect(roleIssue).toBeDefined();
    }
  });

  it("text part serialization roundtrip preserves shape", () => {
    const textPart = { type: "text" as const, text: "Hello world" };
    const serialized = JSON.stringify(textPart);
    const deserialized = JSON.parse(serialized);

    const result = MessagePartSchema.safeParse(deserialized);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(textPart);
    }
  });

  it("parts can be null", () => {
    const result = MessageSchema.safeParse({
      ...validUserMessage,
      parts: null,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.parts).toBeNull();
    }
  });
});
