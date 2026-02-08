import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

/**
 * Skills Slice
 * Manages user skills/playbooks — reusable task templates the agent can execute.
 * Users can add custom skills and use official ones.
 */

export interface Skill {
  id: string;
  uid: string;
  name: string;
  description: string;
  prompt: string;
  iconUrl?: string;
  category?: string;
  isOfficial: boolean;
  isEnabled: boolean;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SkillsState {
  // User-added custom skills
  userAddedSkills: Skill[];

  // Official skills provided by platform
  officialSkills: Skill[];

  // Loading
  isLoading: boolean;

  // Search
  searchQuery: string;

  // Error
  error: string | null;
}

const initialState: SkillsState = {
  userAddedSkills: [],
  officialSkills: [],
  isLoading: false,
  searchQuery: "",
  error: null,
};

const skillsSlice = createSlice({
  name: "skills",
  initialState,
  reducers: {
    // User skills
    setUserAddedSkills: (state, action: PayloadAction<Skill[]>) => {
      state.userAddedSkills = action.payload;
      state.isLoading = false;
    },

    addUserSkill: (state, action: PayloadAction<Skill>) => {
      state.userAddedSkills.push(action.payload);
    },

    updateUserSkill: (
      state,
      action: PayloadAction<{ id: string; updates: Partial<Skill> }>
    ) => {
      const skill = state.userAddedSkills.find(
        (s) => s.id === action.payload.id
      );
      if (skill) {
        Object.assign(skill, action.payload.updates);
      }
    },

    removeUserSkill: (state, action: PayloadAction<string>) => {
      state.userAddedSkills = state.userAddedSkills.filter(
        (s) => s.id !== action.payload
      );
    },

    // Official skills
    setOfficialSkills: (state, action: PayloadAction<Skill[]>) => {
      state.officialSkills = action.payload;
      state.isLoading = false;
    },

    // Toggle skill enabled/disabled
    toggleSkillEnabled: (
      state,
      action: PayloadAction<{ id: string; isOfficial: boolean }>
    ) => {
      const list = action.payload.isOfficial
        ? state.officialSkills
        : state.userAddedSkills;
      const skill = list.find((s) => s.id === action.payload.id);
      if (skill) {
        skill.isEnabled = !skill.isEnabled;
      }
    },

    // Loading
    setSkillsLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },

    // Search
    setSkillsSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload;
    },

    // Error
    setSkillsError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
      state.isLoading = false;
    },

    // Reset
    resetSkills: (state) => {
      Object.assign(state, initialState);
    },
  },
});

export const {
  setUserAddedSkills,
  addUserSkill,
  updateUserSkill,
  removeUserSkill,
  setOfficialSkills,
  toggleSkillEnabled,
  setSkillsLoading,
  setSkillsSearchQuery,
  setSkillsError,
  resetSkills,
} = skillsSlice.actions;

export default skillsSlice.reducer;
