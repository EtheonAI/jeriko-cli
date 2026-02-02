import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

/**
 * Example Slice
 * Manages example templates and prompts for users
 */

export interface ExampleItem {
  id: string;
  title: string;
  description: string;
  prompt: string;
  category: string;
  tags: string[];
  icon?: string;
  thumbnailUrl?: string;
  difficulty?: "beginner" | "intermediate" | "advanced";
  estimatedTime?: string;
  popularity: number;
  isNew: boolean;
  isFeatured: boolean;
  createdAt: string;
}

export interface ExampleCategory {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  itemCount: number;
}

export interface ExampleState {
  // Example list
  exampleList: ExampleItem[];
  exampleListLoading: boolean;

  // Categories
  categories: ExampleCategory[];
  selectedCategory: string | null;

  // Search and filters
  searchQuery: string;
  filterTags: string[];
  filterDifficulty: string | null;

  // Featured examples
  featuredExamples: ExampleItem[];
  featuredLoading: boolean;

  // Recently used
  recentlyUsed: string[];

  // Selected example
  selectedExampleId: string | null;

  // UI State
  showExampleModal: boolean;
  viewMode: "grid" | "list";

  // Error
  error: string | null;
}

const initialState: ExampleState = {
  exampleList: [],
  exampleListLoading: false,
  categories: [],
  selectedCategory: null,
  searchQuery: "",
  filterTags: [],
  filterDifficulty: null,
  featuredExamples: [],
  featuredLoading: false,
  recentlyUsed: [],
  selectedExampleId: null,
  showExampleModal: false,
  viewMode: "grid",
  error: null,
};

export const exampleSlice = createSlice({
  name: "example",
  initialState,
  reducers: {
    // Example list
    setExampleList: (state, action: PayloadAction<ExampleItem[]>) => {
      state.exampleList = action.payload;
      state.exampleListLoading = false;
    },

    setExampleListLoading: (state, action: PayloadAction<boolean>) => {
      state.exampleListLoading = action.payload;
    },

    // Categories
    setCategories: (state, action: PayloadAction<ExampleCategory[]>) => {
      state.categories = action.payload;
    },

    setSelectedCategory: (state, action: PayloadAction<string | null>) => {
      state.selectedCategory = action.payload;
    },

    // Search and filters
    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload;
    },

    setFilterTags: (state, action: PayloadAction<string[]>) => {
      state.filterTags = action.payload;
    },

    toggleFilterTag: (state, action: PayloadAction<string>) => {
      const index = state.filterTags.indexOf(action.payload);
      if (index === -1) {
        state.filterTags.push(action.payload);
      } else {
        state.filterTags.splice(index, 1);
      }
    },

    setFilterDifficulty: (state, action: PayloadAction<string | null>) => {
      state.filterDifficulty = action.payload;
    },

    clearFilters: (state) => {
      state.searchQuery = "";
      state.filterTags = [];
      state.filterDifficulty = null;
      state.selectedCategory = null;
    },

    // Featured
    setFeaturedExamples: (state, action: PayloadAction<ExampleItem[]>) => {
      state.featuredExamples = action.payload;
      state.featuredLoading = false;
    },

    setFeaturedLoading: (state, action: PayloadAction<boolean>) => {
      state.featuredLoading = action.payload;
    },

    // Recently used
    addToRecentlyUsed: (state, action: PayloadAction<string>) => {
      // Remove if already exists
      state.recentlyUsed = state.recentlyUsed.filter(
        (id) => id !== action.payload
      );
      // Add to front
      state.recentlyUsed.unshift(action.payload);
      // Keep only last 10
      state.recentlyUsed = state.recentlyUsed.slice(0, 10);
    },

    clearRecentlyUsed: (state) => {
      state.recentlyUsed = [];
    },

    // Selected example
    setSelectedExampleId: (state, action: PayloadAction<string | null>) => {
      state.selectedExampleId = action.payload;
    },

    // UI State
    setShowExampleModal: (state, action: PayloadAction<boolean>) => {
      state.showExampleModal = action.payload;
    },

    openExampleModal: (state, action: PayloadAction<string>) => {
      state.selectedExampleId = action.payload;
      state.showExampleModal = true;
    },

    closeExampleModal: (state) => {
      state.showExampleModal = false;
      state.selectedExampleId = null;
    },

    setViewMode: (state, action: PayloadAction<"grid" | "list">) => {
      state.viewMode = action.payload;
    },

    // Error
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
      state.exampleListLoading = false;
      state.featuredLoading = false;
    },

    // Reset
    resetExample: (state) => {
      Object.assign(state, initialState);
    },
  },
});

export const {
  setExampleList,
  setExampleListLoading,
  setCategories,
  setSelectedCategory,
  setSearchQuery,
  setFilterTags,
  toggleFilterTag,
  setFilterDifficulty,
  clearFilters,
  setFeaturedExamples,
  setFeaturedLoading,
  addToRecentlyUsed,
  clearRecentlyUsed,
  setSelectedExampleId,
  setShowExampleModal,
  openExampleModal,
  closeExampleModal,
  setViewMode,
  setError,
  resetExample,
} = exampleSlice.actions;

export default exampleSlice.reducer;
