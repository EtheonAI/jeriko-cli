import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type VariantKey = "treatment" | "control" | "off";

export interface ExperimentVariant {
  key: VariantKey;
  value?: string;
  expKey?: string;
  metadata?: {
    default?: boolean;
    evaluationId?: string;
    experimentKey?: string;
    testInstrumentation?: boolean;
    [key: string]: unknown;
  };
}

export interface FeatureFlag {
  key: string;
  enabled: boolean;
  variant?: ExperimentVariant;
  description?: string;
  rolloutPercentage?: number;
}

export interface Experiment {
  id: string;
  key: string;
  name: string;
  description?: string;
  status: "draft" | "running" | "paused" | "completed";
  variants: ExperimentVariant[];
  // Targeting
  targetingRules?: {
    userIds?: string[];
    teamIds?: string[];
    userPercentage?: number;
    conditions?: Array<{
      attribute: string;
      operator: "eq" | "neq" | "in" | "not_in" | "gt" | "lt";
      value: unknown;
    }>;
  };
  // Metrics
  primaryMetric?: string;
  secondaryMetrics?: string[];
  // Timestamps
  startedAt?: string;
  endedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExperimentState {
  // Frontend feature flags/variants
  frontendVariants: Record<string, ExperimentVariant>;
  // Backend feature flags/variants
  backendVariants: Record<string, ExperimentVariant>;
  // Simplified feature flags
  featureFlags: Record<string, FeatureFlag>;
  // Active experiments
  experiments: Experiment[];
  // Guest page experiment (for non-authenticated users)
  guestPageExperiment: ExperimentVariant | null;
  // Loading states
  isLoading: boolean;
  isInitialized: boolean;
  // Error state
  error: string | null;
}

const initialState: ExperimentState = {
  frontendVariants: {},
  backendVariants: {},
  featureFlags: {},
  experiments: [],
  guestPageExperiment: null,
  isLoading: false,
  isInitialized: false,
  error: null,
};

export const experimentSlice = createSlice({
  name: "experiment",
  initialState,
  reducers: {
    // Initialize all variants
    initializeExperiments: (
      state,
      action: PayloadAction<{
        frontendVariants: Record<string, ExperimentVariant>;
        backendVariants: Record<string, ExperimentVariant>;
        guestPageExperiment?: ExperimentVariant | null;
      }>
    ) => {
      state.frontendVariants = action.payload.frontendVariants;
      state.backendVariants = action.payload.backendVariants;
      state.guestPageExperiment = action.payload.guestPageExperiment || null;
      state.isInitialized = true;
      state.isLoading = false;
    },

    // Set frontend variants
    setFrontendVariants: (
      state,
      action: PayloadAction<Record<string, ExperimentVariant>>
    ) => {
      state.frontendVariants = action.payload;
    },

    // Update a single frontend variant
    updateFrontendVariant: (
      state,
      action: PayloadAction<{ key: string; variant: ExperimentVariant }>
    ) => {
      state.frontendVariants[action.payload.key] = action.payload.variant;
    },

    // Set backend variants
    setBackendVariants: (
      state,
      action: PayloadAction<Record<string, ExperimentVariant>>
    ) => {
      state.backendVariants = action.payload;
    },

    // Update a single backend variant
    updateBackendVariant: (
      state,
      action: PayloadAction<{ key: string; variant: ExperimentVariant }>
    ) => {
      state.backendVariants[action.payload.key] = action.payload.variant;
    },

    // Set feature flags
    setFeatureFlags: (
      state,
      action: PayloadAction<Record<string, FeatureFlag>>
    ) => {
      state.featureFlags = action.payload;
    },

    // Update a single feature flag
    updateFeatureFlag: (
      state,
      action: PayloadAction<{ key: string; flag: FeatureFlag }>
    ) => {
      state.featureFlags[action.payload.key] = action.payload.flag;
    },

    // Toggle a feature flag
    toggleFeatureFlag: (state, action: PayloadAction<string>) => {
      if (state.featureFlags[action.payload]) {
        state.featureFlags[action.payload].enabled =
          !state.featureFlags[action.payload].enabled;
      }
    },

    // Set experiments
    setExperiments: (state, action: PayloadAction<Experiment[]>) => {
      state.experiments = action.payload;
    },

    // Add an experiment
    addExperiment: (state, action: PayloadAction<Experiment>) => {
      state.experiments.push(action.payload);
    },

    // Update an experiment
    updateExperiment: (
      state,
      action: PayloadAction<{ id: string; updates: Partial<Experiment> }>
    ) => {
      const index = state.experiments.findIndex(
        (e) => e.id === action.payload.id
      );
      if (index !== -1) {
        state.experiments[index] = {
          ...state.experiments[index],
          ...action.payload.updates,
          updatedAt: new Date().toISOString(),
        };
      }
    },

    // Delete an experiment
    deleteExperiment: (state, action: PayloadAction<string>) => {
      state.experiments = state.experiments.filter(
        (e) => e.id !== action.payload
      );
    },

    // Set guest page experiment
    setGuestPageExperiment: (
      state,
      action: PayloadAction<ExperimentVariant | null>
    ) => {
      state.guestPageExperiment = action.payload;
    },

    // Loading state
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },

    // Error handling
    setExperimentError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
      state.isLoading = false;
    },

    // Clear experiment state
    clearExperimentState: (state) => {
      state.frontendVariants = {};
      state.backendVariants = {};
      state.featureFlags = {};
      state.experiments = [];
      state.guestPageExperiment = null;
      state.isInitialized = false;
    },
  },
});

// Selectors
export const selectIsFeatureEnabled = (
  state: { experiment: ExperimentState },
  featureKey: string
): boolean => {
  // Check feature flags first
  const flag = state.experiment.featureFlags[featureKey];
  if (flag) {
    return flag.enabled;
  }

  // Check frontend variants
  const frontendVariant = state.experiment.frontendVariants[featureKey];
  if (frontendVariant) {
    return frontendVariant.key === "treatment";
  }

  // Check backend variants
  const backendVariant = state.experiment.backendVariants[featureKey];
  if (backendVariant) {
    return backendVariant.key === "treatment";
  }

  return false;
};

export const selectVariant = (
  state: { experiment: ExperimentState },
  featureKey: string
): ExperimentVariant | null => {
  return (
    state.experiment.frontendVariants[featureKey] ||
    state.experiment.backendVariants[featureKey] ||
    null
  );
};

export const {
  initializeExperiments,
  setFrontendVariants,
  updateFrontendVariant,
  setBackendVariants,
  updateBackendVariant,
  setFeatureFlags,
  updateFeatureFlag,
  toggleFeatureFlag,
  setExperiments,
  addExperiment,
  updateExperiment,
  deleteExperiment,
  setGuestPageExperiment,
  setLoading,
  setExperimentError,
  clearExperimentState,
} = experimentSlice.actions;

export default experimentSlice.reducer;
