import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

/**
 * Library Slice
 * Manages attachment library, templates, and assets
 */

export type DocType = 0 | 1 | 2 | 3 | 4 | 5; // 0: all, 1: documents, 2: images, 3: videos, 4: audio, 5: other
export type ViewType = "grid" | "list";

export interface AttachmentItem {
  id: string;
  name: string;
  type: string;
  mimeType: string;
  size: number;
  url: string;
  thumbnailUrl?: string;
  isFavorite: boolean;
  tags: string[];
  groupId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AttachmentGroup {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface LibraryState {
  // Filters
  filterDocType: DocType;
  isFavorite: boolean;
  searchValue: string;
  selectedGroupId: string | null;
  selectedTags: string[];

  // Attachments
  attachmentList: AttachmentItem[];
  attachmentListTotal: number;
  attachmentListLoading: boolean;

  // Groups
  attachmentGroupList: AttachmentGroup[];
  attachmentGroupListTotal: number;
  attachmentGroupListLoading: boolean;

  // View
  viewType: ViewType;

  // Selection
  selectedItems: string[];
  isSelectionMode: boolean;

  // Pagination
  page: number;
  pageSize: number;
  hasMore: boolean;

  // Sorting
  sortBy: "name" | "date" | "size" | "type";
  sortOrder: "asc" | "desc";

  // Upload
  isUploading: boolean;
  uploadProgress: number;

  // Error
  error: string | null;
}

const initialState: LibraryState = {
  filterDocType: 0,
  isFavorite: false,
  searchValue: "",
  selectedGroupId: null,
  selectedTags: [],
  attachmentList: [],
  attachmentListTotal: 0,
  attachmentListLoading: false,
  attachmentGroupList: [],
  attachmentGroupListTotal: 0,
  attachmentGroupListLoading: false,
  viewType: "grid",
  selectedItems: [],
  isSelectionMode: false,
  page: 1,
  pageSize: 20,
  hasMore: true,
  sortBy: "date",
  sortOrder: "desc",
  isUploading: false,
  uploadProgress: 0,
  error: null,
};

export const librarySlice = createSlice({
  name: "library",
  initialState,
  reducers: {
    // Filters
    setFilterDocType: (state, action: PayloadAction<DocType>) => {
      state.filterDocType = action.payload;
      state.page = 1;
    },

    setIsFavorite: (state, action: PayloadAction<boolean>) => {
      state.isFavorite = action.payload;
      state.page = 1;
    },

    setSearchValue: (state, action: PayloadAction<string>) => {
      state.searchValue = action.payload;
      state.page = 1;
    },

    setSelectedGroupId: (state, action: PayloadAction<string | null>) => {
      state.selectedGroupId = action.payload;
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

    clearFilters: (state) => {
      state.filterDocType = 0;
      state.isFavorite = false;
      state.searchValue = "";
      state.selectedGroupId = null;
      state.selectedTags = [];
      state.page = 1;
    },

    // Attachments
    setAttachmentList: (state, action: PayloadAction<AttachmentItem[]>) => {
      state.attachmentList = action.payload;
      state.attachmentListLoading = false;
    },

    appendAttachmentList: (state, action: PayloadAction<AttachmentItem[]>) => {
      state.attachmentList = [...state.attachmentList, ...action.payload];
      state.attachmentListLoading = false;
    },

    setAttachmentListTotal: (state, action: PayloadAction<number>) => {
      state.attachmentListTotal = action.payload;
      state.hasMore = state.attachmentList.length < action.payload;
    },

    setAttachmentListLoading: (state, action: PayloadAction<boolean>) => {
      state.attachmentListLoading = action.payload;
    },

    addAttachment: (state, action: PayloadAction<AttachmentItem>) => {
      state.attachmentList.unshift(action.payload);
      state.attachmentListTotal += 1;
    },

    updateAttachment: (
      state,
      action: PayloadAction<{ id: string; updates: Partial<AttachmentItem> }>
    ) => {
      const item = state.attachmentList.find((a) => a.id === action.payload.id);
      if (item) {
        Object.assign(item, action.payload.updates);
      }
    },

    removeAttachment: (state, action: PayloadAction<string>) => {
      state.attachmentList = state.attachmentList.filter(
        (a) => a.id !== action.payload
      );
      state.attachmentListTotal -= 1;
      state.selectedItems = state.selectedItems.filter(
        (id) => id !== action.payload
      );
    },

    toggleFavorite: (state, action: PayloadAction<string>) => {
      const item = state.attachmentList.find((a) => a.id === action.payload);
      if (item) {
        item.isFavorite = !item.isFavorite;
      }
    },

    // Groups
    setAttachmentGroupList: (state, action: PayloadAction<AttachmentGroup[]>) => {
      state.attachmentGroupList = action.payload;
      state.attachmentGroupListLoading = false;
    },

    setAttachmentGroupListTotal: (state, action: PayloadAction<number>) => {
      state.attachmentGroupListTotal = action.payload;
    },

    setAttachmentGroupListLoading: (state, action: PayloadAction<boolean>) => {
      state.attachmentGroupListLoading = action.payload;
    },

    addGroup: (state, action: PayloadAction<AttachmentGroup>) => {
      state.attachmentGroupList.push(action.payload);
      state.attachmentGroupListTotal += 1;
    },

    updateGroup: (
      state,
      action: PayloadAction<{ id: string; updates: Partial<AttachmentGroup> }>
    ) => {
      const group = state.attachmentGroupList.find(
        (g) => g.id === action.payload.id
      );
      if (group) {
        Object.assign(group, action.payload.updates);
      }
    },

    removeGroup: (state, action: PayloadAction<string>) => {
      state.attachmentGroupList = state.attachmentGroupList.filter(
        (g) => g.id !== action.payload
      );
      state.attachmentGroupListTotal -= 1;
      if (state.selectedGroupId === action.payload) {
        state.selectedGroupId = null;
      }
    },

    // View
    setViewType: (state, action: PayloadAction<ViewType>) => {
      state.viewType = action.payload;
    },

    // Selection
    setSelectedItems: (state, action: PayloadAction<string[]>) => {
      state.selectedItems = action.payload;
    },

    toggleItemSelection: (state, action: PayloadAction<string>) => {
      const index = state.selectedItems.indexOf(action.payload);
      if (index === -1) {
        state.selectedItems.push(action.payload);
      } else {
        state.selectedItems.splice(index, 1);
      }
    },

    selectAll: (state) => {
      state.selectedItems = state.attachmentList.map((a) => a.id);
    },

    clearSelection: (state) => {
      state.selectedItems = [];
    },

    setIsSelectionMode: (state, action: PayloadAction<boolean>) => {
      state.isSelectionMode = action.payload;
      if (!action.payload) {
        state.selectedItems = [];
      }
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

    setHasMore: (state, action: PayloadAction<boolean>) => {
      state.hasMore = action.payload;
    },

    // Sorting
    setSortBy: (state, action: PayloadAction<LibraryState["sortBy"]>) => {
      state.sortBy = action.payload;
      state.page = 1;
    },

    setSortOrder: (state, action: PayloadAction<"asc" | "desc">) => {
      state.sortOrder = action.payload;
      state.page = 1;
    },

    toggleSortOrder: (state) => {
      state.sortOrder = state.sortOrder === "asc" ? "desc" : "asc";
      state.page = 1;
    },

    // Upload
    setIsUploading: (state, action: PayloadAction<boolean>) => {
      state.isUploading = action.payload;
      if (!action.payload) {
        state.uploadProgress = 0;
      }
    },

    setUploadProgress: (state, action: PayloadAction<number>) => {
      state.uploadProgress = action.payload;
    },

    // Error
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
      state.attachmentListLoading = false;
      state.attachmentGroupListLoading = false;
    },

    // Reset
    resetLibrary: (state) => {
      Object.assign(state, initialState);
    },
  },
});

export const {
  setFilterDocType,
  setIsFavorite,
  setSearchValue,
  setSelectedGroupId,
  setSelectedTags,
  toggleTag,
  clearFilters,
  setAttachmentList,
  appendAttachmentList,
  setAttachmentListTotal,
  setAttachmentListLoading,
  addAttachment,
  updateAttachment,
  removeAttachment,
  toggleFavorite,
  setAttachmentGroupList,
  setAttachmentGroupListTotal,
  setAttachmentGroupListLoading,
  addGroup,
  updateGroup,
  removeGroup,
  setViewType,
  setSelectedItems,
  toggleItemSelection,
  selectAll,
  clearSelection,
  setIsSelectionMode,
  setPage,
  nextPage,
  setHasMore,
  setSortBy,
  setSortOrder,
  toggleSortOrder,
  setIsUploading,
  setUploadProgress,
  setError,
  resetLibrary,
} = librarySlice.actions;

export default librarySlice.reducer;
