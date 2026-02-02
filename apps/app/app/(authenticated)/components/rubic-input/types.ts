/**
 * Rubic Input - Type Definitions
 *
 * Strict types for the Manus-inspired prompt input component.
 */

import type { MessagePart, Attachment } from "@repo/ai/lib/types";

// ============================================================================
// Model & Configuration Types
// ============================================================================

export type ModelType = "local" | "cloud";

export type AgentType = "agent" | "assistant";

export type PerformanceLevel = "high" | "medium" | "low";

export interface InputConfig {
  model: ModelType;
  agent: AgentType;
  performance: PerformanceLevel;
  autoMode: boolean;
}

// ============================================================================
// Tool Types
// ============================================================================

export type ToolType =
  | "attach-files"
  | "code-interpreter"
  | "web-search"
  | "chat-history";

export interface Tool {
  id: ToolType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
}

// ============================================================================
// Component Props
// ============================================================================

export interface RubicInputProps {
  /** Callback when user submits input */
  onSubmit: (parts: MessagePart[], attachments?: Attachment[], config?: InputConfig) => void | Promise<void>;

  /** Callback when user cancels streaming */
  onCancel?: () => void;

  /** Whether input is disabled */
  disabled?: boolean;

  /** Whether AI is currently responding */
  loading?: boolean;

  /** Whether AI response is streaming */
  streaming?: boolean;

  /** Placeholder text */
  placeholder?: string;

  /** Additional CSS classes */
  className?: string;

  /** Initial configuration */
  initialConfig?: Partial<InputConfig>;

  /** Called when configuration changes */
  onConfigChange?: (config: InputConfig) => void;

  /** Show configuration dropdowns below input */
  showConfigBar?: boolean;

  /** Callback when tool is selected */
  onToolSelect?: (tool: ToolType) => void;
}

export interface RubicInputRef {
  focus: () => void;
  clear: () => void;
  setValue: (value: string) => void;
  getValue: () => string;
  submit: () => void;
  getConfig: () => InputConfig;
}

// ============================================================================
// Selector Props
// ============================================================================

export interface SelectorOption<T extends string> {
  value: T;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export interface SelectorProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: SelectorOption<T>[];
  icon: React.ComponentType<{ className?: string }>;
  className?: string;
}
