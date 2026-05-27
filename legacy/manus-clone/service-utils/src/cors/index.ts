import type { FastifyInstance, FastifyPluginAsync } from "fastify";

export interface CorsConfig {
  /**
   * Allowed origins
   * Can be a string, array of strings, or function
   * @default "*"
   */
  origin?: string | string[] | ((origin: string) => boolean);

  /**
   * Allowed HTTP methods
   * @default ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE"]
   */
  methods?: string[];

  /**
   * Allowed headers
   */
  allowedHeaders?: string[];

  /**
   * Exposed headers (accessible to the client)
   */
  exposedHeaders?: string[];

  /**
   * Allow credentials (cookies, authorization headers)
   * @default false
   */
  credentials?: boolean;

  /**
   * Max age for preflight cache in seconds
   * @default 86400 (24 hours)
   */
  maxAge?: number;

  /**
   * Enable preflight continue
   * @default false
   */
  preflightContinue?: boolean;

  /**
   * Success status for OPTIONS requests
   * @default 204
   */
  optionsSuccessStatus?: number;
}

const DEFAULT_METHODS = ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE"];
const DEFAULT_ALLOWED_HEADERS = [
  "Origin",
  "X-Requested-With",
  "Content-Type",
  "Accept",
  "Authorization",
  "X-API-Key",
  "X-Request-ID",
];
const DEFAULT_EXPOSED_HEADERS = [
  "X-Request-ID",
  "X-RateLimit-Limit",
  "X-RateLimit-Remaining",
  "X-RateLimit-Reset",
];

/**
 * Lightweight CORS plugin for Fastify
 * For full CORS support, use @fastify/cors
 */
export function corsPlugin(config: CorsConfig = {}): FastifyPluginAsync {
  const {
    origin = "*",
    methods = DEFAULT_METHODS,
    allowedHeaders = DEFAULT_ALLOWED_HEADERS,
    exposedHeaders = DEFAULT_EXPOSED_HEADERS,
    credentials = false,
    maxAge = 86400,
    preflightContinue = false,
    optionsSuccessStatus = 204,
  } = config;

  return async (fastify: FastifyInstance) => {
    // Check if origin is allowed
    const isOriginAllowed = (requestOrigin: string | undefined): string | false => {
      if (!requestOrigin) return false;

      if (origin === "*") {
        return credentials ? requestOrigin : "*";
      }

      if (typeof origin === "string") {
        return origin === requestOrigin ? requestOrigin : false;
      }

      if (Array.isArray(origin)) {
        return origin.includes(requestOrigin) ? requestOrigin : false;
      }

      if (typeof origin === "function") {
        return origin(requestOrigin) ? requestOrigin : false;
      }

      return false;
    };

    // Add CORS headers to all responses
    fastify.addHook("onRequest", async (request, reply) => {
      const requestOrigin = request.headers.origin;
      const allowedOrigin = isOriginAllowed(requestOrigin);

      if (allowedOrigin) {
        reply.header("Access-Control-Allow-Origin", allowedOrigin);
      }

      if (credentials) {
        reply.header("Access-Control-Allow-Credentials", "true");
      }

      if (exposedHeaders.length > 0) {
        reply.header("Access-Control-Expose-Headers", exposedHeaders.join(", "));
      }

      // Add Vary header for caching
      const existingVary = reply.getHeader("Vary") as string | undefined;
      if (existingVary) {
        if (!existingVary.toLowerCase().includes("origin")) {
          reply.header("Vary", `${existingVary}, Origin`);
        }
      } else {
        reply.header("Vary", "Origin");
      }
    });

    // Handle preflight OPTIONS requests
    fastify.options("*", async (request, reply) => {
      const requestOrigin = request.headers.origin;
      const allowedOrigin = isOriginAllowed(requestOrigin);

      if (!allowedOrigin) {
        return reply.status(403).send({ error: "CORS not allowed" });
      }

      reply.header("Access-Control-Allow-Origin", allowedOrigin);
      reply.header("Access-Control-Allow-Methods", methods.join(", "));
      reply.header("Access-Control-Allow-Headers", allowedHeaders.join(", "));
      reply.header("Access-Control-Max-Age", maxAge.toString());

      if (credentials) {
        reply.header("Access-Control-Allow-Credentials", "true");
      }

      if (preflightContinue) {
        return;
      }

      return reply.status(optionsSuccessStatus).send();
    });

    fastify.log.info("CORS plugin registered");
  };
}

/**
 * Common CORS configurations
 */
export const corsPresets = {
  /**
   * Allow all origins (development)
   */
  development: {
    origin: "*",
    credentials: false,
  } satisfies CorsConfig,

  /**
   * Strict same-origin (production default)
   */
  strict: {
    origin: (origin: string) => false, // Deny all cross-origin
    credentials: true,
  } satisfies CorsConfig,

  /**
   * Allow specific origins (production)
   */
  production: (allowedOrigins: string[]): CorsConfig => ({
    origin: allowedOrigins,
    credentials: true,
    methods: DEFAULT_METHODS,
  }),

  /**
   * Allow subdomains of a domain
   */
  subdomains: (domain: string): CorsConfig => ({
    origin: (origin: string) => {
      const url = new URL(origin);
      return url.hostname === domain || url.hostname.endsWith(`.${domain}`);
    },
    credentials: true,
  }),
};

/**
 * Validate origin against a pattern
 */
export function createOriginValidator(
  patterns: Array<string | RegExp>
): (origin: string) => boolean {
  return (origin: string) => {
    return patterns.some((pattern) => {
      if (typeof pattern === "string") {
        return origin === pattern;
      }
      return pattern.test(origin);
    });
  };
}

/**
 * Parse allowed origins from environment variable
 */
export function parseOriginsFromEnv(envValue: string | undefined): string[] {
  if (!envValue) return [];
  return envValue
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
}
