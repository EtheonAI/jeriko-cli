/**
 * @repo/ai - Providers Module
 *
 * AI model provider management with automatic model selection,
 * health monitoring, and fallback handling.
 */

// ============================================================================
// Provider Registry
// ============================================================================

export {
  ProviderRegistry,
  getProviderRegistry,
  createProviderRegistry,
  BUILT_IN_MODELS,
  type ProviderName,
  type ModelCapabilities,
  type ModelInfo,
  type ProviderConfig,
  type ProviderHealth,
} from './provider-registry';

// ============================================================================
// Fallback Provider
// ============================================================================

export {
  FallbackProvider,
  createFallbackProvider,
  createAutoFallbackProvider,
  ANTHROPIC_FALLBACK_CHAIN,
  OPENAI_FALLBACK_CHAIN,
  CROSS_PROVIDER_FALLBACK_CHAIN,
  type FallbackConfig,
  type CircuitState,
} from './fallback';

// ============================================================================
// Convenience Functions
// ============================================================================

import { getProviderRegistry, type ProviderName, type ModelCapabilities } from './provider-registry';

/**
 * Get a model instance by ID
 */
export async function getModel(modelId: string): Promise<unknown> {
  const registry = getProviderRegistry();
  return registry.getModelInstance(modelId);
}

/**
 * List available models
 */
export function listModels(filter?: {
  provider?: ProviderName;
  capability?: keyof ModelCapabilities;
  useCase?: string;
}) {
  const registry = getProviderRegistry();
  return registry.listModels(filter);
}

/**
 * Select the best model for given requirements
 */
export function selectModel(requirements: {
  capabilities?: Partial<ModelCapabilities>;
  maxPrice?: number;
  preferredProvider?: ProviderName;
  useCase?: string;
}) {
  const registry = getProviderRegistry();
  return registry.selectBestModel(requirements);
}

/**
 * Initialize providers from environment
 */
export function initializeProviders(): void {
  const registry = getProviderRegistry();

  // Check for API keys in environment
  if (typeof process !== 'undefined' && process.env) {
    if (process.env.ANTHROPIC_API_KEY) {
      registry.registerProvider({
        name: 'anthropic',
        apiKey: process.env.ANTHROPIC_API_KEY,
        enabled: true,
      });
    }

    if (process.env.OPENAI_API_KEY) {
      registry.registerProvider({
        name: 'openai',
        apiKey: process.env.OPENAI_API_KEY,
        enabled: true,
      });
    }

    if (process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      registry.registerProvider({
        name: 'google',
        apiKey: process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY,
        enabled: true,
      });
    }
  }
}

// ============================================================================
// Model ID Utilities
// ============================================================================

/**
 * Parse a model ID into provider and model name
 */
export function parseModelId(modelId: string): { provider: ProviderName; model: string } {
  const parts = modelId.split('/');

  if (parts.length === 1) {
    // No provider specified, detect from model name
    if (modelId.startsWith('claude')) {
      return { provider: 'anthropic', model: modelId };
    } else if (modelId.startsWith('gpt') || modelId.startsWith('o1')) {
      return { provider: 'openai', model: modelId };
    } else if (modelId.startsWith('gemini')) {
      return { provider: 'google', model: modelId };
    }
    return { provider: 'anthropic', model: modelId };
  }

  return {
    provider: parts[0] as ProviderName,
    model: parts.slice(1).join('/'),
  };
}

/**
 * Create a fully qualified model ID
 */
export function createModelId(provider: ProviderName, model: string): string {
  return `${provider}/${model}`;
}

/**
 * Check if a model ID is valid
 */
export function isValidModelId(modelId: string): boolean {
  const registry = getProviderRegistry();
  const { provider, model } = parseModelId(modelId);

  // Check if model exists in registry
  const modelInfo = registry.getModel(model) || registry.getModel(modelId);

  return modelInfo !== undefined;
}
