import { log } from "@repo/observability/log";
import type { UIMessage } from "@repo/ai/lib/types/ui-message";
import { auth } from "@repo/auth";
import { headers } from "next/headers";
import { db, agentSessions, messages as messagesTable, eq } from "@repo/database";
import { queryKnowledge } from "./knowledge";
import { resolveModel } from "@repo/ai/lib/models";
import { streamText } from "ai";
import { createId } from "@paralleldrive/cuid2";

const AGENT_SERVICE_URL = process.env.AGENT_SERVICE_URL || "http://localhost:8000";

export const maxDuration = 120;

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
      knowledgeGroupIds,
    } = body as {
      messages: UIMessage[];
      id?: string;
      chatId?: string;
      metadata?: { sessionId?: string; model?: string };
      model?: string;
      knowledgeGroupIds?: string[];
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

    // RAG: Query knowledge base for relevant context
    let systemPrompt: string | undefined;
    if (lastUserText) {
      const ragContext = await queryKnowledge(userId, lastUserText, knowledgeGroupIds);
      if (ragContext) {
        systemPrompt = `You are Rubic, a helpful AI assistant. Be concise, helpful, and friendly.

The user has provided the following knowledge base context. Use it to inform your response when relevant:

${ragContext}

If the knowledge context is not relevant to the user's question, ignore it.`;
      }
    }

    // Try agent service first, fall back to direct AI SDK streaming
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
          system_prompt: systemPrompt || undefined,
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
      const agentReader = agentResponse.body.getReader();
      const decoder = new TextDecoder();
      const encoder = new TextEncoder();

      // Use TransformStream for push-based streaming (no buffering)
      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();

      // Stateful SSE processor that emits proper AI SDK v6 lifecycle events
      const processor = new SSEProcessor();

      // Start async reader that pushes data immediately
      const pumpPromise = (async () => {
        let buffer = "";
        let hasStarted = false;
        try {
          while (true) {
            const { done, value } = await agentReader.read();

            if (done) {
              // Process remaining buffer
              if (buffer.trim()) {
                for (const part of buffer.split("\n\n")) {
                  if (!part.trim()) continue;
                  const output = processor.process(part.trim());
                  if (output) await writer.write(encoder.encode(output));
                }
              }
              // Close any open text part before finish
              const closeOutput = processor.closeTextPart();
              if (closeOutput) await writer.write(encoder.encode(closeOutput));
              // Send finish event
              await writer.write(
                encoder.encode(
                  `data: ${JSON.stringify({ type: "finish", finishReason: "stop" })}\n\n`
                )
              );
              break;
            }

            buffer += decoder.decode(value, { stream: true });

            // Process complete SSE messages
            const parts = buffer.split("\n\n");
            buffer = parts.pop() ?? "";

            for (const part of parts) {
              if (!part.trim()) continue;
              const output = processor.process(part.trim());
              if (output) {
                // Send start event on first output for immediate UI feedback
                if (!hasStarted) {
                  hasStarted = true;
                  await writer.write(
                    encoder.encode(`data: ${JSON.stringify({ type: "start" })}\n\n`)
                  );
                }
                await writer.write(encoder.encode(output));
              }
            }
          }
        } catch (error) {
          log.error("Stream pump error:", error as Error);
          try {
            await writer.write(
              encoder.encode(
                `data: ${JSON.stringify({ type: "error", errorText: "Stream error" })}\n\n`
              )
            );
          } catch {
            /* writer may be closed */
          }
        } finally {
          try {
            await writer.close();
          } catch {
            /* ignore */
          }

          // DB persistence is handled by the agent service in this path.
        }
      })();

      // Don't await the pump — let it run concurrently with the response
      pumpPromise.catch((e) => log.error("Pump promise error:", e as Error));

      return new Response(readable, {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
          "Transfer-Encoding": "chunked",
          "x-vercel-ai-ui-message-stream": "v1",
        },
      });
    }

    // Fallback: Direct AI SDK streaming (no agent service needed)
    log.info("Using direct AI SDK streaming fallback", { model: model ?? "default" });

    // Save user message to DB (non-blocking) for fallback path
    if (sessionId && lastUserText) {
      saveMessageToDB(sessionId, "user", lastUserText).catch(() => {});
    }

    const resolvedModel = resolveModel(model || undefined);
    const result = streamText({
      model: resolvedModel,
      system:
        systemPrompt || "You are Rubic, a helpful AI assistant. Be concise, helpful, and friendly.",
      messages: [{ role: "user" as const, content: lastUserText }],
      onFinish: async ({ text }) => {
        // Persist fallback response too
        if (sessionId && text) {
          await saveMessageToDB(sessionId, "assistant", text, { model: model ?? "default" }).catch(
            () => {}
          );
          if (lastUserText) {
            await autoSetSessionTitle(sessionId, lastUserText).catch(() => {});
          }
        }
      },
    });

    // Use toUIMessageStreamResponse() to produce SSE with proper lifecycle events
    // (text-start, text-delta, text-end, finish) that the client transport can parse.
    // toTextStreamResponse() produces raw text with no protocol framing — the client
    // parsers can't recognize it, so streaming appears broken.
    return result.toUIMessageStreamResponse();
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
// Message Persistence
// ============================================================

async function saveMessageToDB(
  sessionId: string,
  role: "user" | "assistant" | "system" | "tool",
  content: string,
  metadata?: Record<string, unknown>
) {
  try {
    await db.insert(messagesTable).values({
      id: createId(),
      sessionId,
      role,
      content,
      metadata: metadata ?? null,
    });
  } catch (err) {
    log.error(`Failed to save ${role} message:`, err as Error);
  }
}

async function autoSetSessionTitle(sessionId: string, userPrompt: string) {
  try {
    // Only set title if it's not already set
    const [session] = await db
      .select({ title: agentSessions.title })
      .from(agentSessions)
      .where(eq(agentSessions.id, sessionId))
      .limit(1);

    if (session && !session.title) {
      let title = userPrompt.slice(0, 60).trim();
      if (userPrompt.length > 60) title += "...";
      await db
        .update(agentSessions)
        .set({ title, updatedAt: new Date() })
        .where(eq(agentSessions.id, sessionId));
    }
  } catch {
    // Non-critical
  }
}

// ============================================================
// SSE → AI SDK Data Stream Transform
// ============================================================

/**
 * Stateful processor that converts agent SSE events into AI SDK v6
 * UIMessage stream chunks.  Tracks whether a text part is currently
 * open so we can emit the required text-start / text-delta / text-end
 * lifecycle events.
 */
class SSEProcessor {
  private textPartId = "text-0";
  private textPartOpen = false;
  private textPartCounter = 0;
  collectedText: string[] = [];
  collectedToolSteps: Array<{
    id: string;
    toolName: string;
    label: string;
    status: string;
  }> = [];

  private toSSE(chunk: object) {
    return `data: ${JSON.stringify(chunk)}\n\n`;
  }

  /** Close any open text part (returns text-end SSE or empty string). */
  closeTextPart(): string {
    if (!this.textPartOpen) return "";
    this.textPartOpen = false;
    return this.toSSE({ type: "text-end", id: this.textPartId });
  }

  /** Open a new text part (returns text-start SSE). */
  private openTextPart(): string {
    this.textPartCounter++;
    this.textPartId = `text-${this.textPartCounter}`;
    this.textPartOpen = true;
    return this.toSSE({ type: "text-start", id: this.textPartId });
  }

  process(part: string): string {
    // Extract data from SSE lines
    let data = "";
    for (const line of part.split("\n")) {
      if (line.startsWith("data: ")) {
        data += line.slice(6);
      } else if (line.startsWith("data:")) {
        data += line.slice(5);
      }
    }

    if (!data) return "";
    if (data === "[DONE]") return "";

    try {
      const event = JSON.parse(data) as AgentSSEEvent;
      let output = "";

      switch (event.type) {
        case "content": {
          const text = event.content || "";
          if (text) {
            this.collectedText.push(text);
            // Open a text part if not already open
            if (!this.textPartOpen) {
              output += this.openTextPart();
            }
            output += this.toSSE({ type: "text-delta", id: this.textPartId, delta: text });
          }
          break;
        }

        case "tool_start": {
          // Close any open text part before tool events
          output += this.closeTextPart();

          const toolCallId = event.toolCallId || `tool_${Date.now()}`;
          const toolName = event.tool || "unknown";
          output += this.toSSE({
            type: "tool-input-available",
            toolCallId,
            toolName,
            input: event.input || {},
            providerExecuted: true,
          });
          this.collectedToolSteps.push({
            id: toolCallId,
            toolName,
            label: toolName.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
            status: "in_progress",
          });
          break;
        }

        case "tool_result": {
          output += this.closeTextPart();
          const toolCallId = event.toolCallId || "";
          if (event.success) {
            output += this.toSSE({
              type: "tool-output-available",
              toolCallId,
              output: event.result ?? event.summary,
              providerExecuted: true,
            });
          } else {
            const errorText =
              typeof event.result === "object" && event.result && "error" in event.result
                ? (event.result as { error: string }).error
                : typeof event.summary === "string"
                  ? event.summary
                  : "Tool execution failed";
            output += this.toSSE({
              type: "tool-output-error",
              toolCallId,
              errorText,
              providerExecuted: true,
            });
          }
          const step = this.collectedToolSteps.find((s) => s.id === toolCallId);
          if (step) {
            step.status = event.success ? "completed" : "cancelled";
          }
          break;
        }

        case "usage": {
          output += this.toSSE({
            type: "message-metadata",
            messageMetadata: {
              usage: event.usage,
              iterations: event.iterations,
              toolCallsCount: event.tool_calls_count,
            },
          });
          break;
        }

        case "error": {
          output += this.closeTextPart();
          output += this.toSSE({ type: "error", errorText: event.error || "Unknown error" });
          break;
        }

        case "warning": {
          const msg = event.message || "Warning";
          if (!this.textPartOpen) {
            output += this.openTextPart();
          }
          output += this.toSSE({ type: "text-delta", id: this.textPartId, delta: `\n\n⚠️ ${msg}` });
          this.collectedText.push(`\n\n⚠️ ${msg}`);
          break;
        }

        default:
          break;
      }

      return output;
    } catch {
      return "";
    }
  }
}

// ============================================================
// Type definitions
// ============================================================

type AgentSSEEvent =
  | { type: "content"; content: string }
  | {
      type: "tool_start";
      toolCallId?: string;
      tool: string;
      input: unknown;
    }
  | {
      type: "tool_result";
      toolCallId?: string;
      tool: string;
      success: boolean;
      result?: unknown;
      summary?: unknown;
    }
  | {
      type: "usage";
      usage: Record<string, number>;
      iterations: number;
      tool_calls_count: number;
    }
  | { type: "error"; error: string }
  | { type: "warning"; message: string };
