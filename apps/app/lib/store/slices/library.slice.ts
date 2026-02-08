import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

/**
 * Library Slice
 * Manages the attachment library / files page:
 * - Attachment list with pagination
 * - Attachment groups/folders
 * - Filtering and search
 * - View mode (grid/list)
 */

// Manus uses numeric doc types: 0=all, 1=document, 2=pdf, 3=image, 4=video, 5=audio, 6=code, 7=other
export type LibraryDocType = number;

export type LibraryViewType = "grid" | "list";

export interface LibraryAttachment {
  id: string;
  userId: string;
  groupId?: string;
  name: string;
  description?: string;
  mimeType: string;
  size: number;
  docType: string;
  source: "upload" | "web" | "connector" | "agent";
  url?: string;
  thumbnailUrl?: string;
  isProcessed: boolean;
  isFavorite: boolean;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface LibraryAttachmentGroup {
  id: string;
  userId: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  attachmentCount: number;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

// --- Merged from files.slice.ts ---

export interface FileItem {
  id: string;
  sessionId: string | null;
  userId: string;
  name: string;
  path: string;
  mimeType: string | null;
  size: number | null;
  storageKey: string | null;
  storageProvider: "local" | "s3" | "r2" | "vercel_blob";
  isPublic: boolean;
  metadata?: {
    width?: number;
    height?: number;
    duration?: number;
    encoding?: string;
    [key: string]: unknown;
  };
  createdAt: string;
  updatedAt: string;
}

export interface FileVersion {
  id: string;
  fileId: string;
  version: number;
  storageKey: string;
  size: number | null;
  changeDescription: string | null;
  createdAt: string;
}

// --- End files types ---

export interface LibraryState {
  // Attachment list
  attachmentList: LibraryAttachment[];
  attachmentListTotal: number;
  attachmentListLoading: boolean;

  // Attachment groups
  attachmentGroupList: LibraryAttachmentGroup[];
  attachmentGroupListTotal: number;
  attachmentGroupListLoading: boolean;

  // Selected group
  selectedGroupId: string | null;

  // Filters
  filterDocType: LibraryDocType;
  searchValue: string;
  isFavorite: boolean;

  // View
  viewType: LibraryViewType;

  // Pagination
  cursor: string | null;
  hasMore: boolean;

  // --- Merged from files ---
  // File items with versions
  files: FileItem[];
  versions: Record<string, FileVersion[]>;
  selectedFileId: string | null;
  uploadProgress: Record<string, number>;
  isFilesLoading: boolean;

  // Error
  error: string | null;
}

const initialState: LibraryState = {
  attachmentList: [],
  attachmentListTotal: 0,
  attachmentListLoading: false,

  attachmentGroupList: [],
  attachmentGroupListTotal: 0,
  attachmentGroupListLoading: false,

  selectedGroupId: null,

  filterDocType: 0,
  searchValue: "",
  isFavorite: false,

  viewType: "grid",

  cursor: null,
  hasMore: false,

  // --- Merged from files ---
  files: [],
  versions: {},
  selectedFileId: null,
  uploadProgress: {},
  isFilesLoading: false,

  error: null,
};

const librarySlice = createSlice({
  name: "library",
  initialState,
  reducers: {
    // Attachment list
    setAttachmentList: (
      state,
      action: PayloadAction<{
        attachments: LibraryAttachment[];
        total: number;
        hasMore?: boolean;
        cursor?: string | null;
      }>
    ) => {
      state.attachmentList = action.payload.attachments;
      state.attachmentListTotal = action.payload.total;
      if (action.payload.hasMore !== undefined) {
        state.hasMore = action.payload.hasMore;
      }
      if (action.payload.cursor !== undefined) {
        state.cursor = action.payload.cursor;
      }
      state.attachmentListLoading = false;
    },

    appendAttachmentList: (
      state,
      action: PayloadAction<{
        attachments: LibraryAttachment[];
        hasMore: boolean;
        cursor: string | null;
      }>
    ) => {
      state.attachmentList = [...state.attachmentList, ...action.payload.attachments];
      state.hasMore = action.payload.hasMore;
      state.cursor = action.payload.cursor;
      state.attachmentListLoading = false;
    },

    addAttachment: (state, action: PayloadAction<LibraryAttachment>) => {
      state.attachmentList.unshift(action.payload);
      state.attachmentListTotal += 1;
    },

    updateAttachment: (
      state,
      action: PayloadAction<{ id: string; updates: Partial<LibraryAttachment> }>
    ) => {
      const index = state.attachmentList.findIndex((a) => a.id === action.payload.id);
      if (index !== -1) {
        state.attachmentList[index] = {
          ...state.attachmentList[index],
          ...action.payload.updates,
        };
      }
    },

    removeAttachment: (state, action: PayloadAction<string>) => {
      state.attachmentList = state.attachmentList.filter((a) => a.id !== action.payload);
      state.attachmentListTotal = Math.max(0, state.attachmentListTotal - 1);
    },

    toggleAttachmentFavorite: (state, action: PayloadAction<string>) => {
      const attachment = state.attachmentList.find((a) => a.id === action.payload);
      if (attachment) {
        attachment.isFavorite = !attachment.isFavorite;
      }
    },

    setAttachmentListLoading: (state, action: PayloadAction<boolean>) => {
      state.attachmentListLoading = action.payload;
    },

    // Attachment groups
    setAttachmentGroupList: (
      state,
      action: PayloadAction<{
        groups: LibraryAttachmentGroup[];
        total: number;
      }>
    ) => {
      state.attachmentGroupList = action.payload.groups;
      state.attachmentGroupListTotal = action.payload.total;
      state.attachmentGroupListLoading = false;
    },

    addAttachmentGroup: (state, action: PayloadAction<LibraryAttachmentGroup>) => {
      state.attachmentGroupList.push(action.payload);
      state.attachmentGroupListTotal += 1;
    },

    updateAttachmentGroup: (
      state,
      action: PayloadAction<{ id: string; updates: Partial<LibraryAttachmentGroup> }>
    ) => {
      const index = state.attachmentGroupList.findIndex((g) => g.id === action.payload.id);
      if (index !== -1) {
        state.attachmentGroupList[index] = {
          ...state.attachmentGroupList[index],
          ...action.payload.updates,
        };
      }
    },

    removeAttachmentGroup: (state, action: PayloadAction<string>) => {
      state.attachmentGroupList = state.attachmentGroupList.filter(
        (g) => g.id !== action.payload
      );
      state.attachmentGroupListTotal = Math.max(0, state.attachmentGroupListTotal - 1);
      if (state.selectedGroupId === action.payload) {
        state.selectedGroupId = null;
      }
    },

    setAttachmentGroupListLoading: (state, action: PayloadAction<boolean>) => {
      state.attachmentGroupListLoading = action.payload;
    },

    // Selection
    setSelectedGroupId: (state, action: PayloadAction<string | null>) => {
      state.selectedGroupId = action.payload;
    },

    // Filters
    setFilterDocType: (state, action: PayloadAction<LibraryDocType>) => {
      state.filterDocType = action.payload;
    },

    setSearchValue: (state, action: PayloadAction<string>) => {
      state.searchValue = action.payload;
    },

    setIsFavorite: (state, action: PayloadAction<boolean>) => {
      state.isFavorite = action.payload;
    },

    // View
    setViewType: (state, action: PayloadAction<LibraryViewType>) => {
      state.viewType = action.payload;
    },

    // --- Merged from files ---
    setFiles: (state, action: PayloadAction<FileItem[]>) => {
      state.files = action.payload;
      state.isFilesLoading = false;
    },

    addFile: (state, action: PayloadAction<FileItem>) => {
      state.files.unshift(action.payload);
    },

    updateFile: (
      state,
      action: PayloadAction<{ id: string; updates: Partial<FileItem> }>
    ) => {
      const index = state.files.findIndex((f) => f.id === action.payload.id);
      if (index !== -1) {
        state.files[index] = { ...state.files[index], ...action.payload.updates };
      }
    },

    removeFile: (state, action: PayloadAction<string>) => {
      state.files = state.files.filter((f) => f.id !== action.payload);
      delete state.versions[action.payload];
      delete state.uploadProgress[action.payload];
      if (state.selectedFileId === action.payload) {
        state.selectedFileId = null;
      }
    },

    setVersions: (
      state,
      action: PayloadAction<{ fileId: string; versions: FileVersion[] }>
    ) => {
      state.versions[action.payload.fileId] = action.payload.versions;
    },

    addVersion: (state, action: PayloadAction<FileVersion>) => {
      const { fileId } = action.payload;
      if (!state.versions[fileId]) {
        state.versions[fileId] = [];
      }
      state.versions[fileId].unshift(action.payload);
    },

    setSelectedFile: (state, action: PayloadAction<string | null>) => {
      state.selectedFileId = action.payload;
    },

    setUploadProgress: (
      state,
      action: PayloadAction<{ fileId: string; progress: number }>
    ) => {
      state.uploadProgress[action.payload.fileId] = action.payload.progress;
    },

    clearUploadProgress: (state, action: PayloadAction<string>) => {
      delete state.uploadProgress[action.payload];
    },

    setFilesLoading: (state, action: PayloadAction<boolean>) => {
      state.isFilesLoading = action.payload;
    },

    setFilesError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
      state.isFilesLoading = false;
    },
    // --- End merged from files ---

    // Error
    setLibraryError: (state, action: PayloadAction<string | null>) => {
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
  setAttachmentList,
  appendAttachmentList,
  addAttachment,
  updateAttachment,
  removeAttachment,
  toggleAttachmentFavorite,
  setAttachmentListLoading,
  setAttachmentGroupList,
  addAttachmentGroup,
  updateAttachmentGroup,
  removeAttachmentGroup,
  setAttachmentGroupListLoading,
  setSelectedGroupId,
  setFilterDocType,
  setSearchValue,
  setIsFavorite,
  setViewType,
  setLibraryError,
  resetLibrary,
  // --- Merged from files ---
  setFiles,
  addFile,
  updateFile,
  removeFile,
  setVersions,
  addVersion,
  setSelectedFile,
  setUploadProgress,
  clearUploadProgress,
  setFilesLoading,
  setFilesError,
} = librarySlice.actions;

export default librarySlice.reducer;
