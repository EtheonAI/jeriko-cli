// src/types/index.ts
import { z } from "zod";
var TaskStatusSchema = z.enum([
  "pending",
  "running",
  "paused",
  "completed",
  "failed",
  "cancelled"
]);
var TaskPrioritySchema = z.enum(["low", "normal", "high", "urgent"]);
var DeviceTypeSchema = z.enum(["pc", "iot", "mobile", "browser"]);
var DeviceStatusSchema = z.enum([
  "online",
  "offline",
  "busy",
  "error"
]);
var DeviceCapabilitySchema = z.enum([
  "terminal",
  "filesystem",
  "browser",
  "screen",
  "audio",
  "gpio",
  "sensor",
  "actuator"
]);
var AgentModelSchema = z.enum([
  "claude-3-5-sonnet",
  "claude-3-opus",
  "gpt-4o",
  "gpt-4o-mini"
]);
var MessageRoleSchema = z.enum(["user", "assistant", "system", "tool"]);
var WebsiteFrameworkSchema = z.enum([
  "nextjs",
  "react",
  "vue",
  "svelte",
  "astro"
]);
var WebsiteStatusSchema = z.enum([
  "draft",
  "building",
  "ready",
  "deployed",
  "error"
]);
export {
  AgentModelSchema,
  DeviceCapabilitySchema,
  DeviceStatusSchema,
  DeviceTypeSchema,
  MessageRoleSchema,
  TaskPrioritySchema,
  TaskStatusSchema,
  WebsiteFrameworkSchema,
  WebsiteStatusSchema
};
//# sourceMappingURL=index.js.map