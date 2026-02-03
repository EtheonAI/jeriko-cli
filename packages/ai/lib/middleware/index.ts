/**
 * @repo/ai - Middleware Module
 *
 * Agent middleware for cross-cutting concerns like logging,
 * cost tracking, rate limiting, and more.
 */

// ============================================================================
// Cost Tracking
// ============================================================================

export {
  createCostTrackingMiddleware,
  CostTracker,
  InMemoryCostStore,
  DEFAULT_PRICING,
  type ModelPricing,
  type CostRecord,
  type CostSummary,
  type CostTrackingStore,
  type CostTrackingMiddlewareConfig,
} from './cost-tracking';

// ============================================================================
// Logging
// ============================================================================

export {
  createLoggingMiddleware,
  createLogger,
  createConsoleLogger,
  createJSONLogger,
  Logger,
  ConsoleTransport,
  JSONTransport,
  ArrayTransport,
  CallbackTransport,
  type LogLevel,
  type LogEntry,
  type LogTransport,
  type LoggingMiddlewareConfig,
} from './logging';

// ============================================================================
// Rate Limiting
// ============================================================================

export {
  createRateLimitingMiddleware,
  createRateLimiter,
  requestsPerMinute,
  tokensPerMinute,
  combinedLimiter,
  RateLimiter,
  type RateLimitStrategy,
  type RateLimitConfig,
  type RateLimitState,
  type RateLimitResult,
  type RateLimitMiddlewareConfig,
} from './rate-limiting';

// ============================================================================
// Middleware Utilities
// ============================================================================

import type { AgentMiddleware, AgentGenerateOptions, AgentGenerateResult, AgentStreamChunk } from '../agents/types';

/**
 * Compose multiple middleware into a single middleware
 */
export function composeMiddleware(...middlewares: AgentMiddleware[]): AgentMiddleware {
  return {
    name: middlewares.map((m) => m.name).join('+'),

    async beforeGenerate(options: AgentGenerateOptions): Promise<AgentGenerateOptions> {
      let result = options;
      for (const middleware of middlewares) {
        if (middleware.beforeGenerate) {
          result = await middleware.beforeGenerate(result);
        }
      }
      return result;
    },

    async afterGenerate(result: AgentGenerateResult): Promise<AgentGenerateResult> {
      let current = result;
      // Run in reverse order for afterGenerate
      for (const middleware of [...middlewares].reverse()) {
        if (middleware.afterGenerate) {
          current = await middleware.afterGenerate(current);
        }
      }
      return current;
    },

    transformChunk(chunk: AgentStreamChunk): AgentStreamChunk | null {
      let current: AgentStreamChunk | null = chunk;
      for (const middleware of middlewares) {
        if (current === null) break;
        if (middleware.transformChunk) {
          current = middleware.transformChunk(current);
        }
      }
      return current;
    },
  };
}

/**
 * Create a middleware that only runs when a condition is met
 */
export function conditionalMiddleware(
  middleware: AgentMiddleware,
  condition: (options: AgentGenerateOptions) => boolean
): AgentMiddleware {
  return {
    name: `conditional(${middleware.name})`,

    async beforeGenerate(options: AgentGenerateOptions): Promise<AgentGenerateOptions> {
      if (!condition(options)) return options;
      return middleware.beforeGenerate ? middleware.beforeGenerate(options) : options;
    },

    async afterGenerate(result: AgentGenerateResult): Promise<AgentGenerateResult> {
      // Note: We can't check condition here easily since we don't have the original options
      // This middleware will apply afterGenerate unconditionally if beforeGenerate ran
      return middleware.afterGenerate ? middleware.afterGenerate(result) : result;
    },

    transformChunk(chunk: AgentStreamChunk): AgentStreamChunk | null {
      return middleware.transformChunk ? middleware.transformChunk(chunk) : chunk;
    },
  };
}

/**
 * Create a no-op middleware (useful for conditional composition)
 */
export function noopMiddleware(): AgentMiddleware {
  return {
    name: 'noop',
  };
}

/**
 * Create a middleware from simple before/after functions
 */
export function simpleMiddleware(
  name: string,
  hooks: {
    before?: (options: AgentGenerateOptions) => AgentGenerateOptions | Promise<AgentGenerateOptions>;
    after?: (result: AgentGenerateResult) => AgentGenerateResult | Promise<AgentGenerateResult>;
  }
): AgentMiddleware {
  return {
    name,
    beforeGenerate: hooks.before ? async (o) => hooks.before!(o) : undefined,
    afterGenerate: hooks.after ? async (r) => hooks.after!(r) : undefined,
  };
}
