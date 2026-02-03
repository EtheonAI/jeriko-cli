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

export {
  DAGAgent,
  createDAGAgent,
  type DAGAgentConfig,
  type DAGNode,
  type DAGNodeResult,
  type DAG,
  type DAGProgress,
  type TaskPlannerContext,
} from './dag-agent';

export {
  RouterAgent,
  createRouterAgent,
  createRoute,
  withCondition,
  withPriority,
  type RouterAgentConfig,
  type Route,
  type RouteContext,
  type RouteDecision,
} from './router-agent';

export {
  CachedAgent,
  createCachedAgent,
  withCache,
  InMemoryCacheStore,
  type CachedAgentConfig,
  type CacheEntry,
  type CacheStore,
  type CacheStats,
} from './cached-agent';

// ============================================================================
// Convenience Re-exports
// ============================================================================

export {
  stepCountIs,
  toolCalled,
  customStop,
} from './types';
