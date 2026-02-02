import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

/**
 * File Connector Slice
 * Manages OAuth file connectors (Google Drive, OneDrive, Gmail, etc.)
 */

export type FileConnectorType =
  | "google_drive"
  | "one_drive_personal"
  | "one_drive_business"
  | "google_gmail"
  | "google_calendar"
  | "github"
  | "figma"
  | "microsoft_outlook"
  | "dropbox"
  | "notion"
  | "slack";

export type AppType = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;

export interface FileConnectorApp {
  type: FileConnectorType;
  connected: boolean;
  appType: AppType;
  errCode: number;
  lastSyncAt?: string;
  accountEmail?: string;
  accountName?: string;
  permissions?: string[];
}

export interface FileConnectorState {
  // Connector list
  fileConnectorList: FileConnectorApp[];
  isLoading: boolean;

  // Connection flow
  connectingType: FileConnectorType | null;
  connectionError: string | null;

  // Sync state
  syncingConnectors: FileConnectorType[];
  lastSyncResults: Record<
    FileConnectorType,
    {
      success: boolean;
      itemsSynced: number;
      error?: string;
      syncedAt: string;
    }
  >;

  // OAuth popup
  oauthPopupOpen: boolean;
  oauthRedirectUrl: string | null;
}

const initialState: FileConnectorState = {
  fileConnectorList: [
    { type: "google_drive", connected: false, appType: 1, errCode: 1 },
    { type: "one_drive_personal", connected: false, appType: 2, errCode: 1 },
    { type: "one_drive_business", connected: false, appType: 3, errCode: 1 },
    { type: "google_gmail", connected: false, appType: 4, errCode: 1 },
    { type: "google_calendar", connected: false, appType: 5, errCode: 1 },
    { type: "github", connected: false, appType: 6, errCode: 1 },
    { type: "figma", connected: false, appType: 7, errCode: 1 },
    { type: "microsoft_outlook", connected: false, appType: 8, errCode: 1 },
    { type: "dropbox", connected: false, appType: 9, errCode: 1 },
    { type: "notion", connected: false, appType: 10, errCode: 1 },
    { type: "slack", connected: false, appType: 11, errCode: 1 },
  ],
  isLoading: false,
  connectingType: null,
  connectionError: null,
  syncingConnectors: [],
  lastSyncResults: {} as FileConnectorState["lastSyncResults"],
  oauthPopupOpen: false,
  oauthRedirectUrl: null,
};

export const fileConnectorSlice = createSlice({
  name: "fileConnector",
  initialState,
  reducers: {
    // Set connector list
    setFileConnectorList: (state, action: PayloadAction<FileConnectorApp[]>) => {
      state.fileConnectorList = action.payload;
      state.isLoading = false;
    },

    // Update single connector
    updateConnector: (
      state,
      action: PayloadAction<{
        type: FileConnectorType;
        updates: Partial<FileConnectorApp>;
      }>
    ) => {
      const connector = state.fileConnectorList.find(
        (c) => c.type === action.payload.type
      );
      if (connector) {
        Object.assign(connector, action.payload.updates);
      }
    },

    // Connect/disconnect
    setConnectorConnected: (
      state,
      action: PayloadAction<{
        type: FileConnectorType;
        connected: boolean;
        accountEmail?: string;
        accountName?: string;
      }>
    ) => {
      const connector = state.fileConnectorList.find(
        (c) => c.type === action.payload.type
      );
      if (connector) {
        connector.connected = action.payload.connected;
        connector.accountEmail = action.payload.accountEmail;
        connector.accountName = action.payload.accountName;
        connector.errCode = action.payload.connected ? 0 : 1;
      }
      state.connectingType = null;
      state.connectionError = null;
    },

    // Loading
    setIsLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },

    // Connection flow
    startConnecting: (state, action: PayloadAction<FileConnectorType>) => {
      state.connectingType = action.payload;
      state.connectionError = null;
    },

    cancelConnecting: (state) => {
      state.connectingType = null;
      state.connectionError = null;
    },

    setConnectionError: (state, action: PayloadAction<string | null>) => {
      state.connectionError = action.payload;
      state.connectingType = null;
    },

    // Sync
    startSync: (state, action: PayloadAction<FileConnectorType>) => {
      if (!state.syncingConnectors.includes(action.payload)) {
        state.syncingConnectors.push(action.payload);
      }
    },

    completeSync: (
      state,
      action: PayloadAction<{
        type: FileConnectorType;
        success: boolean;
        itemsSynced: number;
        error?: string;
      }>
    ) => {
      state.syncingConnectors = state.syncingConnectors.filter(
        (t) => t !== action.payload.type
      );
      state.lastSyncResults[action.payload.type] = {
        success: action.payload.success,
        itemsSynced: action.payload.itemsSynced,
        error: action.payload.error,
        syncedAt: new Date().toISOString(),
      };

      // Update connector lastSyncAt
      const connector = state.fileConnectorList.find(
        (c) => c.type === action.payload.type
      );
      if (connector) {
        connector.lastSyncAt = new Date().toISOString();
      }
    },

    // OAuth popup
    setOauthPopupOpen: (state, action: PayloadAction<boolean>) => {
      state.oauthPopupOpen = action.payload;
    },

    setOauthRedirectUrl: (state, action: PayloadAction<string | null>) => {
      state.oauthRedirectUrl = action.payload;
    },

    openOauthPopup: (
      state,
      action: PayloadAction<{ type: FileConnectorType; redirectUrl: string }>
    ) => {
      state.connectingType = action.payload.type;
      state.oauthPopupOpen = true;
      state.oauthRedirectUrl = action.payload.redirectUrl;
    },

    closeOauthPopup: (state) => {
      state.oauthPopupOpen = false;
      state.oauthRedirectUrl = null;
    },

    // Reset
    resetFileConnector: (state) => {
      Object.assign(state, initialState);
    },
  },
});

export const {
  setFileConnectorList,
  updateConnector,
  setConnectorConnected,
  setIsLoading,
  startConnecting,
  cancelConnecting,
  setConnectionError,
  startSync,
  completeSync,
  setOauthPopupOpen,
  setOauthRedirectUrl,
  openOauthPopup,
  closeOauthPopup,
  resetFileConnector,
} = fileConnectorSlice.actions;

export default fileConnectorSlice.reducer;
