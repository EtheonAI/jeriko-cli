/**
 * SSE streaming completion route.
 * POST /v1/completions — accepts messages, streams SSE response.
 * POST /v1/completions/:sessionId/stop — abort a running completion.
 * This is what the Next.js chat route proxies to.
 *
 * Credit enforcement:
 *   - Checks credits BEFORE starting agent loop (returns 402 if insufficient)
 *   - Meters step completion and tool calls via billing service
 */

import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { ModelMessage } from "ai";
import { runStreamingAgentLoop } from "../lib/agent-loop.js";
import { getRedisClient } from "@repo/service-utils";
import { checkUserCredits, getUserLimits, type PlanLimits } from "../lib/billing-client.js";

// ── Active stream tracking ────────────────────────────────────────────────
// Maps sessionId → AbortController for active streaming completions.
// Enables the stop endpoint to cancel a running agent loop.
const activeStreams = new Map<string, AbortController>();

/** Check if a session has an active streaming completion. */
export function isSessionStreaming(sessionId: string): boolean {
  return activeStreams.has(sessionId);
}

/** Abort an active streaming completion. Returns true if aborted. */
export function abortSession(sessionId: string): boolean {
  const controller = activeStreams.get(sessionId);
  if (controller) {
    controller.abort();
    activeStreams.delete(sessionId);
    return true;
  }
  return false;
}

const completionBodySchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant", "system"]),
      content: z.union([z.string(), z.array(z.any())]),
    })
  ),
  sessionId: z.string().optional(),
  userId: z.string().optional(),
  userName: z.string().optional(),
  maxSteps: z.number().int().min(1).max(50).optional(),
  model: z.string().optional(),
  skills: z.array(z.string()).optional(),
  connections: z.array(
    z.object({
      id: z.string(),
      type: z.string().optional(),
      name: z.string().optional(),
    })
  ).optional(),
  fileContext: z.array(
    z.object({
      name: z.string(),
      type: z.string(),
      url: z.string().optional(),
    })
  ).optional(),
  /** Session metadata from DB — contains sandboxId for resume, skills/connections from previous runs */
  sessionMeta: z.record(z.string(), z.unknown()).optional(),
  /** Project ID for project-scoped Composio entity routing */
  projectId: z.string().optional(),
});

export const completionRoutes: FastifyPluginAsync = async (fastify) => {
  // SSE streaming completion
  fastify.post("/v1/completions", async (request, reply) => {
    // ── Idempotency guard ──────────────────────────────────────────────
    // Prevents duplicate tool executions (email sends, API calls) when
    // Inngest retries a timed-out task. The task service sends
    // x-idempotency-key: <executionId>. Redis SET NX ensures only the
    // first request proceeds; retries get 409 until the lock expires.
    const idempotencyKey = request.headers["x-idempotency-key"] as string | undefined;
    let idempotencyLockKey: string | null = null;

    if (idempotencyKey) {
      try {
        const redis = getRedisClient();
        idempotencyLockKey = `exec-lock:${idempotencyKey}`;
        // SET NX — only succeeds if key doesn't exist. TTL = 10 min (max execution time).
        const acquired = await redis.set(idempotencyLockKey, "in-progress", "EX", 600, "NX");
        if (!acquired) {
          const status = await redis.get(idempotencyLockKey);
          if (status === "completed") {
            return reply.status(200).send({ status: "already-completed", idempotencyKey });
          }
          return reply.status(409).send({ error: "Execution already in progress", idempotencyKey });
        }
      } catch (redisErr) {
        // Redis down — proceed without idempotency protection (better than crashing)
        fastify.log.warn({ idempotencyKey, error: redisErr }, "Redis unavailable for idempotency check — proceeding without lock");
        idempotencyLockKey = null;
      }
    }

    const parsed = completionBodySchema.safeParse(request.body);
    if (!parsed.success) {
      // Release lock on validation failure so retry can proceed
      if (idempotencyLockKey) {
        const redis = getRedisClient();
        await redis.del(idempotencyLockKey).catch(() => {});
      }
      return reply.status(400).send({
        error: "Invalid request body",
        details: parsed.error.issues,
      });
    }

    const {
      messages,
      sessionId = `sess_${Date.now()}`,
      userId = (request.headers["x-user-id"] as string) || "anonymous",
      userName = (request.headers["x-user-name"] as string) || undefined,
      maxSteps,
      skills,
      connections,
      fileContext,
      sessionMeta,
      projectId,
    } = parsed.data;

    // ── Credit check ────────────────────────────────────────────────────
    // Check credits BEFORE starting the agent loop. Returns 402 if insufficient.
    // Graceful: if billing service is down, allow (null result).
    const creditCheck = await checkUserCredits(userId, 10);
    if (creditCheck && !creditCheck.hasCredits) {
      // Release lock on credit failure
      if (idempotencyLockKey) {
        const redis = getRedisClient();
        await redis.del(idempotencyLockKey).catch(() => {});
      }
      return reply.status(402).send({
        error: "Insufficient credits",
        code: "PAYMENT_REQUIRED",
        balance: creditCheck.currentBalance,
        state: creditCheck.state,
        message: "You don't have enough credits to continue. Please upgrade your plan or purchase more credits.",
      });
    }

    // ── Plan limits ─────────────────────────────────────────────────────
    // Get plan limits for maxSteps enforcement
    const planLimits = await getUserLimits(userId);
    const effectiveMaxSteps = maxSteps
      ? Math.min(maxSteps, planLimits.maxStepsPerSession)
      : planLimits.maxStepsPerSession;

    // Create abort controller for this session
    const abortController = new AbortController();
    activeStreams.set(sessionId, abortController);

    try {
      const { stream, sandboxId } = await runStreamingAgentLoop({
        sessionId,
        userId,
        userName,
        messages: messages as ModelMessage[],
        maxSteps: effectiveMaxSteps,
        skills,
        connections,
        fileContext,
        sessionMeta,
        projectId,
        abortSignal: abortController.signal,
        planLimits: {
          maxParallelSubtasks: planLimits.maxParallelSubtasks,
          planType: planLimits.planType,
        },
      });

      // Set SSE headers — must include CORS manually since reply.raw bypasses Fastify.
      // Use the request Origin if it matches ALLOWED_ORIGINS, otherwise use the first allowed origin.
      const allowedOrigins = (process.env.ALLOWED_ORIGINS || "http://localhost:3000")
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean);
      const requestOrigin = request.headers.origin || "";
      const origin = allowedOrigins.includes(requestOrigin)
        ? requestOrigin
        : allowedOrigins[0] || "http://localhost:3000";
      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
        "x-vercel-ai-ui-message-stream": "v1",
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Credentials": "true",
        ...(sandboxId ? { "x-sandbox-id": sandboxId } : {}),
      });

      // Abort agent loop if client disconnects (TCP close)
      reply.raw.on("close", () => {
        if (!abortController.signal.aborted) {
          abortController.abort();
          activeStreams.delete(sessionId);
        }
      });

      // Pipe the stream to the response
      const reader = stream.getReader();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          reply.raw.write(value);
        }
      } catch (error) {
        // Client disconnected or stream error — abort agent loop
        if (!abortController.signal.aborted) {
          abortController.abort();
          const errMsg = error instanceof Error ? error.message : "Stream error";
          try { reply.raw.write(`data: ${JSON.stringify({ type: "error", error: errMsg })}\n\n`); } catch { /* client gone */ }
        }
      } finally {
        activeStreams.delete(sessionId);
        // Mark idempotency lock as completed (24h TTL for dedup window)
        if (idempotencyLockKey) {
          const redis = getRedisClient();
          await redis.set(idempotencyLockKey, "completed", "EX", 86400).catch(() => {});
        }
        try { reply.raw.end(); } catch { /* already closed */ }
      }
    } catch (error) {
      activeStreams.delete(sessionId);
      // Delete lock on failure so Inngest retry can proceed
      if (idempotencyLockKey) {
        const redis = getRedisClient();
        await redis.del(idempotencyLockKey).catch(() => {});
      }
      const errMsg = error instanceof Error ? error.message : "Completion failed";
      return reply.status(500).send({ error: errMsg });
    }
  });

  // Stop an active streaming completion
  fastify.post<{ Params: { sessionId: string } }>(
    "/v1/completions/:sessionId/stop",
    async (request, reply) => {
      const { sessionId } = request.params;
      const aborted = abortSession(sessionId);
      if (aborted) {
        return { success: true, message: "Completion stopped" };
      }
      return reply.status(404).send({
        error: "No active completion found for this session",
      });
    }
  );

  // Health check for completion service
  fastify.get("/v1/completions/health", async () => {
    return {
      status: "ok",
      hasApiKey: !!process.env.ANTHROPIC_API_KEY || !!process.env.OPENAI_API_KEY,
      model: process.env.ORCHESTRATOR_MODEL || "claude-sonnet-4-5-20250929",
      activeStreams: activeStreams.size,
    };
  });
};
