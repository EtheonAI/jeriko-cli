// Main exports
export * from "./types/index.js";
export * from "./logger/index.js";
export * from "./redis/index.js";
export * from "./auth/index.js";
export * from "./webhooks/index.js";

// Re-export commonly used utilities
export { createId } from "@paralleldrive/cuid2";
export { z } from "zod";

// Environment helpers
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getEnv(name: string, defaultValue: string): string {
  return process.env[name] || defaultValue;
}

// Service health check response
export interface HealthCheckResponse {
  status: "healthy" | "unhealthy";
  service: string;
  version: string;
  timestamp: string;
  checks: {
    name: string;
    status: "pass" | "fail";
    message?: string;
  }[];
}

export function createHealthCheck(
  service: string,
  version: string,
  checks: HealthCheckResponse["checks"]
): HealthCheckResponse {
  const allPass = checks.every((c) => c.status === "pass");
  return {
    status: allPass ? "healthy" : "unhealthy",
    service,
    version,
    timestamp: new Date().toISOString(),
    checks,
  };
}

// API response helpers
import type { ApiResponse, ApiError } from "./types/index.js";

export function successResponse<T>(data: T, requestId: string): ApiResponse<T> {
  return {
    data,
    meta: {
      requestId,
      timestamp: new Date().toISOString(),
    },
    error: null,
  };
}

export function errorResponse(error: ApiError, requestId: string): ApiResponse<null> {
  return {
    data: null,
    meta: {
      requestId,
      timestamp: new Date().toISOString(),
    },
    error,
  };
}

// Common error codes
export const ErrorCodes = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  RATE_LIMITED: "RATE_LIMITED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
} as const;
