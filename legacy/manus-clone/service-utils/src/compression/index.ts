import type { FastifyInstance, FastifyPluginAsync } from "fastify";

export interface CompressionConfig {
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

const DEFAULT_MIME_TYPES = [
  "text/plain",
  "text/html",
  "text/css",
  "text/javascript",
  "application/json",
  "application/javascript",
  "application/xml",
  "application/x-www-form-urlencoded",
  "image/svg+xml",
];

/**
 * Lightweight compression plugin for Fastify
 * For production, use @fastify/compress which provides full gzip/brotli support
 *
 * This implementation provides response compression awareness and headers
 */
export function compressionPlugin(
  config: CompressionConfig = {}
): FastifyPluginAsync {
  const {
    threshold = 1024,
    mimeTypes = DEFAULT_MIME_TYPES,
    excludeRoutes = [],
  } = config;

  return async (fastify: FastifyInstance) => {
    // Add compression-related headers
    fastify.addHook("onSend", async (request, reply, payload) => {
      // Skip excluded routes
      if (excludeRoutes.some((route) => request.url.startsWith(route))) {
        return payload;
      }

      // Skip if no payload or already compressed
      if (!payload || reply.hasHeader("content-encoding")) {
        return payload;
      }

      const contentType = reply.getHeader("content-type") as string | undefined;

      // Skip non-compressible content types
      if (contentType && !mimeTypes.some((mt) => contentType.includes(mt))) {
        return payload;
      }

      // Get payload size
      const payloadSize =
        typeof payload === "string"
          ? Buffer.byteLength(payload)
          : payload instanceof Buffer
            ? payload.length
            : 0;

      // Skip small payloads
      if (payloadSize < threshold) {
        return payload;
      }

      // Add Vary header for caching
      const existingVary = reply.getHeader("vary") as string | undefined;
      if (existingVary) {
        if (!existingVary.toLowerCase().includes("accept-encoding")) {
          reply.header("vary", `${existingVary}, Accept-Encoding`);
        }
      } else {
        reply.header("vary", "Accept-Encoding");
      }

      return payload;
    });

    fastify.log.info("Compression awareness plugin registered");
  };
}

/**
 * Check if client accepts compression
 */
export function clientAcceptsCompression(
  acceptEncoding: string | undefined
): { gzip: boolean; brotli: boolean; deflate: boolean } {
  if (!acceptEncoding) {
    return { gzip: false, brotli: false, deflate: false };
  }

  const lower = acceptEncoding.toLowerCase();
  return {
    gzip: lower.includes("gzip"),
    brotli: lower.includes("br"),
    deflate: lower.includes("deflate"),
  };
}

/**
 * Get best compression method based on client accept-encoding
 */
export function getBestCompression(
  acceptEncoding: string | undefined
): "br" | "gzip" | "deflate" | null {
  const accepts = clientAcceptsCompression(acceptEncoding);

  // Brotli is best, then gzip, then deflate
  if (accepts.brotli) return "br";
  if (accepts.gzip) return "gzip";
  if (accepts.deflate) return "deflate";
  return null;
}

/**
 * Response size utilities
 */
export const responseSize = {
  /**
   * Format bytes to human-readable string
   */
  format(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  },

  /**
   * Calculate compression ratio
   */
  compressionRatio(original: number, compressed: number): number {
    if (original === 0) return 0;
    return Number((((original - compressed) / original) * 100).toFixed(2));
  },
};
