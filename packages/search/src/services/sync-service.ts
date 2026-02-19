import "server-only";
import {
  indexFile,
  deleteFileFromIndex,
  indexSession,
  deleteSessionFromIndex,
  indexTask,
  deleteTaskFromIndex,
  indexProject,
  deleteProjectFromIndex,
  indexAction,
  deleteActionFromIndex,
} from "./index-service";
import type {
  FileDocument,
  SessionDocument,
  TaskDocument,
  ProjectDocument,
  ActionDocument,
} from "../types";

// Database entity types (from @repo/database)
interface DbFile {
  id: string;
  userId: string;
  sessionId: string | null;
  name: string;
  path: string;
  mimeType: string | null;
  size: number | null;
  isPublic: boolean | null;
  createdAt: Date;
  updatedAt: Date;
}

interface DbSession {
  id: string;
  userId: string;
  title: string | null;
  status: "active" | "paused" | "completed" | "failed" | null;
  createdAt: Date;
  updatedAt: Date;
}

interface DbScheduledTask {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  status: "pending" | "running" | "completed" | "failed" | "cancelled" | "paused" | null;
  taskType: "agent_run" | "report" | "sync" | "backup" | "custom";
  scheduleType: "once" | "recurring" | "cron" | "trigger";
  isEnabled: boolean;
  nextRunAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface DbProject {
  id: string;
  userId: string;
  organizationId: string | null;
  name: string;
  description: string | null;
  status: "active" | "archived" | "completed" | "paused" | null;
  visibility: "private" | "team" | "public" | null;
  isPinned: boolean;
  tags: string[] | null;
  createdAt: Date;
  updatedAt: Date;
}

interface DbAgentTask {
  id: string;
  agentId: string;
  title: string;
  description: string | null;
  status: "pending" | "in_progress" | "completed" | "failed" | "cancelled" | null;
  createdAt: Date;
  updatedAt: Date;
}

interface DbAgent {
  id: string;
  sessionId: string;
  type: "orchestrator" | "researcher" | "coder" | "browser" | "file_manager" | "executor" | "analyst";
}

// Transform database entities to search documents

function transformFile(file: DbFile): FileDocument {
  return {
    id: file.id,
    userId: file.userId,
    sessionId: file.sessionId || undefined,
    name: file.name,
    path: file.path,
    mimeType: file.mimeType || undefined,
    size: file.size || undefined,
    isPublic: file.isPublic ?? false,
    createdAt: file.createdAt.getTime(),
    updatedAt: file.updatedAt.getTime(),
  };
}

function transformSession(session: DbSession): SessionDocument {
  return {
    id: session.id,
    userId: session.userId,
    title: session.title || undefined,
    status: session.status || "active",
    createdAt: session.createdAt.getTime(),
    updatedAt: session.updatedAt.getTime(),
  };
}

function transformTask(task: DbScheduledTask): TaskDocument {
  return {
    id: task.id,
    userId: task.userId,
    name: task.name,
    description: task.description || undefined,
    status: task.status || "pending",
    taskType: task.taskType,
    scheduleType: task.scheduleType,
    isEnabled: task.isEnabled,
    nextRunAt: task.nextRunAt?.getTime(),
    createdAt: task.createdAt.getTime(),
    updatedAt: task.updatedAt.getTime(),
  };
}

function transformProject(project: DbProject): ProjectDocument {
  return {
    id: project.id,
    userId: project.userId,
    organizationId: project.organizationId || undefined,
    name: project.name,
    description: project.description || undefined,
    status: project.status || "active",
    visibility: project.visibility || "private",
    isPinned: project.isPinned,
    tags: project.tags || undefined,
    createdAt: project.createdAt.getTime(),
    updatedAt: project.updatedAt.getTime(),
  };
}

function transformAction(
  task: DbAgentTask,
  agent: DbAgent,
  userId: string
): ActionDocument {
  return {
    id: task.id,
    userId,
    agentId: task.agentId,
    sessionId: agent.sessionId,
    title: task.title,
    description: task.description || undefined,
    status: task.status || "pending",
    agentType: agent.type,
    createdAt: task.createdAt.getTime(),
    updatedAt: task.updatedAt.getTime(),
  };
}

// Sync functions - safe to call (they catch errors internally)

export async function syncFileToSearch(file: DbFile): Promise<void> {
  try {
    await indexFile(transformFile(file));
  } catch (error) {
    console.error("[Search Sync] Failed to index file:", file.id, error);
  }
}

export async function removeFileFromSearch(fileId: string): Promise<void> {
  try {
    await deleteFileFromIndex(fileId);
  } catch (error) {
    console.error("[Search Sync] Failed to remove file from index:", fileId, error);
  }
}

export async function syncSessionToSearch(session: DbSession): Promise<void> {
  try {
    await indexSession(transformSession(session));
  } catch (error) {
    console.error("[Search Sync] Failed to index session:", session.id, error);
  }
}

export async function removeSessionFromSearch(sessionId: string): Promise<void> {
  try {
    await deleteSessionFromIndex(sessionId);
  } catch (error) {
    console.error("[Search Sync] Failed to remove session from index:", sessionId, error);
  }
}

export async function syncTaskToSearch(task: DbScheduledTask): Promise<void> {
  try {
    await indexTask(transformTask(task));
  } catch (error) {
    console.error("[Search Sync] Failed to index task:", task.id, error);
  }
}

export async function removeTaskFromSearch(taskId: string): Promise<void> {
  try {
    await deleteTaskFromIndex(taskId);
  } catch (error) {
    console.error("[Search Sync] Failed to remove task from index:", taskId, error);
  }
}

export async function syncProjectToSearch(project: DbProject): Promise<void> {
  try {
    await indexProject(transformProject(project));
  } catch (error) {
    console.error("[Search Sync] Failed to index project:", project.id, error);
  }
}

export async function removeProjectFromSearch(projectId: string): Promise<void> {
  try {
    await deleteProjectFromIndex(projectId);
  } catch (error) {
    console.error("[Search Sync] Failed to remove project from index:", projectId, error);
  }
}

export async function syncActionToSearch(
  task: DbAgentTask,
  agent: DbAgent,
  userId: string
): Promise<void> {
  try {
    await indexAction(transformAction(task, agent, userId));
  } catch (error) {
    console.error("[Search Sync] Failed to index action:", task.id, error);
  }
}

export async function removeActionFromSearch(actionId: string): Promise<void> {
  try {
    await deleteActionFromIndex(actionId);
  } catch (error) {
    console.error("[Search Sync] Failed to remove action from index:", actionId, error);
  }
}

// Batch sync functions for initial indexing

export async function syncAllFilesToSearch(files: DbFile[]): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  for (const file of files) {
    try {
      await indexFile(transformFile(file));
      success++;
    } catch {
      failed++;
    }
  }

  return { success, failed };
}

export async function syncAllSessionsToSearch(
  sessions: DbSession[]
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  for (const session of sessions) {
    try {
      await indexSession(transformSession(session));
      success++;
    } catch {
      failed++;
    }
  }

  return { success, failed };
}

export async function syncAllTasksToSearch(
  tasks: DbScheduledTask[]
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  for (const task of tasks) {
    try {
      await indexTask(transformTask(task));
      success++;
    } catch {
      failed++;
    }
  }

  return { success, failed };
}

export async function syncAllProjectsToSearch(
  projects: DbProject[]
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  for (const project of projects) {
    try {
      await indexProject(transformProject(project));
      success++;
    } catch {
      failed++;
    }
  }

  return { success, failed };
}
