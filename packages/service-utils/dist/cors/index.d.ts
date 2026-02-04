import { FastifyPluginAsync } from 'fastify';

interface CorsConfig {
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
/**
 * Lightweight CORS plugin for Fastify
 * For full CORS support, use @fastify/cors
 */
declare function corsPlugin(config?: CorsConfig): FastifyPluginAsync;
/**
 * Common CORS configurations
 */
declare const corsPresets: {
    /**
     * Allow all origins (development)
     */
    development: {
        origin: string;
        credentials: false;
    };
    /**
     * Strict same-origin (production default)
     */
    strict: {
        origin: (origin: string) => false;
        credentials: true;
    };
    /**
     * Allow specific origins (production)
     */
    production: (allowedOrigins: string[]) => CorsConfig;
    /**
     * Allow subdomains of a domain
     */
    subdomains: (domain: string) => CorsConfig;
};
/**
 * Validate origin against a pattern
 */
declare function createOriginValidator(patterns: Array<string | RegExp>): (origin: string) => boolean;
/**
 * Parse allowed origins from environment variable
 */
declare function parseOriginsFromEnv(envValue: string | undefined): string[];

export { type CorsConfig, corsPlugin, corsPresets, createOriginValidator, parseOriginsFromEnv };
