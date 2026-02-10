/**
 * Tool Definition Schemas - Agent Service Tools
 *
 * Schemas for tool definitions and inputs used by the orchestrator.
 * These match the tool definitions in services/agent/src/tools_definitions.py
 */

import { z } from "zod";

// ============================================================================
// Base Tool Schema
// ============================================================================

export const ToolInputPropertiesSchema = z.record(
  z.object({
    type: z.string(),
    description: z.string().optional(),
    enum: z.array(z.string()).optional(),
    items: z.record(z.unknown()).optional(),
    anyOf: z.array(z.unknown()).optional(),
    properties: z.record(z.unknown()).optional(),
    required: z.array(z.string()).optional(),
  })
);

export const ToolInputSchema = z.object({
  type: z.literal("object"),
  properties: ToolInputPropertiesSchema,
  required: z.array(z.string()).optional(),
});

export const ToolDefinitionSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  input_schema: ToolInputSchema,
});

// ============================================================================
// Planning Tool
// ============================================================================

export const ShowPlanInputSchema = z.object({
  title: z.string().min(1),
  todos: z.array(
    z.object({
      id: z.string().min(1),
      label: z.string().min(1),
      status: z.enum(["pending", "in_progress", "completed", "cancelled"]),
    })
  ),
});

// ============================================================================
// Communication Tools
// ============================================================================

export const MessageNotifyUserInputSchema = z.object({
  text: z.string().min(1),
  attachments: z.union([z.string(), z.array(z.string())]).optional(),
});

export const MessageAskUserInputSchema = z.object({
  text: z.string().min(1),
  attachments: z.union([z.string(), z.array(z.string())]).optional(),
});

// ============================================================================
// File System Tools
// ============================================================================

export const FileReadInputSchema = z.object({
  path: z.string().min(1),
});

export const FileWriteInputSchema = z.object({
  path: z.string().min(1),
  content: z.string(),
});

export const FileEditInputSchema = z.object({
  path: z.string().min(1),
  old_str: z.string(),
  new_str: z.string(),
});

export const FileSearchInputSchema = z.object({
  path: z.string().min(1),
  regex: z.string().min(1),
  file_pattern: z.string().optional(),
});

export const DirectoryListInputSchema = z.object({
  path: z.string().default("."),
});

export const DirectoryTreeInputSchema = z.object({
  path: z.string().default("."),
  max_depth: z.number().int().min(1).max(10).optional(),
});

// ============================================================================
// Shell Tools
// ============================================================================

export const ShellCreateInputSchema = z.object({
  session_id: z.string().min(1),
});

export const ShellExecInputSchema = z.object({
  session_id: z.string().min(1),
  command: z.string().min(1),
  timeout: z.number().int().min(0).optional(),
});

export const ShellReadInputSchema = z.object({
  session_id: z.string().min(1),
});

export const ShellKillInputSchema = z.object({
  session_id: z.string().min(1),
});

// ============================================================================
// Browser Tools
// ============================================================================

export const BrowserActionInputSchema = z.object({
  action: z.enum([
    "navigate",
    "click",
    "type",
    "scroll_down",
    "scroll_up",
    "screenshot",
    "back",
    "forward",
  ]),
  url: z.string().url().optional(),
  text: z.string().optional(),
  selector: z.string().optional(),
});

export const BrowserExtractInputSchema = z.object({
  selector: z.string().min(1),
  attribute: z.string().optional(),
});

// ============================================================================
// Search Tools
// ============================================================================

export const WebSearchInputSchema = z.object({
  query: z.string().min(1),
  num_results: z.number().int().min(1).max(20).default(10),
});

export const WebFetchInputSchema = z.object({
  url: z.string().url(),
});

// ============================================================================
// Code Execution Tools
// ============================================================================

export const PythonRunInputSchema = z.object({
  code: z.string().min(1),
});

export const NodeRunInputSchema = z.object({
  code: z.string().min(1),
});

// ============================================================================
// Image Generation Tools
// ============================================================================

export const ImageGenerateInputSchema = z.object({
  prompt: z.string().min(1),
  model: z.string().optional(),
  size: z.enum(["256x256", "512x512", "1024x1024", "1024x1792", "1792x1024"]).optional(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type ToolDefinition = z.infer<typeof ToolDefinitionSchema>;
export type ToolInputSchema = z.infer<typeof ToolInputSchema>;
export type ShowPlanInput = z.infer<typeof ShowPlanInputSchema>;
export type MessageNotifyUserInput = z.infer<typeof MessageNotifyUserInputSchema>;
export type MessageAskUserInput = z.infer<typeof MessageAskUserInputSchema>;
export type FileReadInput = z.infer<typeof FileReadInputSchema>;
export type FileWriteInput = z.infer<typeof FileWriteInputSchema>;
export type FileEditInput = z.infer<typeof FileEditInputSchema>;
export type FileSearchInput = z.infer<typeof FileSearchInputSchema>;
export type DirectoryListInput = z.infer<typeof DirectoryListInputSchema>;
export type DirectoryTreeInput = z.infer<typeof DirectoryTreeInputSchema>;
export type ShellCreateInput = z.infer<typeof ShellCreateInputSchema>;
export type ShellExecInput = z.infer<typeof ShellExecInputSchema>;
export type ShellReadInput = z.infer<typeof ShellReadInputSchema>;
export type ShellKillInput = z.infer<typeof ShellKillInputSchema>;
export type BrowserActionInput = z.infer<typeof BrowserActionInputSchema>;
export type BrowserExtractInput = z.infer<typeof BrowserExtractInputSchema>;
export type WebSearchInput = z.infer<typeof WebSearchInputSchema>;
export type WebFetchInput = z.infer<typeof WebFetchInputSchema>;
export type PythonRunInput = z.infer<typeof PythonRunInputSchema>;
export type NodeRunInput = z.infer<typeof NodeRunInputSchema>;
export type ImageGenerateInput = z.infer<typeof ImageGenerateInputSchema>;
