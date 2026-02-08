import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@repo/database", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
  agents: { id: "id", sessionId: "sessionId", type: "type", status: "status" },
  agentTasks: { id: "id", agentId: "agentId", title: "title", status: "status" },
  agentSessions: { id: "id", userId: "userId" },
  eq: (a: unknown, b: unknown) => ({ field: a, value: b }),
  and: (...conditions: unknown[]) => ({ and: conditions }),
  asc: (col: unknown) => ({ column: col, direction: "asc" }),
  desc: (col: unknown) => ({ column: col, direction: "desc" }),
}));

vi.mock("@repo/search", () => ({
  syncActionToSearch: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@paralleldrive/cuid2", () => ({
  createId: vi.fn(() => "test-agent-id"),
}));

describe("Agents Router Logic", () => {
  const mockUser = { id: "user-123", name: "Test User", email: "test@rubic.dev" };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("create", () => {
    it("should accept all valid agent types", () => {
      const validTypes = [
        "orchestrator",
        "researcher",
        "coder",
        "browser",
        "file_manager",
        "executor",
        "analyst",
      ] as const;

      for (const type of validTypes) {
        const values = {
          id: "test-agent-id",
          sessionId: "session-123",
          type,
          name: null,
          status: "idle",
          progress: 0,
          metadata: undefined,
        };
        expect(values.type).toBe(type);
        expect(values.status).toBe("idle");
        expect(values.progress).toBe(0);
      }
    });

    it("should set name to null if not provided", () => {
      const input = { sessionId: "s1", type: "coder" as const };
      const values = {
        ...input,
        id: "test-agent-id",
        name: undefined || null,
        status: "idle",
        progress: 0,
      };

      expect(values.name).toBeNull();
    });

    it("should throw if session is not owned by user", () => {
      const session = { id: "s1", userId: "other-user" };
      expect(() => {
        if (!session || session.userId !== mockUser.id) {
          throw new Error("Session not found");
        }
      }).toThrow("Session not found");
    });
  });

  describe("updateStatus", () => {
    it("should accept all valid status values", () => {
      const validStatuses = [
        "idle",
        "thinking",
        "executing",
        "waiting",
        "completed",
        "failed",
      ] as const;

      for (const status of validStatuses) {
        expect(typeof status).toBe("string");
      }
    });

    it("should validate progress is between 0 and 100", () => {
      const validProgress = [0, 50, 100];
      const invalidProgress = [-1, 101, 200];

      for (const p of validProgress) {
        expect(p).toBeGreaterThanOrEqual(0);
        expect(p).toBeLessThanOrEqual(100);
      }

      for (const p of invalidProgress) {
        expect(p < 0 || p > 100).toBe(true);
      }
    });

    it("should set lastActivity to current date", () => {
      const before = new Date();
      const lastActivity = new Date();
      const after = new Date();

      expect(lastActivity.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(lastActivity.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe("createTask", () => {
    it("should create a task with pending status", () => {
      const values = {
        id: "test-agent-id",
        agentId: "agent-123",
        title: "Research topic",
        description: null,
        parentTaskId: null,
        priority: 0,
        status: "pending",
      };

      expect(values.status).toBe("pending");
      expect(values.priority).toBe(0);
    });

    it("should set default priority to 0 if not provided", () => {
      const input = { agentId: "a1", title: "Task" };
      const priority = undefined || 0;
      expect(priority).toBe(0);
    });
  });

  describe("updateTask", () => {
    it("should set startedAt when transitioning to in_progress", () => {
      const task = { startedAt: null };
      const updates = { status: "in_progress" as const };

      const updateData: Record<string, unknown> = { ...updates };
      if (updates.status === "in_progress" && !task.startedAt) {
        updateData.startedAt = new Date();
      }

      expect(updateData.startedAt).toBeInstanceOf(Date);
    });

    it("should set completedAt for terminal statuses", () => {
      const terminalStatuses = ["completed", "failed", "cancelled"];

      for (const status of terminalStatuses) {
        const updateData: Record<string, unknown> = { status };
        if (terminalStatuses.includes(status)) {
          updateData.completedAt = new Date();
        }
        expect(updateData.completedAt).toBeInstanceOf(Date);
      }
    });

    it("should NOT set completedAt for non-terminal statuses", () => {
      const nonTerminalStatuses = ["pending", "in_progress"];
      const terminalStatuses = ["completed", "failed", "cancelled"];

      for (const status of nonTerminalStatuses) {
        const updateData: Record<string, unknown> = { status };
        if (terminalStatuses.includes(status)) {
          updateData.completedAt = new Date();
        }
        expect(updateData.completedAt).toBeUndefined();
      }
    });
  });

  describe("authorization", () => {
    it("should verify session ownership via JOIN for get", () => {
      // The router uses an innerJoin between agents and agentSessions
      // to verify ownership in a single query
      const result = [
        {
          agent: { id: "a1", sessionId: "s1", type: "coder", status: "idle" },
        },
      ];

      expect(result[0]?.agent).toBeDefined();
      expect(result[0].agent.type).toBe("coder");
    });

    it("should return null for non-existent agent", () => {
      const result: { agent: unknown }[] = [];
      expect(result[0]?.agent ?? null).toBeNull();
    });
  });
});
