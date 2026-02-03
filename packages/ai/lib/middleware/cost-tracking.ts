/**
 * @repo/ai - Cost Tracking Middleware
 *
 * Tracks token usage and estimated costs for AI API calls.
 * Integrates with the agent system for real-time cost monitoring.
 */

import type { AgentMiddleware, AgentGenerateOptions, AgentGenerateResult, TokenUsage } from '../agents/types';

// ============================================================================
// Cost Tracking Types
// ============================================================================

export interface ModelPricing {
  /** Model identifier */
  model: string;

  /** Input token price per 1M tokens */
  inputPricePerMillion: number;

  /** Output token price per 1M tokens */
  outputPricePerMillion: number;

  /** Cached input token price per 1M tokens */
  cachedInputPricePerMillion?: number;
}

export interface CostRecord {
  /** Record ID */
  id: string;

  /** Timestamp */
  timestamp: Date;

  /** Model used */
  model: string;

  /** Token usage */
  usage: TokenUsage;

  /** Estimated cost in USD */
  cost: number;

  /** Session ID (if applicable) */
  sessionId?: string;

  /** User ID (if applicable) */
  userId?: string;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

export interface CostSummary {
  /** Total cost in USD */
  totalCost: number;

  /** Total tokens used */
  totalTokens: number;

  /** Total prompt tokens */
  promptTokens: number;

  /** Total completion tokens */
  completionTokens: number;

  /** Cost by model */
  byModel: Record<string, { cost: number; tokens: number }>;

  /** Cost by session */
  bySession: Record<string, { cost: number; tokens: number }>;

  /** Number of requests */
  requestCount: number;

  /** Time period */
  period: {
    start: Date;
    end: Date;
  };
}

export interface CostTrackingStore {
  /** Record a cost event */
  record(cost: CostRecord): Promise<void>;

  /** Get costs for a time period */
  getCosts(start: Date, end: Date): Promise<CostRecord[]>;

  /** Get summary for a time period */
  getSummary(start: Date, end: Date): Promise<CostSummary>;

  /** Clear records */
  clear(): Promise<void>;
}

// ============================================================================
// Default Pricing (as of 2025)
// ============================================================================

export const DEFAULT_PRICING: ModelPricing[] = [
  // Anthropic
  {
    model: 'claude-3-5-sonnet-20241022',
    inputPricePerMillion: 3.0,
    outputPricePerMillion: 15.0,
    cachedInputPricePerMillion: 0.3,
  },
  {
    model: 'claude-sonnet-4-5-20250929',
    inputPricePerMillion: 3.0,
    outputPricePerMillion: 15.0,
    cachedInputPricePerMillion: 0.3,
  },
  {
    model: 'claude-3-5-haiku-20241022',
    inputPricePerMillion: 1.0,
    outputPricePerMillion: 5.0,
    cachedInputPricePerMillion: 0.1,
  },
  {
    model: 'claude-3-opus-20240229',
    inputPricePerMillion: 15.0,
    outputPricePerMillion: 75.0,
    cachedInputPricePerMillion: 1.5,
  },

  // OpenAI
  {
    model: 'gpt-4-turbo',
    inputPricePerMillion: 10.0,
    outputPricePerMillion: 30.0,
  },
  {
    model: 'gpt-4o',
    inputPricePerMillion: 2.5,
    outputPricePerMillion: 10.0,
  },
  {
    model: 'gpt-4o-mini',
    inputPricePerMillion: 0.15,
    outputPricePerMillion: 0.6,
  },
  {
    model: 'gpt-3.5-turbo',
    inputPricePerMillion: 0.5,
    outputPricePerMillion: 1.5,
  },

  // Google
  {
    model: 'gemini-1.5-pro',
    inputPricePerMillion: 3.5,
    outputPricePerMillion: 10.5,
  },
  {
    model: 'gemini-1.5-flash',
    inputPricePerMillion: 0.075,
    outputPricePerMillion: 0.3,
  },
];

// ============================================================================
// In-Memory Cost Store
// ============================================================================

export class InMemoryCostStore implements CostTrackingStore {
  private records: CostRecord[] = [];
  private maxRecords: number;

  constructor(maxRecords = 10000) {
    this.maxRecords = maxRecords;
  }

  async record(cost: CostRecord): Promise<void> {
    this.records.push(cost);

    // Trim if over limit
    if (this.records.length > this.maxRecords) {
      this.records = this.records.slice(-this.maxRecords);
    }
  }

  async getCosts(start: Date, end: Date): Promise<CostRecord[]> {
    return this.records.filter(
      (r) => r.timestamp >= start && r.timestamp <= end
    );
  }

  async getSummary(start: Date, end: Date): Promise<CostSummary> {
    const costs = await this.getCosts(start, end);

    const summary: CostSummary = {
      totalCost: 0,
      totalTokens: 0,
      promptTokens: 0,
      completionTokens: 0,
      byModel: {},
      bySession: {},
      requestCount: costs.length,
      period: { start, end },
    };

    for (const cost of costs) {
      summary.totalCost += cost.cost;
      summary.totalTokens += cost.usage.totalTokens;
      summary.promptTokens += cost.usage.promptTokens;
      summary.completionTokens += cost.usage.completionTokens;

      // By model
      if (!summary.byModel[cost.model]) {
        summary.byModel[cost.model] = { cost: 0, tokens: 0 };
      }
      summary.byModel[cost.model].cost += cost.cost;
      summary.byModel[cost.model].tokens += cost.usage.totalTokens;

      // By session
      if (cost.sessionId) {
        if (!summary.bySession[cost.sessionId]) {
          summary.bySession[cost.sessionId] = { cost: 0, tokens: 0 };
        }
        summary.bySession[cost.sessionId].cost += cost.cost;
        summary.bySession[cost.sessionId].tokens += cost.usage.totalTokens;
      }
    }

    return summary;
  }

  async clear(): Promise<void> {
    this.records = [];
  }
}

// ============================================================================
// Cost Tracking Middleware
// ============================================================================

export interface CostTrackingMiddlewareConfig {
  /** Cost store */
  store?: CostTrackingStore;

  /** Custom pricing */
  pricing?: ModelPricing[];

  /** Session ID extractor */
  getSessionId?: (options: AgentGenerateOptions) => string | undefined;

  /** User ID extractor */
  getUserId?: (options: AgentGenerateOptions) => string | undefined;

  /** Cost limit per request */
  costLimitPerRequest?: number;

  /** Cost limit per session */
  costLimitPerSession?: number;

  /** Called when cost is recorded */
  onCostRecorded?: (record: CostRecord) => void;

  /** Called when limit is exceeded */
  onLimitExceeded?: (type: 'request' | 'session', cost: number, limit: number) => void;
}

export function createCostTrackingMiddleware(
  config: CostTrackingMiddlewareConfig = {}
): AgentMiddleware {
  const store = config.store ?? new InMemoryCostStore();
  const pricing = [...DEFAULT_PRICING, ...(config.pricing ?? [])];
  let sessionCosts: Record<string, number> = {};

  return {
    name: 'cost-tracking',

    async afterGenerate(result: AgentGenerateResult): Promise<AgentGenerateResult> {
      if (!result.usage) return result;

      // Extract model from result
      const model = (result.message.metadata as Record<string, unknown>)?.model as string ?? 'unknown';

      // Find pricing
      const modelPricing = findPricing(pricing, model);

      // Calculate cost
      const cost = calculateCost(result.usage, modelPricing);

      // Create record
      const record: CostRecord = {
        id: `cost_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        timestamp: new Date(),
        model,
        usage: result.usage,
        cost,
        metadata: {
          finishReason: result.finishReason,
          duration: result.duration,
        },
      };

      // Store
      await store.record(record);

      // Notify
      config.onCostRecorded?.(record);

      // Check limits
      if (config.costLimitPerRequest && cost > config.costLimitPerRequest) {
        config.onLimitExceeded?.('request', cost, config.costLimitPerRequest);
      }

      // Add cost info to message metadata
      return {
        ...result,
        message: {
          ...result.message,
          metadata: {
            ...result.message.metadata,
            cost: {
              amount: cost,
              currency: 'USD',
              tokens: result.usage.totalTokens,
            },
          },
        },
      };
    },
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function findPricing(pricing: ModelPricing[], model: string): ModelPricing {
  // Try exact match
  let found = pricing.find((p) => p.model === model);
  if (found) return found;

  // Try partial match
  found = pricing.find((p) => model.includes(p.model) || p.model.includes(model));
  if (found) return found;

  // Default fallback
  return {
    model: 'default',
    inputPricePerMillion: 3.0,
    outputPricePerMillion: 15.0,
  };
}

function calculateCost(usage: TokenUsage, pricing: ModelPricing): number {
  let inputCost = (usage.promptTokens / 1_000_000) * pricing.inputPricePerMillion;

  // Apply cached pricing if available
  if (usage.cachedPromptTokens && pricing.cachedInputPricePerMillion) {
    const cachedCost = (usage.cachedPromptTokens / 1_000_000) * pricing.cachedInputPricePerMillion;
    const nonCachedTokens = usage.promptTokens - usage.cachedPromptTokens;
    inputCost = cachedCost + (nonCachedTokens / 1_000_000) * pricing.inputPricePerMillion;
  }

  const outputCost = (usage.completionTokens / 1_000_000) * pricing.outputPricePerMillion;

  return inputCost + outputCost;
}

// ============================================================================
// Cost Tracker Class
// ============================================================================

export class CostTracker {
  private store: CostTrackingStore;
  private pricing: ModelPricing[];

  constructor(config: { store?: CostTrackingStore; pricing?: ModelPricing[] } = {}) {
    this.store = config.store ?? new InMemoryCostStore();
    this.pricing = [...DEFAULT_PRICING, ...(config.pricing ?? [])];
  }

  async track(model: string, usage: TokenUsage, metadata?: Record<string, unknown>): Promise<CostRecord> {
    const modelPricing = findPricing(this.pricing, model);
    const cost = calculateCost(usage, modelPricing);

    const record: CostRecord = {
      id: `cost_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      timestamp: new Date(),
      model,
      usage,
      cost,
      metadata,
    };

    await this.store.record(record);
    return record;
  }

  async getSummary(start?: Date, end?: Date): Promise<CostSummary> {
    const now = new Date();
    return this.store.getSummary(
      start ?? new Date(now.getTime() - 24 * 60 * 60 * 1000),
      end ?? now
    );
  }

  async getTodaySummary(): Promise<CostSummary> {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    return this.store.getSummary(startOfDay, now);
  }

  estimateCost(model: string, promptTokens: number, completionTokens: number): number {
    const modelPricing = findPricing(this.pricing, model);
    return calculateCost(
      { promptTokens, completionTokens, totalTokens: promptTokens + completionTokens },
      modelPricing
    );
  }
}
