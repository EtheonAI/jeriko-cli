/**
 * @repo/ai - Fallback Provider
 *
 * Automatic fallback handling for AI model calls with retry logic,
 * circuit breaker patterns, and graceful degradation.
 */

import type { Agent, AgentGenerateOptions, AgentGenerateResult, AgentStreamOptions, AgentStreamResult } from '../agents/types';
import { getProviderRegistry, type ProviderName, type ModelInfo } from './provider-registry';
import { generateId } from '../streaming';

// ============================================================================
// Fallback Types
// ============================================================================

export interface FallbackConfig {
  /** Primary model ID */
  primaryModel: string;

  /** Fallback model IDs in order of preference */
  fallbackModels: string[];

  /** Maximum retry attempts per model */
  maxRetries?: number;

  /** Retry delay in ms */
  retryDelay?: number;

  /** Exponential backoff multiplier */
  backoffMultiplier?: number;

  /** Maximum delay between retries */
  maxRetryDelay?: number;

  /** Timeout per request in ms */
  timeout?: number;

  /** Enable circuit breaker */
  circuitBreaker?: boolean;

  /** Circuit breaker failure threshold */
  failureThreshold?: number;

  /** Circuit breaker reset timeout */
  resetTimeout?: number;

  /** Called when fallback occurs */
  onFallback?: (from: string, to: string, error: Error) => void;

  /** Called when all models fail */
  onAllFailed?: (errors: Map<string, Error>) => void;
}

export interface CircuitState {
  /** Model ID */
  model: string;

  /** Circuit state */
  state: 'closed' | 'open' | 'half-open';

  /** Failure count */
  failures: number;

  /** Last failure time */
  lastFailure?: Date;

  /** Circuit opened time */
  openedAt?: Date;
}

// ============================================================================
// Fallback Provider Implementation
// ============================================================================

export class FallbackProvider implements Agent {
  private config: Required<FallbackConfig>;
  private circuits = new Map<string, CircuitState>();
  private agentFactory: (modelId: string) => Agent;

  constructor(config: FallbackConfig, agentFactory: (modelId: string) => Agent) {
    this.config = {
      maxRetries: config.maxRetries ?? 2,
      retryDelay: config.retryDelay ?? 1000,
      backoffMultiplier: config.backoffMultiplier ?? 2,
      maxRetryDelay: config.maxRetryDelay ?? 30000,
      timeout: config.timeout ?? 60000,
      circuitBreaker: config.circuitBreaker ?? true,
      failureThreshold: config.failureThreshold ?? 3,
      resetTimeout: config.resetTimeout ?? 60000,
      onFallback: config.onFallback ?? (() => {}),
      onAllFailed: config.onAllFailed ?? (() => {}),
      ...config,
    };

    this.agentFactory = agentFactory;

    // Initialize circuits
    this.initializeCircuit(config.primaryModel);
    for (const model of config.fallbackModels) {
      this.initializeCircuit(model);
    }
  }

  // ========================================
  // Agent Interface
  // ========================================

  async generate(options: AgentGenerateOptions): Promise<AgentGenerateResult> {
    const models = this.getAvailableModels();
    const errors = new Map<string, Error>();

    for (const model of models) {
      // Check circuit breaker
      if (this.isCircuitOpen(model)) {
        continue;
      }

      try {
        const result = await this.tryModel(model, options);
        this.recordSuccess(model);
        return result;
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        errors.set(model, err);
        this.recordFailure(model);

        // Report fallback
        const nextModel = this.getNextAvailableModel(models, model);
        if (nextModel) {
          this.config.onFallback(model, nextModel, err);
        }
      }
    }

    // All models failed
    this.config.onAllFailed(errors);
    throw new AggregateError(
      Array.from(errors.values()),
      `All models failed: ${Array.from(errors.entries())
        .map(([m, e]) => `${m}: ${e.message}`)
        .join('; ')}`
    );
  }

  async stream(options: AgentStreamOptions): Promise<AgentStreamResult> {
    const models = this.getAvailableModels();
    const errors = new Map<string, Error>();

    for (const model of models) {
      if (this.isCircuitOpen(model)) {
        continue;
      }

      try {
        const agent = this.agentFactory(model);
        const result = await agent.stream(options);
        this.recordSuccess(model);
        return result;
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        errors.set(model, err);
        this.recordFailure(model);

        const nextModel = this.getNextAvailableModel(models, model);
        if (nextModel) {
          this.config.onFallback(model, nextModel, err);
        }
      }
    }

    this.config.onAllFailed(errors);
    throw new AggregateError(
      Array.from(errors.values()),
      `All models failed during streaming`
    );
  }

  // ========================================
  // Retry Logic
  // ========================================

  private async tryModel(
    model: string,
    options: AgentGenerateOptions
  ): Promise<AgentGenerateResult> {
    let lastError: Error | undefined;
    let delay = this.config.retryDelay;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const agent = this.agentFactory(model);

        // Add timeout
        const result = await Promise.race([
          agent.generate(options),
          this.createTimeout(this.config.timeout),
        ]);

        return result as AgentGenerateResult;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry on certain errors
        if (this.shouldNotRetry(lastError)) {
          throw lastError;
        }

        // Wait before retry
        if (attempt < this.config.maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay = Math.min(delay * this.config.backoffMultiplier, this.config.maxRetryDelay);
        }
      }
    }

    throw lastError ?? new Error('Unknown error');
  }

  private createTimeout(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Request timed out after ${ms}ms`)), ms);
    });
  }

  private shouldNotRetry(error: Error): boolean {
    // Don't retry authentication errors
    if (error.message.includes('401') || error.message.includes('403')) {
      return true;
    }

    // Don't retry validation errors
    if (error.message.includes('400') || error.message.includes('invalid')) {
      return true;
    }

    return false;
  }

  // ========================================
  // Circuit Breaker
  // ========================================

  private initializeCircuit(model: string): void {
    this.circuits.set(model, {
      model,
      state: 'closed',
      failures: 0,
    });
  }

  private isCircuitOpen(model: string): boolean {
    if (!this.config.circuitBreaker) return false;

    const circuit = this.circuits.get(model);
    if (!circuit) return false;

    if (circuit.state === 'open') {
      // Check if we should try half-open
      if (circuit.openedAt) {
        const elapsed = Date.now() - circuit.openedAt.getTime();
        if (elapsed >= this.config.resetTimeout) {
          circuit.state = 'half-open';
          return false;
        }
      }
      return true;
    }

    return false;
  }

  private recordSuccess(model: string): void {
    const circuit = this.circuits.get(model);
    if (circuit) {
      circuit.state = 'closed';
      circuit.failures = 0;
    }
  }

  private recordFailure(model: string): void {
    if (!this.config.circuitBreaker) return;

    const circuit = this.circuits.get(model);
    if (!circuit) return;

    circuit.failures++;
    circuit.lastFailure = new Date();

    if (circuit.failures >= this.config.failureThreshold) {
      circuit.state = 'open';
      circuit.openedAt = new Date();
    }
  }

  // ========================================
  // Helpers
  // ========================================

  private getAvailableModels(): string[] {
    return [this.config.primaryModel, ...this.config.fallbackModels];
  }

  private getNextAvailableModel(models: string[], current: string): string | undefined {
    const currentIndex = models.indexOf(current);
    for (let i = currentIndex + 1; i < models.length; i++) {
      if (!this.isCircuitOpen(models[i])) {
        return models[i];
      }
    }
    return undefined;
  }

  // ========================================
  // Public Methods
  // ========================================

  getCircuitStates(): CircuitState[] {
    return Array.from(this.circuits.values());
  }

  resetCircuit(model: string): void {
    const circuit = this.circuits.get(model);
    if (circuit) {
      circuit.state = 'closed';
      circuit.failures = 0;
      circuit.openedAt = undefined;
    }
  }

  resetAllCircuits(): void {
    for (const circuit of this.circuits.values()) {
      circuit.state = 'closed';
      circuit.failures = 0;
      circuit.openedAt = undefined;
    }
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

export function createFallbackProvider(
  config: FallbackConfig,
  agentFactory: (modelId: string) => Agent
): FallbackProvider {
  return new FallbackProvider(config, agentFactory);
}

/**
 * Create a fallback provider with automatic agent creation
 */
export function createAutoFallbackProvider(config: FallbackConfig): FallbackProvider {
  // Dynamically import to avoid circular dependencies
  const agentFactory = async (modelId: string): Promise<Agent> => {
    const { RubicToolLoopAgent } = await import('../agents/tool-loop-agent');
    return new RubicToolLoopAgent({ model: modelId });
  };

  // Wrap in sync factory
  let cachedAgents = new Map<string, Agent>();

  const syncFactory = (modelId: string): Agent => {
    // For the fallback provider, we need a sync factory
    // We'll create a proxy agent that handles the async nature
    if (!cachedAgents.has(modelId)) {
      const { RubicToolLoopAgent } = require('../agents/tool-loop-agent');
      cachedAgents.set(modelId, new RubicToolLoopAgent({ model: modelId }));
    }
    return cachedAgents.get(modelId)!;
  };

  return new FallbackProvider(config, syncFactory);
}

// ============================================================================
// Predefined Fallback Chains
// ============================================================================

export const ANTHROPIC_FALLBACK_CHAIN: FallbackConfig = {
  primaryModel: 'anthropic/claude-sonnet-4-5-20250929',
  fallbackModels: [
    'anthropic/claude-3-5-haiku-20241022',
    'anthropic/claude-3-opus-20240229',
  ],
};

export const OPENAI_FALLBACK_CHAIN: FallbackConfig = {
  primaryModel: 'openai/gpt-4o',
  fallbackModels: [
    'openai/gpt-4o-mini',
    'openai/gpt-4-turbo',
  ],
};

export const CROSS_PROVIDER_FALLBACK_CHAIN: FallbackConfig = {
  primaryModel: 'anthropic/claude-sonnet-4-5-20250929',
  fallbackModels: [
    'openai/gpt-4o',
    'google/gemini-1.5-pro',
    'anthropic/claude-3-5-haiku-20241022',
    'openai/gpt-4o-mini',
    'google/gemini-1.5-flash',
  ],
};
