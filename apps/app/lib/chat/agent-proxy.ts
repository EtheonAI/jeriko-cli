// ============================================================
// Agent Service Proxy — SSE stream pump + response creation
// ============================================================

import { log } from "@repo/observability/log";
import { SSEProcessor } from "./sse-processor";
import { detectQuotaError } from "./error-detection";
import { streamFallbackInlineToStringStream } from "./provider-fallback";
import { saveMessageToDB, autoSetSessionTitle } from "./persistence";
import { clearActiveStreamId } from "./resumable-stream";

export const AGENT_SERVICE_URL = process.env.AGENT_SERVICE_URL || "http://localhost:8000";

export const SSE_HEADERS: HeadersInit = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
  "Transfer-Encoding": "chunked",
  "x-vercel-ai-ui-message-stream": "v1",
};

export interface AgentProxyOpts {
  model: string | undefined;
  sessionId: string | undefined;
  lastUserText: string;
  fallbackSystemPrompt: string;
}

/**
 * Create a ReadableStream<string> that proxies agent SSE events,
 * converting them to AI SDK v6 UIMessage stream format (SSE text).
 *
 * This is the core function used by both the direct response path
 * and the resumable-stream path.
 *
 * Also handles:
 * - Quota error detection & inline fallback
 * - Server-side message persistence after stream ends
 * - Session auto-titling
 * - Active stream ID cleanup
 */
export function createAgentProxySseStream(
  agentBody: ReadableStream<Uint8Array>,
  opts: AgentProxyOpts,
): ReadableStream<string> {
  const { model, sessionId, lastUserText, fallbackSystemPrompt } = opts;

  const agentReader = agentBody.getReader();
  const decoder = new TextDecoder();

  // Stateful SSE processor that emits proper AI SDK v6 lifecycle events
  const processor = new SSEProcessor();

  return new ReadableStream<string>({
    async pull(controller) {
      // Internal pump that reads until we have something to enqueue
      // or the stream ends. We handle the full lifecycle here.
    },
    async start(controller) {
      let buffer = "";
      let hasStarted = false;

      const pump = async () => {
        try {
          while (true) {
            const { done, value } = await agentReader.read();

            if (done) {
              // Process remaining buffer
              if (buffer.trim()) {
                for (const part of buffer.split("\n\n")) {
                  if (!part.trim()) continue;
                  const output = processor.process(part.trim());
                  if (output) controller.enqueue(output);
                }
              }
              // Close all open parts (text, reasoning, step boundaries)
              const { closingSSE } = processor.finalize();
              if (closingSSE) controller.enqueue(closingSSE);
              // Send finish event
              controller.enqueue(
                `data: ${JSON.stringify({ type: "finish", finishReason: "stop" })}\n\n`
              );
              controller.close();
              break;
            }

            buffer += decoder.decode(value, { stream: true });

            // Process complete SSE messages
            const parts = buffer.split("\n\n");
            buffer = parts.pop() ?? "";

            for (const part of parts) {
              if (!part.trim()) continue;

              // Detect quota/auth errors BEFORE processing — fall back inline.
              // Only trigger fallback if we haven't received meaningful tool results yet.
              // Once the agent has executed tools, falling back to text-only streaming
              // makes no sense and produces confusing error messages.
              if (detectQuotaError(part) && processor.collectedParts.length === 0) {
                log.warn("Provider quota error detected in agent stream, falling back inline", {
                  raw: part.slice(0, 200),
                });
                // Stream fallback text through the same controller
                await streamFallbackInlineToStringStream(
                  controller,
                  processor,
                  hasStarted,
                  lastUserText,
                  model,
                  fallbackSystemPrompt,
                  sessionId,
                );
                return; // Exit pump — fallback closes controller
              }

              const output = processor.process(part.trim());
              if (output) {
                // Send start event on first output for immediate UI feedback
                if (!hasStarted) {
                  hasStarted = true;
                  controller.enqueue(
                    `data: ${JSON.stringify({ type: "start" })}\n\n`
                  );
                }
                controller.enqueue(output);
              }
            }
          }
        } catch (error) {
          log.error("Stream pump error:", error as Error);
          try {
            controller.enqueue(
              `data: ${JSON.stringify({ type: "error", errorText: "Stream error" })}\n\n`
            );
          } catch {
            /* controller may be closed */
          }
          try {
            controller.close();
          } catch {
            /* ignore */
          }
        } finally {
          // Server-side persistence — save user + assistant messages with full parts.
          // This runs on the server after the stream ends, surviving client disconnects.
          if (sessionId) {
            const fullText = processor.collectedText.join("");
            const collectedParts = processor.collectedParts;

            // Save user message (text-only)
            if (lastUserText) {
              saveMessageToDB(sessionId, "user", lastUserText).catch(() => {});
            }

            // Save assistant message with full parts (tool calls, plan, etc.)
            if (fullText || collectedParts.length > 0) {
              saveMessageToDB(
                sessionId,
                "assistant",
                fullText,
                { model: model ?? "agent" },
                collectedParts.length > 0 ? collectedParts : null,
              ).catch(() => {});
            }

            // Auto-title the session
            if (lastUserText) {
              autoSetSessionTitle(sessionId, lastUserText).catch(() => {});
            }

            // Clear active stream ID (resumable stream cleanup)
            clearActiveStreamId(sessionId).catch(() => {});
          }
        }
      };

      // Start the pump (non-blocking)
      pump().catch((e) => log.error("Pump promise error:", e as Error));
    },
  });
}

/**
 * Convenience wrapper: creates a full HTTP Response from the SSE string stream.
 * Used when resumable streams are not available (no Redis).
 */
export function createAgentProxyResponse(
  agentBody: ReadableStream<Uint8Array>,
  opts: AgentProxyOpts,
): Response {
  const sseStream = createAgentProxySseStream(agentBody, opts);

  // Convert ReadableStream<string> to ReadableStream<Uint8Array> for Response
  const encoder = new TextEncoder();
  const byteStream = sseStream.pipeThrough(
    new TransformStream<string, Uint8Array>({
      transform(chunk, controller) {
        controller.enqueue(encoder.encode(chunk));
      },
    })
  );

  return new Response(byteStream, { headers: SSE_HEADERS });
}
