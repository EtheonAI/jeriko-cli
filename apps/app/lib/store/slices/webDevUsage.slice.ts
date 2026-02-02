import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

/**
 * WebDev Usage Slice
 * Manages web development usage tracking and budgets
 */

export interface UsageInfo {
  totalUsed: number;
  totalLimit: number;
  usedPercentage: number;
  periodStart: string;
  periodEnd: string;
  breakdown: {
    compute: number;
    storage: number;
    bandwidth: number;
    builds: number;
  };
}

export interface UsageDetailItem {
  id: string;
  projectId: string;
  projectName: string;
  type: "compute" | "storage" | "bandwidth" | "build";
  amount: number;
  unit: string;
  cost: number;
  timestamp: string;
}

export interface ProjectUsageStatus {
  projectId: string;
  projectName: string;
  usageAmount: number;
  usageLimit: number;
  usagePercentage: number;
  isOverLimit: boolean;
  budgetWarning: boolean;
}

export interface WebDevUsageState {
  // Overall usage info
  usageInfo: UsageInfo | null;

  // Detailed usage
  usageDetail: UsageDetailItem[] | null;
  usageDetailLoading: boolean;

  // Expanded projects in detail view
  usageDetailExpandedProjects: string[];

  // Per-project usage status
  projectUsageStatus: Record<string, ProjectUsageStatus> | null;

  // Budget management
  manageBudgetLoading: boolean;
  budgetSettings: {
    globalLimit: number | null;
    alertThreshold: number; // percentage
    autoStopOnLimit: boolean;
  };

  // Alerts
  usageAlerts: Array<{
    id: string;
    projectId: string;
    message: string;
    severity: "warning" | "critical";
    timestamp: string;
    dismissed: boolean;
  }>;

  // Loading
  isLoading: boolean;

  // Error
  error: string | null;
}

const initialState: WebDevUsageState = {
  usageInfo: null,
  usageDetail: null,
  usageDetailLoading: false,
  usageDetailExpandedProjects: [],
  projectUsageStatus: null,
  manageBudgetLoading: false,
  budgetSettings: {
    globalLimit: null,
    alertThreshold: 80,
    autoStopOnLimit: false,
  },
  usageAlerts: [],
  isLoading: false,
  error: null,
};

export const webDevUsageSlice = createSlice({
  name: "webDevUsage",
  initialState,
  reducers: {
    // Usage info
    setUsageInfo: (state, action: PayloadAction<UsageInfo | null>) => {
      state.usageInfo = action.payload;
      state.isLoading = false;
    },

    updateUsageInfo: (state, action: PayloadAction<Partial<UsageInfo>>) => {
      if (state.usageInfo) {
        state.usageInfo = { ...state.usageInfo, ...action.payload };
      }
    },

    // Usage detail
    setUsageDetail: (state, action: PayloadAction<UsageDetailItem[] | null>) => {
      state.usageDetail = action.payload;
      state.usageDetailLoading = false;
    },

    setUsageDetailLoading: (state, action: PayloadAction<boolean>) => {
      state.usageDetailLoading = action.payload;
    },

    // Expanded projects
    setUsageDetailExpandedProjects: (state, action: PayloadAction<string[]>) => {
      state.usageDetailExpandedProjects = action.payload;
    },

    toggleProjectExpanded: (state, action: PayloadAction<string>) => {
      const index = state.usageDetailExpandedProjects.indexOf(action.payload);
      if (index === -1) {
        state.usageDetailExpandedProjects.push(action.payload);
      } else {
        state.usageDetailExpandedProjects.splice(index, 1);
      }
    },

    expandAllProjects: (state) => {
      if (state.usageDetail) {
        const projectIds = [...new Set(state.usageDetail.map((d) => d.projectId))];
        state.usageDetailExpandedProjects = projectIds;
      }
    },

    collapseAllProjects: (state) => {
      state.usageDetailExpandedProjects = [];
    },

    // Project usage status
    setProjectUsageStatus: (
      state,
      action: PayloadAction<Record<string, ProjectUsageStatus> | null>
    ) => {
      state.projectUsageStatus = action.payload;
    },

    updateProjectUsageStatus: (
      state,
      action: PayloadAction<{ projectId: string; status: Partial<ProjectUsageStatus> }>
    ) => {
      if (state.projectUsageStatus && state.projectUsageStatus[action.payload.projectId]) {
        state.projectUsageStatus[action.payload.projectId] = {
          ...state.projectUsageStatus[action.payload.projectId],
          ...action.payload.status,
        };
      }
    },

    // Budget management
    setManageBudgetLoading: (state, action: PayloadAction<boolean>) => {
      state.manageBudgetLoading = action.payload;
    },

    setBudgetSettings: (
      state,
      action: PayloadAction<Partial<WebDevUsageState["budgetSettings"]>>
    ) => {
      state.budgetSettings = { ...state.budgetSettings, ...action.payload };
      state.manageBudgetLoading = false;
    },

    // Alerts
    addUsageAlert: (
      state,
      action: PayloadAction<Omit<WebDevUsageState["usageAlerts"][0], "id" | "dismissed">>
    ) => {
      state.usageAlerts.unshift({
        ...action.payload,
        id: `alert_${Date.now()}`,
        dismissed: false,
      });
    },

    dismissAlert: (state, action: PayloadAction<string>) => {
      const alert = state.usageAlerts.find((a) => a.id === action.payload);
      if (alert) {
        alert.dismissed = true;
      }
    },

    clearDismissedAlerts: (state) => {
      state.usageAlerts = state.usageAlerts.filter((a) => !a.dismissed);
    },

    // Loading
    setIsLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },

    // Error
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
      state.isLoading = false;
      state.usageDetailLoading = false;
      state.manageBudgetLoading = false;
    },

    // Reset
    resetWebDevUsage: (state) => {
      Object.assign(state, initialState);
    },
  },
});

export const {
  setUsageInfo,
  updateUsageInfo,
  setUsageDetail,
  setUsageDetailLoading,
  setUsageDetailExpandedProjects,
  toggleProjectExpanded,
  expandAllProjects,
  collapseAllProjects,
  setProjectUsageStatus,
  updateProjectUsageStatus,
  setManageBudgetLoading,
  setBudgetSettings,
  addUsageAlert,
  dismissAlert,
  clearDismissedAlerts,
  setIsLoading,
  setError,
  resetWebDevUsage,
} = webDevUsageSlice.actions;

export default webDevUsageSlice.reducer;
