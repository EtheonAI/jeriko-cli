import { Middleware } from "@reduxjs/toolkit";
import type { RootState } from "../index";
import {
  setConnectionStatus,
  setSocketId,
  joinRoom,
  leaveRoom,
  setLastError,
} from "../slices/websocket.slice";
import { addMessage, updateMessage, appendToMessage } from "../slices/chat.slice";
import { updateAgent, addTask, updateTask } from "../slices/agents.slice";
import { updateSession, addSession } from "../slices/sessions.slice";

// WebSocket event types
export type WebSocketEvent =
  | { type: "message:new"; payload: { sessionId: string; message: unknown } }
  | { type: "message:update"; payload: { sessionId: string; messageId: string; content: string } }
  | { type: "message:stream"; payload: { sessionId: string; messageId: string; chunk: string } }
  | { type: "agent:update"; payload: { sessionId: string; agentId: string; updates: unknown } }
  | { type: "agent:task:new"; payload: { agentId: string; task: unknown } }
  | { type: "agent:task:update"; payload: { agentId: string; taskId: string; updates: unknown } }
  | { type: "session:update"; payload: { sessionId: string; updates: unknown } }
  | { type: "session:new"; payload: { session: unknown } };

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

    case "message:stream":
      dispatch(
        appendToMessage({
          sessionId: event.payload.sessionId,
          messageId: event.payload.messageId,
          content: event.payload.chunk,
        })
      );
      break;

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

    default:
      console.warn("Unknown WebSocket event type:", (event as any).type);
  }
}
