import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

// Types matching the search package
export type SearchResultType = "file" | "session" | "task" | "project" | "action";

export interface SearchResultItem {
  id: string;
  type: SearchResultType;
  title: string;
  subtitle?: string;
  description?: string;
  icon?: string;
  timestamp: number;
  url?: string;
  highlights?: {
    field: string;
    snippet: string;
  }[];
  metadata?: Record<string, unknown>;
}

export interface SearchResults {
  query: string;
  totalFound: number;
  results: SearchResultItem[];
  facets?: {
    type: Record<string, number>;
    status?: Record<string, number>;
  };
  processingTimeMs: number;
}

export interface RecentSearch {
  query: string;
  timestamp: number;
  resultCount: number;
}

export interface SearchFilters {
  types: SearchResultType[];
  dateRange?: {
    from?: string;
    to?: string;
  };
}

export interface SearchState {
  // Modal state
  isOpen: boolean;

  // Search query and results
  query: string;
  results: SearchResults | null;
  isLoading: boolean;
  error: string | null;

  // Recent searches (persisted to localStorage)
  recentSearches: RecentSearch[];
  maxRecentSearches: number;

  // Filters
  filters: SearchFilters;
  activeFilter: SearchResultType | "all";

  // UI state
  selectedIndex: number;
  showFilters: boolean;
}

const MAX_RECENT_SEARCHES = 10;

const initialState: SearchState = {
  isOpen: false,
  query: "",
  results: null,
  isLoading: false,
  error: null,
  recentSearches: [],
  maxRecentSearches: MAX_RECENT_SEARCHES,
  filters: {
    types: [],
  },
  activeFilter: "all",
  selectedIndex: 0,
  showFilters: false,
};

export const searchSlice = createSlice({
  name: "search",
  initialState,
  reducers: {
    // Modal actions
    openSearch: (state) => {
      state.isOpen = true;
      state.selectedIndex = 0;
    },
    closeSearch: (state) => {
      state.isOpen = false;
      state.query = "";
      state.results = null;
      state.error = null;
      state.selectedIndex = 0;
      state.activeFilter = "all";
    },
    toggleSearch: (state) => {
      if (state.isOpen) {
        state.isOpen = false;
        state.query = "";
        state.results = null;
        state.error = null;
        state.selectedIndex = 0;
      } else {
        state.isOpen = true;
        state.selectedIndex = 0;
      }
    },

    // Query actions
    setQuery: (state, action: PayloadAction<string>) => {
      state.query = action.payload;
      state.selectedIndex = 0;
    },
    clearQuery: (state) => {
      state.query = "";
      state.results = null;
      state.selectedIndex = 0;
    },

    // Results actions
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setResults: (state, action: PayloadAction<SearchResults>) => {
      state.results = action.payload;
      state.isLoading = false;
      state.error = null;
      state.selectedIndex = 0;
    },
    clearResults: (state) => {
      state.results = null;
      state.selectedIndex = 0;
    },
    setError: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
      state.isLoading = false;
    },

    // Recent searches actions
    addRecentSearch: (state, action: PayloadAction<{ query: string; resultCount: number }>) => {
      const { query, resultCount } = action.payload;

      // Don't add empty queries or duplicates
      if (!query.trim()) return;

      // Remove existing entry with same query
      state.recentSearches = state.recentSearches.filter(
        (s) => s.query.toLowerCase() !== query.toLowerCase()
      );

      // Add to beginning
      state.recentSearches.unshift({
        query: query.trim(),
        timestamp: Date.now(),
        resultCount,
      });

      // Trim to max
      if (state.recentSearches.length > state.maxRecentSearches) {
        state.recentSearches = state.recentSearches.slice(0, state.maxRecentSearches);
      }
    },
    removeRecentSearch: (state, action: PayloadAction<string>) => {
      state.recentSearches = state.recentSearches.filter((s) => s.query !== action.payload);
    },
    clearRecentSearches: (state) => {
      state.recentSearches = [];
    },
    loadRecentSearches: (state, action: PayloadAction<RecentSearch[]>) => {
      state.recentSearches = action.payload.slice(0, state.maxRecentSearches);
    },

    // Filter actions
    setActiveFilter: (state, action: PayloadAction<SearchResultType | "all">) => {
      state.activeFilter = action.payload;
      state.selectedIndex = 0;
    },
    setTypeFilters: (state, action: PayloadAction<SearchResultType[]>) => {
      state.filters.types = action.payload;
    },
    toggleTypeFilter: (state, action: PayloadAction<SearchResultType>) => {
      const type = action.payload;
      const index = state.filters.types.indexOf(type);
      if (index === -1) {
        state.filters.types.push(type);
      } else {
        state.filters.types.splice(index, 1);
      }
    },
    setDateRangeFilter: (
      state,
      action: PayloadAction<{ from?: string; to?: string } | undefined>
    ) => {
      state.filters.dateRange = action.payload;
    },
    clearFilters: (state) => {
      state.filters = { types: [] };
      state.activeFilter = "all";
    },
    toggleShowFilters: (state) => {
      state.showFilters = !state.showFilters;
    },

    // Navigation actions
    setSelectedIndex: (state, action: PayloadAction<number>) => {
      state.selectedIndex = action.payload;
    },
    moveSelectionUp: (state) => {
      if (state.results && state.results.results.length > 0) {
        state.selectedIndex = Math.max(0, state.selectedIndex - 1);
      }
    },
    moveSelectionDown: (state) => {
      if (state.results && state.results.results.length > 0) {
        state.selectedIndex = Math.min(
          state.results.results.length - 1,
          state.selectedIndex + 1
        );
      }
    },
  },
});

export const {
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
  setTypeFilters,
  toggleTypeFilter,
  setDateRangeFilter,
  clearFilters,
  toggleShowFilters,
  setSelectedIndex,
  moveSelectionUp,
  moveSelectionDown,
} = searchSlice.actions;

export default searchSlice.reducer;

// Selectors
export const selectSearchIsOpen = (state: { search: SearchState }) => state.search.isOpen;
export const selectSearchQuery = (state: { search: SearchState }) => state.search.query;
export const selectSearchResults = (state: { search: SearchState }) => state.search.results;
export const selectSearchIsLoading = (state: { search: SearchState }) => state.search.isLoading;
export const selectSearchError = (state: { search: SearchState }) => state.search.error;
export const selectRecentSearches = (state: { search: SearchState }) => state.search.recentSearches;
export const selectSearchFilters = (state: { search: SearchState }) => state.search.filters;
export const selectActiveFilter = (state: { search: SearchState }) => state.search.activeFilter;
export const selectSelectedIndex = (state: { search: SearchState }) => state.search.selectedIndex;
export const selectShowFilters = (state: { search: SearchState }) => state.search.showFilters;

// Filtered results selector
export const selectFilteredResults = (state: { search: SearchState }) => {
  const { results, activeFilter } = state.search;
  if (!results) return null;
  if (activeFilter === "all") return results;

  const filteredResults = results.results.filter((r) => r.type === activeFilter);
  return {
    ...results,
    results: filteredResults,
    totalFound: filteredResults.length,
  };
};

// Selected result selector
export const selectSelectedResult = (state: { search: SearchState }) => {
  const { results, selectedIndex } = state.search;
  if (!results || results.results.length === 0) return null;
  return results.results[selectedIndex] || null;
};
