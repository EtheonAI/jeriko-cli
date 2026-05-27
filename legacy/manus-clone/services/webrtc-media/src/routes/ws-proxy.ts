/**
 * WebSocket signaling proxy for Neko.
 *
 * Frontend Neko Client → ws://webrtc-media:4016/ws?session={sessionId}
 *                              ↓
 * ws-proxy looks up mediaSessions table → gets nekoHost
 *                              ↓
 * Upstream → wss://{nekoHost}/ws (E2B port proxy to sandbox Neko:8333)
 *                              ↓
 * Bidirectional pipe (message ↔ message, close ↔ close)
 */

import type { FastifyInstance, FastifyRequest } from "fastify";
import { WebSocket } from "ws";
import { createLogger } from "@repo/service-utils";
import { db, mediaSessions, eq } from "../lib/db.js";

const logger = createLogger({ service: "ws-proxy" });

const UPSTREAM_CONNECT_TIMEOUT_MS = 10000;

export async function wsProxyRoutes(app: FastifyInstance) {
  // @fastify/websocket handler: (socket: WebSocket, request: FastifyRequest)
  app.get("/ws", { websocket: true }, async function wsHandler(
    socket: WebSocket,
    request: FastifyRequest
  ) {
    // Parse session from the upgrade URL
    const urlObj = new URL(request.url, `http://${request.hostname}`);
    const sessionId = urlObj.searchParams.get("session");

    if (!sessionId) {
      socket.close(4000, "Missing session query parameter");
      return;
    }

    // Look up media session
    let session: { nekoHost: string | null } | undefined;
    try {
      const [row] = await db
        .select()
        .from(mediaSessions)
        .where(eq(mediaSessions.sessionId, sessionId))
        .limit(1);
      session = row;
    } catch (err: unknown) {
      logger.error({ sessionId, error: err instanceof Error ? err.message : String(err) }, "DB lookup failed");
      socket.close(4500, "Internal error");
      return;
    }

    if (!session?.nekoHost) {
      socket.close(4004, "No media session or nekoHost found");
      return;
    }

    // Connect to upstream Neko WebSocket
    const upstreamUrl = `wss://${session.nekoHost}/ws`;
    let upstream: WebSocket;

    try {
      upstream = await new Promise<WebSocket>((resolve, reject) => {
        const ws = new WebSocket(upstreamUrl, {
          handshakeTimeout: UPSTREAM_CONNECT_TIMEOUT_MS,
        });

        const timeout = setTimeout(() => {
          ws.close();
          reject(new Error("Upstream connection timeout"));
        }, UPSTREAM_CONNECT_TIMEOUT_MS);

        ws.on("open", () => {
          clearTimeout(timeout);
          resolve(ws);
        });

        ws.on("error", (err: Error) => {
          clearTimeout(timeout);
          reject(err);
        });
      });
    } catch (err: unknown) {
      logger.warn(
        { sessionId, upstreamUrl, error: err instanceof Error ? err.message : String(err) },
        "Failed to connect to upstream Neko"
      );
      socket.close(4502, "Upstream connection failed");
      return;
    }

    logger.info({ sessionId, upstreamUrl }, "WebSocket proxy established");

    // Bidirectional pipe — no message transformation (Neko protocol is opaque JSON)
    socket.on("message", (data: Buffer | string, isBinary: boolean) => {
      if (upstream.readyState === WebSocket.OPEN) {
        upstream.send(data, { binary: isBinary });
      }
    });

    upstream.on("message", (data: Buffer | string, isBinary: boolean) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(data, { binary: isBinary });
      }
    });

    // Close propagation
    socket.on("close", (code: number, reason: Buffer) => {
      logger.info({ sessionId, code }, "Client WebSocket closed");
      if (upstream.readyState === WebSocket.OPEN || upstream.readyState === WebSocket.CONNECTING) {
        upstream.close(code, reason);
      }
    });

    upstream.on("close", (code: number, reason: Buffer) => {
      logger.info({ sessionId, code }, "Upstream WebSocket closed");
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close(code, reason);
      }
    });

    // Error handling
    socket.on("error", (err: Error) => {
      logger.warn({ sessionId, error: err.message }, "Client WebSocket error");
      if (upstream.readyState === WebSocket.OPEN) upstream.close(1011, "Client error");
    });

    upstream.on("error", (err: Error) => {
      logger.warn({ sessionId, error: err.message }, "Upstream WebSocket error");
      if (socket.readyState === WebSocket.OPEN) socket.close(1011, "Upstream error");
    });
  });
}
