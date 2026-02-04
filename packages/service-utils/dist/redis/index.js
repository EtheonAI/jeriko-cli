// src/redis/index.ts
import Redis from "ioredis";
var redisClient = null;
var redisPubClient = null;
var redisSubClient = null;
function getRedisConfig() {
  return {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379", 10),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || "0", 10),
    keyPrefix: process.env.REDIS_KEY_PREFIX || "rubic:"
  };
}
function getRedisClient() {
  if (!redisClient) {
    const config = getRedisConfig();
    redisClient = new Redis({
      host: config.host,
      port: config.port,
      password: config.password,
      db: config.db,
      keyPrefix: config.keyPrefix,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2e3);
        return delay;
      }
    });
  }
  return redisClient;
}
function getRedisPubClient() {
  if (!redisPubClient) {
    const config = getRedisConfig();
    redisPubClient = new Redis({
      host: config.host,
      port: config.port,
      password: config.password,
      db: config.db
    });
  }
  return redisPubClient;
}
function getRedisSubClient() {
  if (!redisSubClient) {
    const config = getRedisConfig();
    redisSubClient = new Redis({
      host: config.host,
      port: config.port,
      password: config.password,
      db: config.db
    });
  }
  return redisSubClient;
}
async function cacheGet(key) {
  const redis = getRedisClient();
  const value = await redis.get(key);
  if (!value) return null;
  return JSON.parse(value);
}
async function cacheSet(key, value, ttlSeconds) {
  const redis = getRedisClient();
  const serialized = JSON.stringify(value);
  if (ttlSeconds) {
    await redis.setex(key, ttlSeconds, serialized);
  } else {
    await redis.set(key, serialized);
  }
}
async function cacheDel(key) {
  const redis = getRedisClient();
  await redis.del(key);
}
async function publish(channel, message) {
  const pub = getRedisPubClient();
  await pub.publish(channel, JSON.stringify(message));
}
function subscribe(channel, callback) {
  const sub = getRedisSubClient();
  sub.subscribe(channel);
  sub.on("message", (ch, msg) => {
    if (ch === channel) {
      callback(JSON.parse(msg));
    }
  });
}
async function closeRedis() {
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
export {
  cacheDel,
  cacheGet,
  cacheSet,
  closeRedis,
  getRedisClient,
  getRedisConfig,
  getRedisPubClient,
  getRedisSubClient,
  publish,
  subscribe
};
//# sourceMappingURL=index.js.map