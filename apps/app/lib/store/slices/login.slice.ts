import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

/**
 * Login Slice
 * Manages login flow state (separate from auth slice)
 */

export type LoginStep =
  | "emailCheck"
  | "emailLogin"
  | "emailRegister"
  | "verifyCode"
  | "resetPassword"
  | "setPassword"
  | "mfaVerify"
  | "complete";

export type LoginPlatform = "google" | "github" | "microsoft" | "apple" | null;

export interface CaptchaData {
  id: string;
  imageUrl: string;
  expiresAt: string;
}

export interface TeamInvitationInfo {
  teamId: string;
  teamName: string;
  inviterName: string;
  inviterEmail: string;
  role: string;
  expiresAt: string;
}

export interface InvitationInfo {
  code: string;
  type: string;
  expiresAt: string;
}

export interface EduInfo {
  institution: string;
  email: string;
  verified: boolean;
}

export interface LoginState {
  // Current step
  step: LoginStep;

  // Email
  email: string;
  emailError: string;

  // Password
  password: string;
  passwordError: string;
  confirmPassword: string;
  confirmPasswordError: string;

  // Captcha
  captchaData: CaptchaData | null;
  captchaValue: string;
  captchaError: string;

  // Temp token (for multi-step flows)
  tempToken: string;

  // Loading states
  loadingEmailCheck: boolean;
  loadingEmailLogin: boolean;
  loadingEmailRegister: boolean;
  loadingEmailCodeCheck: boolean;
  loadingPasswordReset: boolean;
  loadingOAuth: boolean;

  // OAuth
  loginPlatform: LoginPlatform;

  // Verification code
  verifyCode: string;
  verifyCodeError: string;
  verifyCodeTimeout: number;
  lastSendTime: number;

  // MFA
  mfaCode: string;
  mfaError: string;
  mfaBackupCode: string;

  // UI
  focused: boolean;
  showPassword: boolean;

  // Invitation/team info
  teamInvitationInfo: TeamInvitationInfo | null;
  invitationInfo: InvitationInfo | null;
  eduInfo: EduInfo | null;

  // Remember me
  rememberMe: boolean;

  // Error
  generalError: string | null;
}

const initialState: LoginState = {
  step: "emailCheck",
  email: "",
  emailError: "",
  password: "",
  passwordError: "",
  confirmPassword: "",
  confirmPasswordError: "",
  captchaData: null,
  captchaValue: "",
  captchaError: "",
  tempToken: "",
  loadingEmailCheck: false,
  loadingEmailLogin: false,
  loadingEmailRegister: false,
  loadingEmailCodeCheck: false,
  loadingPasswordReset: false,
  loadingOAuth: false,
  loginPlatform: null,
  verifyCode: "",
  verifyCodeError: "",
  verifyCodeTimeout: 60,
  lastSendTime: 0,
  mfaCode: "",
  mfaError: "",
  mfaBackupCode: "",
  focused: false,
  showPassword: false,
  teamInvitationInfo: null,
  invitationInfo: null,
  eduInfo: null,
  rememberMe: false,
  generalError: null,
};

export const loginSlice = createSlice({
  name: "login",
  initialState,
  reducers: {
    // Step
    setStep: (state, action: PayloadAction<LoginStep>) => {
      state.step = action.payload;
      state.generalError = null;
    },

    // Email
    setEmail: (state, action: PayloadAction<string>) => {
      state.email = action.payload;
      state.emailError = "";
    },

    setEmailError: (state, action: PayloadAction<string>) => {
      state.emailError = action.payload;
    },

    // Password
    setPassword: (state, action: PayloadAction<string>) => {
      state.password = action.payload;
      state.passwordError = "";
    },

    setPasswordError: (state, action: PayloadAction<string>) => {
      state.passwordError = action.payload;
    },

    setConfirmPassword: (state, action: PayloadAction<string>) => {
      state.confirmPassword = action.payload;
      state.confirmPasswordError = "";
    },

    setConfirmPasswordError: (state, action: PayloadAction<string>) => {
      state.confirmPasswordError = action.payload;
    },

    toggleShowPassword: (state) => {
      state.showPassword = !state.showPassword;
    },

    // Captcha
    setCaptchaData: (state, action: PayloadAction<CaptchaData | null>) => {
      state.captchaData = action.payload;
      state.captchaValue = "";
      state.captchaError = "";
    },

    setCaptchaValue: (state, action: PayloadAction<string>) => {
      state.captchaValue = action.payload;
      state.captchaError = "";
    },

    setCaptchaError: (state, action: PayloadAction<string>) => {
      state.captchaError = action.payload;
    },

    // Temp token
    setTempToken: (state, action: PayloadAction<string>) => {
      state.tempToken = action.payload;
    },

    // Loading states
    setLoadingEmailCheck: (state, action: PayloadAction<boolean>) => {
      state.loadingEmailCheck = action.payload;
    },

    setLoadingEmailLogin: (state, action: PayloadAction<boolean>) => {
      state.loadingEmailLogin = action.payload;
    },

    setLoadingEmailRegister: (state, action: PayloadAction<boolean>) => {
      state.loadingEmailRegister = action.payload;
    },

    setLoadingEmailCodeCheck: (state, action: PayloadAction<boolean>) => {
      state.loadingEmailCodeCheck = action.payload;
    },

    setLoadingPasswordReset: (state, action: PayloadAction<boolean>) => {
      state.loadingPasswordReset = action.payload;
    },

    setLoadingOAuth: (state, action: PayloadAction<boolean>) => {
      state.loadingOAuth = action.payload;
    },

    // OAuth
    setLoginPlatform: (state, action: PayloadAction<LoginPlatform>) => {
      state.loginPlatform = action.payload;
      if (action.payload) {
        state.loadingOAuth = true;
      }
    },

    // Verification code
    setVerifyCode: (state, action: PayloadAction<string>) => {
      state.verifyCode = action.payload;
      state.verifyCodeError = "";
    },

    setVerifyCodeError: (state, action: PayloadAction<string>) => {
      state.verifyCodeError = action.payload;
    },

    setVerifyCodeTimeout: (state, action: PayloadAction<number>) => {
      state.verifyCodeTimeout = action.payload;
    },

    decrementVerifyCodeTimeout: (state) => {
      if (state.verifyCodeTimeout > 0) {
        state.verifyCodeTimeout -= 1;
      }
    },

    setLastSendTime: (state, action: PayloadAction<number>) => {
      state.lastSendTime = action.payload;
      state.verifyCodeTimeout = 60;
    },

    // MFA
    setMfaCode: (state, action: PayloadAction<string>) => {
      state.mfaCode = action.payload;
      state.mfaError = "";
    },

    setMfaError: (state, action: PayloadAction<string>) => {
      state.mfaError = action.payload;
    },

    setMfaBackupCode: (state, action: PayloadAction<string>) => {
      state.mfaBackupCode = action.payload;
    },

    // UI
    setFocused: (state, action: PayloadAction<boolean>) => {
      state.focused = action.payload;
    },

    // Invitation info
    setTeamInvitationInfo: (
      state,
      action: PayloadAction<TeamInvitationInfo | null>
    ) => {
      state.teamInvitationInfo = action.payload;
    },

    setInvitationInfo: (state, action: PayloadAction<InvitationInfo | null>) => {
      state.invitationInfo = action.payload;
    },

    setEduInfo: (state, action: PayloadAction<EduInfo | null>) => {
      state.eduInfo = action.payload;
    },

    // Remember me
    setRememberMe: (state, action: PayloadAction<boolean>) => {
      state.rememberMe = action.payload;
    },

    // General error
    setGeneralError: (state, action: PayloadAction<string | null>) => {
      state.generalError = action.payload;
    },

    // Clear errors
    clearErrors: (state) => {
      state.emailError = "";
      state.passwordError = "";
      state.confirmPasswordError = "";
      state.captchaError = "";
      state.verifyCodeError = "";
      state.mfaError = "";
      state.generalError = null;
    },

    // Clear all loading
    clearAllLoading: (state) => {
      state.loadingEmailCheck = false;
      state.loadingEmailLogin = false;
      state.loadingEmailRegister = false;
      state.loadingEmailCodeCheck = false;
      state.loadingPasswordReset = false;
      state.loadingOAuth = false;
    },

    // Reset
    resetLogin: (state) => {
      Object.assign(state, initialState);
    },

    // Reset to email check (go back)
    resetToEmailCheck: (state) => {
      state.step = "emailCheck";
      state.password = "";
      state.passwordError = "";
      state.verifyCode = "";
      state.verifyCodeError = "";
      state.mfaCode = "";
      state.mfaError = "";
      state.tempToken = "";
      state.generalError = null;
    },
  },
});

export const {
  setStep,
  setEmail,
  setEmailError,
  setPassword,
  setPasswordError,
  setConfirmPassword,
  setConfirmPasswordError,
  toggleShowPassword,
  setCaptchaData,
  setCaptchaValue,
  setCaptchaError,
  setTempToken,
  setLoadingEmailCheck,
  setLoadingEmailLogin,
  setLoadingEmailRegister,
  setLoadingEmailCodeCheck,
  setLoadingPasswordReset,
  setLoadingOAuth,
  setLoginPlatform,
  setVerifyCode,
  setVerifyCodeError,
  setVerifyCodeTimeout,
  decrementVerifyCodeTimeout,
  setLastSendTime,
  setMfaCode,
  setMfaError,
  setMfaBackupCode,
  setFocused,
  setTeamInvitationInfo,
  setInvitationInfo,
  setEduInfo,
  setRememberMe,
  setGeneralError,
  clearErrors,
  clearAllLoading,
  resetLogin,
  resetToEmailCheck,
} = loginSlice.actions;

export default loginSlice.reducer;
