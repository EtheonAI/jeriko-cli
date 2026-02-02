import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

/**
 * Community Slice
 * Manages community features and shared content
 */

export interface CommunityItem {
  id: string;
  title: string;
  description?: string;
  author: {
    id: string;
    name: string;
    avatar?: string;
  };
  category: string;
  tags: string[];
  likes: number;
  views: number;
  isLiked: boolean;
  createdAt: string;
  updatedAt: string;
  thumbnailUrl?: string;
  previewUrl?: string;
}

export interface CommunityState {
  // Data
  dataSource: CommunityItem[];
  isDataSourceLoading: boolean;

  // Grouping
  groupedTotalMap: Record<string, number>;
  groupedIds: Record<string, string[]>;

  // Filters
  selectedCategory: string | null;
  selectedTags: string[];
  searchQuery: string;
  sortBy: "recent" | "popular" | "trending";

  // Pagination
  page: number;
  pageSize: number;
  totalItems: number;
  hasMore: boolean;

  // UI State
  viewMode: "grid" | "list";
  isSubmitting: boolean;

  // Error
  error: string | null;
}

const initialState: CommunityState = {
  dataSource: [],
  isDataSourceLoading: true,
  groupedTotalMap: {},
  groupedIds: {},
  selectedCategory: null,
  selectedTags: [],
  searchQuery: "",
  sortBy: "recent",
  page: 1,
  pageSize: 20,
  totalItems: 0,
  hasMore: true,
  viewMode: "grid",
  isSubmitting: false,
  error: null,
};

export const communitySlice = createSlice({
  name: "community",
  initialState,
  reducers: {
    // Data
    setDataSource: (state, action: PayloadAction<CommunityItem[]>) => {
      state.dataSource = action.payload;
      state.isDataSourceLoading = false;
    },

    appendDataSource: (state, action: PayloadAction<CommunityItem[]>) => {
      state.dataSource = [...state.dataSource, ...action.payload];
      state.isDataSourceLoading = false;
    },

    setDataSourceLoading: (state, action: PayloadAction<boolean>) => {
      state.isDataSourceLoading = action.payload;
    },

    // Grouping
    setGroupedTotalMap: (
      state,
      action: PayloadAction<Record<string, number>>
    ) => {
      state.groupedTotalMap = action.payload;
    },

    setGroupedIds: (state, action: PayloadAction<Record<string, string[]>>) => {
      state.groupedIds = action.payload;
    },

    // Filters
    setSelectedCategory: (state, action: PayloadAction<string | null>) => {
      state.selectedCategory = action.payload;
      state.page = 1;
    },

    setSelectedTags: (state, action: PayloadAction<string[]>) => {
      state.selectedTags = action.payload;
      state.page = 1;
    },

    toggleTag: (state, action: PayloadAction<string>) => {
      const index = state.selectedTags.indexOf(action.payload);
      if (index === -1) {
        state.selectedTags.push(action.payload);
      } else {
        state.selectedTags.splice(index, 1);
      }
      state.page = 1;
    },

    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload;
      state.page = 1;
    },

    setSortBy: (state, action: PayloadAction<"recent" | "popular" | "trending">) => {
      state.sortBy = action.payload;
      state.page = 1;
    },

    // Pagination
    setPage: (state, action: PayloadAction<number>) => {
      state.page = action.payload;
    },

    nextPage: (state) => {
      if (state.hasMore) {
        state.page += 1;
      }
    },

    setTotalItems: (state, action: PayloadAction<number>) => {
      state.totalItems = action.payload;
      state.hasMore = state.dataSource.length < action.payload;
    },

    setHasMore: (state, action: PayloadAction<boolean>) => {
      state.hasMore = action.payload;
    },

    // UI
    setViewMode: (state, action: PayloadAction<"grid" | "list">) => {
      state.viewMode = action.payload;
    },

    setIsSubmitting: (state, action: PayloadAction<boolean>) => {
      state.isSubmitting = action.payload;
    },

    // Like/Unlike
    toggleLike: (state, action: PayloadAction<string>) => {
      const item = state.dataSource.find((i) => i.id === action.payload);
      if (item) {
        item.isLiked = !item.isLiked;
        item.likes += item.isLiked ? 1 : -1;
      }
    },

    // Error
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
      state.isDataSourceLoading = false;
    },

    // Reset
    resetFilters: (state) => {
      state.selectedCategory = null;
      state.selectedTags = [];
      state.searchQuery = "";
      state.sortBy = "recent";
      state.page = 1;
    },

    resetCommunity: (state) => {
      Object.assign(state, initialState);
    },
  },
});

export const {
  setDataSource,
  appendDataSource,
  setDataSourceLoading,
  setGroupedTotalMap,
  setGroupedIds,
  setSelectedCategory,
  setSelectedTags,
  toggleTag,
  setSearchQuery,
  setSortBy,
  setPage,
  nextPage,
  setTotalItems,
  setHasMore,
  setViewMode,
  setIsSubmitting,
  toggleLike,
  setError,
  resetFilters,
  resetCommunity,
} = communitySlice.actions;

export default communitySlice.reducer;
