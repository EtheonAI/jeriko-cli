"use client";

import { useCallback, useEffect } from "react";
import { useAppDispatch, useAppSelector } from "../hooks";
import {
  setUser,
  updateUser,
  setLoading,
  setError,
  setTokens,
  clearTokens,
  logout as logoutAction,
  setMfaRequired,
  setPendingEmail,
  setVerificationCodeSent,
  setPasswordResetRequested,
  setOAuthLoading,
  resetAuthFlow,
  type User,
  type UserPreferences,
} from "../slices/auth.slice";
import {
  signIn,
  signUp,
  signOut,
  useSession,
  getSession,
  forgetPassword,
  organization,
} from "@repo/auth/client";
import { wsConnect, wsDisconnect } from "../middleware/websocket.middleware";

/**
 * Auth Hook - Integrates better-auth with Redux auth slice
 *
 * Action Triggers:
 * - setUser: State only (from better-auth session)
 * - login: API Call (better-auth signIn)
 * - register: API Call (better-auth signUp)
 * - logout: API Call (better-auth signOut) + WebSocket disconnect
 * - refreshSession: API Call (better-auth getSession)
 * - forgotPassword: API Call (better-auth forgetPassword)
 * - socialLogin: API Call (better-auth signIn with provider)
 */
export function useAuthIntegration() {
  const dispatch = useAppDispatch();
  const { data: session, isPending, error } = useSession();
  const authState = useAppSelector((state) => state.auth);

  // Sync better-auth session with Redux store
  useEffect(() => {
    if (isPending) {
      dispatch(setLoading(true));
      return;
    }

    if (session?.user) {
      const user: User = {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name || null,
        image: session.user.image || null,
        role: "user", // Default role, can be extended
        emailVerified: session.user.emailVerified,
        createdAt: session.user.createdAt?.toISOString(),
      };
      dispatch(setUser(user));
      // Connect WebSocket when authenticated
      dispatch(wsConnect());
    } else {
      dispatch(setUser(null));
      // Disconnect WebSocket when not authenticated
      dispatch(wsDisconnect());
    }
  }, [session, isPending, dispatch]);

  // Handle auth errors
  useEffect(() => {
    if (error) {
      dispatch(setError(error.message || "Authentication error"));
    }
  }, [error, dispatch]);

  /**
   * Login with email/password
   * Trigger: API Call (better-auth)
   */
  const login = useCallback(
    async (email: string, password: string, rememberMe?: boolean) => {
      dispatch(setLoading(true));
      dispatch(setError(null));

      try {
        const result = await signIn.email({
          email,
          password,
          rememberMe: rememberMe ?? false,
        });

        if (result.error) {
          dispatch(setError(result.error.message || "Login failed"));
          return { success: false, error: result.error.message };
        }

        // Check if MFA is required (if better-auth supports it)
        if ((result.data as any)?.twoFactorRedirect) {
          dispatch(setMfaRequired({ required: true, method: "totp" }));
          return { success: true, mfaRequired: true };
        }

        return { success: true };
      } catch (err: any) {
        const message = err?.message || "Login failed";
        dispatch(setError(message));
        return { success: false, error: message };
      }
    },
    [dispatch]
  );

  /**
   * Register new account
   * Trigger: API Call (better-auth)
   */
  const register = useCallback(
    async (email: string, password: string, name?: string) => {
      dispatch(setLoading(true));
      dispatch(setError(null));

      try {
        const result = await signUp.email({
          email,
          password,
          name: name || email.split("@")[0],
        });

        if (result.error) {
          dispatch(setError(result.error.message || "Registration failed"));
          return { success: false, error: result.error.message };
        }

        dispatch(setPendingEmail(email));
        dispatch(setVerificationCodeSent(true));

        return { success: true, verificationRequired: true };
      } catch (err: any) {
        const message = err?.message || "Registration failed";
        dispatch(setError(message));
        return { success: false, error: message };
      }
    },
    [dispatch]
  );

  /**
   * Logout
   * Trigger: API Call (better-auth) + WebSocket disconnect
   */
  const logout = useCallback(async () => {
    dispatch(setLoading(true));

    try {
      // Disconnect WebSocket first
      dispatch(wsDisconnect());

      await signOut();
      dispatch(logoutAction());

      return { success: true };
    } catch (err: any) {
      // Still logout locally even if API fails
      dispatch(logoutAction());
      return { success: true };
    }
  }, [dispatch]);

  /**
   * Social login (Google, GitHub, etc.)
   * Trigger: API Call (better-auth OAuth)
   */
  const socialLogin = useCallback(
    async (provider: "google" | "github" | "microsoft") => {
      dispatch(setOAuthLoading(true));
      dispatch(setError(null));

      try {
        const result = await signIn.social({
          provider,
          callbackURL: window.location.origin + "/dashboard",
        });

        if (result.error) {
          dispatch(setError(result.error.message || "OAuth login failed"));
          dispatch(setOAuthLoading(false));
          return { success: false, error: result.error.message };
        }

        // OAuth redirects, so we don't need to do anything else
        return { success: true };
      } catch (err: any) {
        const message = err?.message || "OAuth login failed";
        dispatch(setError(message));
        dispatch(setOAuthLoading(false));
        return { success: false, error: message };
      }
    },
    [dispatch]
  );

  /**
   * Forgot password
   * Trigger: API Call
   */
  const forgotPassword = useCallback(
    async (email: string) => {
      dispatch(setLoading(true));
      dispatch(setError(null));

      try {
        const result = await forgetPassword({
          email,
          redirectTo: window.location.origin + "/reset-password",
        });

        if (result.error) {
          dispatch(setError(result.error.message));
          return { success: false, error: result.error.message };
        }

        dispatch(setPasswordResetRequested({ requested: true, email }));
        return { success: true };
      } catch (err: any) {
        const message = err?.message || "Failed to send reset email";
        dispatch(setError(message));
        return { success: false, error: message };
      }
    },
    [dispatch]
  );

  /**
   * Refresh session from server
   * Trigger: API Call (better-auth)
   */
  const refreshSession = useCallback(async () => {
    dispatch(setLoading(true));

    try {
      const result = await getSession();
      const sessionData = result && 'data' in result ? result.data : result;

      if (sessionData?.user) {
        const user: User = {
          id: sessionData.user.id,
          email: sessionData.user.email,
          name: sessionData.user.name || null,
          image: sessionData.user.image || null,
          role: "user",
          emailVerified: sessionData.user.emailVerified,
          createdAt: sessionData.user.createdAt?.toISOString(),
        };
        dispatch(setUser(user));
        return { success: true, user };
      } else {
        dispatch(setUser(null));
        return { success: false };
      }
    } catch (err: any) {
      dispatch(setError(err?.message || "Failed to refresh session"));
      return { success: false, error: err?.message };
    }
  }, [dispatch]);

  /**
   * Reset auth flow state
   * Trigger: State only
   */
  const resetFlow = useCallback(() => {
    dispatch(resetAuthFlow());
  }, [dispatch]);

  return {
    // State
    user: authState.user,
    isAuthenticated: authState.isAuthenticated,
    isLoading: authState.isLoading || isPending,
    error: authState.error,
    loginStep: authState.loginStep,
    mfaRequired: authState.mfaRequired,
    pendingEmail: authState.pendingEmail,
    oauthLoading: authState.oauthLoading,

    // Actions
    login,
    register,
    logout,
    socialLogin,
    forgotPassword,
    refreshSession,
    resetFlow,

    // Session from better-auth (for direct access)
    session,
  };
}

export default useAuthIntegration;
