// @ts-nocheck - ioredis types have ESM compatibility issues
import Redis from "ioredis";

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
}

let redisClient: any = null;
let redisPubClient: any = null;
let redisSubClient: any = null;

// Track per-channel subscriber callbacks for proper cleanup
const channelSubscribers = new Map<string, Set<(message: unknown) => void>>();

export function getRedisConfig(): RedisConfig {
  return {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379", 10),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || "0", 10),
    keyPrefix: process.env.REDIS_KEY_PREFIX || "rubic:",
  };
}

export function getRedisClient() {
  if (!redisClient) {
    const config = getRedisConfig();
    redisClient = new (Redis as any)({
      host: config.host,
      port: config.port,
      password: config.password,
      db: config.db,
      keyPrefix: config.keyPrefix,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });
  }
  return redisClient;
}

export function getRedisPubClient() {
  if (!redisPubClient) {
    const config = getRedisConfig();
    redisPubClient = new (Redis as any)({
      host: config.host,
      port: config.port,
      password: config.password,
      db: config.db,
    });
  }
  return redisPubClient;
}

export function getRedisSubClient() {
  if (!redisSubClient) {
    const config = getRedisConfig();
    redisSubClient = new (Redis as any)({
      host: config.host,
      port: config.port,
      password: config.password,
      db: config.db,
    });

    // Single global message handler that dispatches to per-channel callbacks
    redisSubClient.on("message", (ch: string, msg: string) => {
      const callbacks = channelSubscribers.get(ch);
      if (!callbacks || callbacks.size === 0) return;
      let parsed: unknown;
      try {
        parsed = JSON.parse(msg);
      } catch {
        return;
      }
      for (const cb of callbacks) {
        try {
          cb(parsed);
        } catch {
          // Individual callback errors should not break others
        }
      }
    });
  }
  return redisSubClient;
}

// Cache helpers
export async function cacheGet<T>(key: string): Promise<T | null> {
  const redis = getRedisClient();
  const value = await redis.get(key);
  if (!value) return null;
  return JSON.parse(value) as T;
}

export async function cacheSet<T>(
  key: string,
  value: T,
  ttlSeconds?: number
): Promise<void> {
  const redis = getRedisClient();
  const serialized = JSON.stringify(value);
  if (ttlSeconds) {
    await redis.setex(key, ttlSeconds, serialized);
  } else {
    await redis.set(key, serialized);
  }
}

export async function cacheDel(key: string): Promise<void> {
  const redis = getRedisClient();
  await redis.del(key);
}

// Pub/Sub helpers
export async function publish(channel: string, message: unknown): Promise<void> {
  const pub = getRedisPubClient();
  await pub.publish(channel, JSON.stringify(message));
}

/**
 * Subscribe to a Redis channel with proper lifecycle management.
 * Returns an unsubscribe function that cleans up the listener.
 * Only calls Redis SUBSCRIBE when the first callback is added for a channel,
 * and Redis UNSUBSCRIBE when the last callback is removed.
 */
export function subscribe(
  channel: string,
  callback: (message: unknown) => void
): () => void {
  const sub = getRedisSubClient();

  let callbacks = channelSubscribers.get(channel);
  if (!callbacks) {
    callbacks = new Set();
    channelSubscribers.set(channel, callbacks);
    // First subscriber for this channel — subscribe at Redis level
    sub.subscribe(channel);
  }

  callbacks.add(callback);

  // Return unsubscribe function
  return () => {
    const cbs = channelSubscribers.get(channel);
    if (!cbs) return;
    cbs.delete(callback);
    if (cbs.size === 0) {
      channelSubscribers.delete(channel);
      // Last subscriber removed — unsubscribe at Redis level
      sub.unsubscribe(channel);
    }
  };
}

export async function closeRedis(): Promise<void> {
  // Clear all subscription tracking
  channelSubscribers.clear();

  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
  if (redisPubClient) {
    await redisPubClient.quit();
    redisPubClient = null;
  }
  if (redisSubClient) {
    await redisSubClient.quit();
    redisSubClient = null;
  }
}
