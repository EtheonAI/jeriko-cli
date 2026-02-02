import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

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

export interface FilesState {
  files: FileItem[];
  versions: Record<string, FileVersion[]>; // fileId -> versions
  selectedFileId: string | null;
  uploadProgress: Record<string, number>; // fileId -> progress (0-100)
  isLoading: boolean;
  error: string | null;
}

const initialState: FilesState = {
  files: [],
  versions: {},
  selectedFileId: null,
  uploadProgress: {},
  isLoading: false,
  error: null,
};

export const filesSlice = createSlice({
  name: "files",
  initialState,
  reducers: {
    setFiles: (state, action: PayloadAction<FileItem[]>) => {
      state.files = action.payload;
      state.isLoading = false;
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
      state.isLoading = action.payload;
    },
    setFilesError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
      state.isLoading = false;
    },
  },
});

export const {
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
} = filesSlice.actions;

export default filesSlice.reducer;
