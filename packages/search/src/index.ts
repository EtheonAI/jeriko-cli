// Client exports
export { getTypesenseClient, checkTypesenseHealth, resetTypesenseClient } from "./client";

export {
  ensureCollection,
  ensureCollections,
  recreateCollection,
  deleteCollection,
  getCollectionStats,
} from "./collections";

export {
  upsertDocument,
  deleteDocument,
  bulkUpsertDocuments,
  deleteDocumentsByFilter,
  searchCollection,
  multiSearch,
  quickSearch,
} from "./services";

export type {
  SearchCollectionName,
  SearchDocument,
  SearchCollectionSchema,
  SearchCollectionStats,
  BulkImportResult,
  SearchCollectionOptions,
  MultiSearchRequest,
  SearchParams,
  SearchResponse,
  MultiSearchResponse,
} from "./types";
