// ============================================================
// Agent Service Fallback — retries agent or returns clean error
// ============================================================
//
// All AI completions go through the agent service. When the primary
// request fails, we either retry the agent or return a clean error
// SSE response. No direct LLM provider calls.
// ============================================================

import { log } from "@repo/observability/log";
import { extractErrorMessage } from "./error-detection";
import { saveMessageToDB, autoSetSessionTitle } from "./persistence";
import { AGENT_SERVICE_URL, createAgentProxyResponse } from "./agent-proxy";
import type { SSEProcessor } from "./sse-processor";

const toSSE = (chunk: object) => `data: ${JSON.stringify(chunk)}\n\n`;

/**
 * Fallback when agent service is completely unavailable.
 * Retries the agent once, or returns a clean error SSE response.
 */
export async function streamWithProviderFallback(
  userText: string,
  model: string | undefined,
  systemPrompt: string,
  sessionId: string | undefined
): Promise<Response> {
  // Retry agent service once (it may have just been starting up)
  try {
    const agentResponse = await fetch(`${AGENT_SERVICE_URL}/v1/complete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": "fallback",
        "x-session-id": sessionId || "default",
      },
      body: JSON.stringify({
        prompt: userText,
        model: model || undefined,
        stream: true,
        session_id: sessionId || undefined,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (agentResponse.ok && agentResponse.body) {
      log.info("Agent service retry succeeded on fallback path");
      return createAgentProxyResponse(agentResponse.body, {
        model,
        sessionId,
        lastUserText: userText,
        fallbackSystemPrompt: systemPrompt,
      });
    }
  } catch {
    // Agent still unavailable — fall through to error response
  }

  log.warn("Agent service unavailable, returning error SSE response");

  // Return a clean error as an SSE stream so the UI handles it gracefully
  const errorMessage =
    "I'm sorry, the AI service is temporarily unavailable. Please try again in a moment.";

  const sseBody = [
    toSSE({ type: "start" }),
    toSSE({ type: "text-start", id: "text-error" }),
    toSSE({ type: "text-delta", id: "text-error", delta: errorMessage }),
    toSSE({ type: "text-end", id: "text-error" }),
    toSSE({ type: "finish", finishReason: "error" }),
  ].join("");

  // Persist the error message
  if (sessionId) {
    saveMessageToDB(sessionId, "assistant", errorMessage, { model: "unavailable" }, [
      { type: "text", text: errorMessage },
    ]).catch(() => {});
    if (userText) {
      autoSetSessionTitle(sessionId, userText).catch(() => {});
    }
  }

  return new Response(sseBody, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      "x-vercel-ai-ui-message-stream": "v1",
    },
  });
}

// ============================================================
// Inline Fallback — streams error message through an open
// ReadableStream<string> controller (used when agent stream
// hits a quota error mid-stream).
// ============================================================

/**
 * Streams a clean error message into a ReadableStreamDefaultController<string>.
 * Used by the agent proxy when a quota error is detected mid-stream.
 * Closes the controller when done.
 */
export async function streamFallbackInlineToStringStream(
  controller: ReadableStreamDefaultController<string>,
  processor: SSEProcessor,
  hasStarted: boolean,
  userText: string,
  model: string | undefined,
  systemPrompt: string,
  sessionId: string | undefined,
): Promise<void> {
  try {
    // Close any open text part from previous agent output
    const closeOut = processor.closeTextPart();
    if (closeOut) controller.enqueue(closeOut);

    // Ensure stream is started
    if (!hasStarted) {
      controller.enqueue(toSSE({ type: "start" }));
    }

    const errorMessage =
      "I encountered a service limit. Please try again in a moment, or rephrase your request.";

    const textPartId = `text-fallback-${Date.now()}`;
    controller.enqueue(toSSE({ type: "text-start", id: textPartId }));
    controller.enqueue(toSSE({ type: "text-delta", id: textPartId, delta: errorMessage }));
    controller.enqueue(toSSE({ type: "text-end", id: textPartId }));
    controller.enqueue(toSSE({ type: "finish", finishReason: "error" }));

    // Persist the error response
    if (sessionId && errorMessage) {
      const textParts = [{ type: "text", text: errorMessage }];
      saveMessageToDB(sessionId, "assistant", errorMessage, { model: "quota-error" }, textParts).catch(() => {});
    }
  } catch (fallbackErr) {
    log.error("Inline fallback error:", fallbackErr as Error);
    const errorMsg = extractErrorMessage(fallbackErr);
    const textPartId = `text-err-${Date.now()}`;
    try {
      controller.enqueue(toSSE({ type: "text-start", id: textPartId }));
      controller.enqueue(
        toSSE({
          type: "text-delta",
          id: textPartId,
          delta: `I'm sorry, I'm temporarily unable to respond. Please try again.\n\n_Error: ${errorMsg}_`,
        })
      );
      controller.enqueue(toSSE({ type: "text-end", id: textPartId }));
      controller.enqueue(toSSE({ type: "finish", finishReason: "error" }));
    } catch {
      /* controller may already be closed */
    }
  } finally {
    try {
      controller.close();
    } catch {
      /* ignore */
    }
  }
}
