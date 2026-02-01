/**
 * @repo/ai - Intelligent Caching System
 *
 * High-performance caching for AI responses, messages, and attachments.
 * Supports memory, IndexedDB, and localStorage backends.
 */

import type { CacheConfig, CacheEntry, Message } from './types/core';

// ============================================================================
// Cache Key Generators
// ============================================================================

export function generateCacheKey(...parts: (string | number | undefined)[]): string {
  return parts.filter(Boolean).join(':');
}

export function generateMessageCacheKey(
  messages: Array<{ role: string; parts: Array<{ type: string; text?: string }> }>,
  model: string
): string {
  // Create a deterministic hash of the conversation
  const conversationHash = messages
    .map((m) => {
      const textParts = m.parts
        .filter((p) => p.type === 'text')
        .map((p) => p.text)
        .join('');
      return `${m.role}:${textParts}`;
    })
    .join('|');

  return `chat:${model}:${hashString(conversationHash)}`;
}

function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

// ============================================================================
// Memory Cache (Fast, volatile)
// ============================================================================

class MemoryCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private maxSize: number;
  private defaultTtl: number;

  constructor(config: Partial<CacheConfig> = {}) {
    this.maxSize = config.maxSize ?? 1000;
    this.defaultTtl = config.ttl ?? 5 * 60 * 1000; // 5 minutes
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check expiration
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  set(key: string, value: T, ttl?: number): void {
    // Evict oldest entries if at capacity
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }

    const entry: CacheEntry<T> = {
      key,
      value,
      createdAt: Date.now(),
      expiresAt: Date.now() + (ttl ?? this.defaultTtl),
    };

    this.cache.set(key, entry);
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  // Get cache stats
  stats(): { size: number; maxSize: number; hitRate: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: 0, // Would need to track hits/misses
    };
  }

  // Invalidate by tag
  invalidateByTag(tag: string): void {
    for (const [key, entry] of this.cache.entries()) {
      if (entry.tags?.includes(tag)) {
        this.cache.delete(key);
      }
    }
  }

  // Invalidate by prefix
  invalidateByPrefix(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }
}

// ============================================================================
// IndexedDB Cache (Persistent, larger storage)
// ============================================================================

const DB_NAME = 'rubic-ai-cache';
const DB_VERSION = 1;
const STORE_NAME = 'cache';

class IndexedDBCache<T> {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private maxSize: number;
  private defaultTtl: number;

  constructor(config: Partial<CacheConfig> = {}) {
    this.maxSize = config.maxSize ?? 10000;
    this.defaultTtl = config.ttl ?? 24 * 60 * 60 * 1000; // 24 hours
  }

  private async getDB(): Promise<IDBDatabase> {
    if (typeof indexedDB === 'undefined') {
      throw new Error('IndexedDB not available');
    }

    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
            store.createIndex('expiresAt', 'expiresAt', { unique: false });
            store.createIndex('createdAt', 'createdAt', { unique: false });
          }
        };
      });
    }

    return this.dbPromise;
  }

  async get(key: string): Promise<T | null> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(key);

        request.onsuccess = () => {
          const entry = request.result as CacheEntry<T> | undefined;
          if (!entry) {
            resolve(null);
            return;
          }

          // Check expiration
          if (entry.expiresAt && Date.now() > entry.expiresAt) {
            this.delete(key); // Async cleanup
            resolve(null);
            return;
          }

          resolve(entry.value);
        };

        request.onerror = () => reject(request.error);
      });
    } catch {
      return null;
    }
  }

  async set(key: string, value: T, ttl?: number): Promise<void> {
    try {
      const db = await this.getDB();
      const entry: CacheEntry<T> = {
        key,
        value,
        createdAt: Date.now(),
        expiresAt: Date.now() + (ttl ?? this.defaultTtl),
      };

      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(entry);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch {
      // Silently fail for cache writes
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(key);

        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
      });
    } catch {
      return false;
    }
  }

  async clear(): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch {
      // Silently fail
    }
  }

  // Cleanup expired entries
  async cleanup(): Promise<number> {
    try {
      const db = await this.getDB();
      const now = Date.now();
      let deletedCount = 0;

      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const index = store.index('expiresAt');
        const range = IDBKeyRange.upperBound(now);
        const request = index.openCursor(range);

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
          if (cursor) {
            cursor.delete();
            deletedCount++;
            cursor.continue();
          }
        };

        transaction.oncomplete = () => resolve(deletedCount);
        transaction.onerror = () => reject(transaction.error);
      });
    } catch {
      return 0;
    }
  }
}

// ============================================================================
// Unified Cache Manager
// ============================================================================

export interface CacheManager {
  // Basic operations
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, options?: { ttl?: number; tags?: string[] }): Promise<void>;
  delete(key: string): Promise<boolean>;
  has(key: string): Promise<boolean>;
  clear(): Promise<void>;

  // Advanced operations
  getOrSet<T>(key: string, factory: () => Promise<T>, options?: { ttl?: number }): Promise<T>;
  invalidateByTag(tag: string): Promise<void>;
  invalidateByPrefix(prefix: string): Promise<void>;

  // Stats
  stats(): Promise<{ size: number; hitRate: number }>;
}

export function createCacheManager(config: Partial<CacheConfig> = {}): CacheManager {
  const storage = config.storage ?? 'memory';

  // Use memory cache as L1, IndexedDB as L2
  const memoryCache = new MemoryCache<unknown>({
    maxSize: Math.min(config.maxSize ?? 1000, 1000),
    ttl: config.ttl ?? 5 * 60 * 1000,
  });

  const persistentCache =
    storage === 'indexeddb' && typeof indexedDB !== 'undefined'
      ? new IndexedDBCache<unknown>(config)
      : null;

  let hits = 0;
  let misses = 0;

  return {
    async get<T>(key: string): Promise<T | null> {
      // Try L1 (memory) first
      const memoryValue = memoryCache.get(key);
      if (memoryValue !== null) {
        hits++;
        return memoryValue as T;
      }

      // Try L2 (persistent)
      if (persistentCache) {
        const persistentValue = await persistentCache.get(key);
        if (persistentValue !== null) {
          // Promote to L1
          memoryCache.set(key, persistentValue);
          hits++;
          return persistentValue as T;
        }
      }

      misses++;
      return null;
    },

    async set<T>(key: string, value: T, options?: { ttl?: number; tags?: string[] }): Promise<void> {
      memoryCache.set(key, value, options?.ttl);
      if (persistentCache) {
        await persistentCache.set(key, value, options?.ttl);
      }
    },

    async delete(key: string): Promise<boolean> {
      const memoryDeleted = memoryCache.delete(key);
      const persistentDeleted = persistentCache ? await persistentCache.delete(key) : false;
      return memoryDeleted || persistentDeleted;
    },

    async has(key: string): Promise<boolean> {
      return (await this.get(key)) !== null;
    },

    async clear(): Promise<void> {
      memoryCache.clear();
      if (persistentCache) {
        await persistentCache.clear();
      }
      hits = 0;
      misses = 0;
    },

    async getOrSet<T>(key: string, factory: () => Promise<T>, options?: { ttl?: number }): Promise<T> {
      const cached = await this.get<T>(key);
      if (cached !== null) {
        return cached;
      }

      const value = await factory();
      await this.set(key, value, options);
      return value;
    },

    async invalidateByTag(tag: string): Promise<void> {
      memoryCache.invalidateByTag(tag);
      // IndexedDB would need tag tracking - simplified for now
    },

    async invalidateByPrefix(prefix: string): Promise<void> {
      memoryCache.invalidateByPrefix(prefix);
      // IndexedDB would need prefix scan - simplified for now
    },

    async stats(): Promise<{ size: number; hitRate: number }> {
      const memStats = memoryCache.stats();
      const total = hits + misses;
      return {
        size: memStats.size,
        hitRate: total > 0 ? hits / total : 0,
      };
    },
  };
}

// ============================================================================
// Specialized Caches
// ============================================================================

// Response cache for AI completions
export const responseCache = createCacheManager({
  storage: 'indexeddb',
  maxSize: 5000,
  ttl: 60 * 60 * 1000, // 1 hour
});

// Message cache for conversation history
export const messageCache = createCacheManager({
  storage: 'memory',
  maxSize: 500,
  ttl: 30 * 60 * 1000, // 30 minutes
});

// Attachment cache for file metadata
export const attachmentCache = createCacheManager({
  storage: 'memory',
  maxSize: 200,
  ttl: 10 * 60 * 1000, // 10 minutes
});

// Tool result cache
export const toolResultCache = createCacheManager({
  storage: 'memory',
  maxSize: 100,
  ttl: 5 * 60 * 1000, // 5 minutes
});
