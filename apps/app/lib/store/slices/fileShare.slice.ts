import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

/**
 * File Share Slice
 * Manages file/session sharing state:
 * - Share link creation
 * - Share metadata (permissions, expiry)
 * - Download from shared links
 */

export type SharePermission = "view" | "download" | "edit";

export interface ShareInfo {
  id: string;
  resourceType: "file" | "session" | "project";
  resourceId: string;
  createdBy: string;
  permission: SharePermission;
  isPublic: boolean;
  password?: string;
  expiresAt?: string;
  viewCount: number;
  downloadCount: number;
  url: string;
  createdAt: string;
}

export interface SharedFileInfo {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  url: string;
  thumbnailUrl?: string;
}

export interface FileShareState {
  // Current share
  shareId: string;
  shareInfo: ShareInfo | null;
  fileInfo: SharedFileInfo | null;

  // Loading states
  loading: boolean;
  downloading: boolean;

  // Error
  error: string;
}

const initialState: FileShareState = {
  shareId: "",
  shareInfo: null,
  fileInfo: null,
  loading: true,
  downloading: false,
  error: "",
};

const fileShareSlice = createSlice({
  name: "fileShare",
  initialState,
  reducers: {
    // Set share context
    setShareId: (state, action: PayloadAction<string>) => {
      state.shareId = action.payload;
    },

    setShareInfo: (state, action: PayloadAction<ShareInfo | null>) => {
      state.shareInfo = action.payload;
      state.loading = false;
    },

    setFileInfo: (state, action: PayloadAction<SharedFileInfo | null>) => {
      state.fileInfo = action.payload;
    },

    // Update share settings
    updateShareInfo: (state, action: PayloadAction<Partial<ShareInfo>>) => {
      if (state.shareInfo) {
        state.shareInfo = { ...state.shareInfo, ...action.payload };
      }
    },

    // Loading
    setShareLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },

    setShareDownloading: (state, action: PayloadAction<boolean>) => {
      state.downloading = action.payload;
    },

    // Error
    setShareError: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
      state.loading = false;
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
  updateShareInfo,
  setShareLoading,
  setShareDownloading,
  setShareError,
  resetFileShare,
} = fileShareSlice.actions;

export default fileShareSlice.reducer;
