import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

const port = z.coerce.number().int().min(1).max(65_535);

export const env = createEnv({
  server: {
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: port.default(3000),
    HOST: z.string().default("0.0.0.0"),
    LOG_LEVEL: z.string().default("info"),
    SERVICE_VERSION: z.string().default("1.0.0"),
    ALLOWED_ORIGINS: z.string().default("http://localhost:3000"),
    WEBHOOK_SERVICE_URL: z.string().url().default("http://localhost:4007"),
    GATEWAY_SECRET: z.string().optional(),
    JWT_SECRET: z.string().optional(),
    INTERNAL_SERVICE_SECRET: z.string().optional(),
    REDIS_HOST: z.string().default("localhost"),
    REDIS_PORT: port.default(6379),
    REDIS_PASSWORD: z.string().optional(),
    REDIS_DB: z.coerce.number().int().min(0).default(0),
    REDIS_KEY_PREFIX: z.string().default("jeriko:"),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});

export type ServiceRuntimeEnv = typeof env;

export function getAllowedOrigins(): string[] {
  return env.ALLOWED_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function requireEnv(name: keyof ServiceRuntimeEnv): string {
  const value = env[name];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getEnv(name: keyof ServiceRuntimeEnv, defaultValue: string): string {
  const value = env[name];
  return typeof value === "string" && value.length > 0 ? value : defaultValue;
}
