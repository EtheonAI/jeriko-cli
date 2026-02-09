import { describe, it, expect } from "vitest";
import { z } from "zod";

const SessionSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  title: z.string().nullable(),
  status: z.enum(["active", "archived", "deleted"]),
  model: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  createdAt: z.union([z.string(), z.date()]),
  updatedAt: z.union([z.string(), z.date()]),
});

describe("Session contract", () => {
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

  it("valid session passes schema validation", () => {
    const result = SessionSchema.safeParse(validSession);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe(validSession.id);
      expect(result.data.userId).toBe(validSession.userId);
      expect(result.data.status).toBe("active");
    }
  });

  it("missing id fails validation", () => {
    const { id: _, ...withoutId } = validSession;
    const result = SessionSchema.safeParse(withoutId);
    expect(result.success).toBe(false);
    if (!result.success) {
      const idIssue = result.error.issues.find((i) => i.path.includes("id"));
      expect(idIssue).toBeDefined();
    }
  });

  it("invalid status fails validation", () => {
    const result = SessionSchema.safeParse({
      ...validSession,
      status: "paused",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const statusIssue = result.error.issues.find((i) =>
        i.path.includes("status"),
      );
      expect(statusIssue).toBeDefined();
    }
  });

  it("null title is valid", () => {
    const result = SessionSchema.safeParse({
      ...validSession,
      title: null,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBeNull();
    }
  });

  it("extra fields are stripped in strict mode", () => {
    const StrictSessionSchema = SessionSchema.strict();
    const result = StrictSessionSchema.safeParse({
      ...validSession,
      extraField: "should not be here",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const unrecognized = result.error.issues.find(
        (i) => i.code === "unrecognized_keys",
      );
      expect(unrecognized).toBeDefined();
    }
  });
});
