// ============================================================
// GET /api/chat/[id]/stream — Resume an active SSE stream
// ============================================================
//
// DefaultChatTransport sends GET requests to `{api}/{chatId}/stream`
// when `resume: true` is set on useChat. This endpoint reads the
// active stream from Redis and pipes it back to the client.
//
// IMPORTANT: We return an immediately-closing empty SSE stream
// instead of 204 when there's nothing to resume. A 204 (no body)
// causes the AI SDK to crash in DefaultChatTransport.makeRequest's
// finally block — it tries to access `this.activeResponse!.state`
// before activeResponse is set.
// ============================================================

import { log } from "@repo/observability/log";
import { auth } from "@repo/auth";
import { headers } from "next/headers";

import { SSE_HEADERS } from "@/lib/chat/agent-proxy";
import {
  getStreamContext,
  getActiveStreamId,
  clearActiveStreamId,
} from "@/lib/chat/resumable-stream";

export const maxDuration = 120;

/**
 * Return an empty SSE stream that immediately closes.
 * This prevents the AI SDK crash that occurs with 204 (no body) — the SDK's
 * makeRequest needs a readable body so it can set `activeResponse` before
 * the finally block accesses `activeResponse.state`.
 *
 * IMPORTANT: We must NOT send a `start` event with a `messageId` here —
 * the AI SDK treats `start` + `messageId` as a new assistant message and
 * calls `write()`, which would add a phantom empty message to the messages
 * array. An empty stream (no events, immediate close) is safe: the SDK
 * creates an internal message scaffold but never `write()`s it, so it's
 * discarded when the stream ends.
 */
function emptyFinishResponse() {
  const body = new ReadableStream({
    start(controller) {
      controller.close();
    },
  });
  return new Response(body, { headers: SSE_HEADERS });
}

export const GET = async (
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    // Authenticate
    const headersList = await headers();
    const session = await auth.api.getSession({ headers: headersList });

    if (!session?.user) {
      return new Response(null, { status: 401 });
    }

    const { id: chatId } = await params;

    if (!chatId) {
      return emptyFinishResponse();
    }

    // Look up active stream ID from DB
    const streamId = await getActiveStreamId(chatId);
    if (!streamId) {
      return emptyFinishResponse();
    }

    // Get stream context (requires Redis)
    const streamContext = await getStreamContext();
    if (!streamContext) {
      return emptyFinishResponse();
    }

    // Resume the stream from Redis
    const stream = await streamContext.resumeExistingStream(streamId);

    // null = stream is done, undefined = stream never existed
    if (!stream) {
      // Stream completed or expired — clear the active stream ID
      await clearActiveStreamId(chatId);
      return emptyFinishResponse();
    }

    return new Response(stream, { headers: SSE_HEADERS });
  } catch (error) {
    log.error("Stream resume error:", error as Error);
    return emptyFinishResponse();
  }
};
