import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

/**
 * Code Viewer Slice
 * Manages the code viewer/editor state for viewing and editing code files
 */

export interface DirectoryItem {
  name: string;
  path: string;
  type: "file" | "directory";
  size?: number;
  modifiedAt?: string;
  children?: DirectoryItem[];
}

export interface FileTab {
  id: string;
  path: string;
  name: string;
  language?: string;
  isModified: boolean;
  content?: string;
}

export interface DirectoryMetadata {
  expanded: boolean;
  selected?: boolean;
}

export interface CodeViewerState {
  // Directory structure
  rootDirectory: DirectoryItem | null;
  directoryList: DirectoryItem[];
  directoryMetaData: Record<string, DirectoryMetadata>;
  loadDirectoryLoading: boolean;

  // File loading
  fileLoadingMap: Record<string, boolean>;
  fileDataSource: Record<string, string>; // path -> content

  // File tabs
  fileTabList: FileTab[];
  activeTabId: string | null;
  userClickedFileTab: boolean;

  // Editor state
  selectedLines: number[];
  searchQuery: string;
  searchResults: Array<{
    line: number;
    column: number;
    match: string;
  }>;
  currentSearchIndex: number;

  // Settings
  fontSize: number;
  tabSize: number;
  wordWrap: boolean;
  minimap: boolean;
  lineNumbers: boolean;
  theme: "light" | "dark" | "auto";
}

const initialState: CodeViewerState = {
  rootDirectory: null,
  directoryList: [],
  directoryMetaData: {},
  loadDirectoryLoading: true,
  fileLoadingMap: {},
  fileDataSource: {},
  fileTabList: [],
  activeTabId: null,
  userClickedFileTab: false,
  selectedLines: [],
  searchQuery: "",
  searchResults: [],
  currentSearchIndex: 0,
  fontSize: 14,
  tabSize: 2,
  wordWrap: true,
  minimap: true,
  lineNumbers: true,
  theme: "auto",
};

export const codeViewerSlice = createSlice({
  name: "codeViewer",
  initialState,
  reducers: {
    // Directory management
    setRootDirectory: (state, action: PayloadAction<DirectoryItem | null>) => {
      state.rootDirectory = action.payload;
      state.loadDirectoryLoading = false;
    },

    setDirectoryList: (state, action: PayloadAction<DirectoryItem[]>) => {
      state.directoryList = action.payload;
    },

    setDirectoryExpanded: (
      state,
      action: PayloadAction<{ path: string; expanded: boolean }>
    ) => {
      if (!state.directoryMetaData[action.payload.path]) {
        state.directoryMetaData[action.payload.path] = { expanded: false };
      }
      state.directoryMetaData[action.payload.path].expanded = action.payload.expanded;
    },

    toggleDirectoryExpanded: (state, action: PayloadAction<string>) => {
      if (!state.directoryMetaData[action.payload]) {
        state.directoryMetaData[action.payload] = { expanded: true };
      } else {
        state.directoryMetaData[action.payload].expanded =
          !state.directoryMetaData[action.payload].expanded;
      }
    },

    setLoadDirectoryLoading: (state, action: PayloadAction<boolean>) => {
      state.loadDirectoryLoading = action.payload;
    },

    // File loading
    setFileLoading: (
      state,
      action: PayloadAction<{ path: string; loading: boolean }>
    ) => {
      state.fileLoadingMap[action.payload.path] = action.payload.loading;
    },

    setFileContent: (
      state,
      action: PayloadAction<{ path: string; content: string }>
    ) => {
      state.fileDataSource[action.payload.path] = action.payload.content;
      state.fileLoadingMap[action.payload.path] = false;
    },

    clearFileContent: (state, action: PayloadAction<string>) => {
      delete state.fileDataSource[action.payload];
      delete state.fileLoadingMap[action.payload];
    },

    // File tabs
    openFileTab: (state, action: PayloadAction<FileTab>) => {
      const existingIndex = state.fileTabList.findIndex(
        (t) => t.path === action.payload.path
      );
      if (existingIndex === -1) {
        state.fileTabList.push(action.payload);
      }
      state.activeTabId = action.payload.id;
      state.userClickedFileTab = true;
    },

    closeFileTab: (state, action: PayloadAction<string>) => {
      const index = state.fileTabList.findIndex((t) => t.id === action.payload);
      if (index !== -1) {
        state.fileTabList.splice(index, 1);
        if (state.activeTabId === action.payload) {
          // Switch to another tab
          const newActiveTab = state.fileTabList[Math.max(0, index - 1)];
          state.activeTabId = newActiveTab?.id || null;
        }
      }
    },

    setActiveTab: (state, action: PayloadAction<string | null>) => {
      state.activeTabId = action.payload;
      state.userClickedFileTab = true;
    },

    updateFileTab: (
      state,
      action: PayloadAction<{ id: string; updates: Partial<FileTab> }>
    ) => {
      const tab = state.fileTabList.find((t) => t.id === action.payload.id);
      if (tab) {
        Object.assign(tab, action.payload.updates);
      }
    },

    reorderFileTabs: (state, action: PayloadAction<FileTab[]>) => {
      state.fileTabList = action.payload;
    },

    setUserClickedFileTab: (state, action: PayloadAction<boolean>) => {
      state.userClickedFileTab = action.payload;
    },

    // Editor state
    setSelectedLines: (state, action: PayloadAction<number[]>) => {
      state.selectedLines = action.payload;
    },

    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload;
    },

    setSearchResults: (
      state,
      action: PayloadAction<CodeViewerState["searchResults"]>
    ) => {
      state.searchResults = action.payload;
      state.currentSearchIndex = 0;
    },

    nextSearchResult: (state) => {
      if (state.searchResults.length > 0) {
        state.currentSearchIndex =
          (state.currentSearchIndex + 1) % state.searchResults.length;
      }
    },

    prevSearchResult: (state) => {
      if (state.searchResults.length > 0) {
        state.currentSearchIndex =
          (state.currentSearchIndex - 1 + state.searchResults.length) %
          state.searchResults.length;
      }
    },

    clearSearch: (state) => {
      state.searchQuery = "";
      state.searchResults = [];
      state.currentSearchIndex = 0;
    },

    // Settings
    setFontSize: (state, action: PayloadAction<number>) => {
      state.fontSize = action.payload;
    },

    setTabSize: (state, action: PayloadAction<number>) => {
      state.tabSize = action.payload;
    },

    setWordWrap: (state, action: PayloadAction<boolean>) => {
      state.wordWrap = action.payload;
    },

    setMinimap: (state, action: PayloadAction<boolean>) => {
      state.minimap = action.payload;
    },

    setLineNumbers: (state, action: PayloadAction<boolean>) => {
      state.lineNumbers = action.payload;
    },

    setEditorTheme: (state, action: PayloadAction<"light" | "dark" | "auto">) => {
      state.theme = action.payload;
    },

    // Reset
    resetCodeViewer: (state) => {
      Object.assign(state, initialState);
    },

    // Close all tabs
    closeAllTabs: (state) => {
      state.fileTabList = [];
      state.activeTabId = null;
    },
  },
});

export const {
  setRootDirectory,
  setDirectoryList,
  setDirectoryExpanded,
  toggleDirectoryExpanded,
  setLoadDirectoryLoading,
  setFileLoading,
  setFileContent,
  clearFileContent,
  openFileTab,
  closeFileTab,
  setActiveTab,
  updateFileTab,
  reorderFileTabs,
  setUserClickedFileTab,
  setSelectedLines,
  setSearchQuery,
  setSearchResults,
  nextSearchResult,
  prevSearchResult,
  clearSearch,
  setFontSize,
  setTabSize,
  setWordWrap,
  setMinimap,
  setLineNumbers,
  setEditorTheme,
  resetCodeViewer,
  closeAllTabs,
} = codeViewerSlice.actions;

export default codeViewerSlice.reducer;
