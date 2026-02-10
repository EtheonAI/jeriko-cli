import { describe, it, expect } from "vitest";
import {
  MessageSchema,
  SessionSchema,
  ApiKeySchema,
  MessagePartSchema,
} from "../src/schemas/messages";

describe("Message Contract", () => {
  const validMessage = {
    id: "msg_001",
    sessionId: "sess_abc123",
    role: "user" as const,
    content: "What is the weather today?",
    parts: null,
    createdAt: "2026-02-09T00:00:00.000Z",
  };

  it("valid user message passes validation", () => {
    const result = MessageSchema.safeParse(validMessage);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.role).toBe("user");
      expect(result.data.content).toBe("What is the weather today?");
    }
  });

  it("assistant message with parts passes validation", () => {
    const message = {
      ...validMessage,
      role: "assistant" as const,
      parts: [
        { type: "text", text: "The weather is sunny." },
        { type: "source-url", url: "https://weather.com" },
      ],
    };

    const result = MessageSchema.safeParse(message);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.parts).toHaveLength(2);
    }
  });

  it("invalid role fails validation", () => {
    const result = MessageSchema.safeParse({
      ...validMessage,
      role: "invalid_role",
    });
    expect(result.success).toBe(false);
  });

  it("parts can be null", () => {
    const result = MessageSchema.safeParse({
      ...validMessage,
      parts: null,
    });
    expect(result.success).toBe(true);
  });
});

describe("Message Part Contract", () => {
  it("text part passes validation", () => {
    const part = { type: "text" as const, text: "Hello" };
    const result = MessagePartSchema.safeParse(part);
    expect(result.success).toBe(true);
  });

  it("reasoning part passes validation", () => {
    const part = { type: "reasoning" as const, text: "Thinking..." };
    const result = MessagePartSchema.safeParse(part);
    expect(result.success).toBe(true);
  });

  it("source-url part with all fields passes validation", () => {
    const part = {
      type: "source-url" as const,
      url: "https://example.com",
      sourceId: "src_001",
      title: "Example Site",
    };
    const result = MessagePartSchema.safeParse(part);
    expect(result.success).toBe(true);
  });

  it("invalid part type fails validation", () => {
    const part = { type: "invalid", text: "text" };
    const result = MessagePartSchema.safeParse(part);
    expect(result.success).toBe(false);
  });
});

describe("Session Contract", () => {
  const validSession = {
    id: "sess_abc123",
    userId: "user_xyz789",
    title: "Research task",
    status: "active" as const,
    model: "claude-opus-4-6",
    metadata: { source: "web" },
    createdAt: "2026-02-09T00:00:00.000Z",
    updatedAt: "2026-02-09T01:00:00.000Z",
  };

  it("valid session passes validation", () => {
    const result = SessionSchema.safeParse(validSession);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("active");
    }
  });

  it("null title is valid", () => {
    const result = SessionSchema.safeParse({
      ...validSession,
      title: null,
    });
    expect(result.success).toBe(true);
  });

  it("invalid status fails validation", () => {
    const result = SessionSchema.safeParse({
      ...validSession,
      status: "paused",
    });
    expect(result.success).toBe(false);
  });
});

describe("API Key Contract", () => {
  function makeValidKey(): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";
    let suffix = "";
    for (let i = 0; i < 32; i++) {
      suffix += chars[i % chars.length];
    }
    return `rk_live_${suffix}`;
  }

  const validApiKey = {
    id: "key_001",
    userId: "user_xyz789",
    key: makeValidKey(),
    keyPrefix: "rk_live_ABCD...",
    name: "Production Key",
    isActive: true,
    expiresAt: null,
    lastUsedAt: null,
    totalRequests: 0,
  };

  it("valid API key passes validation", () => {
    const result = ApiKeySchema.safeParse(validApiKey);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Production Key");
      expect(result.data.isActive).toBe(true);
    }
  });

  it("invalid key format fails validation", () => {
    const result = ApiKeySchema.safeParse({
      ...validApiKey,
      key: "sk_test_invalid",
    });
    expect(result.success).toBe(false);
  });

  it("negative totalRequests fails validation", () => {
    const result = ApiKeySchema.safeParse({
      ...validApiKey,
      totalRequests: -5,
    });
    expect(result.success).toBe(false);
  });

  it("empty name fails validation", () => {
    const result = ApiKeySchema.safeParse({
      ...validApiKey,
      name: "",
    });
    expect(result.success).toBe(false);
  });
});
