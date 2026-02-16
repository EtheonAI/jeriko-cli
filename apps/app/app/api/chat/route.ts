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
  model: string | undefined
) {
  const decoder = new TextDecoder();
  const reader = spyStream.getReader();

  // ── Chronological parts tracking ──
  // Parts are recorded in the order they appear in the stream so that
  // after page refresh the message renders identically to live streaming.
  //
  // Each entry is either:
  //   { kind: "text",      chunks: string[] }
  //   { kind: "reasoning", chunks: string[] }
  //   { kind: "tool",      toolCallId: string }
  //   { kind: "source",    data: Record<string, unknown> }
  type PartEntry =
    | { kind: "text"; chunks: string[] }
    | { kind: "reasoning"; chunks: string[] }
    | { kind: "tool"; toolCallId: string }
    | { kind: "source"; data: Record<string, unknown> };

  const orderedEntries: PartEntry[] = [];

  // Active text/reasoning entry for appending deltas
  let activeText: (PartEntry & { kind: "text" }) | null = null;
  let activeReasoning: (PartEntry & { kind: "reasoning" }) | null = null;

  // Tool parts keyed by toolCallId (for updates)
  const toolParts: Record<string, Record<string, unknown>> = {};

  // Session metadata from message-metadata events (sandboxId, nekoUrl, etc.)
  const sessionMeta: Record<string, unknown> = {};

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
            case "text-start": {
              // Start a new text segment — close any previous one
              const entry: PartEntry & { kind: "text" } = { kind: "text", chunks: [] };
              orderedEntries.push(entry);
              activeText = entry;
              break;
            }
            case "text-delta": {
              if (typeof ev.delta === "string") {
                // Lazy-create text entry if text-start was missed
                if (!activeText) {
                  const entry: PartEntry & { kind: "text" } = { kind: "text", chunks: [] };
                  orderedEntries.push(entry);
                  activeText = entry;
                }
                activeText.chunks.push(ev.delta);
              }
              break;
            }
            case "text-end": {
              activeText = null;
              break;
            }

            // ── Reasoning events ──
            case "reasoning-start": {
              const entry: PartEntry & { kind: "reasoning" } = { kind: "reasoning", chunks: [] };
              orderedEntries.push(entry);
              activeReasoning = entry;
              break;
            }
            case "reasoning-delta": {
              if (typeof ev.delta === "string") {
                if (!activeReasoning) {
                  const entry: PartEntry & { kind: "reasoning" } = {
                    kind: "reasoning",
                    chunks: [],
                  };
                  orderedEntries.push(entry);
                  activeReasoning = entry;
                }
                activeReasoning.chunks.push(ev.delta);
              }
              break;
            }
            case "reasoning-end": {
              activeReasoning = null;
              break;
            }

            // ── Tool events ──
            case "tool-input-start": {
              const tcId = ev.toolCallId as string;
              if (tcId) {
                // Close any active text segment so tool appears after preceding text
                activeText = null;
                toolParts[tcId] = {
                  type: `tool-${(ev.toolName as string) || "unknown"}`,
                  toolCallId: tcId,
                  toolName: ev.toolName || "unknown",
                  state: "input-streaming",
                  input: {},
                };
                orderedEntries.push({ kind: "tool", toolCallId: tcId });
              }
              break;
            }
            case "tool-input-available": {
              const tcId = ev.toolCallId as string;
              if (tcId) {
                if (toolParts[tcId]) {
                  toolParts[tcId].state = "input-available";
                  toolParts[tcId].input = ev.input ?? {};
                  if (ev.toolName) {
                    toolParts[tcId].toolName = ev.toolName;
                    toolParts[tcId].type = `tool-${ev.toolName as string}`;
                  }
                } else {
                  // Tool appeared without tool-input-start — still record in order
                  activeText = null;
                  toolParts[tcId] = {
                    type: `tool-${(ev.toolName as string) || "unknown"}`,
                    toolCallId: tcId,
                    toolName: ev.toolName || "unknown",
                    state: "input-available",
                    input: ev.input ?? {},
                  };
                  orderedEntries.push({ kind: "tool", toolCallId: tcId });
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
                  activeText = null;
                  toolParts[tcId] = {
                    type: `tool-${(ev.toolName as string) || "unknown"}`,
                    toolCallId: tcId,
                    toolName: ev.toolName || "unknown",
                    state: "output-available",
                    input: {},
                    output: ev.output,
                  };
                  orderedEntries.push({ kind: "tool", toolCallId: tcId });
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
              const sourceData = {
                type: "source-url",
                sourceId: ev.sourceId || String(Date.now()),
                url: ev.url,
                title: ev.title,
              };
              orderedEntries.push({ kind: "source", data: sourceData });
              break;
            }

            // ── Metadata events (sandboxId, nekoUrl, etc.) ──
            case "message-metadata": {
              const meta = ev.messageMetadata ?? ev;
              if (meta && typeof meta === "object") {
                for (const [key, val] of Object.entries(meta as Record<string, unknown>)) {
                  if (key === "type") continue;
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

  // ── Build parts array in chronological order ──
  const parts: Record<string, unknown>[] = [];
  let fullText = "";

  for (const entry of orderedEntries) {
    switch (entry.kind) {
      case "reasoning": {
        const text = entry.chunks.join("");
        if (text) parts.push({ type: "reasoning", text });
        break;
      }
      case "text": {
        const text = entry.chunks.join("");
        if (text) {
          parts.push({ type: "text", text });
          fullText += text;
        }
        break;
      }
      case "tool": {
        const tp = toolParts[entry.toolCallId];
        if (tp) parts.push(tp);
        break;
      }
      case "source":
        parts.push(entry.data);
        break;
    }
  }

  const toolPartsArr = Object.values(toolParts);

  // ── Persist messages ──

  // Save user message
  if (lastUserText || (lastUserParts?.length ?? 0) > 0) {
    await saveMessageToDB(sessionId, "user", lastUserText, undefined, lastUserParts).catch(
      () => {}
    );
  }

  // Save assistant message with collected parts
  if (fullText || toolPartsArr.length > 0 || parts.length > 0) {
    const msgMeta: Record<string, unknown> = { model: model ?? "agent" };
    // Include sandbox info in message metadata for historical reference
    if (sessionMeta.sandboxId) msgMeta.sandboxId = sessionMeta.sandboxId;

    await saveMessageToDB(
      sessionId,
      "assistant",
      fullText,
      msgMeta,
      parts.length > 0 ? parts : null
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
    // Extract file/image references from ALL user messages for orchestrator context.
    // Includes historical files so that if the sandbox dies and is recreated,
    // all previously uploaded files are re-downloaded to ~/upload/ (session recovery).
    const fileContext: { name: string; type: string; url?: string }[] = [];
    const seenUrls = new Set<string>();
    for (const m of messages) {
      if (m.role !== "user") continue;
      for (const p of m.parts ?? []) {
        const part = p as unknown as Record<string, unknown>;
        if (part.type === "file" || part.type === "image") {
          const url = part.url as string | undefined;
          // Deduplicate by URL to avoid redundant downloads
          if (url && seenUrls.has(url)) continue;
          if (url) seenUrls.add(url);
          fileContext.push({
            name: (part.filename as string) || (part.name as string) || "unnamed",
            type: (part.mediaType as string) || (part.mimeType as string) || "application/octet-stream",
            url,
          });
        }
      }
    }

    // Allow empty text if files are attached
    if (!lastUserText.trim() && fileContext.length === 0) {
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
    // Persist skills/connections in session metadata for resume.
    // Also read existing metadata (sandboxId, nekoUrl) for sandbox recovery.
    let sessionMeta: Record<string, unknown> = {};
    if (sessionId) {
      try {
        const [existing] = await db
          .select({ id: agentSessions.id, metadata: agentSessions.metadata })
          .from(agentSessions)
          .where(eq(agentSessions.id, sessionId))
          .limit(1);
        if (!existing) {
          const newMeta: Record<string, unknown> = {};
          if (skills?.length) newMeta.skills = skills;
          if (connections?.length) newMeta.connections = connections;
          await db.insert(agentSessions).values({
            id: sessionId,
            userId,
            status: "active",
            ...(Object.keys(newMeta).length > 0 ? { metadata: newMeta } : {}),
          });
          sessionMeta = newMeta;
        } else {
          // Carry forward existing metadata (includes sandboxId for resume)
          sessionMeta = (existing.metadata ?? {}) as Record<string, unknown>;
          if (skills?.length || connections?.length) {
            const updatedMeta = { ...sessionMeta };
            if (skills?.length) updatedMeta.skills = skills;
            if (connections?.length) updatedMeta.connections = connections;
            await db
              .update(agentSessions)
              .set({ metadata: updatedMeta, updatedAt: new Date() })
              .where(eq(agentSessions.id, sessionId));
            sessionMeta = updatedMeta;
          }
        }
      } catch {
        // Non-critical — session may already exist
      }
    }

    // Convert UIMessages to CoreMessages for the orchestrator.
    // Include text content from parts. For user messages, also include file
    // references so the LLM knows about attached files.
    const coreMessages = messages.map((m) => {
      const textParts: string[] = [];

      for (const p of m.parts ?? []) {
        const part = p as unknown as Record<string, unknown>;
        if (part.type === "text" && typeof part.text === "string") {
          textParts.push(part.text);
        } else if (m.role === "user" && (part.type === "file" || part.type === "image")) {
          const name = (part.filename as string) || (part.name as string) || "file";
          const mime = (part.mediaType as string) || (part.mimeType as string) || "";
          textParts.push(`[Attached: ${name}${mime ? ` (${mime})` : ""}]`);
        }
      }

      return {
        role: m.role as "user" | "assistant" | "system",
        content: textParts.join(""),
      };
    });

    // Abort orchestrator when client disconnects OR after 10-min timeout.
    // AbortSignal.any() (Node 20+) merges the request signal (client abort)
    // with a hard timeout so the agent loop doesn't run forever.
    const combinedSignal = AbortSignal.any([req.signal, AbortSignal.timeout(600_000)]);

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
        ...(fileContext.length > 0 ? { fileContext } : {}),
        // Forward session metadata (sandboxId, nekoUrl) for sandbox resume/recovery
        ...(sessionMeta.sandboxId ? { sessionMeta } : {}),
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
      accumulateAndPersist(
        spyStream,
        sessionId,
        lastUserText,
        lastUserParts,
        metadata?.model
      ).catch((err) => log.error("Persistence error:", err as Error));
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
      }
    );
  }
};
