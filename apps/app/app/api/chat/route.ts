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

    let sessionId = chatId ?? bodyId ?? metadata?.sessionId;

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

    if (!sessionId) {
      const createResp = await fetch(`${ORCHESTRATOR_SERVICE_URL}/v1/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, mode: "single" }),
        signal: AbortSignal.timeout(20_000),
      });
      if (!createResp.ok) {
        const detail = await createResp.text();
        throw new Error(`Failed to create orchestrator session: ${detail}`);
      }
      const created = (await createResp.json()) as { sessionId?: string };
      sessionId = created.sessionId;
    }

    if (!sessionId) {
      throw new Error("Missing sessionId after orchestrator session creation");
    }

    const runResp = await fetch(`${ORCHESTRATOR_SERVICE_URL}/v1/sessions/${sessionId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: lastUserText }),
      signal: AbortSignal.timeout(120_000),
    });

    if (!runResp.ok) {
      const detail = await runResp.text();
      throw new Error(`Orchestrator message execution failed: ${detail}`);
    }

    const events = (await runResp.json()) as Array<Record<string, unknown>>;
    const assistantText = String(
      events
        .filter((event) => event?.type === "message.complete")
        .map((event) => event?.content)
        .find(Boolean) ?? "Completed."
    );

    const partId = `text-${Date.now()}`;
    const sseBody = [
      `data: ${JSON.stringify({ type: "start" })}\n\n`,
      `data: ${JSON.stringify({ type: "text-start", id: partId })}\n\n`,
      `data: ${JSON.stringify({ type: "text-delta", id: partId, delta: assistantText })}\n\n`,
      `data: ${JSON.stringify({ type: "text-end", id: partId })}\n\n`,
      `data: ${JSON.stringify({ type: "finish", finishReason: "stop" })}\n\n`,
    ].join("");

    return new Response(sseBody, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
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
      }
    );
  }
};
