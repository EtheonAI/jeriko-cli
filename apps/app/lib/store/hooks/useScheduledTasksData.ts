import type {
  ScheduledTask,
  ScheduledTaskExecution,
} from "../slices/scheduledTasks.slice";

function toIsoString(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  try {
    const date = new Date(value as any);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  } catch {
    return null;
  }
}

export function normalizeScheduledTask(raw: any): ScheduledTask {
  return {
    ...raw,
    scheduledAt: toIsoString(raw?.scheduledAt),
    lastRunAt: toIsoString(raw?.lastRunAt),
    lastTriggerAt: toIsoString(raw?.lastTriggerAt),
    nextRunAt: toIsoString(raw?.nextRunAt),
    endDate: toIsoString(raw?.endDate),
    createdAt: toIsoString(raw?.createdAt) ?? new Date().toISOString(),
    updatedAt: toIsoString(raw?.updatedAt) ?? new Date().toISOString(),
  } as ScheduledTask;
}

export function normalizeScheduledTaskExecution(raw: any): ScheduledTaskExecution {
  return {
    ...raw,
    startedAt: toIsoString(raw?.startedAt),
    completedAt: toIsoString(raw?.completedAt),
    createdAt: toIsoString(raw?.createdAt) ?? new Date().toISOString(),
  } as ScheduledTaskExecution;
}
