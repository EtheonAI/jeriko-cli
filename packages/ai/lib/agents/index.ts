/**
 * @repo/ai - Agents Module
 *
 * Re-exports all agent types, implementations, and utilities.
 * Following AI SDK v6 patterns for multi-agent orchestration.
 */

// ============================================================================
// Core Types
// ============================================================================

export * from './types';

// ============================================================================
// Agent Implementations
// ============================================================================

export {
  RubicToolLoopAgent,
  createToolLoopAgent,
  type ToolLoopAgentConfig,
  type PrepareStepContext,
  type PrepareStepResult,
} from './tool-loop-agent';

// ============================================================================
// Convenience Re-exports
// ============================================================================

export {
  stepCountIs,
  toolCalled,
  customStop,
} from './types';
