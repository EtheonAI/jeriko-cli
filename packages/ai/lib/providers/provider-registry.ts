/**
 * @repo/ai - Provider Registry
 *
 * Centralized management of AI model providers with automatic
 * model instantiation, capability tracking, and health monitoring.
 */

// ============================================================================
// Provider Types
// ============================================================================

export type ProviderName = 'anthropic' | 'openai' | 'google' | 'custom';

export interface ModelCapabilities {
  /** Supports tool/function calling */
  toolUse: boolean;

  /** Supports vision/images */
  vision: boolean;

  /** Supports streaming */
  streaming: boolean;

  /** Supports JSON mode */
  jsonMode: boolean;

  /** Supports system messages */
  systemMessages: boolean;

  /** Supports extended thinking/reasoning */
  reasoning: boolean;

  /** Context window size (tokens) */
  contextWindow: number;

  /** Maximum output tokens */
  maxOutputTokens: number;
}

export interface ModelInfo {
  /** Model identifier (e.g., 'claude-sonnet-4-5-20250929') */
  id: string;

  /** Display name */
  name: string;

  /** Provider */
  provider: ProviderName;

  /** Model capabilities */
  capabilities: ModelCapabilities;

  /** Input price per 1M tokens */
  inputPricePerMillion: number;

  /** Output price per 1M tokens */
  outputPricePerMillion: number;

  /** Whether this is a deprecated model */
  deprecated?: boolean;

  /** Replacement model ID if deprecated */
  replacement?: string;

  /** Model description */
  description?: string;

  /** Best use cases */
  useCases?: string[];
}

export interface ProviderConfig {
  /** Provider name */
  name: ProviderName;

  /** API key (or environment variable name) */
  apiKey?: string;

  /** Base URL override */
  baseUrl?: string;

  /** Default model for this provider */
  defaultModel?: string;

  /** Additional provider options */
  options?: Record<string, unknown>;

  /** Whether provider is enabled */
  enabled?: boolean;
}

export interface ProviderHealth {
  /** Provider name */
  provider: ProviderName;

  /** Health status */
  status: 'healthy' | 'degraded' | 'unavailable';

  /** Last check timestamp */
  lastCheck: Date;

  /** Latency in ms */
  latency?: number;

  /** Error message if unhealthy */
  error?: string;

  /** Success rate (0-1) */
  successRate?: number;
}

// ============================================================================
// Built-in Model Registry
// ============================================================================

export const BUILT_IN_MODELS: ModelInfo[] = [
  // Anthropic Models
  {
    id: 'claude-sonnet-4-5-20250929',
    name: 'Claude 3.5 Sonnet',
    provider: 'anthropic',
    capabilities: {
      toolUse: true,
      vision: true,
      streaming: true,
      jsonMode: true,
      systemMessages: true,
      reasoning: true,
      contextWindow: 200000,
      maxOutputTokens: 8192,
    },
    inputPricePerMillion: 3.0,
    outputPricePerMillion: 15.0,
    description: 'Best balance of intelligence and speed',
    useCases: ['coding', 'analysis', 'writing', 'general'],
  },
  {
    id: 'claude-3-5-haiku-20241022',
    name: 'Claude 3.5 Haiku',
    provider: 'anthropic',
    capabilities: {
      toolUse: true,
      vision: true,
      streaming: true,
      jsonMode: true,
      systemMessages: true,
      reasoning: false,
      contextWindow: 200000,
      maxOutputTokens: 8192,
    },
    inputPricePerMillion: 1.0,
    outputPricePerMillion: 5.0,
    description: 'Fastest model for quick tasks',
    useCases: ['quick-responses', 'classification', 'extraction'],
  },
  {
    id: 'claude-3-opus-20240229',
    name: 'Claude 3 Opus',
    provider: 'anthropic',
    capabilities: {
      toolUse: true,
      vision: true,
      streaming: true,
      jsonMode: true,
      systemMessages: true,
      reasoning: true,
      contextWindow: 200000,
      maxOutputTokens: 4096,
    },
    inputPricePerMillion: 15.0,
    outputPricePerMillion: 75.0,
    description: 'Most capable model for complex tasks',
    useCases: ['complex-reasoning', 'research', 'creative-writing'],
  },

  // OpenAI Models
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    capabilities: {
      toolUse: true,
      vision: true,
      streaming: true,
      jsonMode: true,
      systemMessages: true,
      reasoning: false,
      contextWindow: 128000,
      maxOutputTokens: 16384,
    },
    inputPricePerMillion: 2.5,
    outputPricePerMillion: 10.0,
    description: 'OpenAI flagship multimodal model',
    useCases: ['general', 'vision', 'coding'],
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
    capabilities: {
      toolUse: true,
      vision: true,
      streaming: true,
      jsonMode: true,
      systemMessages: true,
      reasoning: false,
      contextWindow: 128000,
      maxOutputTokens: 16384,
    },
    inputPricePerMillion: 0.15,
    outputPricePerMillion: 0.6,
    description: 'Cost-effective OpenAI model',
    useCases: ['quick-tasks', 'classification', 'simple-queries'],
  },
  {
    id: 'o1',
    name: 'o1',
    provider: 'openai',
    capabilities: {
      toolUse: false,
      vision: true,
      streaming: true,
      jsonMode: true,
      systemMessages: true,
      reasoning: true,
      contextWindow: 200000,
      maxOutputTokens: 100000,
    },
    inputPricePerMillion: 15.0,
    outputPricePerMillion: 60.0,
    description: 'Advanced reasoning model',
    useCases: ['complex-reasoning', 'math', 'science'],
  },

  // Google Models
  {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    provider: 'google',
    capabilities: {
      toolUse: true,
      vision: true,
      streaming: true,
      jsonMode: true,
      systemMessages: true,
      reasoning: false,
      contextWindow: 1000000,
      maxOutputTokens: 8192,
    },
    inputPricePerMillion: 3.5,
    outputPricePerMillion: 10.5,
    description: 'Google flagship model with largest context',
    useCases: ['long-context', 'document-analysis', 'multimodal'],
  },
  {
    id: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash',
    provider: 'google',
    capabilities: {
      toolUse: true,
      vision: true,
      streaming: true,
      jsonMode: true,
      systemMessages: true,
      reasoning: false,
      contextWindow: 1000000,
      maxOutputTokens: 8192,
    },
    inputPricePerMillion: 0.075,
    outputPricePerMillion: 0.3,
    description: 'Fast and cost-effective Google model',
    useCases: ['quick-tasks', 'high-volume', 'classification'],
  },
];

// ============================================================================
// Provider Registry Implementation
// ============================================================================

export class ProviderRegistry {
  private providers = new Map<ProviderName, ProviderConfig>();
  private models = new Map<string, ModelInfo>();
  private healthStatus = new Map<ProviderName, ProviderHealth>();
  private modelInstances = new Map<string, unknown>();

  constructor() {
    // Register built-in models
    for (const model of BUILT_IN_MODELS) {
      this.models.set(model.id, model);
    }
  }

  // ========================================
  // Provider Management
  // ========================================

  registerProvider(config: ProviderConfig): void {
    this.providers.set(config.name, {
      enabled: true,
      ...config,
    });
  }

  getProvider(name: ProviderName): ProviderConfig | undefined {
    return this.providers.get(name);
  }

  isProviderEnabled(name: ProviderName): boolean {
    const provider = this.providers.get(name);
    return provider?.enabled ?? false;
  }

  listProviders(): ProviderConfig[] {
    return Array.from(this.providers.values());
  }

  // ========================================
  // Model Management
  // ========================================

  registerModel(model: ModelInfo): void {
    this.models.set(model.id, model);
  }

  getModel(id: string): ModelInfo | undefined {
    return this.models.get(id);
  }

  listModels(filter?: {
    provider?: ProviderName;
    capability?: keyof ModelCapabilities;
    useCase?: string;
  }): ModelInfo[] {
    let models = Array.from(this.models.values());

    if (filter?.provider) {
      models = models.filter((m) => m.provider === filter.provider);
    }

    if (filter?.capability) {
      models = models.filter((m) => m.capabilities[filter.capability!]);
    }

    if (filter?.useCase) {
      models = models.filter((m) => m.useCases?.includes(filter.useCase!));
    }

    return models;
  }

  // ========================================
  // Model Instance Creation
  // ========================================

  async getModelInstance(modelId: string): Promise<unknown> {
    // Check cache
    if (this.modelInstances.has(modelId)) {
      return this.modelInstances.get(modelId)!;
    }

    const model = this.models.get(modelId);
    if (!model) {
      throw new Error(`Unknown model: ${modelId}`);
    }

    const provider = this.providers.get(model.provider);
    if (!provider?.enabled) {
      throw new Error(`Provider ${model.provider} is not enabled`);
    }

    // Create instance
    const instance = await this.createModelInstance(model, provider);
    this.modelInstances.set(modelId, instance);

    return instance;
  }

  private async createModelInstance(model: ModelInfo, provider: ProviderConfig): Promise<unknown> {
    switch (model.provider) {
      case 'anthropic': {
        const { anthropic } = await import('@ai-sdk/anthropic');
        return anthropic(model.id);
      }

      case 'openai': {
        const { openai } = await import('@ai-sdk/openai');
        return openai(model.id);
      }

      case 'google': {
        const { google } = await import('@ai-sdk/google');
        return google(model.id);
      }

      default:
        throw new Error(`Unsupported provider: ${model.provider}`);
    }
  }

  // ========================================
  // Health Monitoring
  // ========================================

  async checkHealth(provider: ProviderName): Promise<ProviderHealth> {
    const startTime = Date.now();

    try {
      // Simple health check - try to get a model instance
      const models = this.listModels({ provider });
      if (models.length === 0) {
        throw new Error('No models registered');
      }

      await this.getModelInstance(models[0].id);

      const health: ProviderHealth = {
        provider,
        status: 'healthy',
        lastCheck: new Date(),
        latency: Date.now() - startTime,
      };

      this.healthStatus.set(provider, health);
      return health;
    } catch (error) {
      const health: ProviderHealth = {
        provider,
        status: 'unavailable',
        lastCheck: new Date(),
        latency: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      };

      this.healthStatus.set(provider, health);
      return health;
    }
  }

  getHealthStatus(provider: ProviderName): ProviderHealth | undefined {
    return this.healthStatus.get(provider);
  }

  async checkAllHealth(): Promise<ProviderHealth[]> {
    const results: ProviderHealth[] = [];

    for (const provider of this.providers.keys()) {
      const health = await this.checkHealth(provider);
      results.push(health);
    }

    return results;
  }

  // ========================================
  // Model Selection
  // ========================================

  selectBestModel(requirements: {
    capabilities?: Partial<ModelCapabilities>;
    maxPrice?: number;
    preferredProvider?: ProviderName;
    useCase?: string;
  }): ModelInfo | undefined {
    let candidates = this.listModels();

    // Filter by capabilities
    if (requirements.capabilities) {
      candidates = candidates.filter((m) => {
        for (const [cap, required] of Object.entries(requirements.capabilities!)) {
          if (required && !m.capabilities[cap as keyof ModelCapabilities]) {
            return false;
          }
        }
        return true;
      });
    }

    // Filter by price
    if (requirements.maxPrice !== undefined) {
      candidates = candidates.filter(
        (m) => m.inputPricePerMillion <= requirements.maxPrice!
      );
    }

    // Filter by use case
    if (requirements.useCase) {
      candidates = candidates.filter(
        (m) => m.useCases?.includes(requirements.useCase!)
      );
    }

    // Filter by enabled providers
    candidates = candidates.filter((m) => this.isProviderEnabled(m.provider));

    // Prefer specified provider
    if (requirements.preferredProvider) {
      const preferred = candidates.filter(
        (m) => m.provider === requirements.preferredProvider
      );
      if (preferred.length > 0) {
        candidates = preferred;
      }
    }

    // Sort by price (cheapest first)
    candidates.sort((a, b) => a.inputPricePerMillion - b.inputPricePerMillion);

    return candidates[0];
  }

  // ========================================
  // Utility
  // ========================================

  clearCache(): void {
    this.modelInstances.clear();
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

let defaultRegistry: ProviderRegistry | null = null;

export function getProviderRegistry(): ProviderRegistry {
  if (!defaultRegistry) {
    defaultRegistry = new ProviderRegistry();
  }
  return defaultRegistry;
}

export function createProviderRegistry(): ProviderRegistry {
  return new ProviderRegistry();
}
