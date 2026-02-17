"use client";

import { useCallback, useEffect, useRef } from "react";
import { useAppDispatch, useAppSelector } from "../hooks";
import {
  setScheduledTasks,
  setScheduledTasksError,
  setLoading,
  type ScheduledTask,
  type ScheduledTaskExecution,
} from "../slices/scheduledTasks.slice";
import { getTrpcClient } from "@/lib/trpc/vanilla";

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

export function useScheduledTasksData({ autoFetch = true }: { autoFetch?: boolean } = {}) {
  const dispatch = useAppDispatch();
  const { tasks, isLoading, error } = useAppSelector((state) => state.scheduledTasks);
  const hasFetchedRef = useRef(false);

  const fetchTasks = useCallback(async () => {
    dispatch(setLoading(true));
    try {
      const data = await getTrpcClient().scheduledTasks.list.query({});
      const normalized = Array.isArray(data) ? data.map(normalizeScheduledTask) : [];
      dispatch(setScheduledTasks(normalized));
      hasFetchedRef.current = true; // Mark as fetched only after success
    } catch (err: any) {
      dispatch(setScheduledTasksError(err?.message || "Failed to load scheduled tasks"));
      // Don't set hasFetchedRef — allows retry
    } finally {
      dispatch(setLoading(false));
    }
  }, [dispatch]);

  useEffect(() => {
    if (!autoFetch) return;
    if (hasFetchedRef.current) return;
    if (tasks.length > 0) return;
    fetchTasks();
  }, [autoFetch, tasks.length, fetchTasks]);

  return { tasks, isLoading, error, refetch: fetchTasks };
}
