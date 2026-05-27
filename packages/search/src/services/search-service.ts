import "server-only";
import { getTypesenseClient } from "../client";
import type {
  MultiSearchRequest,
  SearchCollectionName,
  SearchCollectionOptions,
  SearchDocument,
  SearchResponse,
} from "../types";

export async function searchCollection<TDocument extends SearchDocument>(
  options: SearchCollectionOptions
): Promise<{ hits: TDocument[]; found: number; raw: SearchResponse<TDocument> }> {
  const client = getTypesenseClient();
  const response = await client
    .collections(options.collection)
    .documents()
    .search({
      q: options.query,
      query_by: options.queryBy,
      ...(options.filterBy ? { filter_by: options.filterBy } : {}),
      ...(options.sortBy ? { sort_by: options.sortBy } : {}),
      ...(options.page ? { page: options.page } : {}),
      ...(options.perPage ? { per_page: options.perPage } : {}),
      ...(typeof options.numTypos === "number" ? { num_typos: options.numTypos } : {}),
      ...(options.highlightFields ? { highlight_fields: options.highlightFields } : {}),
      ...(options.includeFields ? { include_fields: options.includeFields } : {}),
      ...(options.excludeFields ? { exclude_fields: options.excludeFields } : {}),
    });

  return {
    hits: mapHits<TDocument>(response.hits),
    found: response.found || 0,
    raw: response as SearchResponse<TDocument>,
  };
}

export async function multiSearch(
  searches: MultiSearchRequest[],
  options: Record<string, unknown> = {}
) {
  const client = getTypesenseClient();
  return client.multiSearch.perform({ searches }, options);
}

export async function quickSearch<TDocument extends SearchDocument>(
  collection: SearchCollectionName,
  query: string,
  queryBy: string,
  options: {
    filterBy?: string;
    perPage?: number;
    includeFields?: string;
  } = {}
): Promise<TDocument[]> {
  const result = await searchCollection<TDocument>({
    collection,
    query,
    queryBy,
    filterBy: options.filterBy,
    perPage: options.perPage ?? 10,
    includeFields: options.includeFields,
    numTypos: 2,
  });

  return result.hits;
}

function mapHits<TDocument extends SearchDocument>(
  hits: Array<{ document: unknown }> | undefined
): TDocument[] {
  return (hits ?? []).map((hit) => hit.document as TDocument);
}
