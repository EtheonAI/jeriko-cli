"use client";

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { connectSocket, disconnectSocket, getSocket, type TypedSocket } from "./client";
import type { ServerToClientEvents } from "./events";
import { useAppDispatch } from "../store/hooks";
import {
  setConnectionStatus,
  setSocketId,
  joinRoom as joinRoomAction,
  leaveRoom as leaveRoomAction,
  setLastError,
} from "../store/slices/websocket.slice";
import { addMessage, appendToMessage, updateMessage } from "../store/slices/chat.slice";
import { addAgent, updateAgent, addTask, updateTask } from "../store/slices/agents.slice";
import { addSession, updateSession } from "../store/slices/sessions.slice";
import { addFile, removeFile } from "../store/slices/files.slice";
import { updateDeviceStatus } from "../store/slices/devices.slice";

interface SocketContextValue {
  socket: TypedSocket | null;
  isConnected: boolean;
  connect: () => void;
  disconnect: () => void;
  joinRoom: (roomId: string) => void;
  leaveRoom: (roomId: string) => void;
}

const SocketContext = createContext<SocketContextValue | null>(null);

interface SocketProviderProps {
  children: ReactNode;
}

export function SocketProvider({ children }: SocketProviderProps) {
  const [socket, setSocket] = useState<TypedSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const dispatch = useAppDispatch();

  const connect = useCallback(() => {
    if (socket?.connected) return;

    const newSocket = connectSocket();
    setSocket(newSocket);
    dispatch(setConnectionStatus("connecting"));
  }, [socket, dispatch]);

  const disconnect = useCallback(() => {
    disconnectSocket();
    setSocket(null);
    setIsConnected(false);
    dispatch(setConnectionStatus("disconnected"));
  }, [dispatch]);

  const joinRoom = useCallback(
    (roomId: string) => {
      socket?.emit("room:join", roomId);
    },
    [socket]
  );

  const leaveRoom = useCallback(
    (roomId: string) => {
      socket?.emit("room:leave", roomId);
    },
    [socket]
  );

  // Setup socket event listeners
  useEffect(() => {
    if (!socket) return;

    // Connection events
    socket.on("connect", () => {
      setIsConnected(true);
      dispatch(setConnectionStatus("connected"));
      dispatch(setSocketId(socket.id || null));
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
      dispatch(setConnectionStatus("disconnected"));
      dispatch(setSocketId(null));
    });

    socket.on("connect_error", (error) => {
      dispatch(setLastError(error.message));
      dispatch(setConnectionStatus("error"));
    });

    // Room events
    socket.on("room:joined", (roomId) => {
      dispatch(joinRoomAction(roomId));
    });

    socket.on("room:left", (roomId) => {
      dispatch(leaveRoomAction(roomId));
    });

    // Message events
    socket.on("message:new", ({ sessionId, message }) => {
      dispatch(
        addMessage({
          id: message.id,
          sessionId,
          role: message.role as "user" | "assistant" | "system" | "tool",
          content: message.content,
          createdAt: message.createdAt,
          metadata: message.metadata,
        })
      );
    });

    socket.on("message:update", ({ sessionId, messageId, content }) => {
      dispatch(
        updateMessage({
          sessionId,
          messageId,
          updates: { content },
        })
      );
    });

    socket.on("message:stream", ({ sessionId, messageId, chunk }) => {
      dispatch(
        appendToMessage({
          sessionId,
          messageId,
          content: chunk,
        })
      );
    });

    // Agent events
    socket.on("agent:created", ({ sessionId, agent }) => {
      dispatch(
        addAgent({
          id: agent.id,
          sessionId,
          type: agent.type as any,
          name: agent.name,
          status: agent.status as any,
          currentTask: null,
          progress: 0,
          lastActivity: null,
        })
      );
    });

    socket.on("agent:update", ({ sessionId, agentId, updates }) => {
      dispatch(
        updateAgent({
          id: agentId,
          sessionId,
          updates: updates as any,
        })
      );
    });

    socket.on("agent:task:new", ({ agentId, task }) => {
      dispatch(
        addTask({
          id: task.id,
          agentId,
          parentTaskId: null,
          title: task.title,
          description: task.description,
          status: task.status as any,
          priority: task.priority,
          startedAt: null,
          completedAt: null,
          createdAt: new Date().toISOString(),
        })
      );
    });

    socket.on("agent:task:update", ({ agentId, taskId, updates }) => {
      dispatch(
        updateTask({
          id: taskId,
          agentId,
          updates: updates as any,
        })
      );
    });

    // Session events
    socket.on("session:new", ({ session }) => {
      dispatch(
        addSession({
          id: session.id,
          title: session.title,
          status: session.status as any,
          createdAt: session.createdAt,
          updatedAt: session.createdAt,
        })
      );
    });

    socket.on("session:update", ({ sessionId, updates }) => {
      dispatch(
        updateSession({
          id: sessionId,
          updates: updates as any,
        })
      );
    });

    // Device events
    socket.on("device:status", ({ deviceId, status, lastHeartbeat }) => {
      dispatch(updateDeviceStatus({ deviceId, status, lastHeartbeat }));
    });

    // File events
    socket.on("file:new", ({ sessionId, file }) => {
      dispatch(
        addFile({
          id: file.id,
          sessionId,
          userId: "", // Will be filled by server
          name: file.name,
          path: file.path,
          mimeType: file.mimeType,
          size: file.size,
          storageKey: null,
          storageProvider: "local",
          isPublic: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
      );
    });

    socket.on("file:deleted", ({ fileId }) => {
      dispatch(removeFile(fileId));
    });

    // Cleanup
    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("connect_error");
      socket.off("room:joined");
      socket.off("room:left");
      socket.off("message:new");
      socket.off("message:update");
      socket.off("message:stream");
      socket.off("agent:created");
      socket.off("agent:update");
      socket.off("agent:task:new");
      socket.off("agent:task:update");
      socket.off("session:new");
      socket.off("session:update");
      socket.off("device:status");
      socket.off("file:new");
      socket.off("file:deleted");
    };
  }, [socket, dispatch]);

  // Auto-connect on mount
  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, []);

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        connect,
        disconnect,
        joinRoom,
        leaveRoom,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error("useSocket must be used within a SocketProvider");
  }
  return context;
}
