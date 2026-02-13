/**
 * SSE streaming completion route.
 * POST /v1/completions — accepts messages, streams SSE response.
 * POST /v1/completions/:sessionId/stop — abort a running completion.
 * This is what the Next.js chat route proxies to.
 */

import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { ModelMessage } from 'ai';
import { runStreamingAgentLoop } from '../lib/agent-loop.js';

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
      role: z.enum(['user', 'assistant', 'system']),
      content: z.union([z.string(), z.array(z.any())]),
    }),
  ),
  sessionId: z.string().optional(),
  userId: z.string().optional(),
  userName: z.string().optional(),
  maxSteps: z.number().int().min(1).max(50).optional(),
  model: z.string().optional(),
});

export const completionRoutes: FastifyPluginAsync = async (fastify) => {
  // SSE streaming completion
  fastify.post('/v1/completions', async (request, reply) => {
    const parsed = completionBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Invalid request body',
        details: parsed.error.issues,
      });
    }

    const {
      messages,
      sessionId = `sess_${Date.now()}`,
      userId = request.headers['x-user-id'] as string || 'anonymous',
      userName = request.headers['x-user-name'] as string || undefined,
      maxSteps,
    } = parsed.data;

    // Create abort controller for this session
    const abortController = new AbortController();
    activeStreams.set(sessionId, abortController);

    try {
      const { stream, sandboxId } = await runStreamingAgentLoop({
        sessionId,
        userId,
        userName,
        messages: messages as ModelMessage[],
        maxSteps,
        abortSignal: abortController.signal,
      });

      // Set SSE headers — must include CORS manually since reply.raw bypasses Fastify
      const origin = request.headers.origin || 'http://localhost:3000';
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
        'x-vercel-ai-ui-message-stream': 'v1',
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Credentials': 'true',
        ...(sandboxId ? { 'x-sandbox-id': sandboxId } : {}),
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
        // Stream error — write error event (ignore abort errors)
        if (!abortController.signal.aborted) {
          const errMsg = error instanceof Error ? error.message : 'Stream error';
          reply.raw.write(`data: ${JSON.stringify({ type: 'error', error: errMsg })}\n\n`);
        }
      } finally {
        activeStreams.delete(sessionId);
        reply.raw.end();
      }
    } catch (error) {
      activeStreams.delete(sessionId);
      const errMsg = error instanceof Error ? error.message : 'Completion failed';
      return reply.status(500).send({ error: errMsg });
    }
  });

  // Stop an active streaming completion
  fastify.post<{ Params: { sessionId: string } }>(
    '/v1/completions/:sessionId/stop',
    async (request, reply) => {
      const { sessionId } = request.params;
      const aborted = abortSession(sessionId);
      if (aborted) {
        return { success: true, message: 'Completion stopped' };
      }
      return reply.status(404).send({
        error: 'No active completion found for this session',
      });
    },
  );

  // Health check for completion service
  fastify.get('/v1/completions/health', async () => {
    return {
      status: 'ok',
      hasApiKey: !!process.env.ANTHROPIC_API_KEY,
      model: process.env.ORCHESTRATOR_MODEL || 'claude-sonnet-4-5-20250929',
      activeStreams: activeStreams.size,
    };
  });
};
