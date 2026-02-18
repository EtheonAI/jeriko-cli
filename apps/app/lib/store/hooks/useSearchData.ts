"use client";

import { useCallback, useRef } from "react";
import { useAppDispatch, useAppSelector } from "../hooks";
import {
  setLoading,
  setResults,
  setError,
  setQuery,
  addRecentSearch,
  type SearchResults,
} from "../slices/search.slice";
import { getTrpcClient } from "@/lib/trpc/vanilla";

export function useSearchData() {
  const dispatch = useAppDispatch();
  const search = useAppSelector((state) => state.search);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const performSearch = useCallback(
    async (query: string, types?: string[]) => {
      if (!query.trim()) return;

      // Cancel previous in-flight request
      abortRef.current?.abort();
      abortRef.current = new AbortController();

      dispatch(setLoading(true));
      try {
        const result = await getTrpcClient().search.global.query({
          query: query.trim(),
          types: types as any,
          limit: 50,
        });
        if (result) {
          const searchResults: SearchResults = {
            query: query.trim(),
            totalFound: (result as any).totalFound ?? (result as any).results?.length ?? 0,
            results: ((result as any).results ?? []).map((r: any) => ({
              id: r.id,
              type: r.type ?? "session",
              title: r.title ?? "",
              subtitle: r.subtitle,
              description: r.description,
              icon: r.icon,
              timestamp: r.timestamp ?? Date.now(),
              url: r.url,
              highlights: r.highlights,
              metadata: r.metadata,
            })),
            facets: (result as any).facets,
            processingTimeMs: (result as any).processingTimeMs ?? 0,
          };
          dispatch(setResults(searchResults));
          dispatch(addRecentSearch({ query: query.trim(), resultCount: searchResults.totalFound }));
        }
      } catch (err: any) {
        if (err?.name !== "AbortError") {
          dispatch(setError(err?.message || "Search failed"));
        }
      }
    },
    [dispatch]
  );

  const debouncedSearch = useCallback(
    (query: string, types?: string[], delayMs = 300) => {
      dispatch(setQuery(query));
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (!query.trim()) return;
      debounceRef.current = setTimeout(() => performSearch(query, types), delayMs);
    },
    [dispatch, performSearch]
  );

  return {
    // State
    ...search,
    // Actions
    performSearch,
    debouncedSearch,
  };
}
