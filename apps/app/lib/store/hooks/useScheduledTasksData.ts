"use client";

import { useCallback, useEffect, useRef } from "react";
import { useAppDispatch, useAppSelector } from "../hooks";
import {
  setScheduledTasks,
  addScheduledTask,
  updateScheduledTask,
  deleteScheduledTask,
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
      hasFetchedRef.current = true;
    } catch (err: any) {
      dispatch(setScheduledTasksError(err?.message || "Failed to load scheduled tasks"));
    } finally {
      dispatch(setLoading(false));
    }
  }, [dispatch]);

  // Mutations
  const createTask = useCallback(
    async (params: Record<string, unknown>) => {
      try {
        const result = await getTrpcClient().scheduledTasks.create.mutate(params as any);
        if (result) {
          dispatch(addScheduledTask(normalizeScheduledTask(result)));
        }
        return result;
      } catch (err: any) {
        dispatch(setScheduledTasksError(err?.message || "Failed to create task"));
        throw err;
      }
    },
    [dispatch]
  );

  const updateTask = useCallback(
    async (id: string, updates: Record<string, unknown>) => {
      dispatch(updateScheduledTask({ id, updates: updates as any }));
      try {
        await getTrpcClient().scheduledTasks.update.mutate({ id, ...updates } as any);
      } catch {
        await fetchTasks();
      }
    },
    [dispatch, fetchTasks]
  );

  const deleteTask = useCallback(
    async (id: string) => {
      dispatch(deleteScheduledTask(id));
      try {
        await getTrpcClient().scheduledTasks.delete.mutate({ id });
      } catch {
        await fetchTasks();
      }
    },
    [dispatch, fetchTasks]
  );

  const runNow = useCallback(async (id: string) => {
    return getTrpcClient().scheduledTasks.runNow.mutate({ id });
  }, []);

  const pauseTask = useCallback(
    async (id: string) => {
      dispatch(updateScheduledTask({ id, updates: { status: "paused" } as any }));
      try {
        await getTrpcClient().scheduledTasks.pause.mutate({ id });
      } catch {
        await fetchTasks();
      }
    },
    [dispatch, fetchTasks]
  );

  const resumeTask = useCallback(
    async (id: string) => {
      dispatch(updateScheduledTask({ id, updates: { status: "active" } as any }));
      try {
        await getTrpcClient().scheduledTasks.resume.mutate({ id });
      } catch {
        await fetchTasks();
      }
    },
    [dispatch, fetchTasks]
  );

  const getExecutions = useCallback(async (taskId: string) => {
    const data = await getTrpcClient().scheduledTasks.getExecutions.query({ taskId });
    return Array.isArray(data) ? data.map(normalizeScheduledTaskExecution) : [];
  }, []);

  const listTriggerTypes = useCallback(async () => {
    return getTrpcClient().scheduledTasks.listTriggerTypes.query();
  }, []);

  const getTriggerTypeConfig = useCallback(async (type: string) => {
    return getTrpcClient().scheduledTasks.getTriggerTypeConfig.query({ type });
  }, []);

  useEffect(() => {
    if (!autoFetch) return;
    if (hasFetchedRef.current) return;
    if (tasks.length > 0) return;
    fetchTasks();
  }, [autoFetch, tasks.length, fetchTasks]);

  return {
    tasks,
    isLoading,
    error,
    // Fetch
    refetch: fetchTasks,
    // Mutations
    createTask,
    updateTask,
    deleteTask,
    runNow,
    pauseTask,
    resumeTask,
    getExecutions,
    listTriggerTypes,
    getTriggerTypeConfig,
  };
}
