import cronParser from "cron-parser";
const { parseExpression } = cronParser;

export interface ScheduleInput {
  scheduleType: "once" | "recurring" | "cron";
  scheduledAt?: Date | string | null;
  cronExpression?: string | null;
  recurrencePattern?: string | null;
  recurrenceInterval?: number | null;
  recurrenceTime?: string | null;
  recurrenceDaysOfWeek?: number[] | null;
  recurrenceDayOfMonth?: number | null;
  timezone?: string;
  endDate?: Date | string | null;
  maxRuns?: number | null;
  runCount?: number;
}

/**
 * Calculate the next run time for a scheduled task.
 * Returns null if the task should not run again (past endDate or exceeded maxRuns).
 */
export function calculateNextRunAt(task: ScheduleInput): Date | null {
  const now = new Date();

  // Check end conditions
  if (task.endDate && new Date(task.endDate) <= now) {
    return null;
  }
  if (task.maxRuns != null && (task.runCount ?? 0) >= task.maxRuns) {
    return null;
  }

  switch (task.scheduleType) {
    case "once":
      return task.scheduledAt ? new Date(task.scheduledAt) : null;

    case "cron":
      return calculateCronNext(task.cronExpression, task.timezone);

    case "recurring":
      return calculateRecurringNext(task);

    default:
      return null;
  }
}

function calculateCronNext(
  expression: string | null | undefined,
  timezone?: string,
): Date | null {
  if (!expression) return null;

  try {
    const interval = parseExpression(expression, {
      currentDate: new Date(),
      tz: timezone || "UTC",
    });
    return interval.next().toDate();
  } catch {
    return null;
  }
}

function calculateRecurringNext(task: ScheduleInput): Date | null {
  const now = new Date();
  const interval = task.recurrenceInterval ?? 1;

  // Parse time (HH:MM)
  let hour = 9;
  let minute = 0;
  if (task.recurrenceTime) {
    const parts = task.recurrenceTime.split(":");
    hour = parseInt(parts[0]!, 10) || 9;
    minute = parseInt(parts[1]!, 10) || 0;
  }

  const next = new Date(now);
  next.setSeconds(0, 0);
  next.setHours(hour, minute);

  switch (task.recurrencePattern) {
    case "daily":
      // Next occurrence at the specified time
      if (next <= now) {
        next.setDate(next.getDate() + interval);
      }
      return next;

    case "weekly": {
      const targetDays = task.recurrenceDaysOfWeek;
      if (targetDays && targetDays.length > 0) {
        // Find the next matching day of week
        const sorted = [...targetDays].sort((a, b) => a - b);
        const currentDay = now.getDay();

        for (const day of sorted) {
          if (day > currentDay || (day === currentDay && next > now)) {
            next.setDate(next.getDate() + (day - currentDay));
            return next;
          }
        }
        // Wrap to next week
        const daysUntilFirst = 7 - currentDay + sorted[0]!;
        next.setDate(next.getDate() + daysUntilFirst + (interval - 1) * 7);
        return next;
      }
      // Default: same day next week
      if (next <= now) {
        next.setDate(next.getDate() + 7 * interval);
      }
      return next;
    }

    case "biweekly":
      if (next <= now) {
        next.setDate(next.getDate() + 14);
      }
      return next;

    case "monthly":
      if (task.recurrenceDayOfMonth) {
        next.setDate(task.recurrenceDayOfMonth);
      }
      if (next <= now) {
        next.setMonth(next.getMonth() + interval);
      }
      return next;

    case "yearly":
      if (next <= now) {
        next.setFullYear(next.getFullYear() + interval);
      }
      return next;

    default:
      // "custom" — fall back to daily
      if (next <= now) {
        next.setDate(next.getDate() + interval);
      }
      return next;
  }
}
