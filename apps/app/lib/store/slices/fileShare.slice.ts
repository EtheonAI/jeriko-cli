import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

/**
 * File Share Slice
 * Manages file sharing state and shared file viewing
 */

export interface ShareInfo {
  id: string;
  fileId: string;
  createdBy: {
    id: string;
    name: string;
    avatar?: string;
  };
  permission: "view" | "edit" | "download";
  password?: string;
  expiresAt?: string;
  viewCount: number;
  downloadCount: number;
  isPublic: boolean;
  allowDownload: boolean;
  createdAt: string;
}

export interface SharedFileInfo {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  thumbnailUrl?: string;
  previewUrl?: string;
  downloadUrl?: string;
  content?: string;
  metadata?: Record<string, unknown>;
}

export interface FileShareState {
  // Share ID being viewed
  shareId: string;

  // Share information
  shareInfo: ShareInfo | null;

  // File information
  fileInfo: SharedFileInfo | null;

  // Loading states
  loading: boolean;
  downloading: boolean;

  // Password protection
  requiresPassword: boolean;
  passwordVerified: boolean;
  passwordError: string | null;

  // Error
  error: string;

  // Share creation
  isCreatingShare: boolean;
  newShareUrl: string | null;

  // Share settings modal
  showShareSettings: boolean;
}

const initialState: FileShareState = {
  shareId: "",
  shareInfo: null,
  fileInfo: null,
  loading: true,
  downloading: false,
  requiresPassword: false,
  passwordVerified: false,
  passwordError: null,
  error: "",
  isCreatingShare: false,
  newShareUrl: null,
  showShareSettings: false,
};

export const fileShareSlice = createSlice({
  name: "fileShare",
  initialState,
  reducers: {
    // Share ID
    setShareId: (state, action: PayloadAction<string>) => {
      state.shareId = action.payload;
    },

    // Share info
    setShareInfo: (state, action: PayloadAction<ShareInfo | null>) => {
      state.shareInfo = action.payload;
      state.loading = false;
    },

    // File info
    setFileInfo: (state, action: PayloadAction<SharedFileInfo | null>) => {
      state.fileInfo = action.payload;
    },

    // Loading
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },

    setDownloading: (state, action: PayloadAction<boolean>) => {
      state.downloading = action.payload;
    },

    // Password protection
    setRequiresPassword: (state, action: PayloadAction<boolean>) => {
      state.requiresPassword = action.payload;
    },

    setPasswordVerified: (state, action: PayloadAction<boolean>) => {
      state.passwordVerified = action.payload;
      if (action.payload) {
        state.passwordError = null;
      }
    },

    setPasswordError: (state, action: PayloadAction<string | null>) => {
      state.passwordError = action.payload;
      state.passwordVerified = false;
    },

    // Error
    setError: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
      state.loading = false;
    },

    clearError: (state) => {
      state.error = "";
    },

    // Share creation
    setIsCreatingShare: (state, action: PayloadAction<boolean>) => {
      state.isCreatingShare = action.payload;
    },

    setNewShareUrl: (state, action: PayloadAction<string | null>) => {
      state.newShareUrl = action.payload;
      state.isCreatingShare = false;
    },

    // Share settings
    setShowShareSettings: (state, action: PayloadAction<boolean>) => {
      state.showShareSettings = action.payload;
    },

    // Load shared file
    loadSharedFile: (
      state,
      action: PayloadAction<{
        shareId: string;
        shareInfo: ShareInfo;
        fileInfo: SharedFileInfo;
      }>
    ) => {
      state.shareId = action.payload.shareId;
      state.shareInfo = action.payload.shareInfo;
      state.fileInfo = action.payload.fileInfo;
      state.loading = false;
      state.error = "";
    },

    // Update view/download counts
    incrementViewCount: (state) => {
      if (state.shareInfo) {
        state.shareInfo.viewCount += 1;
      }
    },

    incrementDownloadCount: (state) => {
      if (state.shareInfo) {
        state.shareInfo.downloadCount += 1;
      }
    },

    // Reset
    resetFileShare: (state) => {
      Object.assign(state, initialState);
    },
  },
});

export const {
  setShareId,
  setShareInfo,
  setFileInfo,
  setLoading,
  setDownloading,
  setRequiresPassword,
  setPasswordVerified,
  setPasswordError,
  setError,
  clearError,
  setIsCreatingShare,
  setNewShareUrl,
  setShowShareSettings,
  loadSharedFile,
  incrementViewCount,
  incrementDownloadCount,
  resetFileShare,
} = fileShareSlice.actions;

export default fileShareSlice.reducer;
