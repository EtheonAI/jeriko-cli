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

export interface ConnectorsState {
  // Available connectors from the marketplace
  availableConnectors: Connector[];
  // User's installed connectors
  installedConnectors: InstalledConnector[];
  // Categories for filtering
  categories: ConnectorCategory[];
  // Selected connector for details view
  selectedConnectorId: string | null;
  // Search/filter state
  searchQuery: string;
  selectedCategory: ConnectorCategory | "all";
  // Loading states
  isLoadingAvailable: boolean;
  isLoadingInstalled: boolean;
  isInstalling: boolean;
  // Connection flow state
  connectionFlow: {
    isOpen: boolean;
    connectorId: string | null;
    step: "select" | "configure" | "authorize" | "complete";
    error: string | null;
  };
  // Error state
  error: string | null;
}

const initialState: ConnectorsState = {
  availableConnectors: [],
  installedConnectors: [],
  categories: ["productivity", "developer", "communication", "data", "finance", "social", "custom"],
  selectedConnectorId: null,
  searchQuery: "",
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
  error: null,
};

export const connectorsSlice = createSlice({
  name: "connectors",
  initialState,
  reducers: {
    // Set available connectors from marketplace
    setAvailableConnectors: (state, action: PayloadAction<Connector[]>) => {
      state.availableConnectors = action.payload;
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
      const availableIndex = state.availableConnectors.findIndex((c) => c.id === action.payload.id);
      if (availableIndex !== -1) {
        state.availableConnectors[availableIndex].isInstalled = true;
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
      if (index !== -1) {
        state.installedConnectors[index] = {
          ...state.installedConnectors[index],
          ...action.payload.updates,
        };
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
        const availableIndex = state.availableConnectors.findIndex((c) => c.id === connector.id);
        if (availableIndex !== -1) {
          state.availableConnectors[availableIndex].isInstalled = false;
        }
      }
    },

    // Toggle connector enabled state
    toggleConnectorEnabled: (state, action: PayloadAction<string>) => {
      const index = state.installedConnectors.findIndex((c) => c.connectionId === action.payload);
      if (index !== -1) {
        state.installedConnectors[index].isEnabled = !state.installedConnectors[index].isEnabled;
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
      if (index !== -1) {
        state.installedConnectors[index].syncStatus = action.payload.status;
        state.installedConnectors[index].errorMessage = action.payload.errorMessage;
        if (action.payload.status === "idle") {
          state.installedConnectors[index].lastSyncedAt = new Date().toISOString();
        }
      }
    },
  },
  extraReducers: (builder) => {
    // Manus compatibility
    builder.addCase("connectors/setConnectors", (state, action: PayloadAction<Connector[]>) => {
      state.availableConnectors = action.payload ?? [];
      state.isLoadingAvailable = false;
    });
  },
});

export const {
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
} = connectorsSlice.actions;

export default connectorsSlice.reducer;
