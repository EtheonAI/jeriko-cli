// src/types/index.ts
import { z } from "zod";
var TaskStatusSchema = z.enum([
  "pending",
  "running",
  "paused",
  "completed",
  "failed",
  "cancelled"
]);
var TaskPrioritySchema = z.enum(["low", "normal", "high", "urgent"]);
var DeviceTypeSchema = z.enum(["pc", "iot", "mobile", "browser"]);
var DeviceStatusSchema = z.enum([
  "online",
  "offline",
  "busy",
  "error"
]);
var DeviceCapabilitySchema = z.enum([
  "terminal",
  "filesystem",
  "browser",
  "screen",
  "audio",
  "gpio",
  "sensor",
  "actuator"
]);
var AgentModelSchema = z.enum([
  "claude-3-5-sonnet",
  "claude-3-opus",
  "gpt-4o",
  "gpt-4o-mini"
]);
var MessageRoleSchema = z.enum(["user", "assistant", "system", "tool"]);
var WebsiteFrameworkSchema = z.enum([
  "nextjs",
  "react",
  "vue",
  "svelte",
  "astro"
]);
var WebsiteStatusSchema = z.enum([
  "draft",
  "building",
  "ready",
  "deployed",
  "error"
]);

// src/logger/index.ts
import pino from "pino";
function createLogger(options) {
  const { service, level = "info", pretty = process.env.NODE_ENV !== "production" } = options;
  return pino({
    level,
    name: service,
    ...pretty && {
      transport: {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:standard",
          ignore: "pid,hostname"
        }
      }
    },
    base: {
      service,
      env: process.env.NODE_ENV || "development"
    },
    timestamp: pino.stdTimeFunctions.isoTime
  });
}

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

// src/auth/index.ts
import * as jose from "jose";
import { z as z2 } from "zod";
var JWTPayloadSchema = z2.object({
  sub: z2.string(),
  email: z2.string().email(),
  name: z2.string().optional(),
  iat: z2.number(),
  exp: z2.number()
});
var jwtSecret = null;
function getJWTSecret() {
  if (!jwtSecret) {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error("JWT_SECRET environment variable is required");
    }
    jwtSecret = new TextEncoder().encode(secret);
  }
  return jwtSecret;
}
async function verifyToken(token) {
  try {
    const { payload } = await jose.jwtVerify(token, getJWTSecret());
    const parsed = JWTPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}
async function createToken(userId, email, name, expiresIn = "7d") {
  const token = await new jose.SignJWT({
    sub: userId,
    email,
    name
  }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(expiresIn).sign(getJWTSecret());
  return token;
}
async function validateApiKey(apiKey) {
  const parts = apiKey.split("_");
  if (parts.length !== 3 || parts[0] !== "rubic") {
    return null;
  }
  return {
    userId: parts[1] ?? "",
    keyId: parts[2] ?? "",
    scopes: ["*"]
  };
}
async function extractAuth(authorization, apiKey) {
  if (authorization?.startsWith("Bearer ")) {
    const token = authorization.slice(7);
    const payload = await verifyToken(token);
    if (payload) {
      return {
        userId: payload.sub,
        email: payload.email,
        name: payload.name,
        type: "jwt"
      };
    }
  }
  if (apiKey) {
    const payload = await validateApiKey(apiKey);
    if (payload) {
      return {
        userId: payload.userId,
        type: "apikey"
      };
    }
  }
  return null;
}

// src/index.ts
import { createId } from "@paralleldrive/cuid2";
import { z as z3 } from "zod";
function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}
function getEnv(name, defaultValue) {
  return process.env[name] || defaultValue;
}
function createHealthCheck(service, version, checks) {
  const allPass = checks.every((c) => c.status === "pass");
  return {
    status: allPass ? "healthy" : "unhealthy",
    service,
    version,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    checks
  };
}
function successResponse(data, requestId) {
  return {
    data,
    meta: {
      requestId,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    },
    error: null
  };
}
function errorResponse(error, requestId) {
  return {
    data: null,
    meta: {
      requestId,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    },
    error
  };
}
var ErrorCodes = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  RATE_LIMITED: "RATE_LIMITED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE"
};
export {
  AgentModelSchema,
  DeviceCapabilitySchema,
  DeviceStatusSchema,
  DeviceTypeSchema,
  ErrorCodes,
  JWTPayloadSchema,
  MessageRoleSchema,
  TaskPrioritySchema,
  TaskStatusSchema,
  WebsiteFrameworkSchema,
  WebsiteStatusSchema,
  cacheDel,
  cacheGet,
  cacheSet,
  closeRedis,
  createHealthCheck,
  createId,
  createLogger,
  createToken,
  errorResponse,
  extractAuth,
  getEnv,
  getRedisClient,
  getRedisConfig,
  getRedisPubClient,
  getRedisSubClient,
  publish,
  requireEnv,
  subscribe,
  successResponse,
  validateApiKey,
  verifyToken,
  z3 as z
};
//# sourceMappingURL=index.js.map