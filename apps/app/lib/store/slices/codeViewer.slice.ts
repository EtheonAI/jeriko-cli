import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

/**
 * Code Viewer Slice
 * Controls the sandbox code file viewer:
 * - Directory tree navigation
 * - File tabs
 * - File content loading
 */

export interface DirectoryEntry {
  name: string;
  path: string;
  type: "file" | "directory";
  size?: number;
  mimeType?: string;
  children?: DirectoryEntry[];
}

export interface DirectoryMetaData {
  expanded: boolean;
  loading?: boolean;
}

export interface CodeViewerTab {
  id: string;
  path: string;
  name: string;
  language?: string;
  isModified?: boolean;
}

export interface CodeViewerState {
  // Directory tree
  directoryList: DirectoryEntry[];
  directoryMetaData: Record<string, DirectoryMetaData>;
  rootDirectory: string;
  loadDirectoryLoading: boolean;

  // File tabs
  fileTabList: CodeViewerTab[];
  activeTabId: string | null;
  userClickedFileTab: boolean;

  // File content
  fileDataSource: Record<string, string>; // path -> content
  fileLoadingMap: Record<string, boolean>; // path -> loading

  // Error
  error: string | null;
}

const initialState: CodeViewerState = {
  directoryList: [],
  directoryMetaData: {},
  rootDirectory: "",
  loadDirectoryLoading: false,

  fileTabList: [],
  activeTabId: null,
  userClickedFileTab: false,

  fileDataSource: {},
  fileLoadingMap: {},

  error: null,
};

const codeViewerSlice = createSlice({
  name: "codeViewer",
  initialState,
  reducers: {
    // Directory tree
    setDirectoryList: (state, action: PayloadAction<DirectoryEntry[]>) => {
      state.directoryList = action.payload;
      state.loadDirectoryLoading = false;
    },

    setDirectoryMetaData: (
      state,
      action: PayloadAction<{ path: string; meta: DirectoryMetaData }>
    ) => {
      state.directoryMetaData[action.payload.path] = action.payload.meta;
    },

    toggleDirectoryExpanded: (state, action: PayloadAction<string>) => {
      const path = action.payload;
      const current = state.directoryMetaData[path];
      state.directoryMetaData[path] = {
        ...current,
        expanded: !current?.expanded,
      };
    },

    setRootDirectory: (state, action: PayloadAction<string>) => {
      state.rootDirectory = action.payload;
    },

    setLoadDirectoryLoading: (state, action: PayloadAction<boolean>) => {
      state.loadDirectoryLoading = action.payload;
    },

    // File tabs
    openFileTab: (state, action: PayloadAction<CodeViewerTab>) => {
      const existing = state.fileTabList.find((t) => t.id === action.payload.id);
      if (!existing) {
        state.fileTabList.push(action.payload);
      }
      state.activeTabId = action.payload.id;
      state.userClickedFileTab = true;
    },

    closeFileTab: (state, action: PayloadAction<string>) => {
      const index = state.fileTabList.findIndex((t) => t.id === action.payload);
      if (index !== -1) {
        state.fileTabList.splice(index, 1);
        // If closing the active tab, activate the nearest tab
        if (state.activeTabId === action.payload) {
          if (state.fileTabList.length > 0) {
            const newIndex = Math.min(index, state.fileTabList.length - 1);
            state.activeTabId = state.fileTabList[newIndex].id;
          } else {
            state.activeTabId = null;
          }
        }
      }
    },

    setActiveTab: (state, action: PayloadAction<string | null>) => {
      state.activeTabId = action.payload;
      if (action.payload) {
        state.userClickedFileTab = true;
      }
    },

    setUserClickedFileTab: (state, action: PayloadAction<boolean>) => {
      state.userClickedFileTab = action.payload;
    },

    setFileTabList: (state, action: PayloadAction<CodeViewerTab[]>) => {
      state.fileTabList = action.payload;
    },

    markFileModified: (state, action: PayloadAction<{ tabId: string; modified: boolean }>) => {
      const tab = state.fileTabList.find((t) => t.id === action.payload.tabId);
      if (tab) {
        tab.isModified = action.payload.modified;
      }
    },

    // File content
    setFileContent: (
      state,
      action: PayloadAction<{ path: string; content: string }>
    ) => {
      state.fileDataSource[action.payload.path] = action.payload.content;
      state.fileLoadingMap[action.payload.path] = false;
    },

    setFileLoading: (
      state,
      action: PayloadAction<{ path: string; loading: boolean }>
    ) => {
      state.fileLoadingMap[action.payload.path] = action.payload.loading;
    },

    clearFileContent: (state, action: PayloadAction<string>) => {
      delete state.fileDataSource[action.payload];
      delete state.fileLoadingMap[action.payload];
    },

    // Error
    setCodeViewerError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
      state.loadDirectoryLoading = false;
    },

    // Reset
    resetCodeViewer: (state) => {
      Object.assign(state, initialState);
    },
  },
});

export const {
  setDirectoryList,
  setDirectoryMetaData,
  toggleDirectoryExpanded,
  setRootDirectory,
  setLoadDirectoryLoading,
  openFileTab,
  closeFileTab,
  setActiveTab,
  setUserClickedFileTab,
  setFileTabList,
  markFileModified,
  setFileContent,
  setFileLoading,
  clearFileContent,
  setCodeViewerError,
  resetCodeViewer,
} = codeViewerSlice.actions;

export default codeViewerSlice.reducer;
