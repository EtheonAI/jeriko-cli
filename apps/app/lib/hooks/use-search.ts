"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { useQuickSearchQuery } from "../store/api/api.slice";
import {
  openSearch,
  closeSearch,
  toggleSearch,
  setQuery,
  clearQuery,
  setLoading,
  setResults,
  clearResults,
  setError,
  addRecentSearch,
  removeRecentSearch,
  clearRecentSearches,
  loadRecentSearches,
  setActiveFilter,
  clearFilters,
  moveSelectionUp,
  moveSelectionDown,
  setSelectedIndex,
  selectSearchIsOpen,
  selectSearchQuery,
  selectSearchResults,
  selectSearchIsLoading,
  selectSearchError,
  selectRecentSearches,
  selectActiveFilter,
  selectSelectedIndex,
  selectFilteredResults,
  selectSelectedResult,
  type SearchResultType,
  type RecentSearch,
} from "../store/slices/search.slice";

const DEBOUNCE_MS = 300;
const RECENT_SEARCHES_KEY = "rubic-recent-searches";
const MIN_QUERY_LENGTH = 2;

export function useSearch() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Selectors
  const isOpen = useAppSelector(selectSearchIsOpen);
  const query = useAppSelector(selectSearchQuery);
  const results = useAppSelector(selectSearchResults);
  const filteredResults = useAppSelector(selectFilteredResults);
  const isLoading = useAppSelector(selectSearchIsLoading);
  const error = useAppSelector(selectSearchError);
  const recentSearches = useAppSelector(selectRecentSearches);
  const activeFilter = useAppSelector(selectActiveFilter);
  const selectedIndex = useAppSelector(selectSelectedIndex);
  const selectedResult = useAppSelector(selectSelectedResult);

  // RTK Query — auto-fetches when debouncedQuery changes
  const { data: quickResults, error: searchError, isFetching } = useQuickSearchQuery(
    { query: debouncedQuery, limit: 20 },
    { skip: !debouncedQuery || debouncedQuery.length < MIN_QUERY_LENGTH }
  );

  // Sync RTK Query loading state to Redux
  const prevFetchingRef = useRef(isFetching);
  useEffect(() => {
    if (isFetching !== prevFetchingRef.current) {
      prevFetchingRef.current = isFetching;
      dispatch(setLoading(isFetching));
    }
  }, [isFetching, dispatch]);

  // Sync RTK Query results to Redux
  const prevResultsRef = useRef(quickResults);
  useEffect(() => {
    if (quickResults && quickResults !== prevResultsRef.current) {
      prevResultsRef.current = quickResults;
      // Transform quick search results to the format Redux expects
      const resultsArray = quickResults as any[];
      const totalFound = resultsArray?.length ?? 0;
      dispatch(setResults({
        query: debouncedQuery,
        results: resultsArray,
        totalFound,
        processingTimeMs: 0,
      }));
      if (debouncedQuery.trim().length >= MIN_QUERY_LENGTH) {
        dispatch(addRecentSearch({ query: debouncedQuery.trim(), resultCount: totalFound }));
      }
    }
  }, [quickResults, debouncedQuery, dispatch]);

  // Sync RTK Query errors to Redux
  useEffect(() => {
    if (searchError) {
      dispatch(setError("Search failed"));
    }
  }, [searchError, dispatch]);

  // Load recent searches from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as RecentSearch[];
        dispatch(loadRecentSearches(parsed));
      }
    } catch {
      // Ignore localStorage errors
    }
  }, [dispatch]);

  // Save recent searches to localStorage
  const saveRecentSearches = useCallback((searches: RecentSearch[]) => {
    try {
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(searches.slice(0, 10)));
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // Handle query change — debounce before updating the RTK Query parameter
  const handleQueryChange = useCallback(
    (newQuery: string) => {
      dispatch(setQuery(newQuery));

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      if (newQuery.length < MIN_QUERY_LENGTH) {
        dispatch(clearResults());
        dispatch(setLoading(false));
        setDebouncedQuery("");
        return;
      }

      dispatch(setLoading(true));

      debounceRef.current = setTimeout(() => {
        setDebouncedQuery(newQuery);
      }, DEBOUNCE_MS);
    },
    [dispatch]
  );

  // Handle filter change
  const handleFilterChange = useCallback(
    (filter: SearchResultType | "all") => {
      dispatch(setActiveFilter(filter));
    },
    [dispatch]
  );

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          dispatch(moveSelectionDown());
          break;
        case "ArrowUp":
          e.preventDefault();
          dispatch(moveSelectionUp());
          break;
        case "Enter":
          e.preventDefault();
          if (selectedResult?.url) {
            dispatch(closeSearch());
            router.push(selectedResult.url);
          }
          break;
        case "Escape":
          e.preventDefault();
          dispatch(closeSearch());
          break;
        case "Tab":
          // Cycle through filters
          e.preventDefault();
          const filters: (SearchResultType | "all")[] = [
            "all",
            "file",
            "session",
            "task",
            "project",
            "action",
          ];
          const currentIndex = filters.indexOf(activeFilter);
          const nextIndex = e.shiftKey
            ? (currentIndex - 1 + filters.length) % filters.length
            : (currentIndex + 1) % filters.length;
          dispatch(setActiveFilter(filters[nextIndex]!));
          break;
      }
    },
    [isOpen, dispatch, selectedResult, router, activeFilter]
  );

  // Handle result selection
  const handleResultSelect = useCallback(
    (result: { url?: string }) => {
      if (result.url) {
        dispatch(closeSearch());
        router.push(result.url);
      }
    },
    [dispatch, router]
  );

  // Handle recent search selection
  const handleRecentSearchSelect = useCallback(
    (recentQuery: string) => {
      dispatch(setQuery(recentQuery));
      // Immediately update debounced query (no debounce for recent search selection)
      setDebouncedQuery(recentQuery);
      dispatch(setLoading(true));
    },
    [dispatch]
  );

  // Handle recent search removal
  const handleRemoveRecentSearch = useCallback(
    (queryToRemove: string) => {
      dispatch(removeRecentSearch(queryToRemove));
      const updated = recentSearches.filter((s) => s.query !== queryToRemove);
      saveRecentSearches(updated);
    },
    [dispatch, recentSearches, saveRecentSearches]
  );

  // Handle clear recent searches
  const handleClearRecentSearches = useCallback(() => {
    dispatch(clearRecentSearches());
    try {
      localStorage.removeItem(RECENT_SEARCHES_KEY);
    } catch {
      // Ignore
    }
  }, [dispatch]);

  // Register global keyboard shortcut
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Cmd+K or Ctrl+K to toggle search
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        dispatch(toggleSearch());
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [dispatch]);

  // Register navigation keyboard shortcuts when open
  useEffect(() => {
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return {
    // State
    isOpen,
    query,
    results,
    filteredResults,
    isLoading,
    error,
    recentSearches,
    activeFilter,
    selectedIndex,
    selectedResult,

    // Actions
    open: () => dispatch(openSearch()),
    close: () => dispatch(closeSearch()),
    toggle: () => dispatch(toggleSearch()),
    setQuery: handleQueryChange,
    clearQuery: () => dispatch(clearQuery()),
    setFilter: handleFilterChange,
    clearFilters: () => dispatch(clearFilters()),
    selectResult: handleResultSelect,
    selectRecentSearch: handleRecentSearchSelect,
    removeRecentSearch: handleRemoveRecentSearch,
    clearRecentSearches: handleClearRecentSearches,
    setSelectedIndex: (index: number) => dispatch(setSelectedIndex(index)),
  };
}
