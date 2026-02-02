import { configureStore } from "@reduxjs/toolkit";
import { setupListeners } from "@reduxjs/toolkit/query";
import { apiSlice } from "./api/api.slice";
import authReducer from "./slices/auth.slice";
import chatReducer from "./slices/chat.slice";
import agentsReducer from "./slices/agents.slice";
import sessionsReducer from "./slices/sessions.slice";
import filesReducer from "./slices/files.slice";
import websocketReducer from "./slices/websocket.slice";
import uiReducer from "./slices/ui.slice";
import { websocketMiddleware } from "./middleware/websocket.middleware";

export const makeStore = () => {
  const store = configureStore({
    reducer: {
      [apiSlice.reducerPath]: apiSlice.reducer,
      auth: authReducer,
      chat: chatReducer,
      agents: agentsReducer,
      sessions: sessionsReducer,
      files: filesReducer,
      websocket: websocketReducer,
      ui: uiReducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: {
          // Ignore these action types
          ignoredActions: ["websocket/connect", "websocket/send"],
        },
      })
        .concat(apiSlice.middleware)
        .concat(websocketMiddleware),
    devTools: process.env.NODE_ENV !== "production",
  });

  // Enable refetch on focus/reconnect
  setupListeners(store.dispatch);

  return store;
};

// Infer the type of makeStore
export type AppStore = ReturnType<typeof makeStore>;
// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];

// Re-export slices and actions
export * from "./slices/auth.slice";
export * from "./slices/chat.slice";
export * from "./slices/agents.slice";
export * from "./slices/sessions.slice";
export * from "./slices/files.slice";
export * from "./slices/websocket.slice";
export * from "./slices/ui.slice";

// Re-export API hooks
export * from "./api/api.slice";

// Re-export WebSocket actions
export {
  wsConnect,
  wsDisconnect,
  wsJoinRoom,
  wsLeaveRoom,
  wsSend,
} from "./middleware/websocket.middleware";
