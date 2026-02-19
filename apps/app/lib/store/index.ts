import { configureStore } from "@reduxjs/toolkit";
// Core slices
import authReducer from "./slices/auth.slice";
import chatReducer from "./slices/chat.slice";
import sessionsReducer from "./slices/sessions.slice";
import websocketReducer from "./slices/websocket.slice";
import uiReducer from "./slices/ui.slice";
// New Manus-style slices
import connectorsReducer from "./slices/connectors.slice";
import notificationsReducer from "./slices/notifications.slice";
import scheduledTasksReducer from "./slices/scheduledTasks.slice";
import teamReducer from "./slices/team.slice";
import projectsReducer from "./slices/projects.slice";
import experimentReducer from "./slices/experiment.slice";
import knowledgeReducer from "./slices/knowledge.slice";
import configsReducer from "./slices/configs.slice";
// Additional Manus-style slices
import navbarReducer from "./slices/navbar.slice";
import meetingReducer from "./slices/meeting.slice";
import webDevReducer from "./slices/webDev.slice";
import codeViewerReducer from "./slices/codeViewer.slice";
import filePreviewerReducer from "./slices/filePreviewer.slice";
import slideEditorReducer from "./slices/slideEditor.slice";
import aiCanvasReducer from "./slices/aiCanvas.slice";
import onboardingReducer from "./slices/onboarding.slice";
import billingReducer from "./slices/billing.slice";
// Complete Manus-style slices
import sessionSwitchReducer from "./slices/sessionSwitch.slice";
import communityReducer from "./slices/community.slice";
import fileManagementReducer from "./slices/fileManagement.slice";
import fileConnectorReducer from "./slices/fileConnector.slice";
import productsReducer from "./slices/products.slice";
import fileShareReducer from "./slices/fileShare.slice";
import mapReduceReducer from "./slices/mapReduce.slice";
import mailAgentReducer from "./slices/mailAgent.slice";
import webDevUsageReducer from "./slices/webDevUsage.slice";
import libraryReducer from "./slices/library.slice";
import timelineReducer from "./slices/timeline.slice";
import loginReducer from "./slices/login.slice";
import exampleReducer from "./slices/example.slice";
import guestPageReducer from "./slices/guestPage.slice";
import myBrowserReducer from "./slices/myBrowser.slice";
// New missing Manus slices
import agentWorkspaceReducer from "./slices/agentWorkspace.slice";
import webdevAuthReducer from "./slices/webdevAuth.slice";
import aiCanvasEditorReducer from "./slices/aiCanvasEditor.slice";
import searchReducer from "./slices/search.slice";

import toolCallsReducer from "./slices/toolCalls.slice";
// Rubic-specific slices
import skillsReducer from "./slices/skills.slice";
import enterpriseTeamReducer from "./slices/enterpriseTeam.slice";
// API slice (RTK Query — Manus architecture: central data hub)
import { apiSlice } from "./api/api.slice";
// Middleware
import { websocketMiddleware } from "./middleware/websocket.middleware";

export const makeStore = () => {
  const store = configureStore({
    reducer: {
      // RTK Query — central data hub (Manus architecture)
      [apiSlice.reducerPath]: apiSlice.reducer,
      // Core domain slices
      auth: authReducer,
      chat: chatReducer,
      sessions: sessionsReducer,
      websocket: websocketReducer,
      ui: uiReducer,
      // Feature slices (Manus-style)
      connectors: connectorsReducer,
      notifications: notificationsReducer,
      scheduledTasks: scheduledTasksReducer,
      team: teamReducer,
      projects: projectsReducer,
      experiment: experimentReducer,
      knowledge: knowledgeReducer,
      configs: configsReducer,
      // Additional feature slices
      meeting: meetingReducer,
      navbar: navbarReducer,
      webDev: webDevReducer,
      codeViewer: codeViewerReducer,
      filePreviewer: filePreviewerReducer,
      slideEditor: slideEditorReducer,
      aiCanvas: aiCanvasReducer,
      onboarding: onboardingReducer,
      billing: billingReducer,
      // Complete Manus-style slices
      sessionSwitch: sessionSwitchReducer,
      community: communityReducer,
      fileManagement: fileManagementReducer,
      fileConnector: fileConnectorReducer,
      products: productsReducer,
      fileShare: fileShareReducer,
      mapReduce: mapReduceReducer,
      mailAgent: mailAgentReducer,
      webDevUsage: webDevUsageReducer,
      library: libraryReducer,
      timeline: timelineReducer,
      login: loginReducer,
      example: exampleReducer,
      guestPage: guestPageReducer,
      myBrowser: myBrowserReducer,
      // New Manus slices (exact names)
      agentWorkspace: agentWorkspaceReducer,
      webdevAuth: webdevAuthReducer,
      aiCanvasEditor: aiCanvasEditorReducer,
      search: searchReducer,
      // devices slice removed — not needed
      toolCalls: toolCallsReducer,
      // Rubic-specific slices
      skills: skillsReducer,
      enterpriseTeam: enterpriseTeamReducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: {
          ignoredActions: [
            "websocket/connect",
            "websocket/disconnect",
            "websocket/send",
            "websocket/joinRoom",
            "websocket/leaveRoom",
          ],
        },
      })
        .concat(apiSlice.middleware) // RTK Query middleware — before WS for cache invalidation
        .concat(websocketMiddleware),
    devTools: process.env.NODE_ENV !== "production",
  });

  return store;
};

// Infer the type of makeStore
export type AppStore = ReturnType<typeof makeStore>;
// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];

// ---------------------------------------------------------------------------
// Re-export types only — NO barrel-exporting slice actions.
// With 44 slices (43 Manus + apiSlice + toolCalls + search + skills + enterpriseTeam),
// 59+ action names collide. Consumers import actions directly from slice files:
//   import { setLoading } from "@/lib/store/slices/auth.slice"
// ---------------------------------------------------------------------------

// Types consumers need from the barrel
export type { SearchResultType, SearchResultItem } from "./slices/search.slice";

// Re-export WebSocket actions
export {
  wsConnect,
  wsDisconnect,
  wsJoinRoom,
  wsLeaveRoom,
  wsSend,
} from "./middleware/websocket.middleware";
