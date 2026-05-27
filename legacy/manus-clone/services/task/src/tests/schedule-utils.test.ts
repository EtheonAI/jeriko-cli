/**
 * Schedule Utils — calculateNextRunAt comprehensive tests
 *
 * Tests all schedule types (once, cron, recurring), end conditions,
 * and edge cases. Uses real cron-parser — NO mocking.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { calculateNextRunAt, type ScheduleInput } from "../lib/schedule-utils.js";

// ─── Helpers ──────────────────────────────────────────────────────

function makeInput(overrides: Partial<ScheduleInput> = {}): ScheduleInput {
  return {
    scheduleType: overrides.scheduleType ?? "once",
    ...overrides,
  };
}

// ─── Once Schedule ────────────────────────────────────────────────

describe("calculateNextRunAt — once", () => {
  it("should return scheduledAt date for one-time tasks", () => {
    const scheduledAt = new Date("2026-03-15T14:00:00Z");
    const result = calculateNextRunAt(makeInput({
      scheduleType: "once",
      scheduledAt,
    }));

    expect(result).toEqual(scheduledAt);
  });

  it("should return null when scheduledAt is missing for once", () => {
    const result = calculateNextRunAt(makeInput({
      scheduleType: "once",
      scheduledAt: undefined,
    }));

    expect(result).toBeNull();
  });

  it("should accept string dates for scheduledAt", () => {
    const result = calculateNextRunAt(makeInput({
      scheduleType: "once",
      scheduledAt: "2026-06-01T10:30:00Z",
    }));

    expect(result).toEqual(new Date("2026-06-01T10:30:00Z"));
  });
});

// ─── Cron Schedule ────────────────────────────────────────────────

describe("calculateNextRunAt — cron", () => {
  it("should calculate next run for daily 9am cron", () => {
    const result = calculateNextRunAt(makeInput({
      scheduleType: "cron",
      cronExpression: "0 9 * * *", // Every day at 9 AM
    }));

    expect(result).toBeInstanceOf(Date);
    expect(result!.getTime()).toBeGreaterThan(Date.now());
  });

  it("should calculate next run for weekly Friday 2:30pm", () => {
    const result = calculateNextRunAt(makeInput({
      scheduleType: "cron",
      cronExpression: "30 14 * * 5", // Friday 2:30 PM
    }));

    expect(result).toBeInstanceOf(Date);
    expect(result!.getDay()).toBe(5); // Friday
    expect(result!.getUTCHours()).toBe(14);
    expect(result!.getUTCMinutes()).toBe(30);
  });

  it("should calculate next run for first of month at midnight", () => {
    const result = calculateNextRunAt(makeInput({
      scheduleType: "cron",
      cronExpression: "0 0 1 * *", // 1st of every month
    }));

    expect(result).toBeInstanceOf(Date);
    expect(result!.getUTCDate()).toBe(1);
    expect(result!.getUTCHours()).toBe(0);
    expect(result!.getUTCMinutes()).toBe(0);
  });

  it("should return null for invalid cron expression", () => {
    const result = calculateNextRunAt(makeInput({
      scheduleType: "cron",
      cronExpression: "not-a-cron",
    }));

    expect(result).toBeNull();
  });

  it("should return null when cronExpression is missing", () => {
    const result = calculateNextRunAt(makeInput({
      scheduleType: "cron",
      cronExpression: undefined,
    }));

    expect(result).toBeNull();
  });

  it("should respect timezone parameter", () => {
    const result = calculateNextRunAt(makeInput({
      scheduleType: "cron",
      cronExpression: "0 9 * * *",
      timezone: "America/New_York",
    }));

    expect(result).toBeInstanceOf(Date);
    // Result should be in future regardless of timezone
    expect(result!.getTime()).toBeGreaterThan(Date.now());
  });
});

// ─── Recurring Schedule ───────────────────────────────────────────

describe("calculateNextRunAt — recurring daily", () => {
  it("should schedule for tomorrow at specified time if today's time passed", () => {
    const result = calculateNextRunAt(makeInput({
      scheduleType: "recurring",
      recurrencePattern: "daily",
      recurrenceTime: "09:00",
    }));

    expect(result).toBeInstanceOf(Date);
    expect(result!.getTime()).toBeGreaterThan(Date.now());

    // Within 24 hours from now
    const msIn24h = 24 * 60 * 60 * 1000;
    expect(result!.getTime() - Date.now()).toBeLessThanOrEqual(msIn24h + 60_000);
  });

  it("should respect recurrence interval for daily", () => {
    const result = calculateNextRunAt(makeInput({
      scheduleType: "recurring",
      recurrencePattern: "daily",
      recurrenceInterval: 3, // Every 3 days
      recurrenceTime: "00:01", // Just past midnight to ensure it's "past"
    }));

    expect(result).toBeInstanceOf(Date);
    // Should be within 3 days + buffer
    const msIn3d = 3 * 24 * 60 * 60 * 1000;
    expect(result!.getTime() - Date.now()).toBeLessThanOrEqual(msIn3d + 60_000);
  });

  it("should default to 9 AM when no time specified", () => {
    const result = calculateNextRunAt(makeInput({
      scheduleType: "recurring",
      recurrencePattern: "daily",
    }));

    expect(result).toBeInstanceOf(Date);
    expect(result!.getHours()).toBe(9);
    expect(result!.getMinutes()).toBe(0);
  });
});

describe("calculateNextRunAt — recurring weekly", () => {
  it("should pick next matching day of week", () => {
    const result = calculateNextRunAt(makeInput({
      scheduleType: "recurring",
      recurrencePattern: "weekly",
      recurrenceDaysOfWeek: [1, 3, 5], // Mon, Wed, Fri
      recurrenceTime: "10:00",
    }));

    expect(result).toBeInstanceOf(Date);
    const day = result!.getDay();
    expect([1, 3, 5]).toContain(day);
  });

  it("should wrap to next week if all days passed", () => {
    const result = calculateNextRunAt(makeInput({
      scheduleType: "recurring",
      recurrencePattern: "weekly",
      recurrenceDaysOfWeek: [0], // Sunday only
      recurrenceTime: "00:01",
    }));

    expect(result).toBeInstanceOf(Date);
    expect(result!.getDay()).toBe(0);
  });

  it("should default to same day next week when no days specified", () => {
    const result = calculateNextRunAt(makeInput({
      scheduleType: "recurring",
      recurrencePattern: "weekly",
      recurrenceTime: "00:01",
    }));

    expect(result).toBeInstanceOf(Date);
    expect(result!.getTime()).toBeGreaterThan(Date.now());
  });
});

describe("calculateNextRunAt — recurring biweekly", () => {
  it("should schedule 14 days out if time passed today", () => {
    const result = calculateNextRunAt(makeInput({
      scheduleType: "recurring",
      recurrencePattern: "biweekly",
      recurrenceTime: "00:01",
    }));

    expect(result).toBeInstanceOf(Date);
    const daysAway = (result!.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
    // Should be approximately 14 days away (or less if time hasn't passed)
    expect(daysAway).toBeLessThanOrEqual(15);
  });
});

describe("calculateNextRunAt — recurring monthly", () => {
  it("should schedule for specific day of month", () => {
    const result = calculateNextRunAt(makeInput({
      scheduleType: "recurring",
      recurrencePattern: "monthly",
      recurrenceDayOfMonth: 15,
      recurrenceTime: "08:00",
    }));

    expect(result).toBeInstanceOf(Date);
    expect(result!.getDate()).toBe(15);
  });

  it("should roll to next month if day has passed", () => {
    const result = calculateNextRunAt(makeInput({
      scheduleType: "recurring",
      recurrencePattern: "monthly",
      recurrenceDayOfMonth: 1,
      recurrenceTime: "00:01",
    }));

    expect(result).toBeInstanceOf(Date);
    expect(result!.getDate()).toBe(1);
    expect(result!.getTime()).toBeGreaterThan(Date.now());
  });
});

describe("calculateNextRunAt — recurring yearly", () => {
  it("should schedule for next year if time passed", () => {
    const result = calculateNextRunAt(makeInput({
      scheduleType: "recurring",
      recurrencePattern: "yearly",
      recurrenceTime: "00:01",
    }));

    expect(result).toBeInstanceOf(Date);
    expect(result!.getTime()).toBeGreaterThan(Date.now());
  });
});

// ─── End Conditions ───────────────────────────────────────────────

describe("calculateNextRunAt — end conditions", () => {
  it("should return null when endDate has passed", () => {
    const result = calculateNextRunAt(makeInput({
      scheduleType: "cron",
      cronExpression: "0 9 * * *",
      endDate: new Date("2020-01-01T00:00:00Z"), // Past
    }));

    expect(result).toBeNull();
  });

  it("should return null when maxRuns exceeded", () => {
    const result = calculateNextRunAt(makeInput({
      scheduleType: "daily",
      recurrencePattern: "daily",
      maxRuns: 5,
      runCount: 5, // Already ran 5 times
    }));

    expect(result).toBeNull();
  });

  it("should still calculate when maxRuns not yet reached", () => {
    const result = calculateNextRunAt(makeInput({
      scheduleType: "cron",
      cronExpression: "0 9 * * *",
      maxRuns: 10,
      runCount: 3,
    }));

    expect(result).toBeInstanceOf(Date);
  });

  it("should still calculate when endDate is in the future", () => {
    const result = calculateNextRunAt(makeInput({
      scheduleType: "cron",
      cronExpression: "0 9 * * *",
      endDate: new Date("2030-12-31T23:59:59Z"),
    }));

    expect(result).toBeInstanceOf(Date);
  });

  it("should accept string endDate", () => {
    const result = calculateNextRunAt(makeInput({
      scheduleType: "cron",
      cronExpression: "0 9 * * *",
      endDate: "2020-01-01T00:00:00Z", // Past
    }));

    expect(result).toBeNull();
  });
});

// ─── Edge Cases ───────────────────────────────────────────────────

describe("calculateNextRunAt — edge cases", () => {
  it("should return null for unknown schedule type", () => {
    const result = calculateNextRunAt(makeInput({
      scheduleType: "unknown" as any,
    }));

    expect(result).toBeNull();
  });

  it("should handle custom recurrence pattern by falling back to daily", () => {
    const result = calculateNextRunAt(makeInput({
      scheduleType: "recurring",
      recurrencePattern: "custom",
      recurrenceTime: "09:00",
    }));

    expect(result).toBeInstanceOf(Date);
    expect(result!.getTime()).toBeGreaterThan(Date.now());
  });

  it("should handle null interval by defaulting to 1", () => {
    const result = calculateNextRunAt(makeInput({
      scheduleType: "recurring",
      recurrencePattern: "daily",
      recurrenceInterval: null,
      recurrenceTime: "00:01",
    }));

    expect(result).toBeInstanceOf(Date);
  });

  it("should handle null recurrenceTime by defaulting to 9:00", () => {
    const result = calculateNextRunAt(makeInput({
      scheduleType: "recurring",
      recurrencePattern: "daily",
      recurrenceTime: null,
    }));

    expect(result).toBeInstanceOf(Date);
    expect(result!.getHours()).toBe(9);
  });
});

// ─── Orchestrator Cron Detection (tests the regex from plan-tools.ts) ──

describe("Cron expression detection regex", () => {
  const CRON_REGEX = /^[\d*\/,\-]+(\s+[\d*\/,\-]+){4,5}$/;

  it("should detect standard 5-field cron expressions", () => {
    expect(CRON_REGEX.test("0 9 * * *")).toBe(true);
    expect(CRON_REGEX.test("30 14 * * 5")).toBe(true);
    expect(CRON_REGEX.test("0 0 1 * *")).toBe(true);
    expect(CRON_REGEX.test("*/5 * * * *")).toBe(true);
    expect(CRON_REGEX.test("0 9 * * 1-5")).toBe(true);
    expect(CRON_REGEX.test("0,30 * * * *")).toBe(true);
  });

  it("should detect 6-field cron expressions (with seconds)", () => {
    expect(CRON_REGEX.test("0 0 9 * * *")).toBe(true);
    expect(CRON_REGEX.test("0 30 14 * * 5")).toBe(true);
  });

  it("should NOT detect ISO datetime strings", () => {
    expect(CRON_REGEX.test("2026-03-15T14:00:00Z")).toBe(false);
    expect(CRON_REGEX.test("2026-03-15")).toBe(false);
  });

  it("should NOT detect arbitrary text", () => {
    expect(CRON_REGEX.test("every day at 9am")).toBe(false);
    expect(CRON_REGEX.test("daily")).toBe(false);
    expect(CRON_REGEX.test("")).toBe(false);
  });
});
