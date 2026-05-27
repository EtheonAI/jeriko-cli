import type { CollectionCreateSchema } from "typesense/lib/Typesense/Collections";
import type { SearchParams, SearchResponse } from "typesense/lib/Typesense/Documents";
import type { MultiSearchResponse } from "typesense/lib/Typesense/MultiSearch";

export type SearchCollectionName = string;

export type SearchDocument = Record<string, unknown> & {
  id: string;
};

export type SearchCollectionSchema = CollectionCreateSchema;

export type SearchCollectionStats = {
  name: string;
  numDocuments: number;
  numMemoryBytesUsed: number;
};

export type BulkImportResult = {
  success: number;
  failed: number;
};

export type SearchCollectionOptions = {
  collection: SearchCollectionName;
  query: string;
  queryBy: string;
  filterBy?: string;
  sortBy?: string;
  page?: number;
  perPage?: number;
  numTypos?: number;
  highlightFields?: string;
  includeFields?: string;
  excludeFields?: string;
};

export type MultiSearchRequest = {
  collection: SearchCollectionName;
  q: string;
  query_by: string;
  filter_by?: string;
  sort_by?: string;
  page?: number;
  per_page?: number;
  num_typos?: number;
  highlight_fields?: string;
  include_fields?: string;
  exclude_fields?: string;
};

export type { SearchParams, SearchResponse, MultiSearchResponse };
