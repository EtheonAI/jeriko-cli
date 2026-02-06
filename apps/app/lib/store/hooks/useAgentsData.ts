"use client";

import { useCallback, useEffect, useRef } from "react";
import { useAppDispatch, useAppSelector } from "../hooks";
import {
  setAgents,
  setAgentsError,
  setAgentsLoading,
  setTasks,
  type Agent,
  type AgentTask,
} from "../slices/agents.slice";
import { getTrpcClient } from "@/lib/trpc/vanilla";

function normalizeAgent(raw: any): Agent {
  return {
    ...raw,
    name: raw?.name ?? null,
    currentTask: raw?.currentTask ?? null,
    lastActivity: raw?.lastActivity
      ? new Date(raw.lastActivity).toISOString()
      : (raw?.lastActivity ?? null),
  } as Agent;
}

function normalizeTask(raw: any): AgentTask {
  return {
    ...raw,
    description: raw?.description ?? null,
    startedAt: raw?.startedAt ? new Date(raw.startedAt).toISOString() : (raw?.startedAt ?? null),
    completedAt: raw?.completedAt
      ? new Date(raw.completedAt).toISOString()
      : (raw?.completedAt ?? null),
    createdAt: raw?.createdAt
      ? new Date(raw.createdAt).toISOString()
      : (raw?.createdAt ?? new Date().toISOString()),
  } as AgentTask;
}

export function useAgentsData(
  sessionId: string | null,
  { autoFetch = true }: { autoFetch?: boolean } = {}
) {
  const dispatch = useAppDispatch();
  const agentsState = useAppSelector((state) => state.agents);
  const hasFetchedRef = useRef<Record<string, boolean>>({});
  const agentsForSession = sessionId ? (agentsState.agents[sessionId] ?? []) : [];
  const agentsLength = agentsForSession.length;
  const missingTasks = agentsForSession.some((agent: Agent) => !agentsState.tasks[agent.id]);

  const fetchAgents = useCallback(async () => {
    if (!sessionId) return;
    dispatch(setAgentsLoading(true));
    try {
      const agents = await getTrpcClient().agents.list.query({ sessionId });
      const normalizedAgents = Array.isArray(agents) ? agents.map(normalizeAgent) : [];
      dispatch(setAgents({ sessionId, agents: normalizedAgents }));

      // Fetch tasks for each agent individually so partial failures don't block others
      for (const agent of normalizedAgents) {
        try {
          const tasks = await getTrpcClient().agents.tasks.query({ agentId: agent.id });
          const normalizedTasks = Array.isArray(tasks) ? tasks.map(normalizeTask) : [];
          dispatch(setTasks({ agentId: agent.id, tasks: normalizedTasks }));
        } catch {
          // Partial failure: agent tasks couldn't load, but don't fail the whole operation
          console.warn(`Failed to load tasks for agent ${agent.id}`);
        }
      }

      // Mark as fetched only after success
      hasFetchedRef.current[sessionId] = true;
    } catch (err: any) {
      dispatch(setAgentsError(err?.message || "Failed to load agents"));
      // Don't set hasFetchedRef — allows retry
    } finally {
      dispatch(setAgentsLoading(false));
    }
  }, [dispatch, sessionId]);

  useEffect(() => {
    if (!autoFetch || !sessionId) return;
    if (hasFetchedRef.current[sessionId]) return;
    if (agentsLength > 0 && !missingTasks) return;
    fetchAgents();
  }, [autoFetch, sessionId, agentsLength, missingTasks, fetchAgents]);

  return {
    agents: sessionId ? (agentsState.agents[sessionId] ?? []) : [],
    tasks: agentsState.tasks,
    isLoading: agentsState.isLoading,
    error: agentsState.error,
    refetch: fetchAgents,
  };
}
