/**
 * Internal service-to-service HMAC request signing.
 * Gateway signs outbound requests; services verify signatures.
 *
 * Usage (gateway / caller side):
 *   const { signature, timestamp } = signInternalRequest("POST", "/files/upload", bodyString);
 *   headers["x-internal-signature"] = signature;
 *   headers["x-internal-timestamp"] = String(timestamp);
 *
 * Usage (service side):
 *   app.addHook("onRequest", internalAuthMiddleware());
 */

import { createHmac, createHash, timingSafeEqual } from "node:crypto";
import type { FastifyRequest, FastifyReply } from "fastify";
import { requireEnv } from "../env.js";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const DEFAULT_MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes

const SKIP_AUTH_PREFIXES = ["/health", "/metrics", "/ready", "/live"];

function getInternalSecret(): string {
  return requireEnv("INTERNAL_SERVICE_SECRET");
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sha256Hex(data: string): string {
  return createHash("sha256").update(data, "utf-8").digest("hex");
}

function hmacSha256Hex(key: string, data: string): string {
  return createHmac("sha256", key).update(data, "utf-8").digest("hex");
}

// ---------------------------------------------------------------------------
// Sign
// ---------------------------------------------------------------------------

/**
 * Sign an outbound internal request.
 *
 * The canonical string that gets signed is:
 *   `${timestamp}.${METHOD}.${path}.${sha256(body)}`
 *
 * @param method  HTTP method (GET, POST, etc.) — uppercased internally.
 * @param path    Request path (e.g. "/files/upload").
 * @param body    Raw request body string. Omit or pass empty string for bodyless requests.
 * @param timestamp  Unix epoch milliseconds. Defaults to Date.now().
 * @returns An object with `signature` (hex string) and `timestamp` (ms).
 */
export function signInternalRequest(
  method: string,
  path: string,
  body?: string,
  timestamp?: number
): { signature: string; timestamp: number } {
  const ts = timestamp ?? Date.now();
  const bodyHash = sha256Hex(body ?? "");
  const canonical = `${ts}.${method.toUpperCase()}.${path}.${bodyHash}`;
  const signature = hmacSha256Hex(getInternalSecret(), canonical);
  return { signature, timestamp: ts };
}

// ---------------------------------------------------------------------------
// Verify
// ---------------------------------------------------------------------------

/**
 * Verify an internal HMAC signature.
 *
 * Recomputes the expected signature and performs a timing-safe comparison.
 * Also checks that the timestamp is within `maxAgeMs` of the current time.
 *
 * @param signature  The hex signature from the `x-internal-signature` header.
 * @param method     HTTP method.
 * @param path       Request path.
 * @param body       Raw request body string (or empty string).
 * @param timestamp  The timestamp (ms) from the `x-internal-timestamp` header.
 * @param maxAgeMs   Maximum allowed age in milliseconds (default 5 min).
 * @returns `true` if the signature is valid and the timestamp is fresh.
 */
export function verifyInternalSignature(
  signature: string,
  method: string,
  path: string,
  body?: string,
  timestamp?: number,
  maxAgeMs: number = DEFAULT_MAX_AGE_MS
): boolean {
  // Timestamp is required for verification
  if (timestamp === undefined || timestamp === null) {
    return false;
  }

  // Check timestamp freshness
  const now = Date.now();
  const age = Math.abs(now - timestamp);
  if (age > maxAgeMs) {
    return false;
  }

  // Recompute expected signature
  const bodyHash = sha256Hex(body ?? "");
  const canonical = `${timestamp}.${method.toUpperCase()}.${path}.${bodyHash}`;
  const expected = hmacSha256Hex(getInternalSecret(), canonical);

  // Timing-safe comparison
  const sigBuf = Buffer.from(signature, "utf-8");
  const expBuf = Buffer.from(expected, "utf-8");

  if (sigBuf.length !== expBuf.length) {
    // Hash both to fixed length to avoid timing leak on length difference
    const sigHash = createHash("sha256").update(sigBuf).digest();
    const expHash = createHash("sha256").update(expBuf).digest();
    return timingSafeEqual(sigHash, expHash) && sigBuf.length === expBuf.length;
  }

  return timingSafeEqual(sigBuf, expBuf);
}

// ---------------------------------------------------------------------------
// Fastify Middleware
// ---------------------------------------------------------------------------

/**
 * Fastify preHandler hook that verifies internal HMAC signatures.
 *
 * Expects:
 *   - `x-internal-signature` header (hex HMAC)
 *   - `x-internal-timestamp` header (unix epoch ms)
 *
 * Skips verification for health/metrics routes:
 *   /health, /metrics, /ready, /live
 *
 * @returns A Fastify preHandler function.
 */
export function internalAuthMiddleware() {
  return async function verifyInternalAuth(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    // Skip auth for health/metrics endpoints
    if (SKIP_AUTH_PREFIXES.some((prefix) => request.url.startsWith(prefix))) {
      return;
    }

    const signature = request.headers["x-internal-signature"] as
      | string
      | undefined;
    const timestampHeader = request.headers["x-internal-timestamp"] as
      | string
      | undefined;

    if (!signature || !timestampHeader) {
      reply.code(401).send({
        error: "Unauthorized",
        message: "Missing internal authentication headers",
      });
      return;
    }

    const timestamp = Number(timestampHeader);
    if (isNaN(timestamp)) {
      reply.code(401).send({
        error: "Unauthorized",
        message: "Invalid internal timestamp",
      });
      return;
    }

    // Collect raw body — for GET/HEAD/DELETE there is typically no body
    const rawBody =
      typeof request.body === "string"
        ? request.body
        : request.body != null
          ? JSON.stringify(request.body)
          : "";

    const isValid = verifyInternalSignature(
      signature,
      request.method,
      request.url,
      rawBody,
      timestamp
    );

    if (!isValid) {
      reply.code(401).send({
        error: "Unauthorized",
        message: "Invalid internal signature",
      });
      return;
    }
  };
}
