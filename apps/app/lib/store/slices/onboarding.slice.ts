import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

/**
 * Onboarding Slice
 * Manages the new user onboarding flow:
 * - Multi-step wizard
 * - User persona/type selection
 * - Interest/use-case selection
 * - Default connector suggestions
 */

export type OnboardingStep =
  | "welcome"
  | "persona"
  | "interests"
  | "connectors"
  | "workspace"
  | "complete";

export type UserPersona =
  | "developer"
  | "designer"
  | "researcher"
  | "marketer"
  | "analyst"
  | "student"
  | "business"
  | "other";

export type UserType = "individual" | "team" | "enterprise";

export interface OnboardingState {
  // Current step
  currentStep: OnboardingStep | null;

  // User selections
  persona: UserPersona | null;
  userType: UserType | null;

  // Interests (multi-select)
  interests: string[];

  // Suggested connectors based on persona
  suggestedConnectorIds: string[];
  selectedConnectorIds: string[];

  // Team candidates (suggested team members)
  teamCandidateList: string[];

  // Progress indicator
  showIndicator: boolean;

  // Completion
  isCompleted: boolean;
  completedAt: string | null;

  // Skip tracking
  skippedSteps: OnboardingStep[];
}

const initialState: OnboardingState = {
  currentStep: null,
  persona: null,
  userType: null,
  interests: [],
  suggestedConnectorIds: [],
  selectedConnectorIds: [],
  teamCandidateList: ["", "", ""],
  showIndicator: true,
  isCompleted: false,
  completedAt: null,
  skippedSteps: [],
};

const onboardingSlice = createSlice({
  name: "onboarding",
  initialState,
  reducers: {
    // Step navigation
    setCurrentStep: (state, action: PayloadAction<OnboardingStep>) => {
      state.currentStep = action.payload;
    },

    goToNextStep: (state) => {
      const steps: OnboardingStep[] = [
        "welcome",
        "persona",
        "interests",
        "connectors",
        "workspace",
        "complete",
      ];
      if (!state.currentStep) {
        state.currentStep = "welcome";
        return;
      }
      const currentIndex = steps.indexOf(state.currentStep);
      if (currentIndex >= 0 && currentIndex < steps.length - 1) {
        state.currentStep = steps[currentIndex + 1] ?? null;
      }
    },

    goToPreviousStep: (state) => {
      const steps: OnboardingStep[] = [
        "welcome",
        "persona",
        "interests",
        "connectors",
        "workspace",
        "complete",
      ];
      if (!state.currentStep) return;
      const currentIndex = steps.indexOf(state.currentStep);
      if (currentIndex > 0) {
        state.currentStep = steps[currentIndex - 1] ?? null;
      }
    },

    skipCurrentStep: (state) => {
      const steps: OnboardingStep[] = [
        "welcome",
        "persona",
        "interests",
        "connectors",
        "workspace",
        "complete",
      ];
      if (!state.currentStep) return;
      state.skippedSteps.push(state.currentStep);
      const currentIndex = steps.indexOf(state.currentStep);
      if (currentIndex >= 0 && currentIndex < steps.length - 1) {
        state.currentStep = steps[currentIndex + 1] ?? null;
      }
    },

    // Persona
    setPersona: (state, action: PayloadAction<UserPersona | null>) => {
      state.persona = action.payload;
    },

    // User type
    setUserType: (state, action: PayloadAction<UserType | null>) => {
      state.userType = action.payload;
    },

    // Interests
    setInterests: (state, action: PayloadAction<string[]>) => {
      state.interests = action.payload;
    },

    toggleInterest: (state, action: PayloadAction<string>) => {
      const index = state.interests.indexOf(action.payload);
      if (index === -1) {
        state.interests.push(action.payload);
      } else {
        state.interests.splice(index, 1);
      }
    },

    // Connectors
    setSuggestedConnectorIds: (state, action: PayloadAction<string[]>) => {
      state.suggestedConnectorIds = action.payload;
    },

    setSelectedConnectorIds: (state, action: PayloadAction<string[]>) => {
      state.selectedConnectorIds = action.payload;
    },

    toggleSelectedConnector: (state, action: PayloadAction<string>) => {
      const index = state.selectedConnectorIds.indexOf(action.payload);
      if (index === -1) {
        state.selectedConnectorIds.push(action.payload);
      } else {
        state.selectedConnectorIds.splice(index, 1);
      }
    },

    // Team candidates
    setTeamCandidateList: (state, action: PayloadAction<string[]>) => {
      state.teamCandidateList = action.payload;
    },

    // Indicator
    setShowIndicator: (state, action: PayloadAction<boolean>) => {
      state.showIndicator = action.payload;
    },

    // Completion
    completeOnboarding: (state) => {
      state.isCompleted = true;
      state.completedAt = new Date().toISOString();
      state.currentStep = "complete";
      state.showIndicator = false;
    },

    // Reset
    resetOnboarding: (state) => {
      Object.assign(state, initialState);
    },
  },
});

export const {
  setCurrentStep,
  goToNextStep,
  goToPreviousStep,
  skipCurrentStep,
  setPersona,
  setUserType,
  setInterests,
  toggleInterest,
  setSuggestedConnectorIds,
  setSelectedConnectorIds,
  toggleSelectedConnector,
  setTeamCandidateList,
  setShowIndicator,
  completeOnboarding,
  resetOnboarding,
} = onboardingSlice.actions;

export default onboardingSlice.reducer;
