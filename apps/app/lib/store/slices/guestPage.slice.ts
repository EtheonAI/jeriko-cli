import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

/**
 * Guest Page Slice
 * Manages guest/public page state
 */

export interface GuestPageState {
  // Is currently viewing as guest
  isInGuestPage: boolean;

  // Guest session info
  guestSessionId: string | null;
  guestSessionExpiry: string | null;

  // Limited features available to guests
  availableFeatures: string[];

  // Prompts shown to guest
  loginPromptShown: boolean;
  upgradePromptShown: boolean;

  // Guest usage tracking
  messagesUsed: number;
  messagesLimit: number;
  actionsUsed: number;
  actionsLimit: number;

  // Referral tracking
  referralSource: string | null;
  referralCode: string | null;

  // UI State
  showLoginPrompt: boolean;
  showUpgradePrompt: boolean;
  showFeatureLimitPrompt: boolean;
  limitedFeatureAttempted: string | null;
}

const initialState: GuestPageState = {
  isInGuestPage: false,
  guestSessionId: null,
  guestSessionExpiry: null,
  availableFeatures: ["chat", "view_examples"],
  loginPromptShown: false,
  upgradePromptShown: false,
  messagesUsed: 0,
  messagesLimit: 5,
  actionsUsed: 0,
  actionsLimit: 3,
  referralSource: null,
  referralCode: null,
  showLoginPrompt: false,
  showUpgradePrompt: false,
  showFeatureLimitPrompt: false,
  limitedFeatureAttempted: null,
};

export const guestPageSlice = createSlice({
  name: "guestPage",
  initialState,
  reducers: {
    // Guest page status
    setIsInGuestPage: (state, action: PayloadAction<boolean>) => {
      state.isInGuestPage = action.payload;
    },

    enterGuestMode: (state) => {
      state.isInGuestPage = true;
      state.guestSessionId = `guest_${Date.now()}`;
      state.guestSessionExpiry = new Date(
        Date.now() + 24 * 60 * 60 * 1000
      ).toISOString();
    },

    exitGuestMode: (state) => {
      state.isInGuestPage = false;
      state.guestSessionId = null;
      state.guestSessionExpiry = null;
    },

    // Guest session
    setGuestSessionId: (state, action: PayloadAction<string | null>) => {
      state.guestSessionId = action.payload;
    },

    setGuestSessionExpiry: (state, action: PayloadAction<string | null>) => {
      state.guestSessionExpiry = action.payload;
    },

    // Available features
    setAvailableFeatures: (state, action: PayloadAction<string[]>) => {
      state.availableFeatures = action.payload;
    },

    // Prompt tracking
    setLoginPromptShown: (state, action: PayloadAction<boolean>) => {
      state.loginPromptShown = action.payload;
    },

    setUpgradePromptShown: (state, action: PayloadAction<boolean>) => {
      state.upgradePromptShown = action.payload;
    },

    // Usage tracking
    incrementMessagesUsed: (state) => {
      state.messagesUsed += 1;
      if (state.messagesUsed >= state.messagesLimit) {
        state.showLoginPrompt = true;
      }
    },

    incrementActionsUsed: (state) => {
      state.actionsUsed += 1;
      if (state.actionsUsed >= state.actionsLimit) {
        state.showUpgradePrompt = true;
      }
    },

    setMessagesUsed: (state, action: PayloadAction<number>) => {
      state.messagesUsed = action.payload;
    },

    setActionsUsed: (state, action: PayloadAction<number>) => {
      state.actionsUsed = action.payload;
    },

    setMessagesLimit: (state, action: PayloadAction<number>) => {
      state.messagesLimit = action.payload;
    },

    setActionsLimit: (state, action: PayloadAction<number>) => {
      state.actionsLimit = action.payload;
    },

    // Referral tracking
    setReferralSource: (state, action: PayloadAction<string | null>) => {
      state.referralSource = action.payload;
    },

    setReferralCode: (state, action: PayloadAction<string | null>) => {
      state.referralCode = action.payload;
    },

    // UI State
    setShowLoginPrompt: (state, action: PayloadAction<boolean>) => {
      state.showLoginPrompt = action.payload;
    },

    setShowUpgradePrompt: (state, action: PayloadAction<boolean>) => {
      state.showUpgradePrompt = action.payload;
    },

    setShowFeatureLimitPrompt: (state, action: PayloadAction<boolean>) => {
      state.showFeatureLimitPrompt = action.payload;
    },

    showFeatureLimit: (state, action: PayloadAction<string>) => {
      state.limitedFeatureAttempted = action.payload;
      state.showFeatureLimitPrompt = true;
    },

    dismissFeatureLimit: (state) => {
      state.showFeatureLimitPrompt = false;
      state.limitedFeatureAttempted = null;
    },

    dismissAllPrompts: (state) => {
      state.showLoginPrompt = false;
      state.showUpgradePrompt = false;
      state.showFeatureLimitPrompt = false;
      state.limitedFeatureAttempted = null;
    },

    // Check feature availability
    checkFeatureAvailable: (
      state,
      action: PayloadAction<string>
    ): void => {
      if (!state.availableFeatures.includes(action.payload)) {
        state.limitedFeatureAttempted = action.payload;
        state.showFeatureLimitPrompt = true;
      }
    },

    // Reset
    resetGuestPage: (state) => {
      Object.assign(state, initialState);
    },
  },
});

export const {
  setIsInGuestPage,
  enterGuestMode,
  exitGuestMode,
  setGuestSessionId,
  setGuestSessionExpiry,
  setAvailableFeatures,
  setLoginPromptShown,
  setUpgradePromptShown,
  incrementMessagesUsed,
  incrementActionsUsed,
  setMessagesUsed,
  setActionsUsed,
  setMessagesLimit,
  setActionsLimit,
  setReferralSource,
  setReferralCode,
  setShowLoginPrompt,
  setShowUpgradePrompt,
  setShowFeatureLimitPrompt,
  showFeatureLimit,
  dismissFeatureLimit,
  dismissAllPrompts,
  checkFeatureAvailable,
  resetGuestPage,
} = guestPageSlice.actions;

export default guestPageSlice.reducer;
