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
  // Manus-aligned keys
  modifying: boolean;
  avatarUploading: boolean;
  invitationCodeRedDotVisible: boolean;
  usageInfo: Record<string, unknown>;
  usageInfoReady: boolean;
  userRegion: Record<string, unknown>;
  creditAnimateInfo: unknown;
  refreshKey: string;
  profileCardVisible: boolean;
  shareHistoryCache: unknown;
  cookieOptIn: number;
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
  // Manus-aligned defaults
  modifying: false,
  avatarUploading: false,
  invitationCodeRedDotVisible: true,
  usageInfo: {},
  usageInfoReady: true,
  userRegion: {},
  creditAnimateInfo: null,
  refreshKey: "",
  profileCardVisible: false,
  shareHistoryCache: null,
  cookieOptIn: 1,
};

const authSlice = createSlice({
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

    // Manus-aligned reducers
    setModifying: (state, action: PayloadAction<boolean>) => {
      state.modifying = action.payload;
    },
    setAvatarUploading: (state, action: PayloadAction<boolean>) => {
      state.avatarUploading = action.payload;
    },
    setInvitationCodeRedDotVisible: (state, action: PayloadAction<boolean>) => {
      state.invitationCodeRedDotVisible = action.payload;
    },
    setUsageInfo: (state, action: PayloadAction<Record<string, unknown>>) => {
      state.usageInfo = action.payload;
    },
    setUsageInfoReady: (state, action: PayloadAction<boolean>) => {
      state.usageInfoReady = action.payload;
    },
    setUserRegion: (state, action: PayloadAction<Record<string, unknown>>) => {
      state.userRegion = action.payload;
    },
    setCreditAnimateInfo: (state, action: PayloadAction<unknown>) => {
      state.creditAnimateInfo = action.payload;
    },
    setRefreshKey: (state, action: PayloadAction<string>) => {
      state.refreshKey = action.payload;
    },
    setProfileCardVisible: (state, action: PayloadAction<boolean>) => {
      state.profileCardVisible = action.payload;
    },
    setShareHistoryCache: (state, action: PayloadAction<unknown>) => {
      state.shareHistoryCache = action.payload;
    },
    setCookieOptIn: (state, action: PayloadAction<number>) => {
      state.cookieOptIn = action.payload;
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
    builder.addCase("auth/setUserInfo", (state, action) => {
      const payload = (action as any).payload;
      state.user = payload ?? null;
      state.isAuthenticated = !!payload;
      state.isLoading = false;
      state.error = null;
    });
    builder.addCase("auth/setClientConfig", (state, action) => {
      state.clientConfig = (action as any).payload ?? null;
    });
    builder.addCase("auth/setGlobalSettings", (state, action) => {
      state.globalSettings = (action as any).payload ?? null;
    });
    builder.addCase("auth/setInvitationCodeList", (state, action) => {
      state.invitationCodeList = (action as any).payload ?? [];
      state.invitationCodeListLoading = false;
    });
    builder.addCase("auth/setInvitationCodeListLoading", (state, action) => {
      state.invitationCodeListLoading = (action as any).payload;
    });
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
  setModifying,
  setAvatarUploading,
  setInvitationCodeRedDotVisible,
  setUsageInfo,
  setUsageInfoReady,
  setUserRegion,
  setCreditAnimateInfo,
  setRefreshKey,
  setProfileCardVisible,
  setShareHistoryCache,
  setCookieOptIn,
} = authSlice.actions;

export default authSlice.reducer;
