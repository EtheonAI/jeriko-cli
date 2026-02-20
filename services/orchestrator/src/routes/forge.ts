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

// Image generation provider (DALL-E via OpenAI API)
const FORGE_IMAGE_PROVIDER_URL = process.env.FORGE_IMAGE_PROVIDER_URL || "https://api.openai.com/v1";
const FORGE_IMAGE_PROVIDER_KEY = process.env.FORGE_IMAGE_PROVIDER_KEY || FORGE_LLM_PROVIDER_KEY;

// Voice transcription provider (Whisper via OpenAI API)
const FORGE_VOICE_PROVIDER_URL = process.env.FORGE_VOICE_PROVIDER_URL || "https://api.openai.com/v1";
const FORGE_VOICE_PROVIDER_KEY = process.env.FORGE_VOICE_PROVIDER_KEY || FORGE_LLM_PROVIDER_KEY;

// Data API — registered external API providers
// Map of provider name → { baseUrl, apiKey, allowedPaths }
const DATA_API_PROVIDERS: Record<string, { baseUrl: string; apiKey: string; allowedPaths?: string[] }> = {};

// Load data API providers from env (format: DATA_API_PROVIDER_<NAME>_URL, DATA_API_PROVIDER_<NAME>_KEY)
for (const [key, value] of Object.entries(process.env)) {
  const urlMatch = key.match(/^DATA_API_PROVIDER_(\w+)_URL$/);
  if (urlMatch && value) {
    const name = urlMatch[1]!.toLowerCase();
    DATA_API_PROVIDERS[name] = {
      baseUrl: value,
      apiKey: process.env[`DATA_API_PROVIDER_${urlMatch[1]}_KEY`] || "",
    };
  }
}

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
        images: !!FORGE_IMAGE_PROVIDER_KEY,
        voice: !!FORGE_VOICE_PROVIDER_KEY,
        notifications: true,
        dataApi: Object.keys(DATA_API_PROVIDERS).length > 0,
      },
      dataApiProviders: Object.keys(DATA_API_PROVIDERS),
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

    if (!FORGE_IMAGE_PROVIDER_KEY) {
      return reply.status(503).send({ error: "Image generation provider not configured" });
    }

    const body = request.body as {
      prompt?: string;
      model?: string;
      size?: string;
      quality?: string;
      n?: number;
      originalImages?: Array<{ url: string; mimeType: string }>;
    };

    if (!body.prompt) {
      return reply.status(400).send({ error: "prompt required" });
    }

    const model = body.model || "dall-e-3";
    const allowedModels = new Set(["dall-e-2", "dall-e-3", "gpt-image-1"]);
    if (!allowedModels.has(model)) {
      return reply.status(400).send({
        error: `Unsupported image model. Allowed: ${Array.from(allowedModels).join(", ")}`,
      });
    }

    try {
      const upstreamResp = await fetch(`${FORGE_IMAGE_PROVIDER_URL}/images/generations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${FORGE_IMAGE_PROVIDER_KEY}`,
        },
        body: JSON.stringify({
          model,
          prompt: body.prompt,
          n: Math.min(body.n || 1, 4),
          size: body.size || "1024x1024",
          quality: body.quality || "standard",
          response_format: "url",
        }),
        signal: AbortSignal.timeout(120000),
      });

      if (!upstreamResp.ok) {
        const errText = await upstreamResp.text();
        logger.error({ status: upstreamResp.status, error: errText }, "Forge image upstream error");
        return reply.status(upstreamResp.status).send({ error: errText });
      }

      const data = await upstreamResp.json();
      logger.info({ model, prompt: body.prompt.slice(0, 80) }, "Forge image generated");
      return reply.send(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({ error: msg }, "Forge image generation failed");
      return reply.status(502).send({ error: msg });
    }
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

    if (!FORGE_VOICE_PROVIDER_KEY) {
      return reply.status(503).send({ error: "Voice transcription provider not configured" });
    }

    try {
      // Forward the multipart form data to OpenAI Whisper API
      // The request body is multipart/form-data with a file field
      const contentType = request.headers["content-type"] || "";

      if (!contentType.includes("multipart/form-data")) {
        return reply.status(400).send({ error: "Expected multipart/form-data with audio file" });
      }

      // Get raw body and forward as-is to upstream
      const rawBody = request.body as Buffer;

      const upstreamResp = await fetch(`${FORGE_VOICE_PROVIDER_URL}/audio/transcriptions`, {
        method: "POST",
        headers: {
          "Content-Type": contentType,
          Authorization: `Bearer ${FORGE_VOICE_PROVIDER_KEY}`,
        },
        body: rawBody,
        signal: AbortSignal.timeout(60000),
      });

      if (!upstreamResp.ok) {
        const errText = await upstreamResp.text();
        logger.error({ status: upstreamResp.status, error: errText }, "Forge voice upstream error");
        return reply.status(upstreamResp.status).send({ error: errText });
      }

      const data = await upstreamResp.json();
      logger.info("Forge voice transcription completed");
      return reply.send(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({ error: msg }, "Forge voice transcription failed");
      return reply.status(502).send({ error: msg });
    }
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

    const body = request.body as {
      provider: string;   // e.g. "youtube", "twitter", "maps"
      path: string;       // API path (appended to provider's baseUrl)
      method?: string;    // HTTP method (default: GET)
      params?: Record<string, string>; // Query params
      data?: unknown;     // Request body (for POST/PUT)
    };

    if (!body.provider || !body.path) {
      return reply.status(400).send({ error: "provider and path required" });
    }

    const provider = DATA_API_PROVIDERS[body.provider.toLowerCase()];
    if (!provider) {
      const available = Object.keys(DATA_API_PROVIDERS);
      return reply.status(400).send({
        error: `Unknown data API provider: ${body.provider}`,
        available: available.length > 0 ? available : "No providers configured. Set DATA_API_PROVIDER_<NAME>_URL env vars.",
      });
    }

    // Build upstream URL
    const url = new URL(body.path, provider.baseUrl);
    if (body.params) {
      for (const [k, v] of Object.entries(body.params)) {
        url.searchParams.set(k, v);
      }
    }

    // Security: block localhost and private IPs
    const hostname = url.hostname;
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname.startsWith("10.") || hostname.startsWith("192.168.")) {
      return reply.status(403).send({ error: "Private/local URLs not allowed" });
    }

    const method = (body.method || "GET").toUpperCase();

    try {
      const headers: Record<string, string> = {
        Accept: "application/json",
      };

      if (provider.apiKey) {
        headers.Authorization = `Bearer ${provider.apiKey}`;
      }

      if (body.data && (method === "POST" || method === "PUT" || method === "PATCH")) {
        headers["Content-Type"] = "application/json";
      }

      const upstreamResp = await fetch(url.toString(), {
        method,
        headers,
        body: body.data && method !== "GET" ? JSON.stringify(body.data) : undefined,
        signal: AbortSignal.timeout(30000),
      });

      const responseData = await upstreamResp.text();
      logger.info({ provider: body.provider, path: body.path, status: upstreamResp.status }, "Forge data API proxy");

      // Try to parse as JSON, otherwise return as text
      try {
        const json = JSON.parse(responseData);
        return reply.status(upstreamResp.status).send(json);
      } catch {
        return reply.status(upstreamResp.status).send({ data: responseData });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({ error: msg, provider: body.provider }, "Forge data API proxy failed");
      return reply.status(502).send({ error: msg });
    }
  });
}
