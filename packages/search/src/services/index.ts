// Index service exports
export {
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
} from "./index-service";

// Search service exports
export { search, searchCollection, quickSearch } from "./search-service";

// Sync service exports (for integrating with TRPC routers)
export {
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
} from "./sync-service";
