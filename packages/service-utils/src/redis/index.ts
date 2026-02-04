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

export function subscribe(
  channel: string,
  callback: (message: unknown) => void
): void {
  const sub = getRedisSubClient();
  sub.subscribe(channel);
  sub.on("message", (ch: string, msg: string) => {
    if (ch === channel) {
      callback(JSON.parse(msg));
    }
  });
}

export async function closeRedis(): Promise<void> {
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
