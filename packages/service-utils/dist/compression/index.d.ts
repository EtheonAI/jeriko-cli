import { FastifyPluginAsync } from 'fastify';

interface CompressionConfig {
    /**
     * Minimum payload size in bytes to compress
     * @default 1024
     */
    threshold?: number;
    /**
     * Compression level (1-9, higher = better compression, slower)
     * @default 6
     */
    level?: number;
    /**
     * MIME types to compress
     */
    mimeTypes?: string[];
    /**
     * Routes to exclude from compression
     */
    excludeRoutes?: string[];
}
/**
 * Lightweight compression plugin for Fastify
 * For production, use @fastify/compress which provides full gzip/brotli support
 *
 * This implementation provides response compression awareness and headers
 */
declare function compressionPlugin(config?: CompressionConfig): FastifyPluginAsync;
/**
 * Check if client accepts compression
 */
declare function clientAcceptsCompression(acceptEncoding: string | undefined): {
    gzip: boolean;
    brotli: boolean;
    deflate: boolean;
};
/**
 * Get best compression method based on client accept-encoding
 */
declare function getBestCompression(acceptEncoding: string | undefined): "br" | "gzip" | "deflate" | null;
/**
 * Response size utilities
 */
declare const responseSize: {
    /**
     * Format bytes to human-readable string
     */
    format(bytes: number): string;
    /**
     * Calculate compression ratio
     */
    compressionRatio(original: number, compressed: number): number;
};

export { type CompressionConfig, clientAcceptsCompression, compressionPlugin, getBestCompression, responseSize };
