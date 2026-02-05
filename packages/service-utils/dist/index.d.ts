import { ApiResponse, ApiError } from "./types/index.js";
export {
  AgentConfig,
  AgentModel,
  AgentModelSchema,
  Device,
  DeviceCapability,
  DeviceCapabilitySchema,
  DeviceStatus,
  DeviceStatusSchema,
  DeviceType,
  DeviceTypeSchema,
  Message,
  MessageRole,
  MessageRoleSchema,
  PaginatedResponse,
  PaginationParams,
  ServiceEvent,
  Task,
  TaskPriority,
  TaskPrioritySchema,
  TaskStatus,
  TaskStatusSchema,
  ToolCall,
  WebsiteFramework,
  WebsiteFrameworkSchema,
  WebsiteProject,
  WebsiteStatus,
  WebsiteStatusSchema,
} from "./types/index.js";
export { Logger, LoggerOptions, createLogger } from "./logger/index.js";
export {
  RedisConfig,
  cacheDel,
  cacheGet,
  cacheSet,
  closeRedis,
  getRedisClient,
  getRedisConfig,
  getRedisPubClient,
  getRedisSubClient,
  publish,
  subscribe,
} from "./redis/index.js";
export {
  ApiKeyPayload,
  AuthContext,
  JWTPayload,
  JWTPayloadSchema,
  createToken,
  extractAuth,
  validateApiKey,
  verifyToken,
} from "./auth/index.js";
export { createId } from "@paralleldrive/cuid2";
export { z } from "zod";
import "pino";

declare function dispatchWebhookEvent(event: {
  eventType: string;
  resourceType: string;
  resourceId: string;
  payload: Record<string, unknown>;
  userId?: string;
  organizationId?: string;
}): Promise<void>;

declare function requireEnv(name: string): string;
declare function getEnv(name: string, defaultValue: string): string;
interface HealthCheckResponse {
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
declare function createHealthCheck(
  service: string,
  version: string,
  checks: HealthCheckResponse["checks"]
): HealthCheckResponse;

declare function successResponse<T>(data: T, requestId: string): ApiResponse<T>;
declare function errorResponse(error: ApiError, requestId: string): ApiResponse<null>;
declare const ErrorCodes: {
  readonly VALIDATION_ERROR: "VALIDATION_ERROR";
  readonly UNAUTHORIZED: "UNAUTHORIZED";
  readonly FORBIDDEN: "FORBIDDEN";
  readonly NOT_FOUND: "NOT_FOUND";
  readonly RATE_LIMITED: "RATE_LIMITED";
  readonly INTERNAL_ERROR: "INTERNAL_ERROR";
  readonly SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE";
};

export {
  ApiError,
  ApiResponse,
  ErrorCodes,
  type HealthCheckResponse,
  createHealthCheck,
  dispatchWebhookEvent,
  errorResponse,
  getEnv,
  requireEnv,
  successResponse,
};
