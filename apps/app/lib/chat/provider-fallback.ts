// ============================================================
// Provider Fallback -- tries primary then alternate provider
// ============================================================

import { log } from "@repo/observability/log";
import { resolveModel, resolveFallbackModel } from "@repo/ai/lib/models";
import { streamText } from "ai";
import { isQuotaError, extractErrorMessage } from "./error-detection";
import { saveMessageToDB, autoSetSessionTitle } from "./persistence";
import type { SSEProcessor } from "./sse-processor";

const FALLBACK_SYSTEM_SUFFIX =
  "\n\nNote: Tool execution is temporarily unavailable. Answer questions using your knowledge. If the user asks you to perform actions that require tools (browsing, file operations, code execution), let them know the capability is temporarily unavailable and offer to help in other ways.";

export async function streamWithProviderFallback(
  userText: string,
  model: string | undefined,
  systemPrompt: string,
  sessionId: string | undefined
): Promise<Response> {
  // Try primary model first
  try {
    const resolvedModel = resolveModel(model || undefined);
    const result = streamText({
      model: resolvedModel,
      system: (systemPrompt || "You are Rubic, a helpful AI assistant. Be concise, helpful, and friendly.") + FALLBACK_SYSTEM_SUFFIX,
      messages: [{ role: "user" as const, content: userText }],
      onFinish: async ({ text }) => {
        if (sessionId && text) {
          const textParts = [{ type: "text", text }];
          await saveMessageToDB(sessionId, "assistant", text, { model: model ?? "default" }, textParts).catch(() => {});
          if (userText) {
            await autoSetSessionTitle(sessionId, userText).catch(() => {});
          }
        }
      },
    });

    return result.toUIMessageStreamResponse();
  } catch (primaryError) {
    if (!isQuotaError(primaryError)) {
      throw primaryError; // Non-quota errors bubble up
    }

    log.warn("Primary model quota error, trying fallback provider", {
      primaryModel: model ?? "default",
      error: (primaryError as Error).message,
    });

    // Try fallback provider
    try {
      const fallbackModel = resolveFallbackModel(model || undefined);
      const result = streamText({
        model: fallbackModel,
        system: (systemPrompt || "You are Rubic, a helpful AI assistant. Be concise, helpful, and friendly.") + FALLBACK_SYSTEM_SUFFIX,
        messages: [{ role: "user" as const, content: userText }],
        onFinish: async ({ text }) => {
          if (sessionId && text) {
            const textParts = [{ type: "text", text }];
            await saveMessageToDB(sessionId, "assistant", text, { model: "fallback" }, textParts).catch(() => {});
            if (userText) {
              await autoSetSessionTitle(sessionId, userText).catch(() => {});
            }
          }
        },
      });

      return result.toUIMessageStreamResponse();
    } catch (fallbackError) {
      log.error("Both primary and fallback providers failed", {
        primaryError: (primaryError as Error).message,
        fallbackError: (fallbackError as Error).message,
      });
      throw fallbackError;
    }
  }
}

// ============================================================
// Inline Fallback — streams from backup provider through a
// ReadableStream<string> controller (used when agent stream
// hits a quota error mid-stream).
// ============================================================

const toSSE = (chunk: object) => `data: ${JSON.stringify(chunk)}\n\n`;

/**
 * Streams fallback text into a ReadableStreamDefaultController<string>.
 * Used by the agent proxy string stream when a quota error is detected.
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

    // Try fallback model
    const fallbackModel = resolveFallbackModel(model || undefined);

    const result = streamText({
      model: fallbackModel,
      system: (systemPrompt || "You are Rubic, a helpful AI assistant.") + FALLBACK_SYSTEM_SUFFIX,
      messages: [{ role: "user" as const, content: userText }],
    });

    // Open a new text part
    const textPartId = `text-fallback-${Date.now()}`;
    controller.enqueue(toSSE({ type: "text-start", id: textPartId }));

    // Stream text deltas from the fallback model
    const textStream = result.textStream;
    let fullText = "";
    for await (const delta of textStream) {
      fullText += delta;
      controller.enqueue(toSSE({ type: "text-delta", id: textPartId, delta }));
    }

    // Close text part and finish
    controller.enqueue(toSSE({ type: "text-end", id: textPartId }));
    controller.enqueue(toSSE({ type: "finish", finishReason: "stop" }));

    // Persist the fallback response (server-side, survives tab close)
    if (sessionId && fullText) {
      const textParts = [{ type: "text", text: fullText }];
      saveMessageToDB(sessionId, "assistant", fullText, { model: "fallback" }, textParts).catch(() => {});
    }
  } catch (fallbackErr) {
    log.error("Inline fallback also failed:", fallbackErr as Error);
    const errorMsg = extractErrorMessage(fallbackErr);
    const textPartId = `text-err-${Date.now()}`;
    try {
      controller.enqueue(toSSE({ type: "text-start", id: textPartId }));
      controller.enqueue(
        toSSE({
          type: "text-delta",
          id: textPartId,
          delta: `I'm sorry, I'm temporarily unable to respond due to a service issue. Please try again in a moment.\n\n_Error: ${errorMsg}_`,
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

// ============================================================
// Legacy Inline Fallback — Uint8Array writer (kept for compat)
// ============================================================

export async function streamFallbackInline(
  writer: WritableStreamDefaultWriter<Uint8Array>,
  encoder: TextEncoder,
  processor: SSEProcessor,
  hasStarted: boolean,
  userText: string,
  model: string | undefined,
  systemPrompt: string,
  sessionId: string | undefined,
): Promise<void> {
  try {
    const closeOut = processor.closeTextPart();
    if (closeOut) await writer.write(encoder.encode(closeOut));

    if (!hasStarted) {
      await writer.write(encoder.encode(toSSE({ type: "start" })));
    }

    const fallbackModel = resolveFallbackModel(model || undefined);
    const result = streamText({
      model: fallbackModel,
      system: (systemPrompt || "You are Rubic, a helpful AI assistant.") + FALLBACK_SYSTEM_SUFFIX,
      messages: [{ role: "user" as const, content: userText }],
    });

    const textPartId = `text-fallback-${Date.now()}`;
    await writer.write(encoder.encode(toSSE({ type: "text-start", id: textPartId })));

    const textStream = result.textStream;
    let fullText = "";
    for await (const delta of textStream) {
      fullText += delta;
      await writer.write(encoder.encode(toSSE({ type: "text-delta", id: textPartId, delta })));
    }

    await writer.write(encoder.encode(toSSE({ type: "text-end", id: textPartId })));
    await writer.write(encoder.encode(toSSE({ type: "finish", finishReason: "stop" })));

    if (sessionId && fullText) {
      const textParts = [{ type: "text", text: fullText }];
      saveMessageToDB(sessionId, "assistant", fullText, { model: "fallback" }, textParts).catch(() => {});
    }
  } catch (fallbackErr) {
    log.error("Inline fallback also failed:", fallbackErr as Error);
    const errorMsg = extractErrorMessage(fallbackErr);
    const textPartId = `text-err-${Date.now()}`;
    try {
      await writer.write(encoder.encode(toSSE({ type: "text-start", id: textPartId })));
      await writer.write(
        encoder.encode(
          toSSE({
            type: "text-delta",
            id: textPartId,
            delta: `I'm sorry, I'm temporarily unable to respond due to a service issue. Please try again in a moment.\n\n_Error: ${errorMsg}_`,
          })
        )
      );
      await writer.write(encoder.encode(toSSE({ type: "text-end", id: textPartId })));
      await writer.write(encoder.encode(toSSE({ type: "finish", finishReason: "error" })));
    } catch {
      /* writer may already be closed */
    }
  } finally {
    try {
      await writer.close();
    } catch {
      /* ignore */
    }
  }
}
