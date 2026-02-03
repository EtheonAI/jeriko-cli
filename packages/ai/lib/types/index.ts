/**
 * @repo/ai - Type Definitions
 *
 * Comprehensive type system for the Rubic AI platform.
 */

// Export all core types (excluding conflicting names)
export {
  type Message,
  type MessageStatus,
  type TextPart,
  type ImagePart,
  type FilePart,
  type AudioPart,
  type ToolCallPart,
  type ToolResultPart,
  type ReasoningPart,
  type CodePart,
  type MessagePart,
  type ToolCallState,
  type ChatThread,
  type Attachment,
  type AttachmentType,
  type AttachmentSource,
  type AttachmentStatus,
  type AttachmentConfig,
  type ToolDefinition,
  type ToolContext,
  type ToolResult,
  type StreamEventType,
  type StreamEvent,
  type TextDeltaEvent,
  type ToolCallStartEvent,
  type ToolCallDeltaEvent,
  type ToolCallCompleteEvent,
  type ToolResultEvent,
  type DataStreamWriter,
  type ModelProvider,
  type ModelConfig,
  type CacheEntry,
  type CacheConfig,
  messagePartSchema,
  messageSchema,
  attachmentSchema,
  type ValidatedMessage,
  type ValidatedAttachment,
} from './core';

// Export UI Message types (Vercel AI SDK 6.x style)
export * from './ui-message';

// Export stream chunk types
export * from './stream-chunks';

// Re-export legacy types for backwards compatibility
// These are from the original index.d.ts
export type { ChatMessage, ChatTools, CustomUIDataTypes, DataPart } from './index.d';
