import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

/**
 * File Management Slice
 * Manages file spaces, tabs, and file operations
 */

export type FileTab = "all" | "documents" | "images" | "videos" | "audio" | "other";

export interface FileSpace {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  fileCount: number;
  totalSize: number;
  isShared: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SessionFile {
  id: string;
  sessionId: string;
  name: string;
  path: string;
  mimeType: string;
  size: number;
  thumbnailUrl?: string;
  downloadUrl?: string;
  isSelected: boolean;
  createdAt: string;
}

export interface GoogleDrivePickerOptions {
  folderId?: string;
  mimeTypes?: string[];
  multiSelect?: boolean;
  callback?: string;
}

export interface FileManagementState {
  // Spaces
  spaces: FileSpace[];
  spacesLoading: boolean;
  currentSpaceId: string | null;

  // File tabs
  fileTab: FileTab;

  // Download mode
  isDownloadMode: boolean;
  selectedFiles: string[];

  // Session files
  sessionFileList: SessionFile[];
  initSessionFileListLoading: boolean;

  // Google Drive integration
  showGoogleDrivePicker: boolean;
  googleDrivePickerOptions: GoogleDrivePickerOptions | null;

  // Space editing
  spaceEditCode: string | null;
  spacePreviewerEditMode: boolean;

  // Deployment
  tempActiveDeployId: string | null;
  tempSpaceId: string | null;

  // Upload
  uploadQueue: Array<{
    id: string;
    file: string;
    progress: number;
    status: "pending" | "uploading" | "completed" | "failed";
    error?: string;
  }>;
  isUploading: boolean;

  // Error
  error: string | null;
}

const initialState: FileManagementState = {
  spaces: [],
  spacesLoading: false,
  currentSpaceId: null,
  fileTab: "all",
  isDownloadMode: false,
  selectedFiles: [],
  sessionFileList: [],
  initSessionFileListLoading: false,
  showGoogleDrivePicker: false,
  googleDrivePickerOptions: null,
  spaceEditCode: null,
  spacePreviewerEditMode: false,
  tempActiveDeployId: null,
  tempSpaceId: null,
  uploadQueue: [],
  isUploading: false,
  error: null,
};

const fileManagementSlice = createSlice({
  name: "fileManagement",
  initialState,
  reducers: {
    // Spaces
    setSpaces: (state, action: PayloadAction<FileSpace[]>) => {
      state.spaces = action.payload;
      state.spacesLoading = false;
    },

    addSpace: (state, action: PayloadAction<FileSpace>) => {
      state.spaces.push(action.payload);
    },

    updateSpace: (
      state,
      action: PayloadAction<{ id: string; updates: Partial<FileSpace> }>
    ) => {
      const space = state.spaces.find((s) => s.id === action.payload.id);
      if (space) {
        Object.assign(space, action.payload.updates);
      }
    },

    removeSpace: (state, action: PayloadAction<string>) => {
      state.spaces = state.spaces.filter((s) => s.id !== action.payload);
    },

    setSpacesLoading: (state, action: PayloadAction<boolean>) => {
      state.spacesLoading = action.payload;
    },

    setCurrentSpaceId: (state, action: PayloadAction<string | null>) => {
      state.currentSpaceId = action.payload;
    },

    // File tab
    setFileTab: (state, action: PayloadAction<FileTab>) => {
      state.fileTab = action.payload;
    },

    // Download mode
    setIsDownloadMode: (state, action: PayloadAction<boolean>) => {
      state.isDownloadMode = action.payload;
      if (!action.payload) {
        state.selectedFiles = [];
      }
    },

    // File selection
    setSelectedFiles: (state, action: PayloadAction<string[]>) => {
      state.selectedFiles = action.payload;
    },

    toggleFileSelection: (state, action: PayloadAction<string>) => {
      const index = state.selectedFiles.indexOf(action.payload);
      if (index === -1) {
        state.selectedFiles.push(action.payload);
      } else {
        state.selectedFiles.splice(index, 1);
      }
    },

    selectAllFiles: (state) => {
      state.selectedFiles = state.sessionFileList.map((f) => f.id);
    },

    clearFileSelection: (state) => {
      state.selectedFiles = [];
    },

    // Session files
    setSessionFileList: (state, action: PayloadAction<SessionFile[]>) => {
      state.sessionFileList = action.payload;
      state.initSessionFileListLoading = false;
    },

    addSessionFile: (state, action: PayloadAction<SessionFile>) => {
      state.sessionFileList.unshift(action.payload);
    },

    removeSessionFile: (state, action: PayloadAction<string>) => {
      state.sessionFileList = state.sessionFileList.filter(
        (f) => f.id !== action.payload
      );
      state.selectedFiles = state.selectedFiles.filter(
        (id) => id !== action.payload
      );
    },

    setInitSessionFileListLoading: (state, action: PayloadAction<boolean>) => {
      state.initSessionFileListLoading = action.payload;
    },

    // Google Drive
    setShowGoogleDrivePicker: (state, action: PayloadAction<boolean>) => {
      state.showGoogleDrivePicker = action.payload;
    },

    setGoogleDrivePickerOptions: (
      state,
      action: PayloadAction<GoogleDrivePickerOptions | null>
    ) => {
      state.googleDrivePickerOptions = action.payload;
    },

    openGoogleDrivePicker: (
      state,
      action: PayloadAction<GoogleDrivePickerOptions>
    ) => {
      state.showGoogleDrivePicker = true;
      state.googleDrivePickerOptions = action.payload;
    },

    closeGoogleDrivePicker: (state) => {
      state.showGoogleDrivePicker = false;
      state.googleDrivePickerOptions = null;
    },

    // Space editing
    setSpaceEditCode: (state, action: PayloadAction<string | null>) => {
      state.spaceEditCode = action.payload;
    },

    setSpacePreviewerEditMode: (state, action: PayloadAction<boolean>) => {
      state.spacePreviewerEditMode = action.payload;
    },

    // Deployment
    setTempActiveDeployId: (state, action: PayloadAction<string | null>) => {
      state.tempActiveDeployId = action.payload;
    },

    setTempSpaceId: (state, action: PayloadAction<string | null>) => {
      state.tempSpaceId = action.payload;
    },

    // Upload queue
    addToUploadQueue: (
      state,
      action: PayloadAction<{ id: string; file: string }>
    ) => {
      state.uploadQueue.push({
        ...action.payload,
        progress: 0,
        status: "pending",
      });
    },

    updateUploadProgress: (
      state,
      action: PayloadAction<{ id: string; progress: number }>
    ) => {
      const item = state.uploadQueue.find((u) => u.id === action.payload.id);
      if (item) {
        item.progress = action.payload.progress;
        item.status = "uploading";
      }
    },

    completeUpload: (state, action: PayloadAction<string>) => {
      const item = state.uploadQueue.find((u) => u.id === action.payload);
      if (item) {
        item.progress = 100;
        item.status = "completed";
      }
    },

    failUpload: (
      state,
      action: PayloadAction<{ id: string; error: string }>
    ) => {
      const item = state.uploadQueue.find((u) => u.id === action.payload.id);
      if (item) {
        item.status = "failed";
        item.error = action.payload.error;
      }
    },

    removeFromUploadQueue: (state, action: PayloadAction<string>) => {
      state.uploadQueue = state.uploadQueue.filter(
        (u) => u.id !== action.payload
      );
    },

    clearUploadQueue: (state) => {
      state.uploadQueue = [];
    },

    setIsUploading: (state, action: PayloadAction<boolean>) => {
      state.isUploading = action.payload;
    },

    // Error
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },

    // Reset
    resetFileManagement: (state) => {
      Object.assign(state, initialState);
    },
  },
});

export const {
  setSpaces,
  addSpace,
  updateSpace,
  removeSpace,
  setSpacesLoading,
  setCurrentSpaceId,
  setFileTab,
  setIsDownloadMode,
  setSelectedFiles,
  toggleFileSelection,
  selectAllFiles,
  clearFileSelection,
  setSessionFileList,
  addSessionFile,
  removeSessionFile,
  setInitSessionFileListLoading,
  setShowGoogleDrivePicker,
  setGoogleDrivePickerOptions,
  openGoogleDrivePicker,
  closeGoogleDrivePicker,
  setSpaceEditCode,
  setSpacePreviewerEditMode,
  setTempActiveDeployId,
  setTempSpaceId,
  addToUploadQueue,
  updateUploadProgress,
  completeUpload,
  failUpload,
  removeFromUploadQueue,
  clearUploadQueue,
  setIsUploading,
  setError,
  resetFileManagement,
} = fileManagementSlice.actions;

export default fileManagementSlice.reducer;
