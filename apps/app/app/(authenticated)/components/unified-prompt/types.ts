import type { Attachment } from "@repo/ai/lib/types";

// ============================================================================
// Skill Types
// ============================================================================

export type SkillId =
  | "web-search"
  | "code-interpreter"
  | "image-generation"
  | "document-analysis"
  | "data-analysis"
  | "browser";

export interface SkillDefinition {
  id: SkillId;
  label: string;
  description: string;
  icon: string;
}

// ============================================================================
// Submit Options
// ============================================================================

export interface SubmitOptions {
  /** Real model ID (e.g. "claude-sonnet-4-5-20250929") */
  model?: string;
  /** Active skills for this message */
  skills?: SkillId[];
}

// ============================================================================
// Component Props
// ============================================================================

export interface UnifiedPromptProps {
  /** Called when user submits a message */
  onSubmit: (input: string, attachments: Attachment[], options: SubmitOptions) => void;

  /** Placeholder text */
  placeholder?: string;

  /** Whether input is disabled */
  disabled?: boolean;

  /** Whether AI response is currently streaming */
  isStreaming?: boolean;

  /** Called when user cancels streaming */
  onCancel?: () => void;

  /** Show quick action chips (dashboard only) */
  showQuickActions?: boolean;

  /** Show config bar below input (dashboard only) */
  showConfigBar?: boolean;

  /** Initial textarea value */
  initialValue?: string;

  /** Initial model ID */
  initialModel?: string;

  /** Max character length */
  maxLength?: number;

  /** Additional CSS classes */
  className?: string;
}

// ============================================================================
// Ref Handle
// ============================================================================

export interface UnifiedPromptRef {
  focus: () => void;
  clear: () => void;
  setValue: (value: string) => void;
  getValue: () => string;
  submit: () => void;
}
