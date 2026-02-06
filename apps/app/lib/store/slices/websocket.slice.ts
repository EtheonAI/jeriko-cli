import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

export type ContextLengthStatus = "normal" | "warning" | "critical" | "exceeded";

export interface WebSocketEntity {
  id: string;
  type: "session" | "agent" | "task";
  data: unknown;
  updatedAt: string;
}

export interface WebSocketState {
  // Manus-style normalized entities
  ids: string[];
  entities: Record<string, WebSocketEntity>;

  // Connection status
  status: ConnectionStatus;
  error: string | null;

  // Context length tracking (for AI)
  contextLengthStatus: Record<string, ContextLengthStatus>;

  // Task completion
  taskFinished: Record<string, boolean>;

  // VNC connection status
  isVNCConnected: boolean;

  // Timeline auto-update
  disableTimelineAutoUpdate: boolean;

  // Our additions
  socketId: string | null;
  rooms: string[]; // Subscribed room IDs (session IDs, agent IDs, etc.)
  reconnectAttempts: number;
  lastConnectedAt: string | null;
  lastPongTime: number | null;
}

const initialState: WebSocketState = {
  ids: [],
  entities: {},
  status: "disconnected",
  error: null,
  contextLengthStatus: {},
  taskFinished: {},
  isVNCConnected: false,
  disableTimelineAutoUpdate: false,
  socketId: null,
  rooms: [],
  reconnectAttempts: 0,
  lastConnectedAt: null,
  lastPongTime: null,
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
        state.error = null;
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
      state.error = action.payload;
      if (action.payload) {
        state.status = "error";
      }
    },
    setLastPongTime: (state, action: PayloadAction<number>) => {
      state.lastPongTime = action.payload;
    },
    disconnect: (state) => {
      state.status = "disconnected";
      state.socketId = null;
      state.rooms = [];
      state.error = null;
    },

    // Entity management (Manus-style normalized)
    setEntity: (state, action: PayloadAction<WebSocketEntity>) => {
      const { id } = action.payload;
      if (!state.ids.includes(id)) {
        state.ids.push(id);
      }
      state.entities[id] = action.payload;
    },

    removeEntity: (state, action: PayloadAction<string>) => {
      state.ids = state.ids.filter((id) => id !== action.payload);
      delete state.entities[action.payload];
    },

    clearEntities: (state) => {
      state.ids = [];
      state.entities = {};
    },

    // Context length status
    setContextLengthStatus: (
      state,
      action: PayloadAction<{ sessionId: string; status: ContextLengthStatus }>
    ) => {
      state.contextLengthStatus[action.payload.sessionId] = action.payload.status;
    },

    clearContextLengthStatus: (state, action: PayloadAction<string>) => {
      delete state.contextLengthStatus[action.payload];
    },

    // Task finished
    setTaskFinished: (state, action: PayloadAction<{ taskId: string; finished: boolean }>) => {
      state.taskFinished[action.payload.taskId] = action.payload.finished;
    },

    clearTaskFinished: (state, action: PayloadAction<string>) => {
      delete state.taskFinished[action.payload];
    },

    // VNC
    setIsVNCConnected: (state, action: PayloadAction<boolean>) => {
      state.isVNCConnected = action.payload;
    },

    // Timeline auto-update
    setDisableTimelineAutoUpdate: (state, action: PayloadAction<boolean>) => {
      state.disableTimelineAutoUpdate = action.payload;
    },
  },
  extraReducers: (builder) => {
    // Manus compatibility
    builder.addCase("websocket/connected", (state) => {
      state.status = "connected";
      state.lastConnectedAt = new Date().toISOString();
      state.reconnectAttempts = 0;
      state.error = null;
    });
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
  setLastPongTime,
  disconnect,
  setEntity,
  removeEntity,
  clearEntities,
  setContextLengthStatus,
  clearContextLengthStatus,
  setTaskFinished,
  clearTaskFinished,
  setIsVNCConnected,
  setDisableTimelineAutoUpdate,
} = websocketSlice.actions;

export default websocketSlice.reducer;
