/**
 * @repo/ai - Tool System
 *
 * Comprehensive tool execution framework for AI agents.
 */

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
} from './tool-registry';

// Manus-aligned tool definitions (Zod schemas for AI SDK streamText)
export {
  getAllToolDefinitions,
  getToolSchemas,
  TOOL_NAMES,
  communicationTools,
  fileSystemTools,
  shellTools,
  browserTools,
  searchTools,
  deploymentTools,
  codeTools,
} from './definitions';
