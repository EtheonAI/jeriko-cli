import { log } from "@repo/observability/log";
import type { UIMessage } from "@repo/ai/lib/types/ui-message";
import { auth } from "@repo/auth";
import { headers } from "next/headers";
import { db, agentSessions, eq } from "@repo/database";
import { createId } from "@paralleldrive/cuid2";

import { AGENT_SERVICE_URL, createAgentProxySseStream, createAgentProxyResponse, SSE_HEADERS } from "@/lib/chat/agent-proxy";
import { streamWithProviderFallback } from "@/lib/chat/provider-fallback";
import { saveMessageToDB } from "@/lib/chat/persistence";
import {
  getStreamContext,
  setActiveStreamId,
  clearActiveStreamId,
} from "@/lib/chat/resumable-stream";

export const maxDuration = 120;

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
    } = body as {
      messages: UIMessage[];
      id?: string;
      chatId?: string;
      metadata?: { sessionId?: string; model?: string };
      model?: string;
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

    // Fallback-only system prompt — used when agent service is unavailable
    const fallbackSystemPrompt = "You are Rubic, a helpful AI assistant. Be concise, helpful, and friendly.";

    // Try agent service first, fall back to direct AI SDK streaming
    // NOTE: Don't send system_prompt to agent service — it builds its own
    // comprehensive prompt with planning rules, tool rules, browser rules, etc.
    let agentResponse: Response | null = null;
    try {
      agentResponse = await fetch(`${AGENT_SERVICE_URL}/v1/complete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userId,
          "x-session-id": sessionId || "default",
          "x-user-name": userName,
        },
        body: JSON.stringify({
          prompt: lastUserText,
          model: model || undefined,
          stream: true,
          session_id: sessionId || undefined,
        }),
        signal: AbortSignal.timeout(110000),
      });
    } catch (fetchError) {
      log.info("Agent service unavailable, falling back to direct AI SDK streaming", {
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
      const proxyOpts = { model, sessionId, lastUserText, fallbackSystemPrompt };

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
          // Clear any set stream ID on failure
          if (sessionId) {
            clearActiveStreamId(sessionId).catch(() => {});
          }
        }
      }

      // Fallback: non-resumable direct stream (no Redis)
      return createAgentProxyResponse(agentResponse.body, proxyOpts);
    }

    // Fallback: Direct AI SDK streaming (no agent service needed)
    // NOTE: No tools in fallback — sandbox-dependent tools (shell, browser, file)
    // cannot execute without E2B, and schema-only tools cause the model to attempt
    // tool calls that never resolve. Text-only fallback is the safe default.
    log.info("Using direct AI SDK streaming fallback", { model: model ?? "default" });

    // Save user message to DB (non-blocking) for fallback path
    if (sessionId && lastUserText) {
      saveMessageToDB(sessionId, "user", lastUserText).catch(() => {});
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
