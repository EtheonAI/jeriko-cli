// ============================================================
// Resumable Stream Helper — Redis-backed SSE persistence
// ============================================================
//
// Uses the `resumable-stream` package (AI SDK ecosystem) to
// persist SSE chunks in Redis so disconnected clients can
// seamlessly resume an in-flight agent stream.
//
// Graceful degradation: if REDIS_URL is not set, all exports
// return null / no-op so the system falls back to non-resumable
// streaming (the current behaviour).
// ============================================================

import { log } from "@repo/observability/log";
import { db, agentSessions, eq } from "@repo/database";

// ============================================================
// Lazy singleton — stream context
// ============================================================

let _streamContext: Awaited<ReturnType<typeof import("resumable-stream/ioredis")["createResumableStreamContext"]>> | null = null;
let _initAttempted = false;

/**
 * Returns a resumable-stream context backed by Redis.
 * Returns `null` if Redis is not configured or connection failed.
 */
export async function getStreamContext() {
  if (_initAttempted) return _streamContext;
  _initAttempted = true;

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    log.info("REDIS_URL not set — resumable streams disabled");
    return null;
  }

  try {
    const { createResumableStreamContext } = await import("resumable-stream/ioredis");

    _streamContext = createResumableStreamContext({
      // waitUntil is for Vercel serverless (extends function lifetime).
      // On self-hosted / non-serverless, pass null.
      waitUntil: null,
      keyPrefix: "rubic-chat-stream",
    });

    log.info("Resumable stream context initialised (Redis-backed)");
    return _streamContext;
  } catch (err) {
    log.warn("Failed to initialise resumable stream context:", { error: (err as Error).message });
    return null;
  }
}

// ============================================================
// Active stream tracking (DB)
// ============================================================

/**
 * Look up the active stream ID for a session.
 * Returns null if no active stream or DB error.
 */
export async function getActiveStreamId(sessionId: string): Promise<string | null> {
  try {
    const [row] = await db
      .select({ activeStreamId: agentSessions.activeStreamId })
      .from(agentSessions)
      .where(eq(agentSessions.id, sessionId))
      .limit(1);
    return row?.activeStreamId ?? null;
  } catch (err) {
    log.error("Failed to get active stream ID:", err as Error);
    return null;
  }
}

/**
 * Set the active stream ID for a session (called when POST starts streaming).
 */
export async function setActiveStreamId(sessionId: string, streamId: string): Promise<void> {
  try {
    await db
      .update(agentSessions)
      .set({ activeStreamId: streamId })
      .where(eq(agentSessions.id, sessionId));
  } catch (err) {
    log.error("Failed to set active stream ID:", err as Error);
  }
}

/**
 * Clear the active stream ID for a session (called when stream ends).
 */
export async function clearActiveStreamId(sessionId: string): Promise<void> {
  try {
    await db
      .update(agentSessions)
      .set({ activeStreamId: null })
      .where(eq(agentSessions.id, sessionId));
  } catch (err) {
    log.error("Failed to clear active stream ID:", err as Error);
  }
}
