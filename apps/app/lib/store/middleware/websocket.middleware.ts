import { Middleware } from "@reduxjs/toolkit";
import type { RootState, AppDispatch } from "../index";
import {
  setConnectionStatus,
  setSocketId,
  joinRoom,
  leaveRoom,
  setLastError,
  setLastPongTime,
} from "../slices/websocket.slice";
import { addAgent, addTask, updateAgent, updateTask } from "../slices/agents.slice";
import {
  addExecution,
  addScheduledTask,
  deleteScheduledTask,
  updateExecution,
  updateScheduledTask,
} from "../slices/scheduledTasks.slice";
import {
  updateSession,
  addSession,
  removeSession,
  type AgentSession,
} from "../slices/sessions.slice";
import {
  addNotification,
  markAsRead as markNotificationAsRead,
  type Notification,
} from "../slices/notifications.slice";
import { updateDeviceStatus } from "../slices/devices.slice";
import { addMessage, updateMessage, type Message } from "../slices/chat.slice";
import type { Agent, AgentTask } from "../slices/agents.slice";
import type { ScheduledTask, ScheduledTaskExecution } from "../slices/scheduledTasks.slice";

// ==================================================================

// Discriminated union for WebSocket events from server
export type WebSocketEvent =
  | { type: "connected"; data?: { clientId?: string } }
  | { type: "error"; data?: { message?: string } }
  | { type: "task:created"; data?: { task?: AgentTask } }
  | {
      type: "task:updated";
      data?: {
        agentId?: string;
        taskId?: string;
        updates?: Partial<AgentTask>;
        task?: Partial<AgentTask>;
      };
    }
  | {
      type: "task:completed";
      data?: {
        agentId?: string;
        taskId?: string;
        updates?: Partial<AgentTask>;
        task?: Partial<AgentTask>;
      };
    }
  | { type: "task:cancelled"; data?: { agentId?: string; taskId?: string } }
  | { type: "agent:new"; data?: { agent?: Agent } }
  | {
      type: "agent:update";
      data?: { agentId?: string; sessionId?: string; updates?: Partial<Agent> };
    }
  | { type: "session:update"; data?: { sessionId?: string; updates?: Partial<AgentSession> } }
  | { type: "session:new"; data?: { session?: AgentSession } }
  | { type: "session:deleted"; data?: { sessionId?: string } }
  | { type: "notification:new"; data?: Notification }
  | { type: "notification:read"; data?: { notificationId?: string; id?: string } }
  | { type: "message:new"; data?: { message?: Message } & Partial<Message> }
  | {
      type: "message:update";
      data?: { sessionId?: string; messageId?: string; updates?: Partial<Message> };
    }
  | { type: "device:status"; data?: { deviceId?: string; status?: string; lastHeartbeat?: string } }
  | { type: "scheduledTask:new"; data?: { task?: ScheduledTask } }
  | {
      type: "scheduledTask:update";
      data?: { taskId?: string; task?: ScheduledTask; updates?: Partial<ScheduledTask> };
    }
  | { type: "scheduledTask:deleted"; data?: { taskId?: string } }
  | { type: "scheduledTask:execution:new"; data?: { execution?: ScheduledTaskExecution } }
  | {
      type: "scheduledTask:execution:update";
      data?: { taskId?: string; executionId?: string; updates?: Partial<ScheduledTaskExecution> };
    }
  | { type: "pong"; data?: unknown }
  | { type: string; data?: unknown }; // Fallback for unknown events

// WebSocket middleware actions
export const WS_CONNECT = "websocket/connect";
export const WS_DISCONNECT = "websocket/disconnect";
export const WS_JOIN_ROOM = "websocket/joinRoom";
export const WS_LEAVE_ROOM = "websocket/leaveRoom";
export const WS_SEND = "websocket/send";

// Action creators
export const wsConnect = () => ({ type: WS_CONNECT });
export const wsDisconnect = () => ({ type: WS_DISCONNECT });
export const wsJoinRoom = (roomId: string) => ({ type: WS_JOIN_ROOM, payload: roomId });
export const wsLeaveRoom = (roomId: string) => ({ type: WS_LEAVE_ROOM, payload: roomId });
export const wsSend = (event: string, data: unknown) => ({
  type: WS_SEND,
  payload: { event, data },
});

// --- Module-level state ---
let socket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let pingInterval: ReturnType<typeof setInterval> | null = null;
let reconnectAttempts = 0;
let shouldReconnect = true;
const baseReconnectDelayMs = 250;
const maxReconnectDelayMs = 30000;
const MAX_RECONNECT_ATTEMPTS = 15;
const PING_INTERVAL_MS = 30000;

// Message queue for offline sends
const pendingMessages: Array<{ event: string; data: unknown }> = [];

function cleanupSocket() {
  if (pingInterval) {
    clearInterval(pingInterval);
    pingInterval = null;
  }
  if (socket) {
    socket.onopen = null;
    socket.onclose = null;
    socket.onerror = null;
    socket.onmessage = null;
    if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
      socket.close();
    }
    socket = null;
  }
}

function drainPendingMessages() {
  while (pendingMessages.length > 0 && socket?.readyState === WebSocket.OPEN) {
    const msg = pendingMessages.shift()!;
    socket.send(JSON.stringify({ type: msg.event, data: msg.data }));
  }
}

function startPingInterval(dispatch: AppDispatch) {
  if (pingInterval) clearInterval(pingInterval);
  pingInterval = setInterval(() => {
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "ping" }));
    }
  }, PING_INTERVAL_MS);
}

function scheduleReconnect(dispatch: AppDispatch) {
  if (!shouldReconnect) return;
  if (reconnectTimer) return;
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    dispatch(setLastError("Max reconnection attempts reached. Please refresh the page."));
    dispatch(setConnectionStatus("error"));
    return;
  }

  const delay = Math.min(
    maxReconnectDelayMs,
    baseReconnectDelayMs * Math.pow(2, reconnectAttempts)
  );

  reconnectAttempts += 1;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    dispatch(wsConnect());
  }, delay);
}

export const websocketMiddleware: Middleware<{}, RootState> = (store) => (next) => (action) => {
  const dispatch = store.dispatch as AppDispatch;

  switch ((action as { type: string }).type) {
    case WS_CONNECT: {
      // Clean up existing socket and handlers before creating a new one
      cleanupSocket();

      shouldReconnect = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }

      const wsBaseUrl = process.env.NEXT_PUBLIC_GATEWAY_WS_URL || "ws://localhost:3001/v1/stream";
      dispatch(setConnectionStatus("connecting"));

      void (async () => {
        try {
          const tokenResponse = await fetch("/api/gateway-token");
          if (!tokenResponse.ok) {
            dispatch(setLastError("Failed to fetch gateway token"));
            dispatch(setConnectionStatus("error"));
            scheduleReconnect(dispatch);
            return;
          }

          let tokenData: { token?: string };
          try {
            tokenData = await tokenResponse.json();
          } catch {
            dispatch(setLastError("Invalid gateway token response"));
            dispatch(setConnectionStatus("error"));
            scheduleReconnect(dispatch);
            return;
          }

          const { token } = tokenData;
          if (!token) {
            dispatch(setLastError("Missing gateway token"));
            dispatch(setConnectionStatus("error"));
            scheduleReconnect(dispatch);
            return;
          }

          socket = new WebSocket(`${wsBaseUrl}?token=${encodeURIComponent(token)}`);

          socket.onopen = () => {
            reconnectAttempts = 0;
            dispatch(setConnectionStatus("connected"));
            startPingInterval(dispatch);
            drainPendingMessages();
          };

          socket.onclose = () => {
            cleanupSocket();
            dispatch(setConnectionStatus("disconnected"));
            dispatch(setSocketId(null));
            scheduleReconnect(dispatch);
          };

          socket.onerror = () => {
            dispatch(setLastError("WebSocket connection error"));
          };

          socket.onmessage = (event) => {
            try {
              const data = JSON.parse(event.data);
              if (!data || typeof data.type !== "string") {
                console.warn("Invalid WebSocket message format:", data);
                return;
              }
              handleWebSocketMessage(dispatch, data as WebSocketEvent);
            } catch (error) {
              console.error("Failed to parse WebSocket message:", error);
              dispatch(setLastError("Failed to parse server message"));
            }
          };
        } catch {
          dispatch(setLastError("WebSocket connection failed"));
          dispatch(setConnectionStatus("error"));
          scheduleReconnect(dispatch);
        }
      })();
      break;
    }

    case WS_DISCONNECT: {
      shouldReconnect = false;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      cleanupSocket();
      pendingMessages.length = 0;
      dispatch(setConnectionStatus("disconnected"));
      break;
    }

    case WS_JOIN_ROOM: {
      const roomId = (action as { payload: string }).payload;
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "subscribe", data: { channel: roomId } }));
        dispatch(joinRoom(roomId));
      }
      break;
    }

    case WS_LEAVE_ROOM: {
      const roomId = (action as { payload: string }).payload;
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "unsubscribe", data: { channel: roomId } }));
      }
      dispatch(leaveRoom(roomId));
      break;
    }

    case WS_SEND: {
      const { event, data } = (action as { payload: { event: string; data: unknown } }).payload;
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: event, data }));
      } else {
        // Queue message to send when reconnected
        pendingMessages.push({ event, data });
      }
      break;
    }

    default:
      break;
  }

  return next(action);
};

function handleWebSocketMessage(dispatch: AppDispatch, event: WebSocketEvent) {
  switch (event.type) {
    // Connection events
    case "connected":
      dispatch(setSocketId(event.data?.clientId ?? null));
      break;

    case "error":
      dispatch(setLastError(event.data?.message ?? "WebSocket error"));
      break;

    // Task events
    case "task:created":
      if (event.data?.task?.id && event.data.task.agentId) {
        dispatch(addTask(event.data.task));
      }
      break;

    case "task:updated":
    case "task:completed":
      if (event.data?.agentId && event.data?.taskId) {
        dispatch(
          updateTask({
            id: event.data.taskId,
            agentId: event.data.agentId,
            updates: event.data.updates ?? event.data.task ?? {},
          })
        );
      }
      break;

    case "task:cancelled":
      if (event.data?.agentId && event.data?.taskId) {
        dispatch(
          updateTask({
            id: event.data.taskId,
            agentId: event.data.agentId,
            updates: { status: "cancelled" },
          })
        );
      }
      break;

    // Agent events
    case "agent:new":
      if (event.data?.agent?.id && event.data.agent.sessionId) {
        dispatch(addAgent(event.data.agent));
      }
      break;

    case "agent:update":
      if (event.data?.agentId && event.data?.sessionId) {
        dispatch(
          updateAgent({
            id: event.data.agentId,
            sessionId: event.data.sessionId,
            updates: event.data.updates ?? {},
          })
        );
      }
      break;

    // Session events
    case "session:update":
      if (event.data?.sessionId && event.data?.updates) {
        dispatch(
          updateSession({
            id: event.data.sessionId,
            updates: event.data.updates,
          })
        );
      }
      break;

    case "session:new":
      if (event.data?.session?.id) {
        dispatch(addSession(event.data.session));
      }
      break;

    case "session:deleted":
      if (event.data?.sessionId) {
        dispatch(removeSession(event.data.sessionId));
      }
      break;

    // Notification events
    case "notification:new":
      if (event.data?.id && event.data?.type && event.data?.title) {
        dispatch(addNotification(event.data as Notification));
      }
      break;

    case "notification:read":
      if (event.data?.notificationId || event.data?.id) {
        dispatch(markNotificationAsRead(event.data.notificationId ?? event.data.id!));
      }
      break;

    // Message events
    case "message:new":
      if (event.data?.message?.id && event.data.message.sessionId) {
        dispatch(addMessage(event.data.message));
      } else if (event.data?.id && event.data?.sessionId) {
        dispatch(addMessage(event.data as unknown as Message));
      }
      break;

    case "message:update":
      if (event.data?.sessionId && event.data?.messageId) {
        dispatch(
          updateMessage({
            sessionId: event.data.sessionId,
            messageId: event.data.messageId,
            updates: event.data.updates ?? {},
          })
        );
      }
      break;

    // Device events
    case "device:status":
      if (event.data?.deviceId) {
        dispatch(
          updateDeviceStatus({
            deviceId: event.data.deviceId,
            status: event.data.status,
            lastHeartbeat: event.data.lastHeartbeat,
          })
        );
      }
      break;

    // Scheduled task events
    case "scheduledTask:new":
      if (event.data?.task?.id) {
        dispatch(addScheduledTask(event.data.task));
      }
      break;

    case "scheduledTask:update":
      if (event.data?.taskId || event.data?.task?.id) {
        dispatch(
          updateScheduledTask({
            id: event.data.taskId ?? event.data.task!.id,
            updates: event.data.updates ?? event.data.task ?? {},
          })
        );
      }
      break;

    case "scheduledTask:deleted":
      if (event.data?.taskId) {
        dispatch(deleteScheduledTask(event.data.taskId));
      }
      break;

    case "scheduledTask:execution:new":
      if (event.data?.execution?.id) {
        dispatch(addExecution(event.data.execution));
      }
      break;

    case "scheduledTask:execution:update":
      if (event.data?.taskId && event.data?.executionId) {
        dispatch(
          updateExecution({
            taskId: event.data.taskId,
            executionId: event.data.executionId,
            updates: event.data.updates ?? {},
          })
        );
      }
      break;

    // Heartbeat
    case "pong":
      dispatch(setLastPongTime(Date.now()));
      break;

    default:
      // Only warn for truly unknown events, not empty keepalives
      if (event.type !== "ping") {
        console.warn("Unknown WebSocket event type:", event.type);
      }
  }
}
