/**
 * Forge API Routes — AI services for webdev projects.
 *
 * Manus equivalent: https://forge.manus.ai
 *
 * Provides AI capabilities to user-built webdev projects:
 *   1. LLM completion (OpenAI-compatible) — for AI features in user apps
 *   2. Image generation — text-to-image for user apps
 *   3. Voice transcription (Whisper-compatible) — for voice features
 *   4. Notifications — push notifications to project owners
 *   5. Data API proxy — access external APIs (YouTube, Twitter, etc.)
 *
 * Auth: BUILT_IN_FORGE_API_KEY (server-side, full access)
 *       VITE_FRONTEND_FORGE_API_KEY (client-side, restricted — maps only)
 *
 * These are SEPARATE from the sandbox LLM proxy (which uses OPENAI_API_KEY
 * and only allows cheap models for agent subtasks).
 *
 * Routes:
 *   POST /api/forge/v1/chat/completions     — LLM completion
 *   POST /api/forge/images/generate         — Image generation
 *   POST /api/forge/v1/audio/transcriptions — Voice transcription
 *   POST /api/forge/notifications           — Send notification to owner
 *   POST /api/forge/data-api                — External data API proxy
 *   GET  /api/forge/health                  — Health check
 */

import type { FastifyInstance } from "fastify";
import { createLogger } from "@repo/service-utils";

const logger = createLogger({ service: "forge" });

// Server-side Forge API key — full access to all services
const FORGE_API_KEY = process.env.FORGE_API_KEY || "";
// Frontend Forge API key — restricted access (maps only)
const FORGE_FRONTEND_API_KEY = process.env.FORGE_FRONTEND_API_KEY || "";

// Upstream LLM provider for webdev project LLM calls
// Can be OpenAI, or our own LLM proxy
const FORGE_LLM_PROVIDER_URL = process.env.FORGE_LLM_PROVIDER_URL || "https://api.openai.com/v1";
const FORGE_LLM_PROVIDER_KEY = process.env.FORGE_LLM_PROVIDER_KEY || process.env.OPENAI_API_KEY || "";

// Allowed models for Forge API (webdev projects get access to more models than sandbox)
const ALLOWED_FORGE_MODELS = new Set([
  "gpt-4.1-mini",
  "gpt-4.1-nano",
  "gpt-4o-mini",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
]);

/**
 * Validate a Forge API key (server-side or frontend).
 */
function validateForgeKey(authHeader: string | undefined): { valid: boolean; type: "server" | "frontend" | null } {
  if (!authHeader) return { valid: false, type: null };

  const token = authHeader.replace(/^Bearer\s+/i, "");

  if (FORGE_API_KEY && token === FORGE_API_KEY) {
    return { valid: true, type: "server" };
  }
  if (FORGE_FRONTEND_API_KEY && token === FORGE_FRONTEND_API_KEY) {
    return { valid: true, type: "frontend" };
  }

  return { valid: false, type: null };
}

export async function forgeRoutes(app: FastifyInstance) {
  /**
   * GET /api/forge/health — Health check.
   */
  app.get("/api/forge/health", async (_request, reply) => {
    return reply.send({
      status: "ok",
      services: {
        llm: !!FORGE_LLM_PROVIDER_KEY,
        images: false, // Not yet implemented
        voice: false, // Not yet implemented
        notifications: true,
      },
    });
  });

  /**
   * POST /api/forge/v1/chat/completions — LLM completion for webdev projects.
   *
   * Manus equivalent: POST https://forge.manus.ai/v1/chat/completions
   *
   * OpenAI-compatible format. Proxies to upstream LLM provider.
   * Default model: gemini-2.5-flash (cheap and fast for webdev features).
   */
  app.post("/api/forge/v1/chat/completions", async (request, reply) => {
    const auth = validateForgeKey(request.headers.authorization);
    if (!auth.valid) {
      return reply.status(401).send({ error: "Invalid or missing Forge API key" });
    }

    if (auth.type === "frontend") {
      return reply.status(403).send({ error: "Frontend API key cannot access LLM endpoint" });
    }

    if (!FORGE_LLM_PROVIDER_KEY) {
      return reply.status(503).send({ error: "LLM provider not configured" });
    }

    const body = request.body as {
      model?: string;
      messages?: Array<{ role: string; content: string }>;
      max_tokens?: number;
      temperature?: number;
      stream?: boolean;
      tools?: unknown[];
    };

    const model = body.model || "gemini-2.5-flash";

    // Validate model
    if (!ALLOWED_FORGE_MODELS.has(model)) {
      return reply.status(400).send({
        error: `Unsupported model. Allowed: ${Array.from(ALLOWED_FORGE_MODELS).join(", ")}`,
      });
    }

    // Block Claude models (prevent recursive self-invocation)
    if (model.includes("claude")) {
      return reply.status(400).send({ error: "Claude models not available through Forge API" });
    }

    try {
      const upstreamResp = await fetch(`${FORGE_LLM_PROVIDER_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${FORGE_LLM_PROVIDER_KEY}`,
        },
        body: JSON.stringify({
          model,
          messages: body.messages || [],
          max_tokens: Math.min(body.max_tokens || 4096, 32768),
          temperature: body.temperature ?? 0.7,
          stream: body.stream || false,
          ...(body.tools ? { tools: body.tools } : {}),
        }),
        signal: AbortSignal.timeout(60000),
      });

      if (!upstreamResp.ok) {
        const errText = await upstreamResp.text();
        logger.error({ status: upstreamResp.status, error: errText }, "Forge LLM upstream error");
        return reply.status(upstreamResp.status).send({ error: errText });
      }

      // Stream passthrough
      if (body.stream) {
        reply.raw.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        });

        const reader = upstreamResp.body?.getReader();
        if (!reader) {
          return reply.status(502).send({ error: "No response body from upstream" });
        }

        const decoder = new TextDecoder();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            reply.raw.write(decoder.decode(value, { stream: true }));
          }
        } finally {
          reply.raw.end();
        }
        return;
      }

      // Non-stream: return JSON
      const data = await upstreamResp.json();

      logger.info({ model, messageCount: body.messages?.length }, "Forge LLM completion");

      return reply.send(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({ error: msg }, "Forge LLM completion failed");
      return reply.status(502).send({ error: msg });
    }
  });

  /**
   * POST /api/forge/images/generate — Image generation.
   *
   * Manus equivalent: POST https://forge.manus.ai/images.v1.ImageService/GenerateImage
   *
   * Currently returns a stub. Will be implemented when we integrate an image
   * generation provider (DALL-E, Stable Diffusion, etc.).
   */
  app.post("/api/forge/images/generate", async (request, reply) => {
    const auth = validateForgeKey(request.headers.authorization);
    if (!auth.valid || auth.type === "frontend") {
      return reply.status(401).send({ error: "Invalid or missing server-side Forge API key" });
    }

    const body = request.body as {
      prompt?: string;
      originalImages?: Array<{ url: string; mimeType: string }>;
    };

    if (!body.prompt) {
      return reply.status(400).send({ error: "prompt required" });
    }

    // TODO: Integrate image generation provider
    logger.info({ prompt: body.prompt?.slice(0, 100) }, "Image generation requested (stub)");

    return reply.status(501).send({
      error: "Image generation not yet implemented",
      hint: "Will be available when DALL-E/Stable Diffusion provider is configured",
    });
  });

  /**
   * POST /api/forge/v1/audio/transcriptions — Voice transcription (Whisper).
   *
   * Manus equivalent: POST https://forge.manus.ai/v1/audio/transcriptions
   *
   * Currently returns a stub. Will proxy to OpenAI Whisper API.
   */
  app.post("/api/forge/v1/audio/transcriptions", async (request, reply) => {
    const auth = validateForgeKey(request.headers.authorization);
    if (!auth.valid || auth.type === "frontend") {
      return reply.status(401).send({ error: "Invalid or missing server-side Forge API key" });
    }

    // TODO: Implement Whisper proxy
    logger.info("Voice transcription requested (stub)");

    return reply.status(501).send({
      error: "Voice transcription not yet implemented",
      hint: "Will proxy to OpenAI Whisper API when configured",
    });
  });

  /**
   * POST /api/forge/notifications — Send notification to project owner.
   *
   * Manus equivalent: POST https://forge.manus.ai/webdevtoken.v1.WebDevService/SendNotification
   *
   * Sends a push notification to the project owner (via our notification service).
   */
  app.post("/api/forge/notifications", async (request, reply) => {
    const auth = validateForgeKey(request.headers.authorization);
    if (!auth.valid) {
      return reply.status(401).send({ error: "Invalid or missing Forge API key" });
    }

    const body = request.body as {
      title?: string;
      content?: string;
      userId?: string;
    };

    if (!body.title || !body.content) {
      return reply.status(400).send({ error: "title and content required" });
    }

    // Forward to our notification service
    try {
      const notifUrl = process.env.NOTIFICATION_SERVICE_URL || "http://localhost:4006";
      await fetch(`${notifUrl}/notifications`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": body.userId || "system",
        },
        body: JSON.stringify({
          type: "webdev",
          title: body.title,
          message: body.content,
          channel: "in-app",
        }),
        signal: AbortSignal.timeout(5000),
      });

      return reply.send({ success: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({ error: msg }, "Failed to send notification");
      return reply.status(502).send({ error: msg });
    }
  });

  /**
   * POST /api/forge/data-api — External data API proxy.
   *
   * Manus equivalent: POST https://forge.manus.ai/webdevtoken.v1.WebDevService/CallApi
   *
   * Proxies requests to external APIs (YouTube, Twitter, etc.) without exposing
   * API keys to the sandbox or frontend.
   */
  app.post("/api/forge/data-api", async (request, reply) => {
    const auth = validateForgeKey(request.headers.authorization);
    if (!auth.valid) {
      return reply.status(401).send({ error: "Invalid or missing Forge API key" });
    }

    // TODO: Implement external API proxy with registered data providers
    logger.info("Data API proxy requested (stub)");

    return reply.status(501).send({
      error: "Data API proxy not yet implemented",
      hint: "Will be available when data providers are registered",
    });
  });
}
