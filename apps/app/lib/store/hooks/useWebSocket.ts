"use client";

import { useCallback, useEffect, useRef } from "react";
import { useAppDispatch, useAppSelector } from "../hooks";
import {
  wsConnect,
  wsDisconnect,
  wsJoinRoom,
  wsLeaveRoom,
  wsSend,
} from "../middleware/websocket.middleware";
import {
  setConnectionStatus,
  setSocketId,
  joinRoom,
  leaveRoom,
  setLastError,
  incrementReconnectAttempts,
  resetReconnectAttempts,
  type ConnectionStatus,
} from "../slices/websocket.slice";
import { addNotification } from "../slices/notifications.slice";
import { addMessage, appendToMessage, updateMessage, setStreaming } from "../slices/chat.slice";
import { updateSession, addSession } from "../slices/sessions.slice";
import { updateAgent, addTask, updateTask } from "../slices/agents.slice";

// WebSocket event types from the server
export type ServerWebSocketEvent =
  | { type: "connection:established"; payload: { socketId: string } }
  | { type: "connection:error"; payload: { message: string } }
  | { type: "room:joined"; payload: { roomId: string } }
  | { type: "room:left"; payload: { roomId: string } }
  | { type: "message:new"; payload: { sessionId: string; message: any } }
  | { type: "message:update"; payload: { sessionId: string; messageId: string; content: string } }
  | { type: "message:stream"; payload: { sessionId: string; messageId: string; chunk: string } }
  | { type: "message:stream:start"; payload: { sessionId: string; messageId: string } }
  | { type: "message:stream:end"; payload: { sessionId: string; messageId: string } }
  | { type: "agent:update"; payload: { sessionId: string; agentId: string; updates: any } }
  | { type: "agent:task:new"; payload: { agentId: string; task: any } }
  | { type: "agent:task:update"; payload: { agentId: string; taskId: string; updates: any } }
  | { type: "session:update"; payload: { sessionId: string; updates: any } }
  | { type: "session:new"; payload: { session: any } }
  | { type: "notification:new"; payload: { notification: any } }
  | { type: "notification:read"; payload: { notificationId: string } }
  | { type: "typing:start"; payload: { sessionId: string; userId: string } }
  | { type: "typing:stop"; payload: { sessionId: string; userId: string } }
  | { type: "vnc:connected"; payload: { sessionId: string } }
  | { type: "vnc:disconnected"; payload: { sessionId: string } }
  | { type: "context:length:update"; payload: { sessionId: string; percentage: number } };

// Client event types to send to server
export type ClientWebSocketEvent =
  | { type: "join"; room: string }
  | { type: "leave"; room: string }
  | { type: "typing:start"; sessionId: string }
  | { type: "typing:stop"; sessionId: string }
  | { type: "message:send"; sessionId: string; content: string; attachments?: any[] }
  | { type: "task:cancel"; taskId: string }
  | { type: "ping" };

/**
 * WebSocket Hook - Manages real-time connection and events
 *
 * Action Triggers:
 * - connect: WebSocket connection
 * - disconnect: WebSocket disconnect
 * - joinRoom: WebSocket message + State
 * - leaveRoom: WebSocket message + State
 * - send: WebSocket message
 *
 * Receives:
 * - Streaming: message:stream events
 * - Real-time: notification:new, session:update, agent:update events
 */
export function useWebSocketIntegration() {
  const dispatch = useAppDispatch();
  const { status, socketId, rooms, reconnectAttempts, lastError } = useAppSelector(
    (state) => state.websocket
  );
  const { isAuthenticated } = useAppSelector((state) => state.auth);

  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const maxReconnectAttempts = 5;
  const reconnectDelay = 1000; // Base delay in ms, will be exponentially increased

  // Auto-connect when authenticated
  useEffect(() => {
    if (isAuthenticated && status === "disconnected") {
      dispatch(wsConnect());
    }
  }, [isAuthenticated, status, dispatch]);

  // Auto-reconnect on disconnect (with exponential backoff)
  useEffect(() => {
    if (
      isAuthenticated &&
      status === "disconnected" &&
      reconnectAttempts > 0 &&
      reconnectAttempts < maxReconnectAttempts
    ) {
      const delay = reconnectDelay * Math.pow(2, reconnectAttempts - 1);

      reconnectTimeoutRef.current = setTimeout(() => {
        dispatch(wsConnect());
        dispatch(incrementReconnectAttempts());
      }, delay);

      return () => {
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
      };
    }
  }, [isAuthenticated, status, reconnectAttempts, dispatch]);

  // Reset reconnect attempts on successful connection
  useEffect(() => {
    if (status === "connected") {
      dispatch(resetReconnectAttempts());
    }
  }, [status, dispatch]);

  /**
   * Connect to WebSocket server
   * Trigger: WebSocket connection
   */
  const connect = useCallback(() => {
    dispatch(wsConnect());
  }, [dispatch]);

  /**
   * Disconnect from WebSocket server
   * Trigger: WebSocket disconnect
   */
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    dispatch(wsDisconnect());
  }, [dispatch]);

  /**
   * Join a room (session, agent, etc.)
   * Trigger: WebSocket message + State update
   */
  const joinRoomHandler = useCallback(
    (roomId: string) => {
      if (status === "connected") {
        dispatch(wsJoinRoom(roomId));
      }
    },
    [status, dispatch]
  );

  /**
   * Leave a room
   * Trigger: WebSocket message + State update
   */
  const leaveRoomHandler = useCallback(
    (roomId: string) => {
      if (status === "connected") {
        dispatch(wsLeaveRoom(roomId));
      }
    },
    [status, dispatch]
  );

  /**
   * Send a message via WebSocket
   * Trigger: WebSocket message
   */
  const send = useCallback(
    (event: string, data: unknown) => {
      if (status === "connected") {
        dispatch(wsSend(event, data));
      } else {
        console.warn("WebSocket not connected, cannot send message");
      }
    },
    [status, dispatch]
  );

  /**
   * Send typing indicator
   * Trigger: WebSocket message
   */
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

  /**
   * Cancel a running task
   * Trigger: WebSocket message
   */
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
