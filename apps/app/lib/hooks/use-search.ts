"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { trpc } from "../trpc/client";
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
} from "../store";

const DEBOUNCE_MS = 300;
const RECENT_SEARCHES_KEY = "rubic-recent-searches";
const MIN_QUERY_LENGTH = 2;

export function useSearch() {
  const dispatch = useAppDispatch();
  const router = useRouter();
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

  // TRPC mutation for search
  const searchMutation = trpc.search.global.useMutation({
    onSuccess: (data) => {
      dispatch(setResults(data));
      if (query.trim().length >= MIN_QUERY_LENGTH) {
        dispatch(addRecentSearch({ query: query.trim(), resultCount: data.totalFound }));
        saveRecentSearches([
          { query: query.trim(), timestamp: Date.now(), resultCount: data.totalFound },
          ...recentSearches.filter((s) => s.query.toLowerCase() !== query.toLowerCase()),
        ]);
      }
    },
    onError: (err) => {
      dispatch(setError(err.message));
    },
  });

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

  // Debounced search
  const performSearch = useCallback(
    (searchQuery: string) => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      if (searchQuery.length < MIN_QUERY_LENGTH) {
        dispatch(clearResults());
        dispatch(setLoading(false));
        return;
      }

      dispatch(setLoading(true));

      debounceRef.current = setTimeout(() => {
        searchMutation.mutate({
          query: searchQuery,
          limit: 20,
        });
      }, DEBOUNCE_MS);
    },
    [dispatch, searchMutation]
  );

  // Handle query change
  const handleQueryChange = useCallback(
    (newQuery: string) => {
      dispatch(setQuery(newQuery));
      performSearch(newQuery);
    },
    [dispatch, performSearch]
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
          dispatch(setActiveFilter(filters[nextIndex]));
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
      performSearch(recentQuery);
    },
    [dispatch, performSearch]
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
