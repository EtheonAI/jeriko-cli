import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

// Connector types based on Manus structure
export type ConnectorCategory =
  | "productivity"
  | "developer"
  | "communication"
  | "data"
  | "finance"
  | "social"
  | "custom";

export type ConnectorType = "oauth" | "api_key" | "webhook" | "mcp" | "builtin";

export interface ConnectorInfo {
  label: string;
  value: string;
  link?: string;
}

export interface ConnectorConfig {
  env?: Array<{
    key: string;
    value: string;
    isSensitive?: boolean;
  }>;
  extraConfig?: Array<{
    variableType: number;
    label: string;
    placeholder: string;
    isRequired: boolean;
    isSensitive: boolean;
    defaultValue: string;
    key: string;
    value: string;
  }>;
  note?: string;
}

export interface Connector {
  id: string;
  uid: string;
  type: ConnectorType;
  name: string;
  brief: string;
  description?: string;
  iconUrl: string;
  iconUrlDark?: string;
  category: ConnectorCategory;
  order: number;
  connectorInfo: ConnectorInfo[];
  isInstalled: boolean;
  isEnabled: boolean;
  isPublished: boolean;
  scopes: string[];
  config?: ConnectorConfig;
  prompt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InstalledConnector extends Connector {
  connectionId: string;
  userId: string;
  credentials?: Record<string, unknown>;
  lastSyncedAt?: string;
  syncStatus?: "idle" | "syncing" | "error";
  errorMessage?: string;
}

export interface ComposioEventMapping {
  composioEvent: string;
  internalEvent: string;
  enabled: boolean;
  metadata?: Record<string, unknown>;
}

export interface ConnectorsState {
  // ── Manus-aligned fields (exact match to Manus all-state.json) ──
  // Single array of all connectors with isInstalled/isEnabled flags
  connectors: Connector[];
  githubRepositories: unknown[];
  githubRepositoriesLoading: boolean;
  temporaryEnabledOverrides: Record<string, boolean>;
  temporaryGithubRepositories: Record<string, unknown>;
  searchQuery: string;
  multipleEmailConfirmedInfo: Record<string, unknown>;
  multipleCalendarConfirmedInfo: Record<string, unknown>;

  // ── Rubic extensions ──
  // Separate installed list for Rubic's Composio/Drizzle backend
  availableConnectors: Connector[];
  installedConnectors: InstalledConnector[];
  categories: ConnectorCategory[];
  selectedConnectorId: string | null;
  selectedCategory: ConnectorCategory | "all";
  isLoadingAvailable: boolean;
  isLoadingInstalled: boolean;
  isInstalling: boolean;
  connectionFlow: {
    isOpen: boolean;
    connectorId: string | null;
    step: "select" | "configure" | "authorize" | "complete";
    error: string | null;
  };
  composioEventMappings: ComposioEventMapping[];
  error: string | null;
}

const initialState: ConnectorsState = {
  // Manus-aligned defaults
  connectors: [],
  githubRepositories: [],
  githubRepositoriesLoading: false,
  temporaryEnabledOverrides: {},
  temporaryGithubRepositories: {},
  searchQuery: "",
  multipleEmailConfirmedInfo: {},
  multipleCalendarConfirmedInfo: {},
  // Rubic extensions
  availableConnectors: [],
  installedConnectors: [],
  categories: ["productivity", "developer", "communication", "data", "finance", "social", "custom"],
  selectedConnectorId: null,
  selectedCategory: "all",
  isLoadingAvailable: false,
  isLoadingInstalled: false,
  isInstalling: false,
  connectionFlow: {
    isOpen: false,
    connectorId: null,
    step: "select",
    error: null,
  },
  composioEventMappings: [],
  error: null,
};

const connectorsSlice = createSlice({
  name: "connectors",
  initialState,
  reducers: {
    // Manus-compatible: set all connectors (single array with isInstalled/isEnabled flags)
    setConnectors: (state, action: PayloadAction<Connector[]>) => {
      state.connectors = action.payload;
      state.availableConnectors = action.payload;
      state.isLoadingAvailable = false;
    },

    // Set available connectors from marketplace
    setAvailableConnectors: (state, action: PayloadAction<Connector[]>) => {
      state.availableConnectors = action.payload;
      state.connectors = action.payload;
      state.isLoadingAvailable = false;
    },

    // Set user's installed connectors
    setInstalledConnectors: (state, action: PayloadAction<InstalledConnector[]>) => {
      state.installedConnectors = action.payload;
      state.isLoadingInstalled = false;
    },

    // Add a new installed connector
    addInstalledConnector: (state, action: PayloadAction<InstalledConnector>) => {
      state.installedConnectors.push(action.payload);
      // Update available connector to show as installed
      const available = state.availableConnectors.find((c) => c.id === action.payload.id);
      if (available) {
        available.isInstalled = true;
      }
      state.isInstalling = false;
    },

    // Update an installed connector
    updateInstalledConnector: (
      state,
      action: PayloadAction<{
        connectionId: string;
        updates: Partial<InstalledConnector>;
      }>
    ) => {
      const index = state.installedConnectors.findIndex(
        (c) => c.connectionId === action.payload.connectionId
      );
      if (index !== -1 && state.installedConnectors[index]) {
        Object.assign(state.installedConnectors[index], action.payload.updates);
      }
    },

    // Remove an installed connector
    removeInstalledConnector: (state, action: PayloadAction<string>) => {
      const connector = state.installedConnectors.find((c) => c.connectionId === action.payload);
      state.installedConnectors = state.installedConnectors.filter(
        (c) => c.connectionId !== action.payload
      );
      // Update available connector to show as not installed
      if (connector) {
        const available = state.availableConnectors.find((c) => c.id === connector.id);
        if (available) {
          available.isInstalled = false;
        }
      }
    },

    // Toggle connector enabled state
    toggleConnectorEnabled: (state, action: PayloadAction<string>) => {
      const conn = state.installedConnectors.find((c) => c.connectionId === action.payload);
      if (conn) {
        conn.isEnabled = !conn.isEnabled;
      }
    },

    // Selection
    setSelectedConnector: (state, action: PayloadAction<string | null>) => {
      state.selectedConnectorId = action.payload;
    },

    // Search and filter
    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload;
    },

    setSelectedCategory: (state, action: PayloadAction<ConnectorCategory | "all">) => {
      state.selectedCategory = action.payload;
    },

    // Connection flow management
    openConnectionFlow: (state, action: PayloadAction<string>) => {
      state.connectionFlow = {
        isOpen: true,
        connectorId: action.payload,
        step: "configure",
        error: null,
      };
    },

    setConnectionFlowStep: (
      state,
      action: PayloadAction<"select" | "configure" | "authorize" | "complete">
    ) => {
      state.connectionFlow.step = action.payload;
    },

    setConnectionFlowError: (state, action: PayloadAction<string | null>) => {
      state.connectionFlow.error = action.payload;
    },

    closeConnectionFlow: (state) => {
      state.connectionFlow = {
        isOpen: false,
        connectorId: null,
        step: "select",
        error: null,
      };
    },

    // Loading states
    setLoadingAvailable: (state, action: PayloadAction<boolean>) => {
      state.isLoadingAvailable = action.payload;
    },

    setLoadingInstalled: (state, action: PayloadAction<boolean>) => {
      state.isLoadingInstalled = action.payload;
    },

    setInstalling: (state, action: PayloadAction<boolean>) => {
      state.isInstalling = action.payload;
    },

    // Error handling
    setConnectorsError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
      state.isLoadingAvailable = false;
      state.isLoadingInstalled = false;
      state.isInstalling = false;
    },

    // Manus-aligned reducers
    setTemporaryEnabledOverrides: (state, action: PayloadAction<Record<string, boolean>>) => {
      state.temporaryEnabledOverrides = action.payload;
    },
    setTemporaryGithubRepositories: (state, action: PayloadAction<Record<string, unknown>>) => {
      state.temporaryGithubRepositories = action.payload;
    },
    setMultipleEmailConfirmedInfo: (state, action: PayloadAction<Record<string, unknown>>) => {
      state.multipleEmailConfirmedInfo = action.payload;
    },
    setMultipleCalendarConfirmedInfo: (state, action: PayloadAction<Record<string, unknown>>) => {
      state.multipleCalendarConfirmedInfo = action.payload;
    },
    setGithubRepositories: (state, action: PayloadAction<unknown[]>) => {
      state.githubRepositories = action.payload;
    },
    setGithubRepositoriesLoading: (state, action: PayloadAction<boolean>) => {
      state.githubRepositoriesLoading = action.payload;
    },

    // Sync status for connectors
    setConnectorSyncStatus: (
      state,
      action: PayloadAction<{
        connectionId: string;
        status: "idle" | "syncing" | "error";
        errorMessage?: string;
      }>
    ) => {
      const index = state.installedConnectors.findIndex(
        (c) => c.connectionId === action.payload.connectionId
      );
      const conn = state.installedConnectors[index];
      if (index !== -1 && conn) {
        conn.syncStatus = action.payload.status;
        conn.errorMessage = action.payload.errorMessage;
        if (action.payload.status === "idle") {
          conn.lastSyncedAt = new Date().toISOString();
        }
      }
    },

    // Composio event mappings
    setComposioEventMappings: (state, action: PayloadAction<ComposioEventMapping[]>) => {
      state.composioEventMappings = action.payload;
    },
    addComposioEventMapping: (state, action: PayloadAction<ComposioEventMapping>) => {
      state.composioEventMappings.push(action.payload);
    },
    updateComposioEventMapping: (
      state,
      action: PayloadAction<{
        composioEvent: string;
        updates: Partial<ComposioEventMapping>;
      }>
    ) => {
      const index = state.composioEventMappings.findIndex(
        (m) => m.composioEvent === action.payload.composioEvent
      );
      if (index !== -1 && state.composioEventMappings[index]) {
        Object.assign(state.composioEventMappings[index], action.payload.updates);
      }
    },
    removeComposioEventMapping: (state, action: PayloadAction<string>) => {
      state.composioEventMappings = state.composioEventMappings.filter(
        (m) => m.composioEvent !== action.payload
      );
    },
    toggleComposioEventMapping: (state, action: PayloadAction<string>) => {
      const mapping = state.composioEventMappings.find((m) => m.composioEvent === action.payload);
      if (mapping) {
        mapping.enabled = !mapping.enabled;
      }
    },
  },
  extraReducers: (_builder) => {
    // Manus WS events handled via setConnectors reducer above
  },
});

export const {
  setConnectors,
  setAvailableConnectors,
  setInstalledConnectors,
  addInstalledConnector,
  updateInstalledConnector,
  removeInstalledConnector,
  toggleConnectorEnabled,
  setSelectedConnector,
  setSearchQuery,
  setSelectedCategory,
  openConnectionFlow,
  setConnectionFlowStep,
  setConnectionFlowError,
  closeConnectionFlow,
  setLoadingAvailable,
  setLoadingInstalled,
  setInstalling,
  setConnectorsError,
  setConnectorSyncStatus,
  setComposioEventMappings,
  addComposioEventMapping,
  updateComposioEventMapping,
  removeComposioEventMapping,
  toggleComposioEventMapping,
  setTemporaryEnabledOverrides,
  setTemporaryGithubRepositories,
  setMultipleEmailConfirmedInfo,
  setMultipleCalendarConfirmedInfo,
  setGithubRepositories,
  setGithubRepositoriesLoading,
} = connectorsSlice.actions;

export default connectorsSlice.reducer;
