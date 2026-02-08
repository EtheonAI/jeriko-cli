"use client";

import { useCallback, useEffect } from "react";
import { useAppDispatch, useAppSelector } from "../hooks";
import {
  wsConnect,
  wsDisconnect,
  wsJoinRoom,
  wsLeaveRoom,
  wsSend,
} from "../middleware/websocket.middleware";

// Re-export the canonical event type from middleware (single source of truth)
export type { WebSocketEvent } from "../middleware/websocket.middleware";

/**
 * WebSocket Hook — thin React wrapper over the Redux WebSocket middleware.
 *
 * The middleware handles ALL connection lifecycle: connect, reconnect with
 * exponential backoff + jitter, ping/pong dead connection detection, bounded
 * message queue, and token refresh. This hook only provides:
 *
 * 1. Auto-connect when the user is authenticated
 * 2. Convenience action dispatchers
 * 3. Derived boolean selectors (isConnected, isConnecting, etc.)
 */
export function useWebSocketIntegration() {
  const dispatch = useAppDispatch();
  const { status, socketId, rooms, reconnectAttempts, error: lastError } = useAppSelector(
    (state) => state.websocket
  );
  const { isAuthenticated } = useAppSelector((state) => state.auth);

  // Auto-connect when authenticated and not yet connected/connecting
  useEffect(() => {
    if (isAuthenticated && status === "disconnected" && reconnectAttempts === 0) {
      dispatch(wsConnect());
    }
  }, [isAuthenticated, status, reconnectAttempts, dispatch]);

  const connect = useCallback(() => {
    dispatch(wsConnect());
  }, [dispatch]);

  const disconnect = useCallback(() => {
    dispatch(wsDisconnect());
  }, [dispatch]);

  const joinRoomHandler = useCallback(
    (roomId: string) => {
      dispatch(wsJoinRoom(roomId));
    },
    [dispatch]
  );

  const leaveRoomHandler = useCallback(
    (roomId: string) => {
      dispatch(wsLeaveRoom(roomId));
    },
    [dispatch]
  );

  const send = useCallback(
    (event: string, data: unknown) => {
      dispatch(wsSend(event, data));
    },
    [dispatch]
  );

  const sendTypingStart = useCallback(
    (sessionId: string) => {
      send("typing:start", { sessionId });
    },
    [send]
  );

  const sendTypingStop = useCallback(
    (sessionId: string) => {
      send("typing:stop", { sessionId });
    },
    [send]
  );

  const cancelTask = useCallback(
    (taskId: string) => {
      send("task:cancel", { taskId });
    },
    [send]
  );

  return {
    // State
    status,
    socketId,
    rooms,
    reconnectAttempts,
    lastError,
    isConnected: status === "connected",
    isConnecting: status === "connecting",
    isError: status === "error",

    // Actions
    connect,
    disconnect,
    joinRoom: joinRoomHandler,
    leaveRoom: leaveRoomHandler,
    send,
    sendTypingStart,
    sendTypingStop,
    cancelTask,
  };
}

export default useWebSocketIntegration;
