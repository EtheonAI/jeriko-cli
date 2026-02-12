import { log } from "@repo/observability/log";
import type { UIMessage } from "@repo/ai/lib/types/ui-message";
import { auth } from "@repo/auth";
import { headers } from "next/headers";

const MAX_DURATION_SECONDS = Number(process.env.CHAT_MAX_DURATION_SECONDS ?? 600);
const ORCHESTRATOR_SERVICE_URL = process.env.ORCHESTRATOR_SERVICE_URL || "http://localhost:4014";

export const maxDuration = MAX_DURATION_SECONDS;

export const POST = async (req: Request) => {
  try {
    const headersList = await headers();
    const session = await auth.api.getSession({ headers: headersList });

    if (!session?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const userId = session.user.id;
    const userName = session.user.name || undefined;
    const body = await req.json();

    const {
      messages,
      id: bodyId,
      chatId,
      metadata,
    } = body as {
      messages: UIMessage[];
      id?: string;
      chatId?: string;
      metadata?: { sessionId?: string; model?: string };
    };

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Messages array is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const sessionId = chatId ?? bodyId ?? metadata?.sessionId;

    // Extract last user message text from parts
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    const lastUserText =
      lastUserMsg?.parts
        ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
        .map((p) => p.text)
        .join("") ?? "";
    if (!lastUserText.trim()) {
      return new Response(JSON.stringify({ error: "Last user message is empty" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Convert UIMessages to CoreMessages for the orchestrator
    const coreMessages = messages.map((m) => ({
      role: m.role as "user" | "assistant" | "system",
      content:
        m.parts
          ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
          .map((p) => p.text)
          .join("") ?? "",
    }));

    // Stream from orchestrator's /v1/completions endpoint
    const orchestratorResp = await fetch(`${ORCHESTRATOR_SERVICE_URL}/v1/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": userId,
        "x-user-name": userName ?? "",
        "x-session-id": sessionId ?? "",
      },
      body: JSON.stringify({
        messages: coreMessages,
        sessionId,
        userId,
        userName,
        model: metadata?.model,
      }),
      signal: AbortSignal.timeout(MAX_DURATION_SECONDS * 1000),
    });

    if (!orchestratorResp.ok) {
      const detail = await orchestratorResp.text();
      log.error({ status: orchestratorResp.status, detail }, "Orchestrator error");
      throw new Error(`Orchestrator error: ${orchestratorResp.status} ${detail}`);
    }

    if (!orchestratorResp.body) {
      throw new Error("Orchestrator returned no body");
    }

    // Proxy the SSE stream directly to the client
    return new Response(orchestratorResp.body, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
        "x-vercel-ai-ui-message-stream": "v1",
      },
    });
  } catch (error) {
    log.error({ error }, "Chat error");
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
};
