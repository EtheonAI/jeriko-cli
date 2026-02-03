// Re-export from Vercel AI SDK
export * from "ai";

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
  DAGAgent,
  createDAGAgent,
  RouterAgent,
  createRouterAgent,
  CachedAgent,
  createCachedAgent,
  withCache,
} from "./lib/agents";

// Export orchestration utilities
export {
  // DAG Executor
  DAGExecutor,
  ExecutionGraphBuilder,
  createDAGExecutor,
  createExecutionGraph,
  type ExecutionNode,
  type ExecutionGraph,
  type ExecutionProgress,
  type DAGExecutorConfig,

  // Task Planner
  TaskPlanner,
  createTaskPlanner,
  quickPlan,
  type TaskPlan,
  type PlannedTask,

  // Parallel Runner
  ParallelRunner,
  createParallelRunner,
  runParallel,
  mapParallel,
  type ParallelTask,
  type ParallelResult,
  type BatchResult,

  // Workflow helpers
  createLinearWorkflow,
  createFanOutFanInWorkflow,
  createPipelineWorkflow,
} from "./lib/orchestration";

// Export middleware
export {
  // Cost tracking
  createCostTrackingMiddleware,
  CostTracker,
  type CostRecord,
  type CostSummary,

  // Logging
  createLoggingMiddleware,
  createLogger,
  Logger,
  type LogLevel,
  type LogEntry,

  // Rate limiting
  createRateLimitingMiddleware,
  RateLimiter,
  requestsPerMinute,
  tokensPerMinute,
  type RateLimitConfig,

  // Middleware utilities
  composeMiddleware,
  conditionalMiddleware,
  simpleMiddleware,
} from "./lib/middleware";

// Export provider management
export {
  ProviderRegistry,
  getProviderRegistry,
  createProviderRegistry,
  FallbackProvider,
  createFallbackProvider,
  BUILT_IN_MODELS,
  ANTHROPIC_FALLBACK_CHAIN,
  OPENAI_FALLBACK_CHAIN,
  CROSS_PROVIDER_FALLBACK_CHAIN,
  getModel,
  listModels,
  selectModel,
  initializeProviders,
  parseModelId,
  type ProviderName,
  type ModelInfo,
  type ModelCapabilities,
  type ProviderConfig,
  type FallbackConfig,
} from "./lib/providers";

// Export demo utilities
export {
  MockAgent,
  createMockAgent,
  createDemoAgent,
  getMockTools,
  MOCK_TOOLS,
  createDemoSetup,
  generateDemoConversation,
  generateDemoSteps,
  generateDemoUsage,
  type MockAgentConfig,
  type DemoConversation,
  type DemoScenario,
} from "./lib/demo";
