// Re-export from Vercel AI SDK
export * from "ai";

// ============================================================================
// RubicAI — Custom AI Provider (routes all completions through agent service)
// ============================================================================
export {
  RubicAI,
  createRubicAI,
  getRubicAI,
  type RubicAIConfig,
  type RubicCompletionOptions,
  type RubicCompletionResult,
  type RubicHealthResult,
} from "./lib/rubic-provider";

// Model name resolution (no direct provider access)
export {
  resolveModelName,
  DEFAULT_MODEL,
  MODEL_ALIASES,
} from "./lib/models";

// Export our custom types (prefixed to avoid conflicts with 'ai' package)
export type {
  // UIMessage types (with Rubic prefix to avoid conflicts)
  UIMessage as RubicUIMessage,
  UIMessagePart as RubicUIMessagePart,
  TextUIPart as RubicTextUIPart,
  ReasoningUIPart as RubicReasoningUIPart,
  FileUIPart as RubicFileUIPart,
  StaticToolUIPart,
  DynamicToolUIPart as RubicDynamicToolUIPart,
  ToolInvocationState,
  ToolApproval,
  MessageMetadata as RubicMessageMetadata,
  ChatStatus as RubicChatStatus,
  SourceUrlUIPart,
  SourceDocumentUIPart,
} from "./lib/types/ui-message";

export {
  isTextUIPart as isRubicTextUIPart,
  isReasoningUIPart as isRubicReasoningUIPart,
  isFileUIPart as isRubicFileUIPart,
  isToolUIPart as isRubicToolUIPart,
  isStaticToolUIPart as isRubicStaticToolUIPart,
  isDynamicToolUIPart as isRubicDynamicToolUIPart,
  isDataUIPart as isRubicDataUIPart,
  getToolName as getRubicToolName,
  getMessageText,
  hasPendingToolCalls,
  hasToolsAwaitingApproval,
  getToolParts,
} from "./lib/types/ui-message";

// Stream chunk types
export type {
  UIMessageStreamChunk,
  UIMessageStreamWriter as RubicStreamWriter,
  TextStartChunk,
  TextDeltaChunk,
  TextEndChunk,
  ToolInputStartChunk,
  ToolInputAvailableChunk,
  ToolOutputAvailableChunk,
} from "./lib/types/stream-chunks";

export {
  formatSSEChunk,
  parseSSEChunk,
} from "./lib/types/stream-chunks";

// Export transport layer
export {
  WebSocketChatTransport,
  HTTPChatTransport,
  AdaptiveChatTransport,
  createTransport,
  createWebSocketTransport,
  createHTTPTransport,
  createAdaptiveTransport,
  type ChatTransport,
  type TransportType,
  type TransportConfig,
  type WebSocketTransportOptions,
  type HTTPTransportOptions,
  type WebSocketStatus,
  type WebSocketEvents,
} from "./lib/transport";

// Export tool system
export {
  ToolRegistry,
  ToolBuilder,
  tool,
  createToolRegistry,
  getDefaultToolRegistry,
  setDefaultToolRegistry,
  type ToolDefinition,
  type ToolContext,
  type ToolResult,
  type ToolExecutionMode,
  type ToolExecutionOptions,
  // Tool definitions (Manus-aligned Zod schemas)
  getAllToolDefinitions,
  getToolSchemas,
  TOOL_NAMES,
} from "./lib/tools";

// Export streaming utilities
export {
  generateId,
  generateMessageId,
  generateToolCallId,
  generateAttachmentId,
  MessageBuilder,
  readStream,
  smoothStream,
  createDataStream,
  createStreamResponse,
  formatSSEMessage,
  parseSSEMessage,
  type StreamReaderCallbacks,
  type SmoothStreamOptions,
} from "./lib/streaming";

// Export server utilities
export {
  convertToModelMessages,
  sanitizeMessages,
} from "./lib/server";

// Export components
export * from "./components";

// ============================================================================
// AI SDK v6 Agent System
// ============================================================================

// Export agent types and implementations
export {
  // Core types
  type Agent,
  type AgentConfig,
  type AgentGenerateOptions,
  type AgentGenerateResult,
  type AgentStreamOptions,
  type AgentStreamResult,
  type AgentStep,
  type AgentToolCall,
  type AgentToolResult,
  type AgentStreamChunk,
  type AgentToolDefinition,
  type AgentMiddleware,
  type AgentType,
  type AgentMetadata,
  type TokenUsage,
  type StopCondition,
  type ToolExecutionContext,

  // Stop condition helpers
  stepCountIs,
  toolCalled,
  customStop,

  // Agent implementations
  RubicToolLoopAgent,
  createToolLoopAgent,
} from "./lib/agents";
