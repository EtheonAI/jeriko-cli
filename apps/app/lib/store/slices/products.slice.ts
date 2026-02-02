import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

/**
 * Products Slice
 * Manages products catalog and playbook information
 */

export interface PlaybookInfo {
  id: string;
  name: string;
  description: string;
  icon?: string;
  category: string;
  tags: string[];
  steps: Array<{
    id: string;
    title: string;
    description: string;
    order: number;
  }>;
  isPublic: boolean;
  author: {
    id: string;
    name: string;
    avatar?: string;
  };
  usageCount: number;
  rating: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProductFile {
  id: string;
  name: string;
  type: string;
  size: number;
  url?: string;
  thumbnailUrl?: string;
}

export interface ProductsState {
  // Files for product creation
  files: ProductFile[];

  // Input
  inputValue: string;

  // Playbook
  playbookInfo: PlaybookInfo | null;
  playbookList: PlaybookInfo[];
  isLoadingPlaybooks: boolean;

  // Selected playbook for execution
  selectedPlaybookId: string | null;

  // Product templates
  templates: Array<{
    id: string;
    name: string;
    description: string;
    icon: string;
    category: string;
  }>;
  isLoadingTemplates: boolean;

  // UI State
  showPlaybookSelector: boolean;
  showTemplateSelector: boolean;

  // Error
  error: string | null;
}

const initialState: ProductsState = {
  files: [],
  inputValue: "",
  playbookInfo: null,
  playbookList: [],
  isLoadingPlaybooks: false,
  selectedPlaybookId: null,
  templates: [],
  isLoadingTemplates: false,
  showPlaybookSelector: false,
  showTemplateSelector: false,
  error: null,
};

export const productsSlice = createSlice({
  name: "products",
  initialState,
  reducers: {
    // Files
    setFiles: (state, action: PayloadAction<ProductFile[]>) => {
      state.files = action.payload;
    },

    addFile: (state, action: PayloadAction<ProductFile>) => {
      state.files.push(action.payload);
    },

    removeFile: (state, action: PayloadAction<string>) => {
      state.files = state.files.filter((f) => f.id !== action.payload);
    },

    clearFiles: (state) => {
      state.files = [];
    },

    // Input
    setInputValue: (state, action: PayloadAction<string>) => {
      state.inputValue = action.payload;
    },

    clearInput: (state) => {
      state.inputValue = "";
    },

    // Playbook info
    setPlaybookInfo: (state, action: PayloadAction<PlaybookInfo | null>) => {
      state.playbookInfo = action.payload;
    },

    // Playbook list
    setPlaybookList: (state, action: PayloadAction<PlaybookInfo[]>) => {
      state.playbookList = action.payload;
      state.isLoadingPlaybooks = false;
    },

    setIsLoadingPlaybooks: (state, action: PayloadAction<boolean>) => {
      state.isLoadingPlaybooks = action.payload;
    },

    // Selected playbook
    setSelectedPlaybookId: (state, action: PayloadAction<string | null>) => {
      state.selectedPlaybookId = action.payload;
      if (action.payload) {
        state.playbookInfo =
          state.playbookList.find((p) => p.id === action.payload) || null;
      }
    },

    // Templates
    setTemplates: (
      state,
      action: PayloadAction<ProductsState["templates"]>
    ) => {
      state.templates = action.payload;
      state.isLoadingTemplates = false;
    },

    setIsLoadingTemplates: (state, action: PayloadAction<boolean>) => {
      state.isLoadingTemplates = action.payload;
    },

    // UI State
    setShowPlaybookSelector: (state, action: PayloadAction<boolean>) => {
      state.showPlaybookSelector = action.payload;
    },

    setShowTemplateSelector: (state, action: PayloadAction<boolean>) => {
      state.showTemplateSelector = action.payload;
    },

    // Error
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },

    // Reset
    resetProducts: (state) => {
      Object.assign(state, initialState);
    },
  },
});

export const {
  setFiles,
  addFile,
  removeFile,
  clearFiles,
  setInputValue,
  clearInput,
  setPlaybookInfo,
  setPlaybookList,
  setIsLoadingPlaybooks,
  setSelectedPlaybookId,
  setTemplates,
  setIsLoadingTemplates,
  setShowPlaybookSelector,
  setShowTemplateSelector,
  setError,
  resetProducts,
} = productsSlice.actions;

export default productsSlice.reducer;
