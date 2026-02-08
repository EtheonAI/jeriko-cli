import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

/**
 * Knowledge Slice
 * User knowledge/memory management for the AI agent.
 * Backend: Knowledge service (RAG pipeline, embeddings, vector search).
 * This tracks user knowledge items, suggestions, and auto-learning settings.
 */

export interface KnowledgeItem {
  id: string;
  title: string;
  content: string;
  source?: string;
  sourceUrl?: string;
  fileId?: string;
  tags: string[];
  isAutoLearned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SuggestedKnowledge {
  sessionId: string;
  content: string;
  source: string;
  confidence: number;
  accepted: boolean;
}

export interface KnowledgeState {
  // User knowledge list
  userKnowledgeList: KnowledgeItem[];
  userKnowledgeListLoading: boolean;
  userKnowledgeTotal: number;

  // Suggested knowledge from sessions (agent suggests things to remember)
  suggestedKnowledgeMap: Record<string, SuggestedKnowledge[]>;

  // Pagination
  cursor: string | null;
  hasMore: boolean;

  // Search/filter
  searchQuery: string;
  selectedTags: string[];

  // Error
  error: string | null;
}

const initialState: KnowledgeState = {
  userKnowledgeList: [],
  userKnowledgeListLoading: false,
  userKnowledgeTotal: 0,
  suggestedKnowledgeMap: {},
  cursor: null,
  hasMore: false,
  searchQuery: "",
  selectedTags: [],
  error: null,
};

const knowledgeSlice = createSlice({
  name: "knowledge",
  initialState,
  reducers: {
    // Knowledge list
    setUserKnowledgeList: (state, action: PayloadAction<KnowledgeItem[]>) => {
      state.userKnowledgeList = action.payload;
      state.userKnowledgeListLoading = false;
    },

    appendUserKnowledgeList: (
      state,
      action: PayloadAction<{ items: KnowledgeItem[]; total: number; cursor: string | null; hasMore: boolean }>
    ) => {
      state.userKnowledgeList = [
        ...state.userKnowledgeList,
        ...action.payload.items,
      ];
      state.userKnowledgeTotal = action.payload.total;
      state.cursor = action.payload.cursor;
      state.hasMore = action.payload.hasMore;
      state.userKnowledgeListLoading = false;
    },

    setUserKnowledgeListLoading: (state, action: PayloadAction<boolean>) => {
      state.userKnowledgeListLoading = action.payload;
    },

    setUserKnowledgeTotal: (state, action: PayloadAction<number>) => {
      state.userKnowledgeTotal = action.payload;
    },

    // CRUD
    addKnowledgeItem: (state, action: PayloadAction<KnowledgeItem>) => {
      state.userKnowledgeList.unshift(action.payload);
      state.userKnowledgeTotal += 1;
    },

    updateKnowledgeItem: (
      state,
      action: PayloadAction<{ id: string; updates: Partial<KnowledgeItem> }>
    ) => {
      const item = state.userKnowledgeList.find(
        (k) => k.id === action.payload.id
      );
      if (item) {
        Object.assign(item, action.payload.updates);
      }
    },

    removeKnowledgeItem: (state, action: PayloadAction<string>) => {
      state.userKnowledgeList = state.userKnowledgeList.filter(
        (k) => k.id !== action.payload
      );
      state.userKnowledgeTotal = Math.max(0, state.userKnowledgeTotal - 1);
    },

    // Suggested knowledge
    setSuggestedKnowledge: (
      state,
      action: PayloadAction<{
        sessionId: string;
        suggestions: SuggestedKnowledge[];
      }>
    ) => {
      state.suggestedKnowledgeMap[action.payload.sessionId] =
        action.payload.suggestions;
    },

    acceptSuggestedKnowledge: (
      state,
      action: PayloadAction<{ sessionId: string; index: number }>
    ) => {
      const suggestions =
        state.suggestedKnowledgeMap[action.payload.sessionId];
      if (suggestions && suggestions[action.payload.index]) {
        suggestions[action.payload.index].accepted = true;
      }
    },

    clearSuggestedKnowledge: (state, action: PayloadAction<string>) => {
      delete state.suggestedKnowledgeMap[action.payload];
    },

    // Search/filter
    setKnowledgeSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload;
    },

    setSelectedTags: (state, action: PayloadAction<string[]>) => {
      state.selectedTags = action.payload;
    },

    toggleSelectedTag: (state, action: PayloadAction<string>) => {
      const index = state.selectedTags.indexOf(action.payload);
      if (index === -1) {
        state.selectedTags.push(action.payload);
      } else {
        state.selectedTags.splice(index, 1);
      }
    },

    // Error
    setKnowledgeError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
      state.userKnowledgeListLoading = false;
    },

    // Reset
    resetKnowledge: (state) => {
      Object.assign(state, initialState);
    },
  },
});

export const {
  setUserKnowledgeList,
  appendUserKnowledgeList,
  setUserKnowledgeListLoading,
  setUserKnowledgeTotal,
  addKnowledgeItem,
  updateKnowledgeItem,
  removeKnowledgeItem,
  setSuggestedKnowledge,
  acceptSuggestedKnowledge,
  clearSuggestedKnowledge,
  setKnowledgeSearchQuery,
  setSelectedTags,
  toggleSelectedTag,
  setKnowledgeError,
  resetKnowledge,
} = knowledgeSlice.actions;

export default knowledgeSlice.reducer;
