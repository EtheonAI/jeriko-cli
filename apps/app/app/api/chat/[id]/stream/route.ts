// ============================================================
// GET /api/chat/[id]/stream — Resume an active SSE stream
// ============================================================
//
// DefaultChatTransport sends GET requests to `{api}/{chatId}/stream`
// when `resume: true` is set on useChat. This endpoint reads the
// active stream from Redis and pipes it back to the client.
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
      return new Response(null, { status: 204 });
    }

    // Look up active stream ID from DB
    const streamId = await getActiveStreamId(chatId);
    if (!streamId) {
      return new Response(null, { status: 204 });
    }

    // Get stream context (requires Redis)
    const streamContext = await getStreamContext();
    if (!streamContext) {
      return new Response(null, { status: 204 });
    }

    // Resume the stream from Redis
    const stream = await streamContext.resumeExistingStream(streamId);

    // null = stream is done, undefined = stream never existed
    if (!stream) {
      // Stream completed or expired — clear the active stream ID
      await clearActiveStreamId(chatId);
      return new Response(null, { status: 204 });
    }

    return new Response(stream, { headers: SSE_HEADERS });
  } catch (error) {
    log.error("Stream resume error:", error as Error);
    return new Response(null, { status: 204 });
  }
};
