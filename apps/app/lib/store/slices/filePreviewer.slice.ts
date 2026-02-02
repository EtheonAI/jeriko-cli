import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

/**
 * File Previewer Slice
 * Manages file preview and editing state
 */

export type PreviewMode = "preview" | "edit" | "split";
export type SaveStatus = "default" | "saving" | "saved" | "error";

export interface FilePreviewData {
  id: string;
  name: string;
  path: string;
  mimeType: string;
  size: number;
  content?: string;
  url?: string;
  thumbnailUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface FileHistoryVersion {
  id: string;
  version: number;
  createdAt: string;
  createdBy?: string;
  changeDescription?: string;
  size: number;
}

export interface FilePreviewerState {
  // Preview state
  mode: PreviewMode;
  previewData: FilePreviewData | null;
  loading: boolean;
  downloading: boolean;
  fullscreen: boolean;

  // Edit state
  saveStatus: SaveStatus;
  syncingFile: boolean;
  exitEditLock: boolean;

  // History
  fileHistory: FileHistoryVersion[] | null;
  currentHistoryVersionUid: string | null;
  isLoadingHistory: boolean;

  // Share
  autoOpenSharePopover: boolean;

  // Slide-specific (for presentations)
  currentSlideId: string | null;
  slideCount: number;

  // Error
  error: string | null;
}

const initialState: FilePreviewerState = {
  mode: "preview",
  previewData: null,
  loading: false,
  downloading: false,
  fullscreen: true,
  saveStatus: "default",
  syncingFile: false,
  exitEditLock: false,
  fileHistory: null,
  currentHistoryVersionUid: null,
  isLoadingHistory: false,
  autoOpenSharePopover: false,
  currentSlideId: null,
  slideCount: 0,
  error: null,
};

export const filePreviewerSlice = createSlice({
  name: "filePreviewer",
  initialState,
  reducers: {
    // Mode
    setPreviewMode: (state, action: PayloadAction<PreviewMode>) => {
      state.mode = action.payload;
    },

    // Preview data
    setPreviewData: (state, action: PayloadAction<FilePreviewData | null>) => {
      state.previewData = action.payload;
      state.loading = false;
      state.error = null;
    },

    updatePreviewData: (state, action: PayloadAction<Partial<FilePreviewData>>) => {
      if (state.previewData) {
        state.previewData = { ...state.previewData, ...action.payload };
      }
    },

    clearPreviewData: (state) => {
      state.previewData = null;
      state.fileHistory = null;
      state.currentHistoryVersionUid = null;
    },

    // Loading states
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },

    setDownloading: (state, action: PayloadAction<boolean>) => {
      state.downloading = action.payload;
    },

    // Fullscreen
    setFullscreen: (state, action: PayloadAction<boolean>) => {
      state.fullscreen = action.payload;
    },

    toggleFullscreen: (state) => {
      state.fullscreen = !state.fullscreen;
    },

    // Save status
    setSaveStatus: (state, action: PayloadAction<SaveStatus>) => {
      state.saveStatus = action.payload;
    },

    setSyncingFile: (state, action: PayloadAction<boolean>) => {
      state.syncingFile = action.payload;
    },

    setExitEditLock: (state, action: PayloadAction<boolean>) => {
      state.exitEditLock = action.payload;
    },

    // History
    setFileHistory: (state, action: PayloadAction<FileHistoryVersion[] | null>) => {
      state.fileHistory = action.payload;
      state.isLoadingHistory = false;
    },

    setCurrentHistoryVersion: (state, action: PayloadAction<string | null>) => {
      state.currentHistoryVersionUid = action.payload;
    },

    setLoadingHistory: (state, action: PayloadAction<boolean>) => {
      state.isLoadingHistory = action.payload;
    },

    // Share
    setAutoOpenSharePopover: (state, action: PayloadAction<boolean>) => {
      state.autoOpenSharePopover = action.payload;
    },

    // Slides
    setCurrentSlideId: (state, action: PayloadAction<string | null>) => {
      state.currentSlideId = action.payload;
    },

    setSlideCount: (state, action: PayloadAction<number>) => {
      state.slideCount = action.payload;
    },

    nextSlide: (state) => {
      // Logic to move to next slide would update currentSlideId
      // This is a placeholder for the actual implementation
    },

    prevSlide: (state) => {
      // Logic to move to previous slide would update currentSlideId
    },

    // Error
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
      state.loading = false;
    },

    // Reset
    resetFilePreviewer: (state) => {
      Object.assign(state, initialState);
    },
  },
});

export const {
  setPreviewMode,
  setPreviewData,
  updatePreviewData,
  clearPreviewData,
  setLoading,
  setDownloading,
  setFullscreen,
  toggleFullscreen,
  setSaveStatus,
  setSyncingFile,
  setExitEditLock,
  setFileHistory,
  setCurrentHistoryVersion,
  setLoadingHistory,
  setAutoOpenSharePopover,
  setCurrentSlideId,
  setSlideCount,
  nextSlide,
  prevSlide,
  setError,
  resetFilePreviewer,
} = filePreviewerSlice.actions;

export default filePreviewerSlice.reducer;
