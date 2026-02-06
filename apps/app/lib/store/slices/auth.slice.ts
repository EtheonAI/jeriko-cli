import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type UserPlan = "free" | "pro" | "enterprise";
export type UserRole = "user" | "admin" | "super_admin";
export type AuthProvider = "email" | "google" | "github" | "microsoft";

export interface UserPreferences {
  theme?: "light" | "dark" | "system";
  language?: string;
  timezone?: string;
  notifications?: boolean;
  communicationStyle?: "concise" | "balanced" | "detailed";
  expertiseLevel?: "beginner" | "intermediate" | "expert";
  customInstructions?: string;
  defaultModel?: string;
  bio?: string;
  fontSize?: "small" | "medium" | "large";
  chatDensity?: "compact" | "comfortable" | "spacious";
  saveHistory?: boolean;
  analyticsEnabled?: boolean;
  crashReports?: boolean;
  personalizedExperience?: boolean;
  conversationRetention?: "30d" | "90d" | "1y" | "never";
  fileRetention?: "30d" | "90d" | "1y" | "never";
  activityLogRetention?: "30d" | "90d" | "1y" | "never";
  enabledSkills?: Record<string, boolean>;
  autoSummarizeEmails?: boolean;
  autoCategorizeEmails?: boolean;
}

export interface UserSubscription {
  plan: UserPlan;
  status: "active" | "canceled" | "past_due" | "trialing";
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
}

export interface User {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  // Extended user properties
  role: UserRole;
  provider?: AuthProvider;
  emailVerified?: boolean;
  phone?: string | null;
  phoneVerified?: boolean;
  // Organization/team
  teamId?: string | null;
  organizationId?: string | null;
  // Subscription
  subscription?: UserSubscription;
  // Preferences
  preferences?: UserPreferences;
  // Timestamps
  createdAt?: string;
  lastLoginAt?: string;
  updatedAt?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterCredentials {
  email: string;
  password: string;
  name?: string;
  invitationCode?: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  // Manus compatibility
  clientConfig: Record<string, unknown> | null;
  globalSettings: Record<string, unknown> | null;
  invitationCodeList: Array<Record<string, unknown>>;
  invitationCodeListLoading: boolean;
  // Session management
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiresAt: string | null;
  // Login flow state
  loginStep: "email" | "password" | "mfa" | "complete";
  mfaRequired: boolean;
  mfaMethod: "totp" | "sms" | "email" | null;
  // Registration flow
  registrationStep: "email" | "verify" | "profile" | "complete";
  pendingEmail: string | null;
  verificationCodeSent: boolean;
  // Password reset
  passwordResetRequested: boolean;
  passwordResetEmail: string | null;
  // OAuth state
  oauthProvider: AuthProvider | null;
  oauthLoading: boolean;
  // Invitation
  pendingInvitation: {
    code: string;
    teamId?: string;
    teamName?: string;
    invitedBy?: string;
  } | null;
}

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
  clientConfig: null,
  globalSettings: null,
  invitationCodeList: [],
  invitationCodeListLoading: false,
  // Session
  accessToken: null,
  refreshToken: null,
  tokenExpiresAt: null,
  // Login flow
  loginStep: "email",
  mfaRequired: false,
  mfaMethod: null,
  // Registration flow
  registrationStep: "email",
  pendingEmail: null,
  verificationCodeSent: false,
  // Password reset
  passwordResetRequested: false,
  passwordResetEmail: null,
  // OAuth
  oauthProvider: null,
  oauthLoading: false,
  // Invitation
  pendingInvitation: null,
};

export const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setUser: (state, action: PayloadAction<User | null>) => {
      state.user = action.payload;
      state.isAuthenticated = !!action.payload;
      state.isLoading = false;
      state.error = null;
    },

    updateUser: (state, action: PayloadAction<Partial<User>>) => {
      if (state.user) {
        state.user = { ...state.user, ...action.payload };
      }
    },

    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },

    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
      state.isLoading = false;
    },

    // Token management
    setTokens: (
      state,
      action: PayloadAction<{
        accessToken: string;
        refreshToken?: string;
        expiresAt?: string;
      }>
    ) => {
      state.accessToken = action.payload.accessToken;
      if (action.payload.refreshToken) {
        state.refreshToken = action.payload.refreshToken;
      }
      if (action.payload.expiresAt) {
        state.tokenExpiresAt = action.payload.expiresAt;
      }
    },

    clearTokens: (state) => {
      state.accessToken = null;
      state.refreshToken = null;
      state.tokenExpiresAt = null;
    },

    // Login flow
    setLoginStep: (state, action: PayloadAction<AuthState["loginStep"]>) => {
      state.loginStep = action.payload;
    },

    setMfaRequired: (
      state,
      action: PayloadAction<{ required: boolean; method?: AuthState["mfaMethod"] }>
    ) => {
      state.mfaRequired = action.payload.required;
      state.mfaMethod = action.payload.method || null;
      if (action.payload.required) {
        state.loginStep = "mfa";
      }
    },

    // Registration flow
    setRegistrationStep: (state, action: PayloadAction<AuthState["registrationStep"]>) => {
      state.registrationStep = action.payload;
    },

    setPendingEmail: (state, action: PayloadAction<string | null>) => {
      state.pendingEmail = action.payload;
    },

    setVerificationCodeSent: (state, action: PayloadAction<boolean>) => {
      state.verificationCodeSent = action.payload;
    },

    // Password reset
    setPasswordResetRequested: (
      state,
      action: PayloadAction<{ requested: boolean; email?: string }>
    ) => {
      state.passwordResetRequested = action.payload.requested;
      state.passwordResetEmail = action.payload.email || null;
    },

    // OAuth
    setOAuthProvider: (state, action: PayloadAction<AuthProvider | null>) => {
      state.oauthProvider = action.payload;
    },

    setOAuthLoading: (state, action: PayloadAction<boolean>) => {
      state.oauthLoading = action.payload;
    },

    // Invitation
    setPendingInvitation: (state, action: PayloadAction<AuthState["pendingInvitation"]>) => {
      state.pendingInvitation = action.payload;
    },

    clearPendingInvitation: (state) => {
      state.pendingInvitation = null;
    },

    // User preferences
    updateUserPreferences: (state, action: PayloadAction<Partial<UserPreferences>>) => {
      if (state.user) {
        state.user.preferences = {
          ...state.user.preferences,
          ...action.payload,
        };
      }
    },

    // Full logout
    logout: (state) => {
      state.user = null;
      state.isAuthenticated = false;
      state.isLoading = false;
      state.error = null;
      state.accessToken = null;
      state.refreshToken = null;
      state.tokenExpiresAt = null;
      state.loginStep = "email";
      state.mfaRequired = false;
      state.mfaMethod = null;
      state.registrationStep = "email";
      state.pendingEmail = null;
      state.verificationCodeSent = false;
      state.passwordResetRequested = false;
      state.passwordResetEmail = null;
      state.oauthProvider = null;
      state.oauthLoading = false;
      state.pendingInvitation = null;
    },

    // Reset auth flow state (for navigation)
    resetAuthFlow: (state) => {
      state.loginStep = "email";
      state.mfaRequired = false;
      state.mfaMethod = null;
      state.registrationStep = "email";
      state.pendingEmail = null;
      state.verificationCodeSent = false;
      state.passwordResetRequested = false;
      state.passwordResetEmail = null;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // Manus compatibility actions
    builder.addCase("auth/setUserInfo", (state, action: PayloadAction<any>) => {
      state.user = action.payload ?? null;
      state.isAuthenticated = !!action.payload;
      state.isLoading = false;
      state.error = null;
    });
    builder.addCase("auth/setClientConfig", (state, action: PayloadAction<any>) => {
      state.clientConfig = action.payload ?? null;
    });
    builder.addCase("auth/setGlobalSettings", (state, action: PayloadAction<any>) => {
      state.globalSettings = action.payload ?? null;
    });
    builder.addCase("auth/setInvitationCodeList", (state, action: PayloadAction<any[]>) => {
      state.invitationCodeList = action.payload ?? [];
      state.invitationCodeListLoading = false;
    });
    builder.addCase(
      "auth/setInvitationCodeListLoading",
      (state, action: PayloadAction<boolean>) => {
        state.invitationCodeListLoading = action.payload;
      }
    );
  },
});

export const {
  setUser,
  updateUser,
  setLoading,
  setError,
  setTokens,
  clearTokens,
  setLoginStep,
  setMfaRequired,
  setRegistrationStep,
  setPendingEmail,
  setVerificationCodeSent,
  setPasswordResetRequested,
  setOAuthProvider,
  setOAuthLoading,
  setPendingInvitation,
  clearPendingInvitation,
  updateUserPreferences,
  logout,
  resetAuthFlow,
} = authSlice.actions;

export default authSlice.reducer;
