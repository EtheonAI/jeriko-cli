/**
 * @repo/ai - Cached Agent
 *
 * Semantic caching wrapper for agents that caches responses based on
 * semantic similarity of inputs. Dramatically reduces latency and cost
 * for repeated or similar queries.
 */

import type {
  Agent,
  AgentGenerateOptions,
  AgentGenerateResult,
  AgentStreamOptions,
  AgentStreamResult,
  AgentStep,
  AgentStreamChunk,
  TokenUsage,
} from './types';
import type { UIMessage, FinishReason } from '../types/ui-message';
import { generateId } from '../streaming';

// ============================================================================
// Cache Types
// ============================================================================

export interface CacheEntry {
  /** Cache key */
  key: string;

  /** Original input hash */
  inputHash: string;

  /** Semantic embedding of the input */
  embedding?: number[];

  /** Cached result */
  result: AgentGenerateResult;

  /** Creation timestamp */
  createdAt: Date;

  /** Last accessed timestamp */
  accessedAt: Date;

  /** Access count */
  accessCount: number;

  /** TTL in milliseconds */
  ttl: number;
}

export interface CacheStore {
  /** Get entry by key */
  get(key: string): Promise<CacheEntry | null>;

  /** Set entry */
  set(key: string, entry: CacheEntry): Promise<void>;

  /** Delete entry */
  delete(key: string): Promise<void>;

  /** Clear all entries */
  clear(): Promise<void>;

  /** Find similar entries by embedding */
  findSimilar?(embedding: number[], threshold: number): Promise<CacheEntry[]>;
}

export interface CacheStats {
  /** Total cache hits */
  hits: number;

  /** Total cache misses */
  misses: number;

  /** Hit rate (0-1) */
  hitRate: number;

  /** Total tokens saved */
  tokensSaved: number;

  /** Total latency saved (ms) */
  latencySaved: number;
}

// ============================================================================
// In-Memory Cache Store
// ============================================================================

export class InMemoryCacheStore implements CacheStore {
  private cache = new Map<string, CacheEntry>();
  private maxSize: number;

  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
  }

  async get(key: string): Promise<CacheEntry | null> {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check TTL
    if (Date.now() - entry.createdAt.getTime() > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    // Update access stats
    entry.accessedAt = new Date();
    entry.accessCount++;

    return entry;
  }

  async set(key: string, entry: CacheEntry): Promise<void> {
    // Evict if at capacity (LRU)
    if (this.cache.size >= this.maxSize) {
      let oldestKey: string | null = null;
      let oldestTime = Infinity;

      for (const [k, v] of this.cache) {
        if (v.accessedAt.getTime() < oldestTime) {
          oldestTime = v.accessedAt.getTime();
          oldestKey = k;
        }
      }

      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, entry);
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  async findSimilar(embedding: number[], threshold: number): Promise<CacheEntry[]> {
    const similar: Array<{ entry: CacheEntry; similarity: number }> = [];

    for (const entry of this.cache.values()) {
      if (!entry.embedding) continue;

      const similarity = this.cosineSimilarity(embedding, entry.embedding);
      if (similarity >= threshold) {
        similar.push({ entry, similarity });
      }
    }

    // Sort by similarity descending
    similar.sort((a, b) => b.similarity - a.similarity);
    return similar.map((s) => s.entry);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}

// ============================================================================
// Cached Agent Configuration
// ============================================================================

export interface CachedAgentConfig {
  /** Wrapped agent */
  agent: Agent;

  /** Agent name */
  name?: string;

  /** Agent ID */
  id?: string;

  /** Cache store */
  store?: CacheStore;

  /** TTL in milliseconds (default: 1 hour) */
  ttl?: number;

  /** Enable semantic similarity matching */
  semanticMatching?: boolean;

  /** Similarity threshold for semantic matching (0-1) */
  similarityThreshold?: number;

  /** Custom embedding function */
  embedder?: (text: string) => Promise<number[]>;

  /** Custom cache key generator */
  keyGenerator?: (messages: UIMessage[]) => string;

  /** Called on cache hit */
  onCacheHit?: (entry: CacheEntry) => void;

  /** Called on cache miss */
  onCacheMiss?: (key: string) => void;

  /** Skip caching for certain requests */
  skipCache?: (options: AgentGenerateOptions) => boolean;
}

// ============================================================================
// Cached Agent Implementation
// ============================================================================

/**
 * CachedAgent - Semantic caching wrapper
 *
 * @example
 * ```ts
 * const cachedAgent = new CachedAgent({
 *   agent: myAgent,
 *   ttl: 3600000, // 1 hour
 *   semanticMatching: true,
 *   similarityThreshold: 0.95,
 * });
 *
 * // First call - cache miss
 * const result1 = await cachedAgent.generate({ messages });
 *
 * // Second call - cache hit
 * const result2 = await cachedAgent.generate({ messages });
 * ```
 */
export class CachedAgent implements Agent {
  readonly id: string;
  readonly name: string;
  readonly config: CachedAgentConfig;

  private store: CacheStore;
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    hitRate: 0,
    tokensSaved: 0,
    latencySaved: 0,
  };

  constructor(config: CachedAgentConfig) {
    this.id = config.id ?? generateId('cached');
    this.name = config.name ?? 'CachedAgent';
    this.config = {
      ttl: 3600000, // 1 hour default
      semanticMatching: false,
      similarityThreshold: 0.95,
      ...config,
    };
    this.store = config.store ?? new InMemoryCacheStore();
  }

  // ========================================
  // Generate
  // ========================================

  async generate(options: AgentGenerateOptions): Promise<AgentGenerateResult> {
    const startTime = Date.now();

    // Check if caching should be skipped
    if (this.config.skipCache?.(options)) {
      return this.config.agent.generate(options);
    }

    // Generate cache key
    const cacheKey = this.generateCacheKey(options.messages);

    // Try to get from cache
    let cachedEntry = await this.store.get(cacheKey);

    // If no exact match and semantic matching is enabled, try similarity
    if (!cachedEntry && this.config.semanticMatching && this.config.embedder) {
      const inputText = this.messagesToText(options.messages);
      const embedding = await this.config.embedder(inputText);

      if (this.store.findSimilar) {
        const similar = await this.store.findSimilar(
          embedding,
          this.config.similarityThreshold ?? 0.95
        );

        if (similar.length > 0) {
          cachedEntry = similar[0];
        }
      }
    }

    // Cache hit
    if (cachedEntry) {
      this.stats.hits++;
      this.updateHitRate();
      this.stats.tokensSaved += cachedEntry.result.usage?.totalTokens ?? 0;
      this.stats.latencySaved += cachedEntry.result.duration;
      this.config.onCacheHit?.(cachedEntry);

      // Return cached result with updated metadata
      return {
        ...cachedEntry.result,
        message: {
          ...cachedEntry.result.message,
          id: generateId('msg'), // New ID for this response
          metadata: {
            ...cachedEntry.result.message.metadata,
            cached: true,
            cacheHit: 'full',
            originalDuration: cachedEntry.result.duration,
          },
        },
        duration: Date.now() - startTime,
      };
    }

    // Cache miss
    this.stats.misses++;
    this.updateHitRate();
    this.config.onCacheMiss?.(cacheKey);

    // Generate response
    const result = await this.config.agent.generate(options);

    // Cache the result
    await this.cacheResult(cacheKey, options.messages, result);

    return result;
  }

  // ========================================
  // Stream
  // ========================================

  async stream(options: AgentStreamOptions): Promise<AgentStreamResult> {
    // Check if caching should be skipped
    if (this.config.skipCache?.(options)) {
      return this.config.agent.stream(options);
    }

    // Generate cache key
    const cacheKey = this.generateCacheKey(options.messages);

    // Try to get from cache
    const cachedEntry = await this.store.get(cacheKey);

    // Cache hit - simulate streaming from cache
    if (cachedEntry) {
      this.stats.hits++;
      this.updateHitRate();
      this.stats.tokensSaved += cachedEntry.result.usage?.totalTokens ?? 0;
      this.stats.latencySaved += cachedEntry.result.duration;
      this.config.onCacheHit?.(cachedEntry);

      return this.createCachedStream(cachedEntry, options);
    }

    // Cache miss - stream from agent and cache result
    this.stats.misses++;
    this.updateHitRate();
    this.config.onCacheMiss?.(cacheKey);

    const agentStream = await this.config.agent.stream(options);

    // Wrap result to cache it
    const wrappedResult = agentStream.result.then(async (result) => {
      await this.cacheResult(cacheKey, options.messages, result);
      return result;
    });

    return {
      stream: agentStream.stream,
      result: wrappedResult,
    };
  }

  // ========================================
  // Caching Logic
  // ========================================

  private generateCacheKey(messages: UIMessage[]): string {
    if (this.config.keyGenerator) {
      return this.config.keyGenerator(messages);
    }

    // Default: hash of message content
    const content = this.messagesToText(messages);
    return this.simpleHash(content);
  }

  private async cacheResult(
    key: string,
    messages: UIMessage[],
    result: AgentGenerateResult
  ): Promise<void> {
    let embedding: number[] | undefined;

    if (this.config.semanticMatching && this.config.embedder) {
      const inputText = this.messagesToText(messages);
      embedding = await this.config.embedder(inputText);
    }

    const entry: CacheEntry = {
      key,
      inputHash: this.simpleHash(this.messagesToText(messages)),
      embedding,
      result,
      createdAt: new Date(),
      accessedAt: new Date(),
      accessCount: 1,
      ttl: this.config.ttl ?? 3600000,
    };

    await this.store.set(key, entry);
  }

  private createCachedStream(
    entry: CacheEntry,
    options: AgentStreamOptions
  ): AgentStreamResult {
    const chunks: AgentStreamChunk[] = [];

    // Build chunks from cached result
    const textParts = entry.result.message.parts.filter((p) => p.type === 'text');
    const text = textParts.map((p) => (p as { text: string }).text).join('');

    // Stream text character by character (simulated streaming)
    const words = text.split(' ');
    for (const word of words) {
      chunks.push({ type: 'text-delta', delta: word + ' ' });
    }

    chunks.push({ type: 'text-done', text });
    chunks.push({
      type: 'finish',
      finishReason: entry.result.finishReason,
      usage: entry.result.usage,
    });

    // Create stream
    const stream = new ReadableStream<AgentStreamChunk>({
      async start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(chunk);
          options.onChunk?.(chunk);
          // Small delay to simulate streaming
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
        controller.close();
      },
    });

    // Create result promise
    const result = Promise.resolve({
      ...entry.result,
      message: {
        ...entry.result.message,
        id: generateId('msg'),
        metadata: {
          ...entry.result.message.metadata,
          cached: true,
          cacheHit: 'full' as const,
        },
      },
    });

    return { stream, result };
  }

  // ========================================
  // Helpers
  // ========================================

  private messagesToText(messages: UIMessage[]): string {
    return messages
      .map((m) => {
        const textParts = m.parts
          .filter((p) => p.type === 'text')
          .map((p) => (p as { text: string }).text);
        return `${m.role}: ${textParts.join(' ')}`;
      })
      .join('\n');
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `cache_${Math.abs(hash).toString(36)}`;
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }

  // ========================================
  // Public Methods
  // ========================================

  get cacheStats(): CacheStats {
    return { ...this.stats };
  }

  async clearCache(): Promise<void> {
    await this.store.clear();
    this.stats = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      tokensSaved: 0,
      latencySaved: 0,
    };
  }

  async invalidate(key: string): Promise<void> {
    await this.store.delete(key);
  }
}

// ============================================================================
// Factory
// ============================================================================

export function createCachedAgent(config: CachedAgentConfig): CachedAgent {
  return new CachedAgent(config);
}

/**
 * Wrap any agent with caching
 */
export function withCache(
  agent: Agent,
  options: Omit<CachedAgentConfig, 'agent'> = {}
): CachedAgent {
  return new CachedAgent({ agent, ...options });
}
