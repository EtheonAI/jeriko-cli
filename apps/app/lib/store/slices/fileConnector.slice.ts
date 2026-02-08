import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

/**
 * File Connector Slice
 * Manages file storage source integrations (Google Drive, OneDrive, Dropbox, etc.)
 * Separate from `connectors` which handles general app integrations (Composio).
 * This tracks which file storage providers are connected for the user.
 */

export type FileConnectorAppType =
  | "google_drive"
  | "onedrive"
  | "dropbox"
  | "box"
  | "s3"
  | "notion"
  | "confluence";

export type FileConnectorType = "cloud_storage" | "document" | "knowledge_base";

export interface FileConnectorItem {
  appType: FileConnectorAppType;
  type: FileConnectorType;
  connected: boolean;
  name?: string;
  iconUrl?: string;
  lastSyncedAt?: string;
  accountEmail?: string;
  quotaUsed?: number;
  quotaTotal?: number;
}

export interface FileConnectorState {
  // Connector list
  fileConnectorList: FileConnectorItem[];
  fileConnectorListLoading: boolean;

  // Error
  error: string | null;
}

const initialState: FileConnectorState = {
  fileConnectorList: [],
  fileConnectorListLoading: false,
  error: null,
};

const fileConnectorSlice = createSlice({
  name: "fileConnector",
  initialState,
  reducers: {
    // Connector list
    setFileConnectorList: (
      state,
      action: PayloadAction<FileConnectorItem[]>
    ) => {
      state.fileConnectorList = action.payload;
      state.fileConnectorListLoading = false;
    },

    setFileConnectorListLoading: (state, action: PayloadAction<boolean>) => {
      state.fileConnectorListLoading = action.payload;
    },

    // Update a single connector's connection status
    updateFileConnectorStatus: (
      state,
      action: PayloadAction<{
        appType: FileConnectorAppType;
        connected: boolean;
        accountEmail?: string;
      }>
    ) => {
      const connector = state.fileConnectorList.find(
        (c) => c.appType === action.payload.appType
      );
      if (connector) {
        connector.connected = action.payload.connected;
        if (action.payload.accountEmail) {
          connector.accountEmail = action.payload.accountEmail;
        }
        if (action.payload.connected) {
          connector.lastSyncedAt = new Date().toISOString();
        }
      }
    },

    // Disconnect a file connector
    disconnectFileConnector: (
      state,
      action: PayloadAction<FileConnectorAppType>
    ) => {
      const connector = state.fileConnectorList.find(
        (c) => c.appType === action.payload
      );
      if (connector) {
        connector.connected = false;
        connector.accountEmail = undefined;
        connector.lastSyncedAt = undefined;
      }
    },

    // Error
    setFileConnectorError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
      state.fileConnectorListLoading = false;
    },

    // Reset
    resetFileConnector: (state) => {
      Object.assign(state, initialState);
    },
  },
});

export const {
  setFileConnectorList,
  setFileConnectorListLoading,
  updateFileConnectorStatus,
  disconnectFileConnector,
  setFileConnectorError,
  resetFileConnector,
} = fileConnectorSlice.actions;

export default fileConnectorSlice.reducer;
