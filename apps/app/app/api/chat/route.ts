import { log } from "@repo/observability/log";
import type { UIMessage } from "@repo/ai/lib/types/ui-message";
import { auth } from "@repo/auth";
import { headers } from "next/headers";
import { saveMessageToDB, autoSetSessionTitle } from "@/lib/chat/persistence";
import { clearActiveStreamId } from "@/lib/chat/resumable-stream";
import { db, agentSessions, eq } from "@repo/database";

const ORCHESTRATOR_SERVICE_URL = process.env.ORCHESTRATOR_SERVICE_URL || "http://localhost:4014";

const SSE_HEADERS: HeadersInit = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
  "x-vercel-ai-ui-message-stream": "v1",
};

// Next.js statically analyzes this — must be a literal, not a variable
export const maxDuration = 600;

/**
 * Accumulate ALL SSE event types from the spy stream for DB persistence.
 * Runs in background — does NOT block the client response.
 *
 * Handles the full AI SDK v6 UIMessage stream protocol:
 * - text-start/delta/end → text parts
 * - reasoning-start/delta/end → reasoning parts
 * - tool-input-start/available → tool parts (input)
 * - tool-output-available/error → tool parts (output)
 * - source-url → source parts
 * - message-metadata → session metadata (sandboxId, nekoUrl)
 * - start-step/finish-step → step boundaries
 * - start/finish → stream lifecycle
 */
async function accumulateAndPersist(
  spyStream: ReadableStream<Uint8Array>,
  sessionId: string,
  lastUserText: string,
  lastUserParts: Record<string, unknown>[] | null,
  model: string | undefined,
) {
  const decoder = new TextDecoder();
  const reader = spyStream.getReader();

  // Text accumulation
  const textChunks: string[] = [];

  // Reasoning accumulation
  const reasoningChunks: string[] = [];
  let reasoningOpen = false;

  // Tool parts keyed by toolCallId
  const toolParts: Record<string, Record<string, unknown>> = {};

  // Source URLs
  const sourceParts: Record<string, unknown>[] = [];

  // Session metadata from message-metadata events (sandboxId, nekoUrl, etc.)
  let sessionMeta: Record<string, unknown> = {};

  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const json = line.slice(6).trim();
        if (json === "[DONE]") continue;
        try {
          const ev = JSON.parse(json) as Record<string, unknown>;

          switch (ev.type) {
            // ── Text events ──
            case "text-delta": {
              if (typeof ev.delta === "string") {
                textChunks.push(ev.delta);
              }
              break;
            }

            // ── Reasoning events ──
            case "reasoning-start": {
              // Flush any open reasoning into a part before starting new one
              if (reasoningOpen && reasoningChunks.length > 0) {
                // (shouldn't happen normally — reasoning-end should come first)
              }
              reasoningOpen = true;
              break;
            }
            case "reasoning-delta": {
              if (typeof ev.delta === "string") {
                reasoningChunks.push(ev.delta);
              }
              break;
            }
            case "reasoning-end": {
              reasoningOpen = false;
              // Reasoning text is accumulated and will be flushed as a part below
              break;
            }

            // ── Tool events ──
            case "tool-input-start": {
              // Tool part started — create placeholder entry
              const tcId = ev.toolCallId as string;
              if (tcId) {
                toolParts[tcId] = {
                  type: `tool-${(ev.toolName as string) || "unknown"}`,
                  toolCallId: tcId,
                  toolName: ev.toolName || "unknown",
                  state: "input-streaming",
                  input: {},
                };
              }
              break;
            }
            case "tool-input-available": {
              const tcId = ev.toolCallId as string;
              if (tcId) {
                if (toolParts[tcId]) {
                  toolParts[tcId].state = "input-available";
                  toolParts[tcId].input = ev.input ?? {};
                  // Ensure toolName is set
                  if (ev.toolName) {
                    toolParts[tcId].toolName = ev.toolName;
                    toolParts[tcId].type = `tool-${ev.toolName as string}`;
                  }
                } else {
                  toolParts[tcId] = {
                    type: `tool-${(ev.toolName as string) || "unknown"}`,
                    toolCallId: tcId,
                    toolName: ev.toolName || "unknown",
                    state: "input-available",
                    input: ev.input ?? {},
                  };
                }
              }
              break;
            }
            case "tool-output-available": {
              const tcId = ev.toolCallId as string;
              if (tcId) {
                if (toolParts[tcId]) {
                  toolParts[tcId].state = "output-available";
                  toolParts[tcId].output = ev.output;
                } else {
                  toolParts[tcId] = {
                    type: `tool-${(ev.toolName as string) || "unknown"}`,
                    toolCallId: tcId,
                    toolName: ev.toolName || "unknown",
                    state: "output-available",
                    input: {},
                    output: ev.output,
                  };
                }
              }
              break;
            }
            case "tool-output-error": {
              const tcId = ev.toolCallId as string;
              if (tcId && toolParts[tcId]) {
                toolParts[tcId].state = "output-error";
                toolParts[tcId].errorText = ev.errorText ?? "Tool error";
              }
              break;
            }

            // ── Source URL events ──
            case "source-url": {
              sourceParts.push({
                type: "source-url",
                sourceId: ev.sourceId || String(Date.now()),
                url: ev.url,
                title: ev.title,
              });
              break;
            }

            // ── Metadata events (sandboxId, nekoUrl, etc.) ──
            case "message-metadata": {
              // Merge all metadata fields — accumulates across multiple events
              const meta = ev.messageMetadata ?? ev;
              if (meta && typeof meta === "object") {
                for (const [key, val] of Object.entries(meta as Record<string, unknown>)) {
                  if (key === "type") continue; // skip the event type field
                  if (val !== undefined && val !== null) {
                    sessionMeta[key] = val;
                  }
                }
              }
              break;
            }

            // ── Step boundaries & lifecycle — no persistence needed ──
            case "start":
            case "finish":
            case "start-step":
            case "finish-step":
            case "text-start":
            case "text-end":
              break;

            default:
              break;
          }
        } catch {
          // Skip malformed SSE lines
        }
      }
    }
  } catch (err) {
    log.error("Stream accumulation error:", err as Error);
  }

  // ── Build parts array for assistant message ──
  const fullText = textChunks.join("");
  const fullReasoning = reasoningChunks.join("");
  const toolPartsArr = Object.values(toolParts);
  const parts: Record<string, unknown>[] = [];

  // Add reasoning part first (if any)
  if (fullReasoning) {
    parts.push({ type: "reasoning", text: fullReasoning });
  }

  // Add text part
  if (fullText) {
    parts.push({ type: "text", text: fullText });
  }

  // Add tool parts
  parts.push(...toolPartsArr);

  // Add source parts
  parts.push(...sourceParts);

  // ── Persist messages ──

  // Save user message
  if (lastUserText || (lastUserParts?.length ?? 0) > 0) {
    await saveMessageToDB(
      sessionId,
      "user",
      lastUserText,
      undefined,
      lastUserParts,
    ).catch(() => {});
  }

  // Save assistant message with collected parts
  if (fullText || fullReasoning || toolPartsArr.length > 0) {
    const msgMeta: Record<string, unknown> = { model: model ?? "agent" };
    // Include sandbox info in message metadata for historical reference
    if (sessionMeta.sandboxId) msgMeta.sandboxId = sessionMeta.sandboxId;

    await saveMessageToDB(
      sessionId,
      "assistant",
      fullText,
      msgMeta,
      parts.length > 0 ? parts : null,
    ).catch(() => {});
  }

  // ── Update session with sandbox metadata ──
  if (sessionMeta.sandboxId || sessionMeta.nekoUrl) {
    try {
      const [session] = await db
        .select({ metadata: agentSessions.metadata })
        .from(agentSessions)
        .where(eq(agentSessions.id, sessionId))
        .limit(1);

      const existingMeta = (session?.metadata ?? {}) as Record<string, unknown>;
      await db
        .update(agentSessions)
        .set({
          metadata: { ...existingMeta, ...sessionMeta },
          updatedAt: new Date(),
        })
        .where(eq(agentSessions.id, sessionId));
    } catch {
      // Non-critical — session metadata update failure shouldn't break the flow
    }
  }

  // Auto-title session
  if (lastUserText) {
    await autoSetSessionTitle(sessionId, lastUserText).catch(() => {});
  }

  // Clear active stream ID (resumable stream cleanup)
  await clearActiveStreamId(sessionId).catch(() => {});
}

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
      skills,
      connections,
    } = body as {
      messages: UIMessage[];
      id?: string;
      chatId?: string;
      metadata?: { sessionId?: string; model?: string };
      skills?: string[];
      connections?: { id: string; type?: string; name?: string }[];
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

    // Extract user message parts for persistence (file parts, etc.)
    const lastUserParts = lastUserMsg?.parts
      ? (lastUserMsg.parts as unknown as Record<string, unknown>[])
      : null;

    // Ensure session exists in DB (creates if missing — idempotent)
    // Persist skills/connections in session metadata for resume
    if (sessionId) {
      try {
        const [existing] = await db
          .select({ id: agentSessions.id, metadata: agentSessions.metadata })
          .from(agentSessions)
          .where(eq(agentSessions.id, sessionId))
          .limit(1);
        if (!existing) {
          const sessionMeta: Record<string, unknown> = {};
          if (skills?.length) sessionMeta.skills = skills;
          if (connections?.length) sessionMeta.connections = connections;
          await db.insert(agentSessions).values({
            id: sessionId,
            userId,
            status: "active",
            ...(Object.keys(sessionMeta).length > 0 ? { metadata: sessionMeta } : {}),
          });
        } else if (skills?.length || connections?.length) {
          // Update existing session metadata with latest skills/connections
          const existingMeta = (existing.metadata ?? {}) as Record<string, unknown>;
          const updatedMeta = { ...existingMeta };
          if (skills?.length) updatedMeta.skills = skills;
          if (connections?.length) updatedMeta.connections = connections;
          await db.update(agentSessions)
            .set({ metadata: updatedMeta, updatedAt: new Date() })
            .where(eq(agentSessions.id, sessionId));
        }
      } catch {
        // Non-critical — session may already exist
      }
    }

    // Convert UIMessages to CoreMessages for the orchestrator.
    // Include text content from parts. For assistant messages with tool results,
    // include a summary of tool calls so the orchestrator has full context.
    const coreMessages = messages.map((m) => {
      const textContent = m.parts
        ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
        .map((p) => p.text)
        .join("") ?? "";

      return {
        role: m.role as "user" | "assistant" | "system",
        content: textContent,
      };
    });

    // Abort orchestrator when client disconnects OR after 10-min timeout.
    // AbortSignal.any() (Node 20+) merges the request signal (client abort)
    // with a hard timeout so the agent loop doesn't run forever.
    const combinedSignal = AbortSignal.any([
      req.signal,
      AbortSignal.timeout(600_000),
    ]);

    // When client disconnects, explicitly call orchestrator stop endpoint
    // so the agent loop's AbortController is signalled server-side.
    if (sessionId) {
      req.signal.addEventListener("abort", () => {
        fetch(`${ORCHESTRATOR_SERVICE_URL}/v1/completions/${sessionId}/stop`, {
          method: "POST",
        }).catch(() => {});
      });
    }

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
        skills,
        connections,
      }),
      signal: combinedSignal,
    });

    if (!orchestratorResp.ok) {
      const detail = await orchestratorResp.text();
      log.error("Orchestrator error", { status: orchestratorResp.status, detail });
      throw new Error(`Orchestrator error: ${orchestratorResp.status} ${detail}`);
    }

    if (!orchestratorResp.body) {
      throw new Error("Orchestrator returned no body");
    }

    // Tee the stream: one leg → client, one leg → DB persistence accumulator
    const [clientStream, spyStream] = orchestratorResp.body.tee();

    // Fire-and-forget: accumulate text + tool parts, save to DB when stream ends
    if (sessionId) {
      accumulateAndPersist(spyStream, sessionId, lastUserText, lastUserParts, metadata?.model)
        .catch((err) => log.error("Persistence error:", err as Error));
    } else {
      // No sessionId — cancel the spy stream to prevent memory leak
      spyStream.cancel().catch(() => {});
    }

    return new Response(clientStream, { headers: SSE_HEADERS });
  } catch (error) {
    log.error("Chat error", error as Error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
};
