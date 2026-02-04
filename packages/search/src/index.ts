// Client exports
export { getTypesenseClient, checkTypesenseHealth, resetTypesenseClient } from "./client";

// Collection exports
export {
  filesCollectionSchema,
  sessionsCollectionSchema,
  tasksCollectionSchema,
  projectsCollectionSchema,
  actionsCollectionSchema,
  allCollectionSchemas,
  COLLECTION_NAMES,
} from "./collections";

// Service exports
export {
  // Index service
  initializeCollections,
  recreateCollection,
  indexFile,
  deleteFileFromIndex,
  bulkIndexFiles,
  indexSession,
  deleteSessionFromIndex,
  bulkIndexSessions,
  indexTask,
  deleteTaskFromIndex,
  bulkIndexTasks,
  indexProject,
  deleteProjectFromIndex,
  bulkIndexProjects,
  indexAction,
  deleteActionFromIndex,
  bulkIndexActions,
  deleteAllUserDocuments,
  getCollectionStats,
  getAllCollectionStats,
  // Search service
  search,
  searchCollection,
  quickSearch,
  // Sync service (for TRPC integration)
  syncFileToSearch,
  removeFileFromSearch,
  syncSessionToSearch,
  removeSessionFromSearch,
  syncTaskToSearch,
  removeTaskFromSearch,
  syncProjectToSearch,
  removeProjectFromSearch,
  syncActionToSearch,
  removeActionFromSearch,
  syncAllFilesToSearch,
  syncAllSessionsToSearch,
  syncAllTasksToSearch,
  syncAllProjectsToSearch,
} from "./services";

// Type exports
export type {
  CollectionName,
  FileDocument,
  SessionDocument,
  TaskDocument,
  ProjectDocument,
  ActionDocument,
  SearchResultType,
  SearchResultItem,
  SearchResults,
  SearchOptions,
} from "./types";
