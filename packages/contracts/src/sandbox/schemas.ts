/**
 * Sandbox Service Contracts
 *
 * Type-safe contracts for E2B sandbox management, code execution, browser control,
 * file operations, and session lifecycle.
 *
 * @module @repo/contracts/sandbox
 */

import { z } from "zod";

// ============================================================================
// Common Schemas
// ============================================================================

export const SandboxIdSchema = z.string().min(1, "Sandbox ID is required");
export const UserIdSchema = z.string().min(1, "User ID is required");
export const ExecutionIdSchema = z.string().min(1, "Execution ID is required");

export const SandboxStatusSchema = z.enum(["pending", "running", "stopped", "terminated", "error"]);

export const ExecutionStatusSchema = z.enum([
  "pending",
  "running",
  "completed",
  "failed",
  "timeout",
]);

// ============================================================================
// Create Sandbox
// ============================================================================

export const CreateSandboxConfigSchema = z.object({
  timeout: z.number().positive().optional(),
  memory: z.number().positive().optional(),
  env: z.record(z.string(), z.string()).optional(),
});

export const CreateSandboxRequestSchema = z.object({
  projectId: z.string().optional(),
  template: z.string().optional(),
  config: CreateSandboxConfigSchema.optional(),
});

export const CreateSandboxResponseSchema = z.object({
  id: SandboxIdSchema,
  status: z.literal("running"),
  e2bSandboxId: z.string(),
  hostname: z.string(),
  template: z.string(),
  vncUrl: z.string().url(),
});

export type CreateSandboxRequest = z.infer<typeof CreateSandboxRequestSchema>;
export type CreateSandboxResponse = z.infer<typeof CreateSandboxResponseSchema>;

// ============================================================================
// Get Sandbox
// ============================================================================

export const GetSandboxParamsSchema = z.object({
  id: SandboxIdSchema,
});

export const SandboxSchema = z.object({
  id: SandboxIdSchema,
  userId: UserIdSchema,
  projectId: z.string().nullable(),
  name: z.string(),
  type: z.string(),
  status: SandboxStatusSchema,
  templateId: z.string(),
  config: z.record(z.unknown()),
  e2bSandboxId: z.string().nullable(),
  hostname: z.string().nullable(),
  startedAt: z.date().nullable(),
  expiresAt: z.date().nullable(),
  lastActivityAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type GetSandboxParams = z.infer<typeof GetSandboxParamsSchema>;
export type Sandbox = z.infer<typeof SandboxSchema>;

// ============================================================================
// List Sandboxes
// ============================================================================

export const ListSandboxesParamsSchema = z.object({
  userId: UserIdSchema,
});

export const ListSandboxesResponseSchema = z.object({
  sandboxes: z.array(SandboxSchema),
});

export type ListSandboxesParams = z.infer<typeof ListSandboxesParamsSchema>;
export type ListSandboxesResponse = z.infer<typeof ListSandboxesResponseSchema>;

// ============================================================================
// Execute Code
// ============================================================================

export const ExecuteCodeRequestSchema = z.object({
  code: z.string().min(1, "Code is required"),
  language: z.string().optional(),
  timeout: z.number().positive().optional(),
});

export const ExecutionErrorSchema = z.object({
  name: z.string(),
  value: z.string(),
  traceback: z.string(),
});

export const ExecuteCodeResponseSchema = z.object({
  id: ExecutionIdSchema,
  status: ExecutionStatusSchema,
  stdout: z.string(),
  stderr: z.string(),
  exitCode: z.number(),
  error: ExecutionErrorSchema.nullable(),
  results: z.array(z.unknown()),
  text: z.string(),
  executionTimeMs: z.number(),
});

export type ExecuteCodeRequest = z.infer<typeof ExecuteCodeRequestSchema>;
export type ExecutionError = z.infer<typeof ExecutionErrorSchema>;
export type ExecuteCodeResponse = z.infer<typeof ExecuteCodeResponseSchema>;

// ============================================================================
// Get Execution
// ============================================================================

export const GetExecutionParamsSchema = z.object({
  id: ExecutionIdSchema,
});

export const GetExecutionResponseSchema = z.object({
  id: ExecutionIdSchema,
  status: ExecutionStatusSchema,
  stdout: z.string(),
  stderr: z.string(),
  exitCode: z.number(),
  error: z.string().nullable(),
  result: z.unknown().nullable(),
  executionTimeMs: z.number().nullable(),
});

export type GetExecutionParams = z.infer<typeof GetExecutionParamsSchema>;
export type GetExecutionResponse = z.infer<typeof GetExecutionResponseSchema>;

// ============================================================================
// Shell Command
// ============================================================================

export const ShellCommandRequestSchema = z.object({
  command: z.string().min(1, "Command is required"),
  timeout: z.number().positive().optional(),
});

export const ShellCommandResponseSchema = z.object({
  id: ExecutionIdSchema,
  stdout: z.string(),
  stderr: z.string(),
  exitCode: z.number(),
  executionTimeMs: z.number(),
});

export type ShellCommandRequest = z.infer<typeof ShellCommandRequestSchema>;
export type ShellCommandResponse = z.infer<typeof ShellCommandResponseSchema>;

// ============================================================================
// Browser Control
// ============================================================================

export const BrowserActionSchema = z.enum([
  "navigate",
  "view",
  "click",
  "input",
  "scroll",
  "scroll_up",
  "scroll_down",
  "key_press",
  "press_key",
  "move_mouse",
  "select_option",
  "console_exec",
  "console_view",
  "screenshot",
  "take_screenshot",
  "restart",
  "health",
]);

export const BrowserActionRequestSchema = z.object({
  action: BrowserActionSchema,
  params: z.record(z.string(), z.unknown()).optional(),
});

export const BrowserActionResponseSchema = z.union([
  z.object({
    output: z.string(),
    raw: z.literal(true),
  }),
  z.record(z.unknown()),
]);

export type BrowserAction = z.infer<typeof BrowserActionSchema>;
export type BrowserActionRequest = z.infer<typeof BrowserActionRequestSchema>;
export type BrowserActionResponse = z.infer<typeof BrowserActionResponseSchema>;

// ============================================================================
// File Operations
// ============================================================================

export const WriteFileRequestSchema = z.object({
  path: z.string().min(1, "File path is required"),
  content: z.string(),
});

export const WriteFileResponseSchema = z.object({
  path: z.string(),
  written: z.literal(true),
});

export const ReadFileQuerySchema = z.object({
  path: z.string().min(1, "File path is required"),
});

export const ReadFileResponseSchema = z.object({
  path: z.string(),
  content: z.string(),
});

export const ListFilesQuerySchema = z.object({
  path: z.string().optional(),
});

export const FileEntrySchema = z.object({
  name: z.string(),
  path: z.string(),
  type: z.enum(["file", "dir"]).optional(),
  size: z.number().optional(),
  isDirectory: z.boolean().optional(),
});

export const ListFilesResponseSchema = z.object({
  files: z.array(FileEntrySchema),
});

export type WriteFileRequest = z.infer<typeof WriteFileRequestSchema>;
export type WriteFileResponse = z.infer<typeof WriteFileResponseSchema>;
export type ReadFileQuery = z.infer<typeof ReadFileQuerySchema>;
export type ReadFileResponse = z.infer<typeof ReadFileResponseSchema>;
export type ListFilesQuery = z.infer<typeof ListFilesQuerySchema>;
export type FileEntry = z.infer<typeof FileEntrySchema>;
export type ListFilesResponse = z.infer<typeof ListFilesResponseSchema>;

// ============================================================================
// Stop/Delete Sandbox
// ============================================================================

export const StopSandboxResponseSchema = z.object({
  id: SandboxIdSchema,
  status: z.literal("stopped"),
});

export const DeleteSandboxResponseSchema = z.object({
  deleted: z.literal(true),
});

export type StopSandboxResponse = z.infer<typeof StopSandboxResponseSchema>;
export type DeleteSandboxResponse = z.infer<typeof DeleteSandboxResponseSchema>;

// ============================================================================
// Stream URLs
// ============================================================================

export const BrowserStreamResponseSchema = z.object({
  streamUrl: z.string().url(),
  sandboxId: SandboxIdSchema,
});

export const TerminalStreamResponseSchema = z.object({
  streamUrl: z.string(),
  sandboxId: SandboxIdSchema,
});

export type BrowserStreamResponse = z.infer<typeof BrowserStreamResponseSchema>;
export type TerminalStreamResponse = z.infer<typeof TerminalStreamResponseSchema>;

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validate that a browser action is allowed
 */
export function isAllowedBrowserAction(action: string): boolean {
  return BrowserActionSchema.safeParse(action).success;
}

/**
 * Validate file path is safe (no path traversal)
 */
export function isSafeFilePath(path: string): boolean {
  // Reject paths with .. or absolute paths outside /home/user
  if (path.includes("..")) return false;
  if (path.startsWith("/") && !path.startsWith("/home/user")) return false;
  return true;
}
