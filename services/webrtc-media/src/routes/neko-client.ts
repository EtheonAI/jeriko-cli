/**
 * Neko Client — serves the Neko web client from S3 (Manus CDN pattern).
 *
 * Moved from orchestrator. Serves static files from S3 neko-client/ prefix
 * with in-memory caching, ETag support, and iframe-friendly headers.
 * Falls back to local neko-client/ directory in development.
 *
 * Routes:
 *   GET /neko-client/*  — serves static files from S3 neko-client/ prefix
 */

import type { FastifyInstance } from "fastify";
import { createLogger } from "@repo/service-utils";
import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const logger = createLogger({ service: "neko-client" });

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOCAL_NEKO_DIR = resolve(__dirname, "../../neko-client");

const S3_PREFIX = "neko-client";

// In-memory cache for static files (they rarely change)
const fileCache = new Map<string, { body: Buffer; contentType: string; etag: string }>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const cacheTimestamps = new Map<string, number>();

// Lazy-load storage
let _storage: typeof import("@repo/storage") | null = null;
async function getStorage(): Promise<typeof import("@repo/storage")> {
  if (!_storage) {
    const mod = await import("@repo/storage");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _storage = (mod as any).default ?? mod;
  }
  return _storage!;
}

const MIME_MAP: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json",
  ".mp3": "audio/mpeg",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".eot": "application/vnd.ms-fontobject",
  ".xml": "application/xml",
};

function getMimeType(path: string): string {
  const ext = path.substring(path.lastIndexOf(".")).toLowerCase();
  return MIME_MAP[ext] || "application/octet-stream";
}

export async function nekoClientRoutes(app: FastifyInstance) {
  app.get("/neko-client/*", async (request, reply) => {
    const url = request.url;
    // Extract path after /neko-client/
    let filePath = url.split("/neko-client/")[1] || "";
    // Strip query params
    filePath = filePath.split("?")[0] ?? "";

    if (!filePath) filePath = "index.html";

    // Security: prevent path traversal
    if (filePath.includes("..") || filePath.includes("//")) {
      return reply.status(400).send({ error: "Invalid path" });
    }

    const s3Key = `${S3_PREFIX}/${filePath}`;

    // Check in-memory cache
    const now = Date.now();
    const cached = fileCache.get(s3Key);
    const cacheTime = cacheTimestamps.get(s3Key) || 0;
    if (cached && now - cacheTime < CACHE_TTL_MS) {
      // Check If-None-Match for client-side cache
      const ifNoneMatch = request.headers["if-none-match"];
      if (ifNoneMatch === cached.etag) {
        return reply.status(304).send();
      }

      return reply
        .header("Content-Type", cached.contentType)
        .header("Cache-Control", "public, max-age=300")
        .header("ETag", cached.etag)
        .header("X-Content-Type-Options", "nosniff")
        .removeHeader("X-Frame-Options") // Allow iframe embedding
        .send(cached.body);
    }

    // Try local file first (development), then S3 (production)
    try {
      const localPath = resolve(LOCAL_NEKO_DIR, filePath);
      // Security: ensure resolved path is within LOCAL_NEKO_DIR
      if (localPath.startsWith(LOCAL_NEKO_DIR)) {
        const body = await readFile(localPath);
        const contentType = getMimeType(filePath);
        const etag = `"${Buffer.from(s3Key + body.length).toString("base64url")}"`;
        fileCache.set(s3Key, { body, contentType, etag });
        cacheTimestamps.set(s3Key, now);
        return reply
          .header("Content-Type", contentType)
          .header("Cache-Control", "public, max-age=300")
          .header("ETag", etag)
          .header("X-Content-Type-Options", "nosniff")
          .removeHeader("X-Frame-Options")
          .send(body);
      }
    } catch {
      // Local file not found — fall through to S3
    }

    try {
      const storage = await getStorage();
      // Use presigned URL to fetch from S3 (private bucket)
      const presignedUrl = await storage.getPresignedUrl(s3Key, 3600);
      const resp = await fetch(presignedUrl);

      if (!resp.ok) {
        if (resp.status === 404) {
          return reply.status(404).send({ error: "File not found" });
        }
        throw new Error(`S3 fetch failed: ${resp.status}`);
      }

      const body = Buffer.from(await resp.arrayBuffer());
      const contentType = getMimeType(filePath);
      const etag = `"${Buffer.from(s3Key + body.length).toString("base64url")}"`;

      // Cache it
      fileCache.set(s3Key, { body, contentType, etag });
      cacheTimestamps.set(s3Key, now);

      return reply
        .header("Content-Type", contentType)
        .header("Cache-Control", "public, max-age=300")
        .header("ETag", etag)
        .header("X-Content-Type-Options", "nosniff")
        .removeHeader("X-Frame-Options") // Allow iframe embedding
        .send(body);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      logger.error({ s3Key, error: errMsg }, "Neko client: failed to serve file");
      return reply.status(500).send({ error: "Failed to load file" });
    }
  });
}
