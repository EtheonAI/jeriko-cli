import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

/**
 * Biz (Business) Slice
 * Manages billing, pricing, and subscription state (Manus-style biz)
 *
 * Manus keys:
 * - loadingKey
 * - creditPackages
 * - personalPlanTiers
 * - teamPlanTiers
 * - trials
 * - freeRefreshCredits
 * - stripeBillingLoading
 * - userAutoTopupInfo
 * - isSubscriptionLoading
 * - selectedPlanKeyIndex
 * - planPreviewDataLoadingMapForUpgrade
 * - planPreviewDataMapForUpgrade
 * - selectedPlanKeyForUpgrade
 */

export interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  price: number;
  currency: string;
  bonusCredits?: number;
  popular?: boolean;
  description?: string;
}

export interface PlanTier {
  id: string;
  key: string;
  name: string;
  description?: string;
  price: number;
  currency: string;
  interval: "month" | "year";
  features: string[];
  credits: number;
  maxTeamMembers?: number;
  popular?: boolean;
  enterprise?: boolean;
}

export interface TrialInfo {
  id: string;
  planId: string;
  durationDays: number;
  creditsIncluded: number;
  isActive: boolean;
  startedAt?: string;
  expiresAt?: string;
}

export interface AutoTopupInfo {
  enabled: boolean;
  threshold: number;
  amount: number;
  maxPerMonth: number;
  currentMonthTopups: number;
}

export interface PlanPreviewData {
  planId: string;
  currentPlan: string;
  proratedAmount: number;
  nextBillingDate: string;
  newMonthlyPrice: number;
  creditsChange: number;
}

export interface BizState {
  // Loading
  loadingKey: string | null;
  stripeBillingLoading: boolean;
  isSubscriptionLoading: boolean;

  // Credit packages
  creditPackages: CreditPackage[];

  // Plan tiers
  personalPlanTiers: PlanTier[];
  teamPlanTiers: PlanTier[];

  // Trials
  trials: TrialInfo[];

  // Free credits
  freeRefreshCredits: number;

  // Auto top-up
  userAutoTopupInfo: AutoTopupInfo | null;

  // Plan selection UI
  selectedPlanKeyIndex: number;
  selectedPlanKeyForUpgrade: string | null;

  // Upgrade preview
  planPreviewDataLoadingMapForUpgrade: Record<string, boolean>;
  planPreviewDataMapForUpgrade: Record<string, PlanPreviewData>;

  // Error
  error: string | null;
}

const initialState: BizState = {
  loadingKey: null,
  stripeBillingLoading: false,
  isSubscriptionLoading: false,
  creditPackages: [],
  personalPlanTiers: [],
  teamPlanTiers: [],
  trials: [],
  freeRefreshCredits: 0,
  userAutoTopupInfo: null,
  selectedPlanKeyIndex: 0,
  selectedPlanKeyForUpgrade: null,
  planPreviewDataLoadingMapForUpgrade: {},
  planPreviewDataMapForUpgrade: {},
  error: null,
};

export const bizSlice = createSlice({
  name: "biz",
  initialState,
  reducers: {
    // Loading
    setLoadingKey: (state, action: PayloadAction<string | null>) => {
      state.loadingKey = action.payload;
    },

    setStripeBillingLoading: (state, action: PayloadAction<boolean>) => {
      state.stripeBillingLoading = action.payload;
    },

    setIsSubscriptionLoading: (state, action: PayloadAction<boolean>) => {
      state.isSubscriptionLoading = action.payload;
    },

    // Credit packages
    setCreditPackages: (state, action: PayloadAction<CreditPackage[]>) => {
      state.creditPackages = action.payload;
    },

    // Plan tiers
    setPersonalPlanTiers: (state, action: PayloadAction<PlanTier[]>) => {
      state.personalPlanTiers = action.payload;
    },

    setTeamPlanTiers: (state, action: PayloadAction<PlanTier[]>) => {
      state.teamPlanTiers = action.payload;
    },

    // Trials
    setTrials: (state, action: PayloadAction<TrialInfo[]>) => {
      state.trials = action.payload;
    },

    addTrial: (state, action: PayloadAction<TrialInfo>) => {
      state.trials.push(action.payload);
    },

    updateTrial: (
      state,
      action: PayloadAction<{ id: string; updates: Partial<TrialInfo> }>
    ) => {
      const index = state.trials.findIndex((t) => t.id === action.payload.id);
      if (index !== -1) {
        state.trials[index] = { ...state.trials[index], ...action.payload.updates };
      }
    },

    // Free credits
    setFreeRefreshCredits: (state, action: PayloadAction<number>) => {
      state.freeRefreshCredits = action.payload;
    },

    // Auto top-up
    setUserAutoTopupInfo: (state, action: PayloadAction<AutoTopupInfo | null>) => {
      state.userAutoTopupInfo = action.payload;
    },

    updateAutoTopupInfo: (
      state,
      action: PayloadAction<Partial<AutoTopupInfo>>
    ) => {
      if (state.userAutoTopupInfo) {
        state.userAutoTopupInfo = {
          ...state.userAutoTopupInfo,
          ...action.payload,
        };
      }
    },

    // Plan selection UI
    setSelectedPlanKeyIndex: (state, action: PayloadAction<number>) => {
      state.selectedPlanKeyIndex = action.payload;
    },

    setSelectedPlanKeyForUpgrade: (state, action: PayloadAction<string | null>) => {
      state.selectedPlanKeyForUpgrade = action.payload;
    },

    // Upgrade preview
    setPlanPreviewDataLoading: (
      state,
      action: PayloadAction<{ planId: string; loading: boolean }>
    ) => {
      state.planPreviewDataLoadingMapForUpgrade[action.payload.planId] =
        action.payload.loading;
    },

    setPlanPreviewData: (
      state,
      action: PayloadAction<{ planId: string; data: PlanPreviewData }>
    ) => {
      state.planPreviewDataMapForUpgrade[action.payload.planId] =
        action.payload.data;
      state.planPreviewDataLoadingMapForUpgrade[action.payload.planId] = false;
    },

    clearPlanPreviewData: (state) => {
      state.planPreviewDataMapForUpgrade = {};
      state.planPreviewDataLoadingMapForUpgrade = {};
    },

    // Error
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
      state.loadingKey = null;
      state.stripeBillingLoading = false;
      state.isSubscriptionLoading = false;
    },

    // Reset
    resetBiz: (state) => {
      Object.assign(state, initialState);
    },
  },
});

export const {
  setLoadingKey,
  setStripeBillingLoading,
  setIsSubscriptionLoading,
  setCreditPackages,
  setPersonalPlanTiers,
  setTeamPlanTiers,
  setTrials,
  addTrial,
  updateTrial,
  setFreeRefreshCredits,
  setUserAutoTopupInfo,
  updateAutoTopupInfo,
  setSelectedPlanKeyIndex,
  setSelectedPlanKeyForUpgrade,
  setPlanPreviewDataLoading,
  setPlanPreviewData,
  clearPlanPreviewData,
  setError,
  resetBiz,
} = bizSlice.actions;

export default bizSlice.reducer;
