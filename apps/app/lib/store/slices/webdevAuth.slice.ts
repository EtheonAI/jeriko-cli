import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

/**
 * WebDev Auth Slice
 * Manages authentication state for web development projects (Manus-style webdevAuth)
 *
 * Manus keys: (empty in current state, but structure needed for auth tokens per project)
 */

export interface WebDevAuthToken {
  projectId: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt: string;
  scope?: string[];
}

export interface WebDevAuthState {
  // Auth tokens per project
  tokens: Record<string, WebDevAuthToken>;

  // OAuth state
  pendingOAuthProjectId: string | null;
  oauthLoading: boolean;
  oauthError: string | null;

  // API keys for projects
  apiKeys: Record<string, string>;

  // Environment variables per project
  envVars: Record<string, Record<string, string>>;

  // Loading states
  isLoading: boolean;
  error: string | null;
}

const initialState: WebDevAuthState = {
  tokens: {},
  pendingOAuthProjectId: null,
  oauthLoading: false,
  oauthError: null,
  apiKeys: {},
  envVars: {},
  isLoading: false,
  error: null,
};

export const webdevAuthSlice = createSlice({
  name: "webdevAuth",
  initialState,
  reducers: {
    // Token management
    setToken: (state, action: PayloadAction<WebDevAuthToken>) => {
      state.tokens[action.payload.projectId] = action.payload;
    },

    removeToken: (state, action: PayloadAction<string>) => {
      delete state.tokens[action.payload];
    },

    clearAllTokens: (state) => {
      state.tokens = {};
    },

    // OAuth
    startOAuth: (state, action: PayloadAction<string>) => {
      state.pendingOAuthProjectId = action.payload;
      state.oauthLoading = true;
      state.oauthError = null;
    },

    completeOAuth: (state, action: PayloadAction<WebDevAuthToken>) => {
      state.tokens[action.payload.projectId] = action.payload;
      state.pendingOAuthProjectId = null;
      state.oauthLoading = false;
      state.oauthError = null;
    },

    failOAuth: (state, action: PayloadAction<string>) => {
      state.oauthLoading = false;
      state.oauthError = action.payload;
    },

    cancelOAuth: (state) => {
      state.pendingOAuthProjectId = null;
      state.oauthLoading = false;
      state.oauthError = null;
    },

    // API keys
    setApiKey: (
      state,
      action: PayloadAction<{ projectId: string; apiKey: string }>
    ) => {
      state.apiKeys[action.payload.projectId] = action.payload.apiKey;
    },

    removeApiKey: (state, action: PayloadAction<string>) => {
      delete state.apiKeys[action.payload];
    },

    // Environment variables
    setEnvVars: (
      state,
      action: PayloadAction<{ projectId: string; vars: Record<string, string> }>
    ) => {
      state.envVars[action.payload.projectId] = action.payload.vars;
    },

    updateEnvVar: (
      state,
      action: PayloadAction<{ projectId: string; key: string; value: string }>
    ) => {
      const projectVars = state.envVars[action.payload.projectId];
      if (!projectVars) {
        state.envVars[action.payload.projectId] = { [action.payload.key]: action.payload.value };
      } else {
        projectVars[action.payload.key] = action.payload.value;
      }
    },

    removeEnvVar: (
      state,
      action: PayloadAction<{ projectId: string; key: string }>
    ) => {
      const vars = state.envVars[action.payload.projectId];
      if (vars) {
        delete vars[action.payload.key];
      }
    },

    clearEnvVars: (state, action: PayloadAction<string>) => {
      delete state.envVars[action.payload];
    },

    // Loading
    setIsLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },

    // Error
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
      state.isLoading = false;
    },

    // Reset
    resetWebdevAuth: (state) => {
      Object.assign(state, initialState);
    },
  },
});

export const {
  setToken,
  removeToken,
  clearAllTokens,
  startOAuth,
  completeOAuth,
  failOAuth,
  cancelOAuth,
  setApiKey,
  removeApiKey,
  setEnvVars,
  updateEnvVar,
  removeEnvVar,
  clearEnvVars,
  setIsLoading,
  setError,
  resetWebdevAuth,
} = webdevAuthSlice.actions;

export default webdevAuthSlice.reducer;
