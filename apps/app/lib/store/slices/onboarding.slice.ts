import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

/**
 * Onboarding Slice
 * Manages user onboarding flow and preferences
 */

export type OnboardingStep =
  | "welcome"
  | "choosePersona"
  | "selectInterests"
  | "setupWorkspace"
  | "connectIntegrations"
  | "complete";

export type UserType = 1 | 2 | 3; // 1: Individual, 2: Team, 3: Enterprise

export type PersonaType =
  | "developer"
  | "designer"
  | "product_manager"
  | "data_analyst"
  | "marketer"
  | "researcher"
  | "student"
  | "other";

export interface Persona {
  type: PersonaType;
  label: string;
  description: string;
  icon: string;
  suggestedConnectors: string[];
  suggestedTemplates: string[];
}

export interface OnboardingProgress {
  welcomeSeen: boolean;
  personaSelected: boolean;
  interestsSelected: boolean;
  workspaceSetup: boolean;
  integrationsConnected: boolean;
  tourCompleted: boolean;
}

export interface OnboardingState {
  // Flow state
  showIndicator: boolean;
  currentStep: OnboardingStep;
  userType: UserType;
  persona: Persona | null;

  // Progress tracking
  progress: OnboardingProgress;

  // User selections
  selectedInterests: string[];
  selectedConnectors: string[];

  // Tour state
  showTour: boolean;
  tourStep: number;
  tourDismissed: boolean;

  // Checklist
  checklistItems: Array<{
    id: string;
    label: string;
    completed: boolean;
    action?: string;
  }>;
  showChecklist: boolean;

  // Loading
  isLoading: boolean;
  isSaving: boolean;

  // Skip state
  skipped: boolean;
}

const initialState: OnboardingState = {
  showIndicator: true,
  currentStep: "welcome",
  userType: 1,
  persona: null,
  progress: {
    welcomeSeen: false,
    personaSelected: false,
    interestsSelected: false,
    workspaceSetup: false,
    integrationsConnected: false,
    tourCompleted: false,
  },
  selectedInterests: [],
  selectedConnectors: [],
  showTour: false,
  tourStep: 0,
  tourDismissed: false,
  checklistItems: [],
  showChecklist: true,
  isLoading: false,
  isSaving: false,
  skipped: false,
};

export const onboardingSlice = createSlice({
  name: "onboarding",
  initialState,
  reducers: {
    // Indicator
    setShowIndicator: (state, action: PayloadAction<boolean>) => {
      state.showIndicator = action.payload;
    },

    // Step navigation
    setCurrentStep: (state, action: PayloadAction<OnboardingStep>) => {
      state.currentStep = action.payload;
    },

    nextStep: (state) => {
      const steps: OnboardingStep[] = [
        "welcome",
        "choosePersona",
        "selectInterests",
        "setupWorkspace",
        "connectIntegrations",
        "complete",
      ];
      const currentIndex = steps.indexOf(state.currentStep);
      if (currentIndex < steps.length - 1) {
        state.currentStep = steps[currentIndex + 1];
      }
    },

    prevStep: (state) => {
      const steps: OnboardingStep[] = [
        "welcome",
        "choosePersona",
        "selectInterests",
        "setupWorkspace",
        "connectIntegrations",
        "complete",
      ];
      const currentIndex = steps.indexOf(state.currentStep);
      if (currentIndex > 0) {
        state.currentStep = steps[currentIndex - 1];
      }
    },

    // User type
    setUserType: (state, action: PayloadAction<UserType>) => {
      state.userType = action.payload;
    },

    // Persona
    setPersona: (state, action: PayloadAction<Persona | null>) => {
      state.persona = action.payload;
      state.progress.personaSelected = !!action.payload;
    },

    // Progress
    updateProgress: (
      state,
      action: PayloadAction<Partial<OnboardingProgress>>
    ) => {
      state.progress = { ...state.progress, ...action.payload };
    },

    markStepComplete: (
      state,
      action: PayloadAction<keyof OnboardingProgress>
    ) => {
      state.progress[action.payload] = true;
    },

    // Interests
    setSelectedInterests: (state, action: PayloadAction<string[]>) => {
      state.selectedInterests = action.payload;
      state.progress.interestsSelected = action.payload.length > 0;
    },

    toggleInterest: (state, action: PayloadAction<string>) => {
      const index = state.selectedInterests.indexOf(action.payload);
      if (index === -1) {
        state.selectedInterests.push(action.payload);
      } else {
        state.selectedInterests.splice(index, 1);
      }
      state.progress.interestsSelected = state.selectedInterests.length > 0;
    },

    // Connectors
    setSelectedConnectors: (state, action: PayloadAction<string[]>) => {
      state.selectedConnectors = action.payload;
    },

    toggleConnector: (state, action: PayloadAction<string>) => {
      const index = state.selectedConnectors.indexOf(action.payload);
      if (index === -1) {
        state.selectedConnectors.push(action.payload);
      } else {
        state.selectedConnectors.splice(index, 1);
      }
    },

    // Tour
    setShowTour: (state, action: PayloadAction<boolean>) => {
      state.showTour = action.payload;
    },

    setTourStep: (state, action: PayloadAction<number>) => {
      state.tourStep = action.payload;
    },

    nextTourStep: (state) => {
      state.tourStep += 1;
    },

    prevTourStep: (state) => {
      if (state.tourStep > 0) {
        state.tourStep -= 1;
      }
    },

    dismissTour: (state) => {
      state.showTour = false;
      state.tourDismissed = true;
    },

    completeTour: (state) => {
      state.showTour = false;
      state.progress.tourCompleted = true;
    },

    // Checklist
    setChecklistItems: (
      state,
      action: PayloadAction<OnboardingState["checklistItems"]>
    ) => {
      state.checklistItems = action.payload;
    },

    toggleChecklistItem: (state, action: PayloadAction<string>) => {
      const item = state.checklistItems.find((i) => i.id === action.payload);
      if (item) {
        item.completed = !item.completed;
      }
    },

    setShowChecklist: (state, action: PayloadAction<boolean>) => {
      state.showChecklist = action.payload;
    },

    // Loading
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },

    setSaving: (state, action: PayloadAction<boolean>) => {
      state.isSaving = action.payload;
    },

    // Skip
    skipOnboarding: (state) => {
      state.skipped = true;
      state.currentStep = "complete";
      state.showIndicator = false;
    },

    // Complete onboarding
    completeOnboarding: (state) => {
      state.currentStep = "complete";
      state.showIndicator = false;
      Object.keys(state.progress).forEach((key) => {
        state.progress[key as keyof OnboardingProgress] = true;
      });
    },

    // Reset
    resetOnboarding: (state) => {
      Object.assign(state, initialState);
    },
  },
});

export const {
  setShowIndicator,
  setCurrentStep,
  nextStep,
  prevStep,
  setUserType,
  setPersona,
  updateProgress,
  markStepComplete,
  setSelectedInterests,
  toggleInterest,
  setSelectedConnectors,
  toggleConnector,
  setShowTour,
  setTourStep,
  nextTourStep,
  prevTourStep,
  dismissTour,
  completeTour,
  setChecklistItems,
  toggleChecklistItem,
  setShowChecklist,
  setLoading,
  setSaving,
  skipOnboarding,
  completeOnboarding,
  resetOnboarding,
} = onboardingSlice.actions;

export default onboardingSlice.reducer;
