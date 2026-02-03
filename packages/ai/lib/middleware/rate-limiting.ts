/**
 * @repo/ai - Rate Limiting Middleware
 *
 * Token bucket and sliding window rate limiting for AI API calls.
 * Prevents quota exhaustion and ensures fair resource distribution.
 */

import type { AgentMiddleware, AgentGenerateOptions, AgentGenerateResult } from '../agents/types';

// ============================================================================
// Rate Limiting Types
// ============================================================================

export type RateLimitStrategy = 'token-bucket' | 'sliding-window' | 'fixed-window';

export interface RateLimitConfig {
  /** Maximum requests per window */
  maxRequests: number;

  /** Window size in milliseconds */
  windowMs: number;

  /** Rate limiting strategy */
  strategy?: RateLimitStrategy;

  /** Maximum tokens per window (optional) */
  maxTokens?: number;

  /** Key extractor for per-user/session limits */
  keyExtractor?: (options: AgentGenerateOptions) => string;

  /** Called when rate limited */
  onRateLimited?: (key: string, retryAfter: number) => void;

  /** Skip rate limiting for certain requests */
  skip?: (options: AgentGenerateOptions) => boolean;
}

export interface RateLimitState {
  /** Current request count */
  requests: number;

  /** Current token count */
  tokens: number;

  /** Window start time */
  windowStart: number;

  /** Request timestamps for sliding window */
  timestamps: number[];

  /** Token timestamps for sliding window */
  tokenTimestamps: Array<{ timestamp: number; count: number }>;
}

export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;

  /** Remaining requests */
  remaining: number;

  /** Time until reset (ms) */
  resetIn: number;

  /** Retry after time (ms) if limited */
  retryAfter?: number;

  /** Current usage info */
  usage: {
    requests: number;
    tokens: number;
    limit: {
      requests: number;
      tokens?: number;
    };
  };
}

// ============================================================================
// Rate Limiter Implementation
// ============================================================================

export class RateLimiter {
  private states = new Map<string, RateLimitState>();
  private config: Required<RateLimitConfig>;

  constructor(config: RateLimitConfig) {
    this.config = {
      strategy: 'sliding-window',
      maxTokens: 0,
      keyExtractor: () => 'default',
      onRateLimited: () => {},
      skip: () => false,
      ...config,
    };
  }

  /**
   * Check if a request is allowed
   */
  check(key: string): RateLimitResult {
    const now = Date.now();
    const state = this.getOrCreateState(key);

    switch (this.config.strategy) {
      case 'token-bucket':
        return this.checkTokenBucket(state, now);
      case 'fixed-window':
        return this.checkFixedWindow(state, now);
      case 'sliding-window':
      default:
        return this.checkSlidingWindow(state, now);
    }
  }

  /**
   * Record a request
   */
  record(key: string, tokenCount = 0): void {
    const now = Date.now();
    const state = this.getOrCreateState(key);

    state.requests++;
    state.tokens += tokenCount;
    state.timestamps.push(now);

    if (tokenCount > 0) {
      state.tokenTimestamps.push({ timestamp: now, count: tokenCount });
    }

    // Clean up old timestamps
    this.cleanupTimestamps(state, now);
  }

  /**
   * Reset limit for a key
   */
  reset(key: string): void {
    this.states.delete(key);
  }

  /**
   * Reset all limits
   */
  resetAll(): void {
    this.states.clear();
  }

  /**
   * Get current state for a key
   */
  getState(key: string): RateLimitState | undefined {
    return this.states.get(key);
  }

  // ========================================
  // Strategy Implementations
  // ========================================

  private checkSlidingWindow(state: RateLimitState, now: number): RateLimitResult {
    const windowStart = now - this.config.windowMs;

    // Count requests in window
    const recentTimestamps = state.timestamps.filter((t) => t > windowStart);
    const requestsInWindow = recentTimestamps.length;

    // Count tokens in window
    const tokensInWindow = state.tokenTimestamps
      .filter((t) => t.timestamp > windowStart)
      .reduce((sum, t) => sum + t.count, 0);

    // Check limits
    const requestsAllowed = requestsInWindow < this.config.maxRequests;
    const tokensAllowed = !this.config.maxTokens || tokensInWindow < this.config.maxTokens;
    const allowed = requestsAllowed && tokensAllowed;

    // Calculate reset time
    const oldestTimestamp = recentTimestamps[0] ?? now;
    const resetIn = Math.max(0, (oldestTimestamp + this.config.windowMs) - now);

    return {
      allowed,
      remaining: Math.max(0, this.config.maxRequests - requestsInWindow),
      resetIn,
      retryAfter: allowed ? undefined : resetIn,
      usage: {
        requests: requestsInWindow,
        tokens: tokensInWindow,
        limit: {
          requests: this.config.maxRequests,
          tokens: this.config.maxTokens || undefined,
        },
      },
    };
  }

  private checkFixedWindow(state: RateLimitState, now: number): RateLimitResult {
    // Check if window has expired
    if (now - state.windowStart >= this.config.windowMs) {
      // Reset window
      state.windowStart = now;
      state.requests = 0;
      state.tokens = 0;
      state.timestamps = [];
      state.tokenTimestamps = [];
    }

    const requestsAllowed = state.requests < this.config.maxRequests;
    const tokensAllowed = !this.config.maxTokens || state.tokens < this.config.maxTokens;
    const allowed = requestsAllowed && tokensAllowed;

    const resetIn = Math.max(0, (state.windowStart + this.config.windowMs) - now);

    return {
      allowed,
      remaining: Math.max(0, this.config.maxRequests - state.requests),
      resetIn,
      retryAfter: allowed ? undefined : resetIn,
      usage: {
        requests: state.requests,
        tokens: state.tokens,
        limit: {
          requests: this.config.maxRequests,
          tokens: this.config.maxTokens || undefined,
        },
      },
    };
  }

  private checkTokenBucket(state: RateLimitState, now: number): RateLimitResult {
    const elapsed = now - state.windowStart;
    const refillRate = this.config.maxRequests / this.config.windowMs;
    const refilled = Math.floor(elapsed * refillRate);

    // Calculate current bucket level
    const currentLevel = Math.min(
      this.config.maxRequests,
      this.config.maxRequests - state.requests + refilled
    );

    const allowed = currentLevel > 0;
    const remaining = Math.max(0, currentLevel);

    // Estimate time until next token
    const timePerToken = this.config.windowMs / this.config.maxRequests;
    const resetIn = allowed ? 0 : Math.ceil(timePerToken);

    return {
      allowed,
      remaining,
      resetIn,
      retryAfter: allowed ? undefined : resetIn,
      usage: {
        requests: this.config.maxRequests - currentLevel,
        tokens: state.tokens,
        limit: {
          requests: this.config.maxRequests,
          tokens: this.config.maxTokens || undefined,
        },
      },
    };
  }

  // ========================================
  // Helpers
  // ========================================

  private getOrCreateState(key: string): RateLimitState {
    let state = this.states.get(key);

    if (!state) {
      state = {
        requests: 0,
        tokens: 0,
        windowStart: Date.now(),
        timestamps: [],
        tokenTimestamps: [],
      };
      this.states.set(key, state);
    }

    return state;
  }

  private cleanupTimestamps(state: RateLimitState, now: number): void {
    const windowStart = now - this.config.windowMs;

    state.timestamps = state.timestamps.filter((t) => t > windowStart);
    state.tokenTimestamps = state.tokenTimestamps.filter((t) => t.timestamp > windowStart);
  }
}

// ============================================================================
// Rate Limiting Middleware
// ============================================================================

export interface RateLimitMiddlewareConfig extends RateLimitConfig {
  /** Error to throw when rate limited */
  rateLimitError?: (retryAfter: number) => Error;

  /** Add rate limit headers to response */
  includeHeaders?: boolean;
}

export function createRateLimitingMiddleware(
  config: RateLimitMiddlewareConfig
): AgentMiddleware {
  const limiter = new RateLimiter(config);

  const {
    keyExtractor = () => 'default',
    skip = () => false,
    onRateLimited = () => {},
    rateLimitError = (retryAfter) =>
      new Error(`Rate limited. Retry after ${retryAfter}ms`),
    includeHeaders = true,
  } = config;

  return {
    name: 'rate-limiting',

    async beforeGenerate(options: AgentGenerateOptions): Promise<AgentGenerateOptions> {
      // Check if should skip
      if (skip(options)) {
        return options;
      }

      // Get key
      const key = keyExtractor(options);

      // Check rate limit
      const result = limiter.check(key);

      if (!result.allowed) {
        onRateLimited(key, result.retryAfter!);
        throw rateLimitError(result.retryAfter!);
      }

      // Record the request
      limiter.record(key);

      return options;
    },

    async afterGenerate(result: AgentGenerateResult): Promise<AgentGenerateResult> {
      if (!includeHeaders) return result;

      // Get key from result metadata
      const key = (result.message.metadata as Record<string, unknown>)?.rateLimitKey as string ?? 'default';
      const state = limiter.getState(key);

      if (!state) return result;

      // Add rate limit info to response
      const check = limiter.check(key);

      return {
        ...result,
        message: {
          ...result.message,
          metadata: {
            ...result.message.metadata,
            rateLimit: {
              remaining: check.remaining,
              resetIn: check.resetIn,
              usage: check.usage,
            },
          },
        },
      };
    },
  };
}

// ============================================================================
// Factory Functions
// ============================================================================

export function createRateLimiter(config: RateLimitConfig): RateLimiter {
  return new RateLimiter(config);
}

/**
 * Create a simple requests-per-minute limiter
 */
export function requestsPerMinute(rpm: number): RateLimiter {
  return new RateLimiter({
    maxRequests: rpm,
    windowMs: 60 * 1000,
    strategy: 'sliding-window',
  });
}

/**
 * Create a tokens-per-minute limiter
 */
export function tokensPerMinute(tpm: number): RateLimiter {
  return new RateLimiter({
    maxRequests: Infinity,
    maxTokens: tpm,
    windowMs: 60 * 1000,
    strategy: 'sliding-window',
  });
}

/**
 * Create a combined rate limiter
 */
export function combinedLimiter(rpm: number, tpm: number): RateLimiter {
  return new RateLimiter({
    maxRequests: rpm,
    maxTokens: tpm,
    windowMs: 60 * 1000,
    strategy: 'sliding-window',
  });
}
