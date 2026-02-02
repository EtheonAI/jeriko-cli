import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

export interface WebSocketState {
  status: ConnectionStatus;
  socketId: string | null;
  rooms: string[]; // Subscribed room IDs (session IDs, agent IDs, etc.)
  reconnectAttempts: number;
  lastError: string | null;
  lastConnectedAt: string | null;
}

const initialState: WebSocketState = {
  status: "disconnected",
  socketId: null,
  rooms: [],
  reconnectAttempts: 0,
  lastError: null,
  lastConnectedAt: null,
};

export const websocketSlice = createSlice({
  name: "websocket",
  initialState,
  reducers: {
    setConnectionStatus: (state, action: PayloadAction<ConnectionStatus>) => {
      state.status = action.payload;
      if (action.payload === "connected") {
        state.lastConnectedAt = new Date().toISOString();
        state.reconnectAttempts = 0;
        state.lastError = null;
      }
    },
    setSocketId: (state, action: PayloadAction<string | null>) => {
      state.socketId = action.payload;
    },
    joinRoom: (state, action: PayloadAction<string>) => {
      if (!state.rooms.includes(action.payload)) {
        state.rooms.push(action.payload);
      }
    },
    leaveRoom: (state, action: PayloadAction<string>) => {
      state.rooms = state.rooms.filter((room) => room !== action.payload);
    },
    clearRooms: (state) => {
      state.rooms = [];
    },
    incrementReconnectAttempts: (state) => {
      state.reconnectAttempts += 1;
    },
    resetReconnectAttempts: (state) => {
      state.reconnectAttempts = 0;
    },
    setLastError: (state, action: PayloadAction<string | null>) => {
      state.lastError = action.payload;
      if (action.payload) {
        state.status = "error";
      }
    },
    disconnect: (state) => {
      state.status = "disconnected";
      state.socketId = null;
      state.rooms = [];
      state.lastError = null;
    },
  },
});

export const {
  setConnectionStatus,
  setSocketId,
  joinRoom,
  leaveRoom,
  clearRooms,
  incrementReconnectAttempts,
  resetReconnectAttempts,
  setLastError,
  disconnect,
} = websocketSlice.actions;

export default websocketSlice.reducer;
