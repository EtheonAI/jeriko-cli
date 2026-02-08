import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

/**
 * File Previewer Slice
 * Controls the file preview panel:
 * - Multi-format preview (PDF, image, code, markdown)
 * - File version history
 * - In-place editing
 * - Download progress
 */

export type PreviewMode = "preview" | "pdf" | "image" | "code" | "markdown" | "slide" | "html" | "video" | "audio" | "unknown";
export type SaveStatus = "default" | "idle" | "saving" | "saved" | "error";

export interface FileHistoryEntry {
  id: string;
  version: number;
  description: string | null;
  size: number | null;
  createdAt: string;
  createdBy?: string;
}

export interface PreviewData {
  url?: string;
  content?: string;
  mimeType: string;
  fileName: string;
  fileSize?: number;
  metadata?: Record<string, unknown>;
}

export interface FilePreviewerState {
  // Preview mode
  mode: PreviewMode;
  fullscreen: boolean;
  loading: boolean;

  // File data
  previewData: PreviewData | null;
  currentSlideId: string | null;

  // History
  fileHistory: FileHistoryEntry[] | null;
  currentHistoryVersionUid: string | null;

  // Editing
  exitEditLock: boolean;
  saveStatus: SaveStatus;
  syncingFile: boolean;

  // Sharing
  autoOpenSharePopover: boolean;
  sharePopoverVisible: boolean;

  // Download
  downloading: boolean;

  // Error
  error: string | null;
}

const initialState: FilePreviewerState = {
  mode: "preview",
  fullscreen: false,
  loading: false,

  previewData: null,
  currentSlideId: null,

  fileHistory: null,
  currentHistoryVersionUid: null,

  exitEditLock: false,
  saveStatus: "default",
  syncingFile: false,

  autoOpenSharePopover: false,
  sharePopoverVisible: false,

  downloading: false,

  error: null,
};

const filePreviewerSlice = createSlice({
  name: "filePreviewer",
  initialState,
  reducers: {
    // Preview mode
    setPreviewMode: (state, action: PayloadAction<PreviewMode>) => {
      state.mode = action.payload;
    },

    setFullscreen: (state, action: PayloadAction<boolean>) => {
      state.fullscreen = action.payload;
    },

    toggleFullscreen: (state) => {
      state.fullscreen = !state.fullscreen;
    },

    setPreviewLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },

    // Preview data
    setPreviewData: (state, action: PayloadAction<PreviewData | null>) => {
      state.previewData = action.payload;
      state.loading = false;
      // Auto-detect mode from mimeType
      if (action.payload) {
        const mime = action.payload.mimeType;
        if (mime.startsWith("image/")) {
          state.mode = "image";
        } else if (mime === "application/pdf") {
          state.mode = "pdf";
        } else if (mime.startsWith("video/")) {
          state.mode = "video";
        } else if (mime.startsWith("audio/")) {
          state.mode = "audio";
        } else if (mime === "text/html") {
          state.mode = "html";
        } else if (mime === "text/markdown" || action.payload.fileName.endsWith(".md")) {
          state.mode = "markdown";
        } else if (
          mime.startsWith("text/") ||
          mime === "application/json" ||
          mime === "application/javascript" ||
          mime === "application/typescript"
        ) {
          state.mode = "code";
        } else {
          state.mode = "unknown";
        }
      }
    },

    setCurrentSlideId: (state, action: PayloadAction<string | null>) => {
      state.currentSlideId = action.payload;
    },

    // History
    setFileHistory: (state, action: PayloadAction<FileHistoryEntry[]>) => {
      state.fileHistory = action.payload;
    },

    setCurrentHistoryVersion: (state, action: PayloadAction<string | null>) => {
      state.currentHistoryVersionUid = action.payload;
    },

    // Editing
    setExitEditLock: (state, action: PayloadAction<boolean>) => {
      state.exitEditLock = action.payload;
    },

    setSaveStatus: (state, action: PayloadAction<SaveStatus>) => {
      state.saveStatus = action.payload;
    },

    setSyncingFile: (state, action: PayloadAction<boolean>) => {
      state.syncingFile = action.payload;
    },

    // Sharing
    setAutoOpenSharePopover: (state, action: PayloadAction<boolean>) => {
      state.autoOpenSharePopover = action.payload;
    },

    setSharePopoverVisible: (state, action: PayloadAction<boolean>) => {
      state.sharePopoverVisible = action.payload;
    },

    // Download
    setDownloading: (state, action: PayloadAction<boolean>) => {
      state.downloading = action.payload;
    },

    // Error
    setPreviewerError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
      state.loading = false;
    },

    // Reset
    resetFilePreviewer: (state) => {
      Object.assign(state, initialState);
    },

    // Close preview (reset but keep history)
    closePreview: (state) => {
      state.previewData = null;
      state.fullscreen = false;
      state.mode = "unknown";
      state.currentSlideId = null;
      state.exitEditLock = false;
      state.saveStatus = "idle";
    },
  },
});

export const {
  setPreviewMode,
  setFullscreen,
  toggleFullscreen,
  setPreviewLoading,
  setPreviewData,
  setCurrentSlideId,
  setFileHistory,
  setCurrentHistoryVersion,
  setExitEditLock,
  setSaveStatus,
  setSyncingFile,
  setAutoOpenSharePopover,
  setSharePopoverVisible,
  setDownloading,
  setPreviewerError,
  resetFilePreviewer,
  closePreview,
} = filePreviewerSlice.actions;

export default filePreviewerSlice.reducer;
