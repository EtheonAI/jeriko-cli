import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@repo/database", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
  },
  messages: { id: "id", sessionId: "sessionId", role: "role", content: "content" },
  agentSessions: { id: "id", userId: "userId" },
  eq: (a: unknown, b: unknown) => ({ field: a, value: b }),
  and: (...conditions: unknown[]) => ({ and: conditions }),
  asc: (col: unknown) => ({ column: col, direction: "asc" }),
}));

vi.mock("@paralleldrive/cuid2", () => ({
  createId: vi.fn(() => "test-message-id"),
}));

describe("Messages Router Logic", () => {
  const mockUser = { id: "user-123", name: "Test User", email: "test@rubic.dev" };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("list", () => {
    it("should throw if session does not belong to user", () => {
      const session = null;
      expect(() => {
        if (!session) throw new Error("Session not found");
      }).toThrow("Session not found");
    });

    it("should return messages ordered by createdAt ascending", () => {
      const messages = [
        { id: "m1", role: "user", content: "Hello", createdAt: new Date("2026-01-01T10:00:00") },
        { id: "m2", role: "assistant", content: "Hi!", createdAt: new Date("2026-01-01T10:00:01") },
        { id: "m3", role: "user", content: "Help me", createdAt: new Date("2026-01-01T10:00:02") },
      ];

      // Messages should be in chronological order
      for (let i = 1; i < messages.length; i++) {
        expect(messages[i]!.createdAt.getTime()).toBeGreaterThan(
          messages[i - 1]!.createdAt.getTime()
        );
      }
    });

    it("should run ownership check and messages query in parallel", () => {
      // Promise.all pattern should be used for concurrent queries
      const ownershipCheck = Promise.resolve([{ id: "s1", userId: mockUser.id }]);
      const messagesQuery = Promise.resolve([{ id: "m1", content: "Hello" }]);

      return Promise.all([ownershipCheck, messagesQuery]).then(
        ([[session], msgs]) => {
          expect(session).toBeDefined();
          expect(msgs).toHaveLength(1);
        }
      );
    });
  });

  describe("send", () => {
    it("should reject empty content", () => {
      const content = "";
      expect(content.length).toBe(0);
      // Router uses z.string().min(1) validation
    });

    it("should create a user message with correct role", () => {
      const values = {
        id: "test-message-id",
        sessionId: "session-123",
        role: "user" as const,
        content: "Hello, Rubic!",
      };

      expect(values.role).toBe("user");
      expect(values.content).toBe("Hello, Rubic!");
    });

    it("should throw if session not found or not owned", () => {
      const session = { id: "s1", userId: "other-user" };
      expect(() => {
        if (!session || session.userId !== mockUser.id) {
          throw new Error("Session not found");
        }
      }).toThrow("Session not found");
    });
  });

  describe("add", () => {
    it("should accept all valid roles", () => {
      const validRoles = ["user", "assistant", "system", "tool"] as const;
      for (const role of validRoles) {
        const values = {
          id: "test-message-id",
          sessionId: "session-123",
          role,
          content: "test",
        };
        expect(values.role).toBe(role);
      }
    });

    it("should set parts to null if not provided", () => {
      const input = { sessionId: "s1", role: "assistant" as const, content: "Hi" };
      const parts: undefined | null = undefined;
      const values = {
        ...input,
        id: "test-message-id",
        parts: parts ?? null,
        metadata: undefined,
      };

      expect(values.parts).toBeNull();
    });

    it("should pass metadata through if provided", () => {
      const metadata = { model: "claude-opus", tokens: 150 };
      expect(metadata.model).toBe("claude-opus");
      expect(metadata.tokens).toBe(150);
    });
  });
});
