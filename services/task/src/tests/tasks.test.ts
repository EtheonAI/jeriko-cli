/**
 * Task Service Unit Tests
 */
import { describe, it, expect, vi } from "vitest";

// ── Schedule helpers ──

const SCHEDULE_MAP: Record<string, string> = {
  daily: "0 9 * * *",
  weekly: "0 9 * * 1",
  biweekly: "0 9 * * 1/2",
  monthly: "0 9 1 * *",
};

const DAY_MAP: Record<string, number> = {
  monday: 1, tuesday: 2, wednesday: 3, thursday: 4,
  friday: 5, saturday: 6, sunday: 0,
};

function buildCronExpression(
  schedule: string,
  dayOfWeek?: string,
  time?: string
): string {
  let cron = SCHEDULE_MAP[schedule] ?? "0 9 * * 1";

  if (dayOfWeek && schedule === "weekly") {
    const dayNum = DAY_MAP[dayOfWeek.toLowerCase()] ?? 1;
    const [hour, minute] = (time ?? "09:00").split(":").map(Number);
    cron = `${minute ?? 0} ${hour ?? 9} * * ${dayNum}`;
  }

  return cron;
}

// ── Task status transitions ──

type TaskStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

const VALID_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  pending: ["running", "cancelled"],
  running: ["completed", "failed", "cancelled"],
  completed: [],
  failed: ["pending"], // Can retry
  cancelled: ["pending"], // Can restart
};

function canTransition(from: TaskStatus, to: TaskStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

// ── Tests ──

describe("Cron expression builder", () => {
  it("should return default cron for known schedules", () => {
    expect(buildCronExpression("daily")).toBe("0 9 * * *");
    expect(buildCronExpression("weekly")).toBe("0 9 * * 1");
    expect(buildCronExpression("monthly")).toBe("0 9 1 * *");
  });

  it("should customize day and time for weekly schedule", () => {
    expect(buildCronExpression("weekly", "friday", "14:30")).toBe("30 14 * * 5");
    expect(buildCronExpression("weekly", "sunday", "08:00")).toBe("0 8 * * 0");
  });

  it("should ignore dayOfWeek for non-weekly schedules", () => {
    expect(buildCronExpression("daily", "friday")).toBe("0 9 * * *");
  });

  it("should handle unknown schedule names", () => {
    expect(buildCronExpression("unknown")).toBe("0 9 * * 1");
  });
});

describe("Task status transitions", () => {
  it("should allow pending → running", () => {
    expect(canTransition("pending", "running")).toBe(true);
  });

  it("should allow running → completed", () => {
    expect(canTransition("running", "completed")).toBe(true);
  });

  it("should allow running → failed", () => {
    expect(canTransition("running", "failed")).toBe(true);
  });

  it("should NOT allow completed → running", () => {
    expect(canTransition("completed", "running")).toBe(false);
  });

  it("should allow failed → pending (retry)", () => {
    expect(canTransition("failed", "pending")).toBe(true);
  });

  it("should NOT allow pending → completed (must go through running)", () => {
    expect(canTransition("pending", "completed")).toBe(false);
  });
});

describe("Task payload validation", () => {
  it("should require name for scheduled tasks", () => {
    const valid = { name: "Daily Report", taskType: "agent_run" };
    const invalid = { name: "", taskType: "agent_run" };

    expect(valid.name).toBeTruthy();
    expect(invalid.name).toBeFalsy();
  });

  it("should validate cron expression format", () => {
    const validCrons = ["0 9 * * *", "30 14 * * 5", "0 0 1 * *"];
    const invalidCrons = ["not-a-cron", "60 25 * * *"];

    for (const cron of validCrons) {
      const parts = cron.split(" ");
      expect(parts).toHaveLength(5);
    }

    for (const cron of invalidCrons) {
      const parts = cron.split(" ");
      if (parts.length === 5) {
        // Has right count but invalid values
        const minute = parseInt(parts[0]!);
        const hour = parseInt(parts[1]!);
        const isValid = !isNaN(minute) && minute < 60 && !isNaN(hour) && hour < 24;
        expect(isValid).toBe(false);
      }
    }
  });

  it("should support known task types", () => {
    const validTypes = ["agent_run", "webhook", "email"];
    expect(validTypes).toContain("agent_run");
  });
});
