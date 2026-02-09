import { log } from "@repo/observability/log";
import type { UIMessage } from "@repo/ai/lib/types/ui-message";
import { createRubicAI } from "@repo/ai/lib/rubic-provider";
import { auth } from "@repo/auth";
import { headers } from "next/headers";
import { db, agentSessions, apiKeys, eq, and } from "@repo/database";
import { createId } from "@paralleldrive/cuid2";

import { createAgentProxySseStream, createAgentProxyResponse, SSE_HEADERS } from "@/lib/chat/agent-proxy";
import { streamWithProviderFallback } from "@/lib/chat/provider-fallback";
import { saveMessageToDB } from "@/lib/chat/persistence";
import {
  getStreamContext,
  setActiveStreamId,
  clearActiveStreamId,
} from "@/lib/chat/resumable-stream";

const MAX_DURATION_SECONDS = Number(process.env.CHAT_MAX_DURATION_SECONDS ?? 600);
const AGENT_STREAM_TIMEOUT_MS = Number(process.env.AGENT_STREAM_TIMEOUT_MS ?? 600_000);

export const maxDuration = MAX_DURATION_SECONDS;

/** RubicAI client — singleton for the agent service */
const rubic = createRubicAI({ timeout: AGENT_STREAM_TIMEOUT_MS });

// ============================================================
// POST — Send a new message (start or continue a chat)
// ============================================================

export const POST = async (req: Request) => {
  try {
    // Authenticate
    const headersList = await headers();
    const session = await auth.api.getSession({ headers: headersList });

    if (!session?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const userId = session.user.id;
    const userName = session.user.name || "";
    const body = await req.json();

    const {
      messages,
      id: bodyId,
      chatId,
      metadata,
      model: bodyModel,
      skills,
      connections,
    } = body as {
      messages: UIMessage[];
      id?: string;
      chatId?: string;
      metadata?: { sessionId?: string; model?: string };
      model?: string;
      skills?: string[];
      connections?: Array<{ id: string; name: string; type: string }>;
    };

    // DefaultChatTransport sends the chat ID as `id`;
    // our legacy transport sent it as `chatId`.
    const sessionId = chatId ?? bodyId ?? metadata?.sessionId;
    const model = bodyModel ?? metadata?.model;

    // Validate messages
    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Messages array is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Ensure session exists in DB
    if (sessionId) {
      try {
        const [existing] = await db
          .select({ id: agentSessions.id })
          .from(agentSessions)
          .where(eq(agentSessions.id, sessionId))
          .limit(1);

        if (!existing) {
          await db.insert(agentSessions).values({
            id: sessionId,
            userId,
            status: "active",
          });
        }
      } catch (err) {
        log.error("Failed to upsert session:", err as Error);
      }
    }

    // Extract latest user message text
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    const lastUserText =
      lastUserMsg?.parts
        ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
        .map((p) => p.text)
        .join("") ?? "";
    const lastUserParts = (lastUserMsg?.parts as Record<string, unknown>[] | undefined) ?? null;

    // Fallback system prompt — used when agent service is unavailable
    const fallbackSystemPrompt = "You are Rubic, a helpful AI assistant. Be concise, helpful, and friendly.";

    // Look up the user's first active API key for agent service auth
    let userApiKey: string | undefined;
    try {
      const [keyRow] = await db
        .select({ key: apiKeys.key })
        .from(apiKeys)
        .where(and(eq(apiKeys.userId, userId), eq(apiKeys.isActive, true)))
        .limit(1);
      userApiKey = keyRow?.key;
    } catch {
      // Non-fatal — agent service works without API key in dev
    }

    // Call the Rubic agent service via RubicAI client
    // NOTE: Don't send system_prompt — agent builds its own comprehensive prompt
    let agentResponse: Response | null = null;
    try {
      agentResponse = await rubic.stream({
        prompt: lastUserText,
        model: model || undefined,
        sessionId: sessionId || undefined,
        userId,
        userName,
        skills,
        connections,
        apiKey: userApiKey,
      });
    } catch (fetchError) {
      log.info("Agent service unavailable, falling back", {
        error: (fetchError as Error).message,
      });
    }

    // If agent service responded with an error, fall through
    if (agentResponse && !agentResponse.ok) {
      const errorText = await agentResponse.text().catch(() => "Unknown error");
      log.warn("Agent service error, falling back", {
        status: agentResponse.status,
        error: errorText,
      });
      agentResponse = null;
    }

    // Agent service proxy path — push-based streaming
    if (agentResponse?.body) {
      const proxyOpts = { model, sessionId, lastUserText, lastUserParts, fallbackSystemPrompt };

      // Try resumable stream wrapping (Redis-backed)
      const streamContext = await getStreamContext();
      if (streamContext && sessionId) {
        try {
          const streamId = createId();
          await setActiveStreamId(sessionId, streamId);

          const sseStringStream = createAgentProxySseStream(agentResponse.body, proxyOpts);

          // createNewResumableStream pipes to Redis AND returns a client-facing stream
          const resumable = await streamContext.createNewResumableStream(
            streamId,
            () => sseStringStream,
          );

          if (resumable) {
            return new Response(resumable, { headers: SSE_HEADERS });
          }

          // If stream already existed (race condition), clear and fall through
          await clearActiveStreamId(sessionId);
        } catch (resumeErr) {
          log.warn("Resumable stream creation failed, falling back to direct stream", {
            error: (resumeErr as Error).message,
          });
          if (sessionId) {
            clearActiveStreamId(sessionId).catch(() => {});
          }
        }
      }

      // Fallback: non-resumable direct stream (no Redis)
      return createAgentProxyResponse(agentResponse.body, proxyOpts);
    }

    // Fallback: Agent service is down — retry or return error SSE
    log.info("Agent service unavailable, using fallback path");

    // Save user message to DB (non-blocking) for fallback path
    if (sessionId && (lastUserText || (lastUserParts?.length ?? 0) > 0)) {
      saveMessageToDB(sessionId, "user", lastUserText, undefined, lastUserParts).catch(() => {});
    }

    return await streamWithProviderFallback(lastUserText, model, fallbackSystemPrompt, sessionId);
  } catch (error) {
    log.error("Chat error:", error as Error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};

// ============================================================
// NOTE: The GET handler for stream resumption lives at
// /api/chat/[id]/stream/route.ts — DefaultChatTransport sends
// GET requests to `{api}/{chatId}/stream` (not query params).
// ============================================================
