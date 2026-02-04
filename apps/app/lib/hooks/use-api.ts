"use client";

import { useState, useCallback } from "react";
import { apiClient, type ApiResponse } from "../api";

interface UseApiOptions {
  onSuccess?: (data: unknown) => void;
  onError?: (error: { code: string; message: string }) => void;
}

export function useApi<T>(options: UseApiOptions = {}) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const execute = useCallback(
    async (apiCall: () => Promise<ApiResponse<T>>) => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await apiCall();

        if (response.error) {
          setError(response.error);
          options.onError?.(response.error);
          return null;
        }

        setData(response.data);
        options.onSuccess?.(response.data);
        return response.data;
      } catch (err) {
        const error = {
          code: "UNEXPECTED_ERROR",
          message: err instanceof Error ? err.message : "An unexpected error occurred",
        };
        setError(error);
        options.onError?.(error);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [options]
  );

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setIsLoading(false);
  }, []);

  return {
    data,
    error,
    isLoading,
    execute,
    reset,
  };
}

// Convenience hooks for common API calls
export function useHealth() {
  const api = useApi<{ status: string }>();

  const checkHealth = useCallback(() => {
    return api.execute(() => apiClient.health());
  }, [api]);

  return { ...api, checkHealth };
}

export function useProjects(userId: string) {
  const api = useApi<{ projects: unknown[] }>();

  const fetchProjects = useCallback(() => {
    return api.execute(() => apiClient.listProjects(userId));
  }, [api, userId]);

  return { ...api, fetchProjects };
}

export function useCredits(userId: string) {
  const api = useApi<{ balance: number; used: number }>();

  const fetchCredits = useCallback(() => {
    return api.execute(() => apiClient.getCredits(userId));
  }, [api, userId]);

  return { ...api, fetchCredits };
}
