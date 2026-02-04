import type { SearchResponse, MultiSearchResponse } from "typesense/lib/Typesense/Documents";

// Collection names
export const COLLECTION_NAMES = {
  FILES: "files",
  SESSIONS: "sessions",
  TASKS: "tasks",
  PROJECTS: "projects",
  ACTIONS: "actions",
} as const;

export type CollectionName = (typeof COLLECTION_NAMES)[keyof typeof COLLECTION_NAMES];

// Document types for each collection
export interface FileDocument {
  id: string;
  userId: string;
  sessionId?: string;
  name: string;
  path: string;
  mimeType?: string;
  size?: number;
  isPublic: boolean;
  createdAt: number; // Unix timestamp
  updatedAt: number;
}

export interface SessionDocument {
  id: string;
  userId: string;
  title?: string;
  status: "active" | "paused" | "completed" | "failed";
  createdAt: number;
  updatedAt: number;
}

export interface TaskDocument {
  id: string;
  userId: string;
  name: string;
  description?: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled" | "paused";
  taskType: "agent_run" | "report" | "sync" | "backup" | "custom";
  scheduleType: "once" | "recurring" | "cron";
  isEnabled: boolean;
  nextRunAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface ProjectDocument {
  id: string;
  userId: string;
  organizationId?: string;
  name: string;
  description?: string;
  status: "active" | "archived" | "completed" | "paused";
  visibility: "private" | "team" | "public";
  isPinned: boolean;
  tags?: string[];
  createdAt: number;
  updatedAt: number;
}

export interface ActionDocument {
  id: string;
  userId: string;
  agentId: string;
  sessionId: string;
  title: string;
  description?: string;
  status: "pending" | "in_progress" | "completed" | "failed" | "cancelled";
  agentType: "orchestrator" | "researcher" | "coder" | "browser" | "file_manager" | "executor" | "analyst";
  createdAt: number;
  updatedAt: number;
}

// Search result types
export type SearchResultType = "file" | "session" | "task" | "project" | "action";

export interface SearchResultItem {
  id: string;
  type: SearchResultType;
  title: string;
  subtitle?: string;
  description?: string;
  icon?: string;
  timestamp: number;
  url?: string;
  highlights?: {
    field: string;
    snippet: string;
  }[];
  metadata?: Record<string, unknown>;
}

export interface SearchResults {
  query: string;
  totalFound: number;
  results: SearchResultItem[];
  facets?: {
    type: Record<string, number>;
    status?: Record<string, number>;
  };
  processingTimeMs: number;
}

// Search options
export interface SearchOptions {
  query: string;
  userId: string;
  collections?: CollectionName[];
  filters?: {
    type?: SearchResultType[];
    status?: string[];
    dateFrom?: Date;
    dateTo?: Date;
  };
  limit?: number;
  offset?: number;
  highlightFields?: boolean;
}

// Export Typesense response types
export type { SearchResponse, MultiSearchResponse };
