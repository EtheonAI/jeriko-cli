import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

/**
 * Billing Slice
 * Manages billing, subscriptions, and credit packages
 */

export type PlanType = "free" | "pro" | "max" | "enterprise";
export type BillingInterval = "monthly" | "yearly";
export type PaymentStatus = "active" | "past_due" | "canceled" | "trialing";

export interface CreditPackage {
  id: string;
  plan: PlanType;
  price: number;
  credits: number;
  currency: string;
  popular?: boolean;
}

export interface MembershipTier {
  id: string;
  plan: PlanType;
  price: number;
  discountPrice?: number;
  credits: number;
  interval: BillingInterval | "";
  features: string[];
  popular?: boolean;
}

export interface Subscription {
  id: string;
  plan: PlanType;
  status: PaymentStatus;
  interval: BillingInterval;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  credits: number;
  creditsUsed: number;
}

export interface AutoTopupInfo {
  enabled: boolean;
  threshold: number;
  amount: number;
  packageId: string;
}

export interface PaymentMethod {
  id: string;
  type: "card" | "paypal" | "bank";
  last4?: string;
  brand?: string;
  expiryMonth?: number;
  expiryYear?: number;
  isDefault: boolean;
}

export interface Invoice {
  id: string;
  amount: number;
  currency: string;
  status: "paid" | "pending" | "failed";
  description: string;
  createdAt: string;
  paidAt?: string;
  invoiceUrl?: string;
}

export interface UsageRecord {
  date: string;
  credits: number;
  type: "chat" | "agent" | "connector" | "storage";
  description?: string;
}

export interface BillingState {
  // Plans and packages
  creditPackages: CreditPackage[];
  personalPlanTiers: MembershipTier[];
  teamPlanTiers: MembershipTier[];

  // Current subscription
  subscription: Subscription | null;
  freeRefreshCredits: number;

  // Auto top-up
  userAutoTopupInfo: AutoTopupInfo | null;

  // Payment methods
  paymentMethods: PaymentMethod[];

  // Invoices
  invoices: Invoice[];

  // Usage
  usageRecords: UsageRecord[];
  currentPeriodUsage: {
    total: number;
    byType: Record<string, number>;
  };

  // Upgrade flow
  selectedPlanKeyIndex: number | null;
  selectedPlanKeyForUpgrade: string | null;
  planPreviewDataLoadingMapForUpgrade: Record<string, boolean> | null;
  planPreviewDataMapForUpgrade: Record<string, unknown> | null;

  // Loading states
  loadingKey: string | null;
  isSubscriptionLoading: boolean;
  stripeBillingLoading: boolean;
  isLoadingInvoices: boolean;
  isLoadingUsage: boolean;

  // Manus-aligned keys
  teamSSOSubscription: unknown;
  teamSCIMSubscription: unknown;
  trials: unknown[];

  // Error
  error: string | null;
}

const initialState: BillingState = {
  creditPackages: [],
  personalPlanTiers: [],
  teamPlanTiers: [],
  subscription: null,
  freeRefreshCredits: 1500,
  userAutoTopupInfo: null,
  paymentMethods: [],
  invoices: [],
  usageRecords: [],
  currentPeriodUsage: {
    total: 0,
    byType: {},
  },
  selectedPlanKeyIndex: null,
  selectedPlanKeyForUpgrade: null,
  planPreviewDataLoadingMapForUpgrade: null,
  planPreviewDataMapForUpgrade: null,
  loadingKey: null,
  isSubscriptionLoading: false,
  stripeBillingLoading: false,
  isLoadingInvoices: false,
  isLoadingUsage: false,
  // Manus-aligned defaults
  teamSSOSubscription: null,
  teamSCIMSubscription: null,
  trials: [],
  error: null,
};

const billingSlice = createSlice({
  name: "billing",
  initialState,
  reducers: {
    // Credit packages
    setCreditPackages: (state, action: PayloadAction<CreditPackage[]>) => {
      state.creditPackages = action.payload;
    },

    // Plan tiers
    setPersonalPlanTiers: (state, action: PayloadAction<MembershipTier[]>) => {
      state.personalPlanTiers = action.payload;
    },

    setTeamPlanTiers: (state, action: PayloadAction<MembershipTier[]>) => {
      state.teamPlanTiers = action.payload;
    },

    // Subscription
    setSubscription: (state, action: PayloadAction<Subscription | null>) => {
      state.subscription = action.payload;
      state.isSubscriptionLoading = false;
    },

    updateSubscription: (
      state,
      action: PayloadAction<Partial<Subscription>>
    ) => {
      if (state.subscription) {
        state.subscription = { ...state.subscription, ...action.payload };
      }
    },

    setFreeRefreshCredits: (state, action: PayloadAction<number>) => {
      state.freeRefreshCredits = action.payload;
    },

    // Auto top-up
    setAutoTopupInfo: (state, action: PayloadAction<AutoTopupInfo | null>) => {
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

    // Payment methods
    setPaymentMethods: (state, action: PayloadAction<PaymentMethod[]>) => {
      state.paymentMethods = action.payload;
    },

    addPaymentMethod: (state, action: PayloadAction<PaymentMethod>) => {
      state.paymentMethods.push(action.payload);
    },

    removePaymentMethod: (state, action: PayloadAction<string>) => {
      state.paymentMethods = state.paymentMethods.filter(
        (pm) => pm.id !== action.payload
      );
    },

    setDefaultPaymentMethod: (state, action: PayloadAction<string>) => {
      state.paymentMethods.forEach((pm) => {
        pm.isDefault = pm.id === action.payload;
      });
    },

    // Invoices
    setInvoices: (state, action: PayloadAction<Invoice[]>) => {
      state.invoices = action.payload;
      state.isLoadingInvoices = false;
    },

    // Usage
    setUsageRecords: (state, action: PayloadAction<UsageRecord[]>) => {
      state.usageRecords = action.payload;
      state.isLoadingUsage = false;
    },

    setCurrentPeriodUsage: (
      state,
      action: PayloadAction<BillingState["currentPeriodUsage"]>
    ) => {
      state.currentPeriodUsage = action.payload;
    },

    addUsageRecord: (state, action: PayloadAction<UsageRecord>) => {
      state.usageRecords.unshift(action.payload);
      state.currentPeriodUsage.total += action.payload.credits;
      const type = action.payload.type;
      state.currentPeriodUsage.byType[type] =
        (state.currentPeriodUsage.byType[type] || 0) + action.payload.credits;
    },

    // Upgrade flow
    setSelectedPlanKeyIndex: (state, action: PayloadAction<number | null>) => {
      state.selectedPlanKeyIndex = action.payload;
    },

    setSelectedPlanKeyForUpgrade: (
      state,
      action: PayloadAction<string | null>
    ) => {
      state.selectedPlanKeyForUpgrade = action.payload;
    },

    setPlanPreviewDataLoading: (
      state,
      action: PayloadAction<{ key: string; loading: boolean }>
    ) => {
      if (!state.planPreviewDataLoadingMapForUpgrade) {
        state.planPreviewDataLoadingMapForUpgrade = {};
      }
      state.planPreviewDataLoadingMapForUpgrade[action.payload.key] =
        action.payload.loading;
    },

    setPlanPreviewData: (
      state,
      action: PayloadAction<{ key: string; data: unknown }>
    ) => {
      if (!state.planPreviewDataMapForUpgrade) {
        state.planPreviewDataMapForUpgrade = {};
      }
      if (!state.planPreviewDataLoadingMapForUpgrade) {
        state.planPreviewDataLoadingMapForUpgrade = {};
      }
      state.planPreviewDataMapForUpgrade[action.payload.key] =
        action.payload.data;
      state.planPreviewDataLoadingMapForUpgrade[action.payload.key] = false;
    },

    setPlanPreviewDataLoadingMapForUpgrade: (
      state,
      action: PayloadAction<Record<string, boolean> | null>
    ) => {
      state.planPreviewDataLoadingMapForUpgrade = action.payload;
    },

    setPlanPreviewDataMapForUpgrade: (
      state,
      action: PayloadAction<Record<string, unknown> | null>
    ) => {
      state.planPreviewDataMapForUpgrade = action.payload;
    },

    // Loading states
    setLoadingKey: (state, action: PayloadAction<string | null>) => {
      state.loadingKey = action.payload;
    },

    setSubscriptionLoading: (state, action: PayloadAction<boolean>) => {
      state.isSubscriptionLoading = action.payload;
    },

    setStripeBillingLoading: (state, action: PayloadAction<boolean>) => {
      state.stripeBillingLoading = action.payload;
    },

    setLoadingInvoices: (state, action: PayloadAction<boolean>) => {
      state.isLoadingInvoices = action.payload;
    },

    setLoadingUsage: (state, action: PayloadAction<boolean>) => {
      state.isLoadingUsage = action.payload;
    },

    // Manus-aligned reducers
    setTeamSSOSubscription: (state, action: PayloadAction<unknown>) => {
      state.teamSSOSubscription = action.payload;
    },
    setTeamSCIMSubscription: (state, action: PayloadAction<unknown>) => {
      state.teamSCIMSubscription = action.payload;
    },
    setTrials: (state, action: PayloadAction<unknown[]>) => {
      state.trials = action.payload;
    },

    // Error
    setBillingError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },

    // Reset
    resetBilling: (state) => {
      Object.assign(state, initialState);
    },
  },
});

export const {
  setCreditPackages,
  setPersonalPlanTiers,
  setTeamPlanTiers,
  setSubscription,
  updateSubscription,
  setFreeRefreshCredits,
  setAutoTopupInfo,
  updateAutoTopupInfo,
  setPaymentMethods,
  addPaymentMethod,
  removePaymentMethod,
  setDefaultPaymentMethod,
  setInvoices,
  setUsageRecords,
  setCurrentPeriodUsage,
  addUsageRecord,
  setSelectedPlanKeyIndex,
  setSelectedPlanKeyForUpgrade,
  setPlanPreviewDataLoading,
  setPlanPreviewData,
  setLoadingKey,
  setSubscriptionLoading,
  setStripeBillingLoading,
  setLoadingInvoices,
  setLoadingUsage,
  setBillingError,
  resetBilling,
  setTeamSSOSubscription,
  setTeamSCIMSubscription,
  setTrials,
  setPlanPreviewDataLoadingMapForUpgrade,
  setPlanPreviewDataMapForUpgrade,
} = billingSlice.actions;

export default billingSlice.reducer;
