/**
 * Tool Adapter - Convert between different tool format representations
 *
 * Handles conversion between Anthropic format and OpenAI format tool definitions.
 */

import { ToolDefinition } from "../schemas/tools";

// ============================================================================
// Anthropic Format (used by agent service)
// ============================================================================

export interface AnthropicToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

// ============================================================================
// OpenAI Format (for compatibility)
// ============================================================================

export interface OpenAIToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
}

// ============================================================================
// Conversion Functions
// ============================================================================

/**
 * Convert Anthropic format to OpenAI format
 */
export function anthropicToOpenAI(tool: AnthropicToolDefinition): OpenAIToolDefinition {
  return {
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.input_schema,
    },
  };
}

/**
 * Convert OpenAI format to Anthropic format
 */
export function openAIToAnthropic(tool: OpenAIToolDefinition): AnthropicToolDefinition {
  return {
    name: tool.function.name,
    description: tool.function.description,
    input_schema: tool.function.parameters,
  };
}

/**
 * Convert array of Anthropic tools to OpenAI format
 */
export function convertToolsToOpenAI(tools: AnthropicToolDefinition[]): OpenAIToolDefinition[] {
  return tools.map(anthropicToOpenAI);
}

/**
 * Convert array of OpenAI tools to Anthropic format
 */
export function convertToolsToAnthropic(tools: OpenAIToolDefinition[]): AnthropicToolDefinition[] {
  return tools.map(openAIToAnthropic);
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate a tool definition against the contract schema
 */
export function validateToolDefinition(tool: unknown): tool is ToolDefinition {
  if (!tool || typeof tool !== "object") {
    return false;
  }

  const t = tool as Record<string, unknown>;
  return (
    typeof t.name === "string" &&
    typeof t.description === "string" &&
    typeof t.input_schema === "object" &&
    t.input_schema !== null
  );
}
