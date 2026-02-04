import { z } from 'zod';

interface ApiResponse<T> {
    data: T | null;
    meta: {
        requestId: string;
        timestamp: string;
    };
    error: ApiError | null;
}
interface ApiError {
    code: string;
    message: string;
    details?: Record<string, unknown>[];
}
declare const TaskStatusSchema: z.ZodEnum<["pending", "running", "paused", "completed", "failed", "cancelled"]>;
type TaskStatus = z.infer<typeof TaskStatusSchema>;
declare const TaskPrioritySchema: z.ZodEnum<["low", "normal", "high", "urgent"]>;
type TaskPriority = z.infer<typeof TaskPrioritySchema>;
interface Task {
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
declare const DeviceTypeSchema: z.ZodEnum<["pc", "iot", "mobile", "browser"]>;
type DeviceType = z.infer<typeof DeviceTypeSchema>;
declare const DeviceStatusSchema: z.ZodEnum<["online", "offline", "busy", "error"]>;
type DeviceStatus = z.infer<typeof DeviceStatusSchema>;
declare const DeviceCapabilitySchema: z.ZodEnum<["terminal", "filesystem", "browser", "screen", "audio", "gpio", "sensor", "actuator"]>;
type DeviceCapability = z.infer<typeof DeviceCapabilitySchema>;
interface Device {
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
declare const AgentModelSchema: z.ZodEnum<["claude-3-5-sonnet", "claude-3-opus", "gpt-4o", "gpt-4o-mini"]>;
type AgentModel = z.infer<typeof AgentModelSchema>;
interface AgentConfig {
    model: AgentModel;
    temperature: number;
    maxTokens: number;
    systemPrompt: string;
    tools: string[];
}
declare const MessageRoleSchema: z.ZodEnum<["user", "assistant", "system", "tool"]>;
type MessageRole = z.infer<typeof MessageRoleSchema>;
interface Message {
    id: string;
    sessionId: string;
    role: MessageRole;
    content: string;
    toolCalls?: ToolCall[];
    metadata: Record<string, unknown>;
    createdAt: Date;
}
interface ToolCall {
    id: string;
    name: string;
    arguments: Record<string, unknown>;
    result?: unknown;
}
declare const WebsiteFrameworkSchema: z.ZodEnum<["nextjs", "react", "vue", "svelte", "astro"]>;
type WebsiteFramework = z.infer<typeof WebsiteFrameworkSchema>;
declare const WebsiteStatusSchema: z.ZodEnum<["draft", "building", "ready", "deployed", "error"]>;
type WebsiteStatus = z.infer<typeof WebsiteStatusSchema>;
interface WebsiteProject {
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
interface ServiceEvent<T = unknown> {
    id: string;
    type: string;
    source: string;
    timestamp: string;
    data: T;
    metadata?: Record<string, unknown>;
}
interface PaginationParams {
    page: number;
    limit: number;
    cursor?: string;
}
interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
    nextCursor?: string;
}

export { type AgentConfig, type AgentModel, AgentModelSchema, type ApiError, type ApiResponse, type Device, type DeviceCapability, DeviceCapabilitySchema, type DeviceStatus, DeviceStatusSchema, type DeviceType, DeviceTypeSchema, type Message, type MessageRole, MessageRoleSchema, type PaginatedResponse, type PaginationParams, type ServiceEvent, type Task, type TaskPriority, TaskPrioritySchema, type TaskStatus, TaskStatusSchema, type ToolCall, type WebsiteFramework, WebsiteFrameworkSchema, type WebsiteProject, type WebsiteStatus, WebsiteStatusSchema };
