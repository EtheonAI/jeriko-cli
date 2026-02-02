import { Middleware } from "@reduxjs/toolkit";
import type { RootState } from "../index";
import {
  setConnectionStatus,
  setSocketId,
  joinRoom,
  leaveRoom,
  setLastError,
  incrementReconnectAttempts,
} from "../slices/websocket.slice";
import {
  addMessage,
  updateMessage,
  appendToMessage,
  setStreaming,
  setCurrentStreamingMessage,
  addTypingUser,
  removeTypingUser,
} from "../slices/chat.slice";
import { updateAgent, addTask, updateTask } from "../slices/agents.slice";
import { updateSession, addSession } from "../slices/sessions.slice";
import { addNotification, markAsRead as markNotificationAsRead } from "../slices/notifications.slice";

// WebSocket event types from server
export type WebSocketEvent =
  | { type: "connection:established"; payload: { socketId: string } }
  | { type: "connection:error"; payload: { message: string } }
  | { type: "room:joined"; payload: { roomId: string } }
  | { type: "room:left"; payload: { roomId: string } }
  | { type: "message:new"; payload: { sessionId: string; message: unknown } }
  | { type: "message:update"; payload: { sessionId: string; messageId: string; content: string } }
  | { type: "message:stream"; payload: { sessionId: string; messageId: string; chunk: string } }
  | { type: "message:stream:start"; payload: { sessionId: string; messageId: string } }
  | { type: "message:stream:end"; payload: { sessionId: string; messageId: string } }
  | { type: "agent:update"; payload: { sessionId: string; agentId: string; updates: unknown } }
  | { type: "agent:task:new"; payload: { agentId: string; task: unknown } }
  | { type: "agent:task:update"; payload: { agentId: string; taskId: string; updates: unknown } }
  | { type: "session:update"; payload: { sessionId: string; updates: unknown } }
  | { type: "session:new"; payload: { session: unknown } }
  | { type: "notification:new"; payload: { notification: unknown } }
  | { type: "notification:read"; payload: { notificationId: string } }
  | { type: "typing:start"; payload: { sessionId: string; userId: string; userName?: string } }
  | { type: "typing:stop"; payload: { sessionId: string; userId: string } }
  | { type: "pong"; payload: { timestamp: number } };

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

let socket: WebSocket | null = null;

export const websocketMiddleware: Middleware<{}, RootState> = (store) => (next) => (action) => {
  const { dispatch } = store;

  switch ((action as { type: string }).type) {
    case WS_CONNECT: {
      if (socket !== null) {
        socket.close();
      }

      const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3000/api/socket";
      dispatch(setConnectionStatus("connecting"));

      socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        dispatch(setConnectionStatus("connected"));
        dispatch(setSocketId(Date.now().toString())); // Placeholder ID
      };

      socket.onclose = () => {
        dispatch(setConnectionStatus("disconnected"));
        dispatch(setSocketId(null));
      };

      socket.onerror = (error) => {
        dispatch(setLastError("WebSocket connection error"));
        dispatch(setConnectionStatus("error"));
      };

      socket.onmessage = (event) => {
        try {
          const data: WebSocketEvent = JSON.parse(event.data);
          handleWebSocketMessage(dispatch, data);
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error);
        }
      };
      break;
    }

    case WS_DISCONNECT: {
      if (socket !== null) {
        socket.close();
        socket = null;
      }
      dispatch(setConnectionStatus("disconnected"));
      break;
    }

    case WS_JOIN_ROOM: {
      const roomId = (action as { payload: string }).payload;
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "join", room: roomId }));
        dispatch(joinRoom(roomId));
      }
      break;
    }

    case WS_LEAVE_ROOM: {
      const roomId = (action as { payload: string }).payload;
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "leave", room: roomId }));
        dispatch(leaveRoom(roomId));
      }
      break;
    }

    case WS_SEND: {
      const { event, data } = (action as { payload: { event: string; data: unknown } }).payload;
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: event, data }));
      }
      break;
    }

    default:
      break;
  }

  return next(action);
};

function handleWebSocketMessage(dispatch: any, event: WebSocketEvent) {
  switch (event.type) {
    // Connection events
    case "connection:established":
      dispatch(setSocketId(event.payload.socketId));
      break;

    case "connection:error":
      dispatch(setLastError(event.payload.message));
      break;

    // Room events
    case "room:joined":
      dispatch(joinRoom(event.payload.roomId));
      break;

    case "room:left":
      dispatch(leaveRoom(event.payload.roomId));
      break;

    // Message events
    case "message:new":
      dispatch(addMessage(event.payload.message as any));
      break;

    case "message:update":
      dispatch(
        updateMessage({
          sessionId: event.payload.sessionId,
          messageId: event.payload.messageId,
          updates: { content: event.payload.content },
        })
      );
      break;

    // Streaming events
    case "message:stream:start":
      dispatch(setStreaming(true));
      dispatch(setCurrentStreamingMessage(event.payload.messageId));
      break;

    case "message:stream":
      dispatch(
        appendToMessage({
          sessionId: event.payload.sessionId,
          messageId: event.payload.messageId,
          content: event.payload.chunk,
        })
      );
      break;

    case "message:stream:end":
      dispatch(setStreaming(false));
      dispatch(setCurrentStreamingMessage(null));
      break;

    // Agent events
    case "agent:update":
      dispatch(
        updateAgent({
          id: event.payload.agentId,
          sessionId: event.payload.sessionId,
          updates: event.payload.updates as any,
        })
      );
      break;

    case "agent:task:new":
      dispatch(addTask(event.payload.task as any));
      break;

    case "agent:task:update":
      dispatch(
        updateTask({
          id: event.payload.taskId,
          agentId: event.payload.agentId,
          updates: event.payload.updates as any,
        })
      );
      break;

    // Session events
    case "session:update":
      dispatch(
        updateSession({
          id: event.payload.sessionId,
          updates: event.payload.updates as any,
        })
      );
      break;

    case "session:new":
      dispatch(addSession(event.payload.session as any));
      break;

    // Notification events (real-time)
    case "notification:new":
      dispatch(addNotification(event.payload.notification as any));
      break;

    case "notification:read":
      dispatch(markNotificationAsRead(event.payload.notificationId));
      break;

    // Typing indicator events
    case "typing:start":
      dispatch(addTypingUser(event.payload.userId));
      break;

    case "typing:stop":
      dispatch(removeTypingUser(event.payload.userId));
      break;

    // Heartbeat
    case "pong":
      // Heartbeat received, connection is alive
      break;

    default:
      console.warn("Unknown WebSocket event type:", (event as any).type);
  }
}
