import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

export type ContextLengthStatus = "normal" | "warning" | "critical" | "exceeded";

export interface WebSocketEntity {
  id: string;
  type: "session" | "agent" | "task";
  data: unknown;
  updatedAt: string;
}

export type ReconnectPolicy = "exponential" | "linear" | "fixed" | "disabled";

export interface ReconnectConfig {
  policy: ReconnectPolicy;
  maxAttempts: number;
  baseDelay: number; // milliseconds
  maxDelay: number; // milliseconds
  backoffMultiplier: number;
}

export interface WebSocketState {
  // Manus-style normalized entities
  ids: string[];
  entities: Record<string, WebSocketEntity>;

  // Connection status
  status: ConnectionStatus;
  error: string | null;

  // Context length tracking (for AI)
  contextLengthStatus: ContextLengthStatus;

  // Task completion
  taskFinished: boolean;

  // VNC connection status
  isVNCConnected: boolean | null;

  // Timeline auto-update
  disableTimelineAutoUpdate: boolean | null;

  // Our additions
  socketId: string | null;
  rooms: string[]; // Subscribed room IDs (session IDs, agent IDs, etc.)
  reconnectAttempts: number;
  lastConnectedAt: string | null;
  lastPongTime: number | null;

  // P6.5: Reconnect policy
  reconnectConfig: ReconnectConfig;
  nextReconnectDelay: number | null; // milliseconds
  isReconnecting: boolean;
}

const initialState: WebSocketState = {
  ids: [],
  entities: {},
  status: "disconnected",
  error: null,
  contextLengthStatus: "normal",
  taskFinished: false,
  isVNCConnected: null,
  disableTimelineAutoUpdate: null,
  socketId: null,
  rooms: [],
  reconnectAttempts: 0,
  lastConnectedAt: null,
  lastPongTime: null,
  // P6.5: Default reconnect policy
  reconnectConfig: {
    policy: "exponential",
    maxAttempts: 10,
    baseDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
  },
  nextReconnectDelay: null,
  isReconnecting: false,
};

const websocketSlice = createSlice({
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
    setContextLengthStatus: (state, action: PayloadAction<ContextLengthStatus>) => {
      state.contextLengthStatus = action.payload;
    },

    // Task finished
    setTaskFinished: (state, action: PayloadAction<boolean>) => {
      state.taskFinished = action.payload;
    },

    // VNC
    setIsVNCConnected: (state, action: PayloadAction<boolean | null>) => {
      state.isVNCConnected = action.payload;
    },

    // Timeline auto-update
    setDisableTimelineAutoUpdate: (state, action: PayloadAction<boolean | null>) => {
      state.disableTimelineAutoUpdate = action.payload;
    },

    // P6.5: Reconnect policy management
    setReconnectConfig: (state, action: PayloadAction<Partial<ReconnectConfig>>) => {
      state.reconnectConfig = { ...state.reconnectConfig, ...action.payload };
    },

    startReconnecting: (state) => {
      state.isReconnecting = true;
      state.status = "connecting";

      // Calculate next delay based on policy
      const { policy, baseDelay, maxDelay, backoffMultiplier } = state.reconnectConfig;
      const attempts = state.reconnectAttempts;

      switch (policy) {
        case "exponential":
          state.nextReconnectDelay = Math.min(
            baseDelay * Math.pow(backoffMultiplier, attempts),
            maxDelay
          );
          break;
        case "linear":
          state.nextReconnectDelay = Math.min(baseDelay * (attempts + 1), maxDelay);
          break;
        case "fixed":
          state.nextReconnectDelay = baseDelay;
          break;
        case "disabled":
          state.nextReconnectDelay = null;
          state.isReconnecting = false;
          break;
      }
    },

    stopReconnecting: (state) => {
      state.isReconnecting = false;
      state.nextReconnectDelay = null;
    },

    reconnectSuccess: (state) => {
      state.isReconnecting = false;
      state.nextReconnectDelay = null;
      state.reconnectAttempts = 0;
      state.status = "connected";
      state.lastConnectedAt = new Date().toISOString();
      state.error = null;
    },

    reconnectFailed: (state, action: PayloadAction<string>) => {
      state.reconnectAttempts += 1;
      state.error = action.payload;

      // Check if max attempts reached
      if (state.reconnectAttempts >= state.reconnectConfig.maxAttempts) {
        state.isReconnecting = false;
        state.nextReconnectDelay = null;
        state.status = "error";
      }
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
  setTaskFinished,
  setIsVNCConnected,
  setDisableTimelineAutoUpdate,
  // P6.5: Reconnect policy actions
  setReconnectConfig,
  startReconnecting,
  stopReconnecting,
  reconnectSuccess,
  reconnectFailed,
} = websocketSlice.actions;

export default websocketSlice.reducer;
