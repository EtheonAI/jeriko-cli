"use client";

import { useCallback, useEffect, useRef } from "react";
import { useAppDispatch, useAppSelector } from "../hooks";
import {
  setUser,
  updateUser,
  updateUserPreferences,
  setLoading,
  setError,
  type User,
  type UserPreferences,
} from "../slices/auth.slice";
import { getTrpcClient } from "@/lib/trpc/vanilla";

function serializeDates<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (obj instanceof Date) return obj.toISOString() as unknown as T;
  if (Array.isArray(obj)) return obj.map(serializeDates) as unknown as T;
  if (typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      result[key] = serializeDates(value);
    }
    return result as T;
  }
  return obj;
}

export function useUserData({ autoFetch = false }: { autoFetch?: boolean } = {}) {
  const dispatch = useAppDispatch();
  const auth = useAppSelector((state) => state.auth);
  const hasFetchedRef = useRef(false);

  const fetchProfile = useCallback(async () => {
    dispatch(setLoading(true));
    try {
      const profile = await getTrpcClient().user.getProfile.query();
      if (profile) {
        dispatch(
          setUser(
            serializeDates({
              id: (profile as any).id,
              email: (profile as any).email,
              name: (profile as any).name,
              image: (profile as any).image,
              role: (profile as any).role ?? "user",
              emailVerified: (profile as any).emailVerified,
              createdAt: (profile as any).createdAt,
            }) as User
          )
        );
      }
      hasFetchedRef.current = true;
    } catch (err: any) {
      dispatch(setError(err?.message || "Failed to load profile"));
    }
  }, [dispatch]);

  const fetchPreferences = useCallback(async () => {
    try {
      const prefs = await getTrpcClient().user.getPreferences.query();
      if (prefs) {
        dispatch(updateUserPreferences(serializeDates(prefs) as Partial<UserPreferences>));
      }
    } catch {
      // Preferences are supplementary
    }
  }, [dispatch]);

  const updateProfile = useCallback(
    async (params: { name?: string; image?: string }) => {
      // Optimistic
      dispatch(updateUser(params));
      try {
        await getTrpcClient().user.updateProfile.mutate(params);
      } catch {
        await fetchProfile();
      }
    },
    [dispatch, fetchProfile]
  );

  const updatePreferences = useCallback(
    async (prefs: Partial<UserPreferences>) => {
      // Optimistic
      dispatch(updateUserPreferences(prefs));
      try {
        await getTrpcClient().user.updatePreferences.mutate(prefs as any);
      } catch {
        await fetchPreferences();
      }
    },
    [dispatch, fetchPreferences]
  );

  const changePassword = useCallback(
    async (params: { currentPassword: string; newPassword: string }) => {
      return getTrpcClient().user.changePassword.mutate(params);
    },
    []
  );

  const deleteAccount = useCallback(async () => {
    return getTrpcClient().user.deleteAccount.mutate();
  }, []);

  const exportData = useCallback(async () => {
    return getTrpcClient().user.exportData.mutate();
  }, []);

  const clearChatHistory = useCallback(async () => {
    return getTrpcClient().user.clearChatHistory.mutate();
  }, []);

  const clearFiles = useCallback(async () => {
    return getTrpcClient().user.clearFiles.mutate();
  }, []);

  useEffect(() => {
    if (!autoFetch || hasFetchedRef.current) return;
    if (auth.user !== null) {
      hasFetchedRef.current = true;
      return;
    }
    hasFetchedRef.current = true;
    fetchProfile();
  }, [autoFetch, auth.user, fetchProfile]);

  return {
    user: auth.user,
    isAuthenticated: auth.isAuthenticated,
    isLoading: auth.isLoading,
    error: auth.error,
    // Fetch
    fetchProfile,
    fetchPreferences,
    // Mutations
    updateProfile,
    updatePreferences,
    changePassword,
    deleteAccount,
    exportData,
    clearChatHistory,
    clearFiles,
  };
}
