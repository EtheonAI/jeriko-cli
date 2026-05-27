import { z } from "zod";

// Common API response types
export interface ApiResponse<T> {
  data: T | null;
  meta: {
    requestId: string;
    timestamp: string;
  };
  error: ApiError | null;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>[];
}

// Task types
export const TaskStatusSchema = z.enum([
  "pending",
  "running",
  "paused",
  "completed",
  "failed",
  "cancelled",
]);
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

export const TaskPrioritySchema = z.enum(["low", "normal", "high", "urgent"]);
export type TaskPriority = z.infer<typeof TaskPrioritySchema>;

export interface Task {
  id: string;
  userId: string;
  sessionId: string;
  title: string | null;
  prompt: string;
  status: TaskStatus;
  priority: TaskPriority;
  targetDeviceId: string | null;
  targetPlatform: string | null;
  requiredCapabilities: string[];
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}

// Device types
export const DeviceTypeSchema = z.enum(["pc", "iot", "mobile", "browser"]);
export type DeviceType = z.infer<typeof DeviceTypeSchema>;

export const DeviceStatusSchema = z.enum([
  "online",
  "offline",
  "busy",
  "error",
]);
export type DeviceStatus = z.infer<typeof DeviceStatusSchema>;

export const DeviceCapabilitySchema = z.enum([
  "terminal",
  "filesystem",
  "browser",
  "screen",
  "audio",
  "gpio",
  "sensor",
  "actuator",
]);
export type DeviceCapability = z.infer<typeof DeviceCapabilitySchema>;

export interface Device {
  id: string;
  userId: string;
  name: string;
  type: DeviceType;
  status: DeviceStatus;
  capabilities: DeviceCapability[];
  platform: string;
  version: string;
  lastSeenAt: Date;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

// Agent types
export const AgentModelSchema = z.enum([
  "claude-3-5-sonnet",
  "claude-3-opus",
  "gpt-4o",
  "gpt-4o-mini",
]);
export type AgentModel = z.infer<typeof AgentModelSchema>;

export interface AgentConfig {
  model: AgentModel;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  tools: string[];
}

// Message types
export const MessageRoleSchema = z.enum(["user", "assistant", "system", "tool"]);
export type MessageRole = z.infer<typeof MessageRoleSchema>;

export interface Message {
  id: string;
  sessionId: string;
  role: MessageRole;
  content: string;
  toolCalls?: ToolCall[];
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result?: unknown;
}

// Website types
export const WebsiteFrameworkSchema = z.enum([
  "nextjs",
  "react",
  "vue",
  "svelte",
  "astro",
]);
export type WebsiteFramework = z.infer<typeof WebsiteFrameworkSchema>;

export const WebsiteStatusSchema = z.enum([
  "draft",
  "building",
  "ready",
  "deployed",
  "error",
]);
export type WebsiteStatus = z.infer<typeof WebsiteStatusSchema>;

export interface WebsiteProject {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  framework: WebsiteFramework;
  previewUrl: string | null;
  productionUrl: string | null;
  customDomain: string | null;
  status: WebsiteStatus;
  settings: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

// Event types for inter-service communication
export interface ServiceEvent<T = unknown> {
  id: string;
  type: string;
  source: string;
  timestamp: string;
  data: T;
  metadata?: Record<string, unknown>;
}

// Pagination
export interface PaginationParams {
  page: number;
  limit: number;
  cursor?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
  nextCursor?: string;
}
