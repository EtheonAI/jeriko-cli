import type { CollectionCreateSchema } from "typesense/lib/Typesense/Collections";
import { COLLECTION_NAMES } from "../types";

// Files collection schema
export const filesCollectionSchema: CollectionCreateSchema = {
  name: COLLECTION_NAMES.FILES,
  fields: [
    { name: "id", type: "string" },
    { name: "userId", type: "string", facet: true },
    { name: "sessionId", type: "string", optional: true },
    { name: "name", type: "string" },
    { name: "path", type: "string" },
    { name: "mimeType", type: "string", facet: true, optional: true },
    { name: "size", type: "int32", optional: true },
    { name: "isPublic", type: "bool" },
    { name: "createdAt", type: "int64" },
    { name: "updatedAt", type: "int64" },
  ],
  default_sorting_field: "updatedAt",
  enable_nested_fields: false,
};

// Sessions collection schema
export const sessionsCollectionSchema: CollectionCreateSchema = {
  name: COLLECTION_NAMES.SESSIONS,
  fields: [
    { name: "id", type: "string" },
    { name: "userId", type: "string", facet: true },
    { name: "title", type: "string", optional: true },
    { name: "status", type: "string", facet: true },
    { name: "createdAt", type: "int64" },
    { name: "updatedAt", type: "int64" },
  ],
  default_sorting_field: "updatedAt",
  enable_nested_fields: false,
};

// Tasks collection schema (scheduled tasks)
export const tasksCollectionSchema: CollectionCreateSchema = {
  name: COLLECTION_NAMES.TASKS,
  fields: [
    { name: "id", type: "string" },
    { name: "userId", type: "string", facet: true },
    { name: "name", type: "string" },
    { name: "description", type: "string", optional: true },
    { name: "status", type: "string", facet: true },
    { name: "taskType", type: "string", facet: true },
    { name: "scheduleType", type: "string", facet: true },
    { name: "isEnabled", type: "bool", facet: true },
    { name: "nextRunAt", type: "int64", optional: true },
    { name: "createdAt", type: "int64" },
    { name: "updatedAt", type: "int64" },
  ],
  default_sorting_field: "createdAt",
  enable_nested_fields: false,
};

// Projects collection schema
export const projectsCollectionSchema: CollectionCreateSchema = {
  name: COLLECTION_NAMES.PROJECTS,
  fields: [
    { name: "id", type: "string" },
    { name: "userId", type: "string", facet: true },
    { name: "organizationId", type: "string", facet: true, optional: true },
    { name: "name", type: "string" },
    { name: "description", type: "string", optional: true },
    { name: "status", type: "string", facet: true },
    { name: "visibility", type: "string", facet: true },
    { name: "isPinned", type: "bool", facet: true },
    { name: "tags", type: "string[]", facet: true, optional: true },
    { name: "createdAt", type: "int64" },
    { name: "updatedAt", type: "int64" },
  ],
  default_sorting_field: "updatedAt",
  enable_nested_fields: false,
};

// Actions collection schema (agent tasks)
export const actionsCollectionSchema: CollectionCreateSchema = {
  name: COLLECTION_NAMES.ACTIONS,
  fields: [
    { name: "id", type: "string" },
    { name: "userId", type: "string", facet: true },
    { name: "agentId", type: "string" },
    { name: "sessionId", type: "string" },
    { name: "title", type: "string" },
    { name: "description", type: "string", optional: true },
    { name: "status", type: "string", facet: true },
    { name: "agentType", type: "string", facet: true },
    { name: "createdAt", type: "int64" },
    { name: "updatedAt", type: "int64" },
  ],
  default_sorting_field: "createdAt",
  enable_nested_fields: false,
};

// All collection schemas
export const allCollectionSchemas = [
  filesCollectionSchema,
  sessionsCollectionSchema,
  tasksCollectionSchema,
  projectsCollectionSchema,
  actionsCollectionSchema,
] as const;

// Export collection names for convenience
export { COLLECTION_NAMES };
