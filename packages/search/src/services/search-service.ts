import "server-only";
import { getTypesenseClient } from "../client";
import { COLLECTION_NAMES } from "../collections";
import type {
  SearchOptions,
  SearchResults,
  SearchResultItem,
  CollectionName,
  FileDocument,
  SessionDocument,
  TaskDocument,
  ProjectDocument,
  ActionDocument,
} from "../types";
import type { MultiSearchRequestSchema } from "typesense/lib/Typesense/MultiSearch";
import type { SearchResponse } from "typesense/lib/Typesense/Documents";

const client = getTypesenseClient();

// Default search configuration
const DEFAULT_LIMIT = 5;
const DEFAULT_TYPO_TOLERANCE = 2;

// Build filter string for Typesense
function buildFilterString(userId: string, options?: SearchOptions["filters"]): string {
  const filters: string[] = [`userId:=${userId}`];

  if (options?.dateFrom) {
    filters.push(`createdAt:>=${options.dateFrom.getTime()}`);
  }

  if (options?.dateTo) {
    filters.push(`createdAt:<=${options.dateTo.getTime()}`);
  }

  return filters.join(" && ");
}

// Map Typesense hit to SearchResultItem
function mapFileHit(hit: SearchResponse<FileDocument>["hits"][0]): SearchResultItem {
  const doc = hit.document;
  return {
    id: doc.id,
    type: "file",
    title: doc.name,
    subtitle: doc.path,
    description: doc.mimeType || undefined,
    icon: getFileIcon(doc.mimeType),
    timestamp: doc.updatedAt,
    url: `/files/${doc.id}`,
    highlights: hit.highlights?.map((h) => ({
      field: h.field,
      snippet: h.snippet || "",
    })),
    metadata: {
      size: doc.size,
      mimeType: doc.mimeType,
      isPublic: doc.isPublic,
    },
  };
}

function mapSessionHit(hit: SearchResponse<SessionDocument>["hits"][0]): SearchResultItem {
  const doc = hit.document;
  return {
    id: doc.id,
    type: "session",
    title: doc.title || "Untitled Session",
    subtitle: `Status: ${doc.status}`,
    icon: "message-square",
    timestamp: doc.updatedAt,
    url: `/chat/${doc.id}`,
    highlights: hit.highlights?.map((h) => ({
      field: h.field,
      snippet: h.snippet || "",
    })),
    metadata: {
      status: doc.status,
    },
  };
}

function mapTaskHit(hit: SearchResponse<TaskDocument>["hits"][0]): SearchResultItem {
  const doc = hit.document;
  return {
    id: doc.id,
    type: "task",
    title: doc.name,
    subtitle: doc.taskType,
    description: doc.description,
    icon: "clock",
    timestamp: doc.createdAt,
    url: `/actions?tab=tasks&id=${doc.id}`,
    highlights: hit.highlights?.map((h) => ({
      field: h.field,
      snippet: h.snippet || "",
    })),
    metadata: {
      status: doc.status,
      taskType: doc.taskType,
      scheduleType: doc.scheduleType,
      isEnabled: doc.isEnabled,
      nextRunAt: doc.nextRunAt,
    },
  };
}

function mapProjectHit(hit: SearchResponse<ProjectDocument>["hits"][0]): SearchResultItem {
  const doc = hit.document;
  return {
    id: doc.id,
    type: "project",
    title: doc.name,
    subtitle: `${doc.status} - ${doc.visibility}`,
    description: doc.description,
    icon: "folder",
    timestamp: doc.updatedAt,
    url: `/projects/${doc.id}`,
    highlights: hit.highlights?.map((h) => ({
      field: h.field,
      snippet: h.snippet || "",
    })),
    metadata: {
      status: doc.status,
      visibility: doc.visibility,
      isPinned: doc.isPinned,
      tags: doc.tags,
    },
  };
}

function mapActionHit(hit: SearchResponse<ActionDocument>["hits"][0]): SearchResultItem {
  const doc = hit.document;
  return {
    id: doc.id,
    type: "action",
    title: doc.title,
    subtitle: doc.agentType,
    description: doc.description,
    icon: "zap",
    timestamp: doc.createdAt,
    url: `/chat/${doc.sessionId}`,
    highlights: hit.highlights?.map((h) => ({
      field: h.field,
      snippet: h.snippet || "",
    })),
    metadata: {
      status: doc.status,
      agentType: doc.agentType,
      agentId: doc.agentId,
      sessionId: doc.sessionId,
    },
  };
}

function getFileIcon(mimeType?: string): string {
  if (!mimeType) return "file";
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "music";
  if (mimeType.includes("pdf")) return "file-text";
  if (mimeType.includes("word") || mimeType.includes("document")) return "file-text";
  if (mimeType.includes("sheet") || mimeType.includes("excel")) return "table";
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint")) return "presentation";
  if (mimeType.includes("zip") || mimeType.includes("archive")) return "archive";
  if (mimeType.includes("code") || mimeType.includes("javascript") || mimeType.includes("typescript"))
    return "code";
  return "file";
}

// Main federated search function
export async function search(options: SearchOptions): Promise<SearchResults> {
  const startTime = Date.now();
  const {
    query,
    userId,
    collections = Object.values(COLLECTION_NAMES) as CollectionName[],
    filters,
    limit = DEFAULT_LIMIT,
    highlightFields = true,
  } = options;

  // Build search requests for each collection
  const searches: MultiSearchRequestSchema["searches"] = [];

  if (collections.includes(COLLECTION_NAMES.FILES)) {
    searches.push({
      collection: COLLECTION_NAMES.FILES,
      q: query,
      query_by: "name,path",
      filter_by: buildFilterString(userId, filters),
      sort_by: "_text_match:desc,updatedAt:desc",
      per_page: limit,
      num_typos: DEFAULT_TYPO_TOLERANCE,
      highlight_fields: highlightFields ? "name,path" : "none",
      highlight_full_fields: highlightFields ? "name" : "none",
    });
  }

  if (collections.includes(COLLECTION_NAMES.SESSIONS)) {
    searches.push({
      collection: COLLECTION_NAMES.SESSIONS,
      q: query,
      query_by: "title",
      filter_by: buildFilterString(userId, filters),
      sort_by: "_text_match:desc,updatedAt:desc",
      per_page: limit,
      num_typos: DEFAULT_TYPO_TOLERANCE,
      highlight_fields: highlightFields ? "title" : "none",
      highlight_full_fields: highlightFields ? "title" : "none",
    });
  }

  if (collections.includes(COLLECTION_NAMES.TASKS)) {
    searches.push({
      collection: COLLECTION_NAMES.TASKS,
      q: query,
      query_by: "name,description",
      filter_by: buildFilterString(userId, filters),
      sort_by: "_text_match:desc,createdAt:desc",
      per_page: limit,
      num_typos: DEFAULT_TYPO_TOLERANCE,
      highlight_fields: highlightFields ? "name,description" : "none",
      highlight_full_fields: highlightFields ? "name" : "none",
    });
  }

  if (collections.includes(COLLECTION_NAMES.PROJECTS)) {
    searches.push({
      collection: COLLECTION_NAMES.PROJECTS,
      q: query,
      query_by: "name,description,tags",
      filter_by: buildFilterString(userId, filters),
      sort_by: "_text_match:desc,updatedAt:desc",
      per_page: limit,
      num_typos: DEFAULT_TYPO_TOLERANCE,
      highlight_fields: highlightFields ? "name,description" : "none",
      highlight_full_fields: highlightFields ? "name" : "none",
    });
  }

  if (collections.includes(COLLECTION_NAMES.ACTIONS)) {
    searches.push({
      collection: COLLECTION_NAMES.ACTIONS,
      q: query,
      query_by: "title,description",
      filter_by: buildFilterString(userId, filters),
      sort_by: "_text_match:desc,createdAt:desc",
      per_page: limit,
      num_typos: DEFAULT_TYPO_TOLERANCE,
      highlight_fields: highlightFields ? "title,description" : "none",
      highlight_full_fields: highlightFields ? "title" : "none",
    });
  }

  // Execute federated search
  const response = await client.multiSearch.perform({ searches }, {});

  // Process results
  const results: SearchResultItem[] = [];
  let totalFound = 0;
  const facets: SearchResults["facets"] = { type: {} };

  for (const searchResult of response.results) {
    if (!searchResult.hits) continue;

    const collection = searchResult.request_params?.collection_name;
    totalFound += searchResult.found || 0;

    // Update facets
    if (collection) {
      const type = collectionToType(collection);
      facets.type[type] = (facets.type[type] || 0) + (searchResult.found || 0);
    }

    // Map hits to SearchResultItem
    for (const hit of searchResult.hits) {
      let item: SearchResultItem | null = null;

      switch (collection) {
        case COLLECTION_NAMES.FILES:
          item = mapFileHit(hit as SearchResponse<FileDocument>["hits"][0]);
          break;
        case COLLECTION_NAMES.SESSIONS:
          item = mapSessionHit(hit as SearchResponse<SessionDocument>["hits"][0]);
          break;
        case COLLECTION_NAMES.TASKS:
          item = mapTaskHit(hit as SearchResponse<TaskDocument>["hits"][0]);
          break;
        case COLLECTION_NAMES.PROJECTS:
          item = mapProjectHit(hit as SearchResponse<ProjectDocument>["hits"][0]);
          break;
        case COLLECTION_NAMES.ACTIONS:
          item = mapActionHit(hit as SearchResponse<ActionDocument>["hits"][0]);
          break;
      }

      if (item) {
        results.push(item);
      }
    }
  }

  // Sort results by text match score (already sorted by Typesense) and timestamp
  results.sort((a, b) => b.timestamp - a.timestamp);

  return {
    query,
    totalFound,
    results,
    facets,
    processingTimeMs: Date.now() - startTime,
  };
}

function collectionToType(collection: string): "file" | "session" | "task" | "project" | "action" {
  switch (collection) {
    case COLLECTION_NAMES.FILES:
      return "file";
    case COLLECTION_NAMES.SESSIONS:
      return "session";
    case COLLECTION_NAMES.TASKS:
      return "task";
    case COLLECTION_NAMES.PROJECTS:
      return "project";
    case COLLECTION_NAMES.ACTIONS:
      return "action";
    default:
      return "file";
  }
}

// Search within a single collection
export async function searchCollection<T>(
  collectionName: CollectionName,
  query: string,
  userId: string,
  queryBy: string,
  options?: {
    limit?: number;
    offset?: number;
    filters?: SearchOptions["filters"];
    sortBy?: string;
  }
): Promise<{ results: T[]; totalFound: number }> {
  const response = await client
    .collections(collectionName)
    .documents()
    .search({
      q: query,
      query_by: queryBy,
      filter_by: buildFilterString(userId, options?.filters),
      sort_by: options?.sortBy || "_text_match:desc",
      per_page: options?.limit || DEFAULT_LIMIT,
      page: options?.offset ? Math.floor(options.offset / (options.limit || DEFAULT_LIMIT)) + 1 : 1,
      num_typos: DEFAULT_TYPO_TOLERANCE,
    });

  return {
    results: (response.hits?.map((hit) => hit.document) || []) as T[],
    totalFound: response.found || 0,
  };
}

// Quick search for autocomplete (faster, limited results)
export async function quickSearch(
  query: string,
  userId: string,
  limit = 10
): Promise<SearchResultItem[]> {
  const results = await search({
    query,
    userId,
    limit: Math.min(limit, 3), // Limit per collection
    highlightFields: false,
  });

  return results.results.slice(0, limit);
}
