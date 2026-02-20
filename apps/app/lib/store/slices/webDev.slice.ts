import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

/**
 * WebDev Slice
 * Manages the web development workspace state for building and deploying web apps
 */

export type WebDevTab = "preview" | "database" | "settings" | "dashboard" | "code" | "file";
export type SettingSubTab = "domain" | "storage" | "env" | "git" | null;

export interface WebDevProject {
  id: string;
  name: string;
  description?: string;
  url?: string;
  previewUrl?: string;
  projectPath?: string;
  status: "building" | "deployed" | "failed" | "idle";
  framework?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DatabaseTable {
  id: string;
  name: string;
  columns: Array<{
    name: string;
    type: string;
    nullable: boolean;
    primaryKey: boolean;
  }>;
  rowCount: number;
}

export interface DatabaseTableData {
  data: unknown[];
  hasMoreData: boolean;
  totalRows: number;
  isLoading: boolean;
  isLoadingMore: boolean;
}

export interface CustomDomain {
  id: string;
  domain: string;
  status: "pending" | "active" | "failed";
  verifiedAt?: string;
}

export interface StorageFile {
  id: string;
  name: string;
  path: string;
  size: number;
  mimeType: string;
  url?: string;
  createdAt: string;
}

export interface GitSyncStatus {
  status: "synced" | "pending" | "error" | null;
  isLoading: boolean;
  lastSyncedAt?: string;
  error?: string;
}

export interface WebDevState {
  // View state
  isFullscreenMode: boolean;
  userClickedTab: WebDevTab | null;
  activeTab: WebDevTab;
  settingSubTab: SettingSubTab;
  mountedTabs: Record<WebDevTab, boolean>;
  fullscreen: boolean;

  // Project state
  project: WebDevProject | null;
  projectInited: boolean;
  initServerProjectLoading: boolean;
  initPreviewPath: string;

  // Publishing
  publishPopoverVisible: boolean;
  publishButtonLoading: boolean;

  // Preview
  preview: {
    isHistoricalVersion: boolean;
    version?: string;
  };
  previewOldVersion: unknown | null;
  previewOldVersionLoading: boolean;
  editMode: boolean;

  // Database
  database: {
    tableList: DatabaseTable[];
    activeTableId: string | null;
    isLoadingTableList: boolean;
    tableData: DatabaseTableData;
  };

  // Settings
  setting: {
    customDomains: CustomDomain[];
    purchasedDomains: string[];
    selectedPurchasedDomainName: string | null;
    pendingPurchasedDomain: unknown | null;
    selectedDomainProviderId: string | null;
  };

  // Storage
  storage: {
    tableDataLoading: boolean;
    files: StorageFile[];
    originalFiles: StorageFile[];
    currentPath: string;
    selectedRows: string[];
    continuationToken: string;
    hasMore: boolean;
    tableOrderBy: string | null;
  };

  // WebView
  webview: {
    isInWebView: boolean;
    projectDetailFromAgent: unknown | null;
    webdevHomepageUpdated: boolean;
    needHiddenHeader: boolean;
  };

  // Feature confirmations
  lastFeatureConfirm: {
    features: string[];
  };

  // Style selections
  fullStyleSelections: string[];

  // Mobile app building
  mobilePreviewOnPhoneHidden: boolean;
  currentAppBuildingProgress: Record<string, number>;
  updateCurrentApkVersion: string | null;
  updateCurrentAabVersion: string | null;
  editMobileAppVersionDialogOpen: boolean;

  // Git sync
  gitSyncStatus: GitSyncStatus;
  gitRepoCreation: {
    status: "idle" | "creating" | "created" | "error";
  };

  // Invite users
  cachedInviteUsers: string[];
  currentProjectInviteUsers: string[];

  // Badge
  previewerBadgeClosedList: string[];
}

const initialState: WebDevState = {
  isFullscreenMode: false,
  userClickedTab: null,
  activeTab: "preview",
  settingSubTab: null,
  mountedTabs: {
    preview: true,
    database: false,
    settings: false,
    dashboard: false,
    code: false,
    file: false,
  },
  fullscreen: true,
  project: null,
  projectInited: false,
  initServerProjectLoading: false,
  initPreviewPath: "",
  publishPopoverVisible: false,
  publishButtonLoading: false,
  preview: {
    isHistoricalVersion: false,
  },
  previewOldVersion: null,
  previewOldVersionLoading: false,
  editMode: false,
  database: {
    tableList: [],
    activeTableId: null,
    isLoadingTableList: true,
    tableData: {
      data: [],
      hasMoreData: false,
      totalRows: 0,
      isLoading: false,
      isLoadingMore: false,
    },
  },
  setting: {
    customDomains: [],
    purchasedDomains: [],
    selectedPurchasedDomainName: null,
    pendingPurchasedDomain: null,
    selectedDomainProviderId: null,
  },
  storage: {
    tableDataLoading: true,
    files: [],
    originalFiles: [],
    currentPath: "",
    selectedRows: [],
    continuationToken: "",
    hasMore: false,
    tableOrderBy: null,
  },
  webview: {
    isInWebView: false,
    projectDetailFromAgent: null,
    webdevHomepageUpdated: false,
    needHiddenHeader: false,
  },
  lastFeatureConfirm: {
    features: [],
  },
  fullStyleSelections: [],
  mobilePreviewOnPhoneHidden: false,
  currentAppBuildingProgress: {},
  updateCurrentApkVersion: null,
  updateCurrentAabVersion: null,
  editMobileAppVersionDialogOpen: false,
  gitSyncStatus: {
    status: null,
    isLoading: false,
  },
  gitRepoCreation: {
    status: "idle",
  },
  cachedInviteUsers: [],
  currentProjectInviteUsers: [],
  previewerBadgeClosedList: [],
};

export const webDevSlice = createSlice({
  name: "webDev",
  initialState,
  reducers: {
    // View state
    setIsFullscreenMode: (state, action: PayloadAction<boolean>) => {
      state.isFullscreenMode = action.payload;
    },

    setActiveTab: (state, action: PayloadAction<WebDevTab>) => {
      state.activeTab = action.payload;
      state.mountedTabs[action.payload] = true;
    },

    setUserClickedTab: (state, action: PayloadAction<WebDevTab | null>) => {
      state.userClickedTab = action.payload;
    },

    setSettingSubTab: (state, action: PayloadAction<SettingSubTab>) => {
      state.settingSubTab = action.payload;
    },

    // Project
    setProject: (state, action: PayloadAction<WebDevProject | null>) => {
      state.project = action.payload;
      state.projectInited = !!action.payload;
    },

    updateProject: (state, action: PayloadAction<Partial<WebDevProject>>) => {
      if (state.project) {
        state.project = { ...state.project, ...action.payload };
      }
    },

    setInitServerProjectLoading: (state, action: PayloadAction<boolean>) => {
      state.initServerProjectLoading = action.payload;
    },

    setInitPreviewPath: (state, action: PayloadAction<string>) => {
      state.initPreviewPath = action.payload;
    },

    // Publishing
    setPublishPopoverVisible: (state, action: PayloadAction<boolean>) => {
      state.publishPopoverVisible = action.payload;
    },

    setPublishButtonLoading: (state, action: PayloadAction<boolean>) => {
      state.publishButtonLoading = action.payload;
    },

    // Preview
    setPreviewHistoricalVersion: (state, action: PayloadAction<boolean>) => {
      state.preview.isHistoricalVersion = action.payload;
    },

    setPreviewOldVersion: (state, action: PayloadAction<unknown | null>) => {
      state.previewOldVersion = action.payload;
    },

    setPreviewOldVersionLoading: (state, action: PayloadAction<boolean>) => {
      state.previewOldVersionLoading = action.payload;
    },

    setEditMode: (state, action: PayloadAction<boolean>) => {
      state.editMode = action.payload;
    },

    // Database
    setDatabaseTableList: (state, action: PayloadAction<DatabaseTable[]>) => {
      state.database.tableList = action.payload;
      state.database.isLoadingTableList = false;
    },

    setActiveDatabaseTable: (state, action: PayloadAction<string | null>) => {
      state.database.activeTableId = action.payload;
    },

    setDatabaseTableData: (state, action: PayloadAction<Partial<DatabaseTableData>>) => {
      state.database.tableData = { ...state.database.tableData, ...action.payload };
    },

    setDatabaseLoadingTableList: (state, action: PayloadAction<boolean>) => {
      state.database.isLoadingTableList = action.payload;
    },

    // Settings
    setCustomDomains: (state, action: PayloadAction<CustomDomain[]>) => {
      state.setting.customDomains = action.payload;
    },

    addCustomDomain: (state, action: PayloadAction<CustomDomain>) => {
      state.setting.customDomains.push(action.payload);
    },

    removeCustomDomain: (state, action: PayloadAction<string>) => {
      state.setting.customDomains = state.setting.customDomains.filter(
        (d) => d.id !== action.payload
      );
    },

    // Storage
    setStorageFiles: (state, action: PayloadAction<StorageFile[]>) => {
      state.storage.files = action.payload;
      state.storage.tableDataLoading = false;
    },

    setStoragePath: (state, action: PayloadAction<string>) => {
      state.storage.currentPath = action.payload;
    },

    setStorageSelectedRows: (state, action: PayloadAction<string[]>) => {
      state.storage.selectedRows = action.payload;
    },

    // Git sync
    setGitSyncStatus: (state, action: PayloadAction<Partial<GitSyncStatus>>) => {
      state.gitSyncStatus = { ...state.gitSyncStatus, ...action.payload };
    },

    setGitRepoCreationStatus: (
      state,
      action: PayloadAction<"idle" | "creating" | "created" | "error">
    ) => {
      state.gitRepoCreation.status = action.payload;
    },

    // Mobile app
    setCurrentAppBuildingProgress: (
      state,
      action: PayloadAction<{ appId: string; progress: number }>
    ) => {
      state.currentAppBuildingProgress[action.payload.appId] = action.payload.progress;
    },

    setEditMobileAppVersionDialogOpen: (state, action: PayloadAction<boolean>) => {
      state.editMobileAppVersionDialogOpen = action.payload;
    },

    // WebView
    setIsInWebView: (state, action: PayloadAction<boolean>) => {
      state.webview.isInWebView = action.payload;
    },

    setProjectDetailFromAgent: (state, action: PayloadAction<unknown | null>) => {
      state.webview.projectDetailFromAgent = action.payload;
    },

    // Reset
    resetWebDev: (state) => {
      Object.assign(state, initialState);
    },
  },
});

export const {
  setIsFullscreenMode,
  setActiveTab,
  setUserClickedTab,
  setSettingSubTab,
  setProject,
  updateProject,
  setInitServerProjectLoading,
  setInitPreviewPath,
  setPublishPopoverVisible,
  setPublishButtonLoading,
  setPreviewHistoricalVersion,
  setPreviewOldVersion,
  setPreviewOldVersionLoading,
  setEditMode,
  setDatabaseTableList,
  setActiveDatabaseTable,
  setDatabaseTableData,
  setDatabaseLoadingTableList,
  setCustomDomains,
  addCustomDomain,
  removeCustomDomain,
  setStorageFiles,
  setStoragePath,
  setStorageSelectedRows,
  setGitSyncStatus,
  setGitRepoCreationStatus,
  setCurrentAppBuildingProgress,
  setEditMobileAppVersionDialogOpen,
  setIsInWebView,
  setProjectDetailFromAgent,
  resetWebDev,
} = webDevSlice.actions;

export default webDevSlice.reducer;
