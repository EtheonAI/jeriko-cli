import { LRUCache } from "lru-cache";
import type { Message } from "../store/slices/chat.slice";

/**
 * LRU Cache for session messages
 *
 * Optimizations:
 * - Max 50 sessions cached simultaneously
 * - Max 10,000 total messages across all sessions
 * - 30 minute TTL for stale data cleanup
 * - Automatic eviction of least-recently-used sessions
 *
 * Usage:
 * ```ts
 * import { messageCache } from '@/lib/cache/message-cache';
 *
 * // Get cached messages for a session
 * const messages = messageCache.get(sessionId);
 *
 * // Cache messages for a session
 * messageCache.set(sessionId, messages);
 *
 * // Append message to cache
 * appendMessageToCache(sessionId, newMessage);
 * ```
 */
export const messageCache = new LRUCache<string, Message[]>({
  max: 50, // Max 50 sessions cached
  maxSize: 10000, // Max 10k messages total
  sizeCalculation: (messages) => messages.length,
  ttl: 1000 * 60 * 30, // 30 min TTL

  // Allow stale data to be returned while fetching fresh
  allowStale: true,

  // Update age on get to keep frequently accessed items fresh
  updateAgeOnGet: true,
});

/**
 * Get messages for a session from cache
 */
export function getCachedMessages(sessionId: string): Message[] | undefined {
  return messageCache.get(sessionId);
}

/**
 * Cache messages for a session
 */
export function setCachedMessages(sessionId: string, messages: Message[]): void {
  messageCache.set(sessionId, messages);
}

/**
 * Append a single message to cached session messages
 * Creates the cache entry if it doesn't exist
 */
export function appendMessageToCache(sessionId: string, message: Message): void {
  const existing = messageCache.get(sessionId);
  if (existing) {
    // Check for duplicates before appending
    if (!existing.some((m) => m.id === message.id)) {
      messageCache.set(sessionId, [...existing, message]);
    }
  } else {
    messageCache.set(sessionId, [message]);
  }
}

/**
 * Append multiple messages to cached session messages
 * Deduplicates by message ID
 */
export function appendMessagesToCache(sessionId: string, messages: Message[]): void {
  const existing = messageCache.get(sessionId) || [];
  const existingIds = new Set(existing.map((m) => m.id));

  const newMessages = messages.filter((m) => !existingIds.has(m.id));

  if (newMessages.length > 0) {
    messageCache.set(sessionId, [...existing, ...newMessages]);
  }
}

/**
 * Update a specific message in the cache
 */
export function updateCachedMessage(
  sessionId: string,
  messageId: string,
  updates: Partial<Message>
): void {
  const messages = messageCache.get(sessionId);
  if (messages) {
    const index = messages.findIndex((m) => m.id === messageId);
    if (index !== -1) {
      const updated = [...messages];
      updated[index] = { ...updated[index], ...updates };
      messageCache.set(sessionId, updated);
    }
  }
}

/**
 * Remove messages for a session from cache
 */
export function clearCachedSession(sessionId: string): void {
  messageCache.delete(sessionId);
}

/**
 * Check if a session has cached messages
 */
export function hasCachedMessages(sessionId: string): boolean {
  return messageCache.has(sessionId);
}

/**
 * Get cache statistics for debugging
 */
export function getCacheStats(): {
  size: number;
  calculatedSize: number;
  maxSize: number;
  maxEntries: number;
} {
  return {
    size: messageCache.size,
    calculatedSize: messageCache.calculatedSize,
    maxSize: messageCache.maxSize,
    maxEntries: messageCache.max,
  };
}

/**
 * Clear all cached messages
 */
export function clearAllCachedMessages(): void {
  messageCache.clear();
}
