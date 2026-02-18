"use client";

import { useCallback, useEffect, useRef } from "react";
import { useAppDispatch, useAppSelector } from "../hooks";
import {
  setProjects,
  addProject,
  updateProject,
  deleteProject as deleteProjectAction,
  addProjectSession,
  setLoading,
  setProjectsError,
  type Project,
} from "../slices/projects.slice";
import { getTrpcClient } from "@/lib/trpc/vanilla";

function serializeDates<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (obj instanceof Date) return obj.toISOString() as unknown as T;
  if (Array.isArray(obj)) return obj.map(serializeDates) as unknown as T;
  if (typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      result[key] = serializeDates(value);
    }
    return result as T;
  }
  return obj;
}

export function useProjectsData({ autoFetch = false }: { autoFetch?: boolean } = {}) {
  const dispatch = useAppDispatch();
  const projects = useAppSelector((state) => state.projects);
  const hasFetchedRef = useRef(false);

  const fetchProjects = useCallback(async () => {
    dispatch(setLoading(true));
    try {
      const result = await getTrpcClient().projects.list.query({
        status: "active",
        limit: 100,
        offset: 0,
        includeShared: true,
      });
      const items = Array.isArray(result) ? result : ((result as any).items ?? []);
      dispatch(setProjects(serializeDates(items) as any));
      hasFetchedRef.current = true;
    } catch (err: any) {
      dispatch(setProjectsError(err?.message || "Failed to load projects"));
    }
  }, [dispatch]);

  const createProject = useCallback(
    async (params: { name: string; description?: string; type?: string }) => {
      try {
        const result = await getTrpcClient().projects.create.mutate(params as any);
        if (result) {
          dispatch(addProject(serializeDates(result) as any));
        }
        return result;
      } catch (err: any) {
        dispatch(setProjectsError(err?.message || "Failed to create project"));
        throw err;
      }
    },
    [dispatch]
  );

  const updateProjectById = useCallback(
    async (id: string, updates: Partial<Project>) => {
      dispatch(updateProject({ id, updates }));
      try {
        await getTrpcClient().projects.update.mutate({ id, ...updates } as any);
      } catch {
        await fetchProjects();
      }
    },
    [dispatch, fetchProjects]
  );

  const deleteProject = useCallback(
    async (id: string) => {
      dispatch(deleteProjectAction(id));
      try {
        await getTrpcClient().projects.delete.mutate({ id });
      } catch {
        await fetchProjects();
      }
    },
    [dispatch, fetchProjects]
  );

  const addSessionToProject = useCallback(
    async (params: { projectId: string; sessionId: string }) => {
      try {
        const result = await getTrpcClient().projects.addSession.mutate(params);
        if (result) {
          dispatch(
            addProjectSession(
              serializeDates({
                id: params.sessionId,
                projectId: params.projectId,
                title: null,
                status: "active" as const,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              })
            )
          );
        }
        return result;
      } catch (err: any) {
        dispatch(setProjectsError(err?.message || "Failed to add session to project"));
        throw err;
      }
    },
    [dispatch]
  );

  useEffect(() => {
    if (!autoFetch || hasFetchedRef.current) return;
    if (projects.projects.length > 0) return;
    hasFetchedRef.current = true;
    fetchProjects();
  }, [autoFetch, projects.projects.length, fetchProjects]);

  return {
    // State
    ...projects,
    // Fetch
    fetchProjects,
    // Mutations
    createProject,
    updateProject: updateProjectById,
    deleteProject,
    addSessionToProject,
  };
}
