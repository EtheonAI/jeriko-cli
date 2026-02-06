"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import {
  wsConnect,
  wsDisconnect,
  wsJoinRoom,
  wsLeaveRoom,
} from "../store/middleware/websocket.middleware";

interface SocketContextValue {
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
  const dispatch = useAppDispatch();
  const connectionStatus = useAppSelector((state) => state.websocket.status);

  const value = useMemo(
    () => ({
      isConnected: connectionStatus === "connected",
      connect: () => dispatch(wsConnect()),
      disconnect: () => dispatch(wsDisconnect()),
      joinRoom: (roomId: string) => dispatch(wsJoinRoom(roomId)),
      leaveRoom: (roomId: string) => dispatch(wsLeaveRoom(roomId)),
    }),
    [connectionStatus, dispatch]
  );

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error("useSocket must be used within a SocketProvider");
  }
  return context;
}
