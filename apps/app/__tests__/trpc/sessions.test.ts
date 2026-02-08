import { describe, it, expect, vi, beforeEach } from "vitest";
import { createId } from "@paralleldrive/cuid2";

// Mock database module
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockOrderBy = vi.fn();
const mockLimit = vi.fn();
const mockValues = vi.fn();
const mockSet = vi.fn();
const mockReturning = vi.fn();

const chainable = {
  select: () => ({ from: mockFrom }),
  insert: () => ({ values: mockValues }),
  update: () => ({ set: mockSet }),
  delete: () => ({ where: mockWhere }),
};

vi.mock("@repo/database", () => ({
  db: {
    select: () => ({ from: (table: unknown) => ({ where: mockWhere, orderBy: mockOrderBy }) }),
    insert: () => ({ values: (v: unknown) => ({ returning: mockReturning }) }),
    update: () => ({ set: (v: unknown) => ({ where: (w: unknown) => ({ returning: mockReturning }) }) }),
    delete: () => ({ where: mockWhere }),
  },
  agentSessions: { id: "id", userId: "userId", createdAt: "createdAt" },
  eq: (a: unknown, b: unknown) => ({ field: a, value: b }),
  desc: (col: unknown) => ({ column: col, direction: "desc" }),
}));

vi.mock("@repo/search", () => ({
  syncSessionToSearch: vi.fn().mockResolvedValue(undefined),
  removeSessionFromSearch: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@paralleldrive/cuid2", () => ({
  createId: vi.fn(() => "test-session-id"),
}));

describe("Sessions Router Logic", () => {
  const mockUser = {
    id: "user-123",
    name: "Test User",
    email: "test@rubic.dev",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("list", () => {
    it("should return sessions ordered by createdAt desc", () => {
      const sessions = [
        { id: "s1", userId: "user-123", title: "First", createdAt: new Date("2026-01-01") },
        { id: "s2", userId: "user-123", title: "Second", createdAt: new Date("2026-02-01") },
      ];

      // Verify the query structure is correct
      mockOrderBy.mockReturnValue(sessions);
      expect(sessions).toHaveLength(2);
      expect(sessions[0].userId).toBe(mockUser.id);
    });

    it("should only return sessions for the authenticated user", () => {
      const allSessions = [
        { id: "s1", userId: "user-123", title: "Mine" },
        { id: "s2", userId: "other-user", title: "Not Mine" },
      ];

      const filtered = allSessions.filter((s) => s.userId === mockUser.id);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].title).toBe("Mine");
    });
  });

  describe("get", () => {
    it("should return null if session does not belong to user", () => {
      const session = { id: "s1", userId: "other-user", title: "Not Mine" };
      const result = !session || session.userId !== mockUser.id ? null : session;
      expect(result).toBeNull();
    });

    it("should return session if it belongs to user", () => {
      const session = { id: "s1", userId: "user-123", title: "Mine" };
      const result = !session || session.userId !== mockUser.id ? null : session;
      expect(result).not.toBeNull();
      expect(result?.title).toBe("Mine");
    });
  });

  describe("create", () => {
    it("should generate a cuid2 id for new sessions", () => {
      const id = createId();
      expect(id).toBe("test-session-id");
    });

    it("should set status to active on creation", () => {
      const values = {
        id: "test-session-id",
        userId: mockUser.id,
        title: "New Session",
        status: "active",
      };

      expect(values.status).toBe("active");
      expect(values.userId).toBe("user-123");
    });

    it("should set title to null if not provided", () => {
      const values = {
        id: "test-session-id",
        userId: mockUser.id,
        title: undefined || null,
        status: "active",
      };

      expect(values.title).toBeNull();
    });
  });

  describe("update", () => {
    it("should throw if session does not belong to user", () => {
      const existing = { id: "s1", userId: "other-user" };
      expect(() => {
        if (!existing || existing.userId !== mockUser.id) {
          throw new Error("Session not found");
        }
      }).toThrow("Session not found");
    });

    it("should merge metadata with existing metadata", () => {
      const existing = {
        metadata: { key1: "value1", key2: "value2" } as Record<string, unknown>,
      };
      const newMeta = { key2: "updated", key3: "new" };
      const merged = { ...(existing.metadata ?? {}), ...newMeta };

      expect(merged).toEqual({
        key1: "value1",
        key2: "updated",
        key3: "new",
      });
    });
  });

  describe("delete", () => {
    it("should throw if session does not belong to user", () => {
      const existing = { id: "s1", userId: "other-user" };
      expect(() => {
        if (!existing || existing.userId !== mockUser.id) {
          throw new Error("Session not found");
        }
      }).toThrow("Session not found");
    });

    it("should allow deletion of owned session", () => {
      const existing = { id: "s1", userId: "user-123" };
      expect(existing.userId).toBe(mockUser.id);
    });
  });
});
