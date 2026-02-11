import { configureStore } from "@reduxjs/toolkit";
import { setupListeners } from "@reduxjs/toolkit/query";
import { apiSlice } from "./api/api.slice";
// Core slices
import authReducer from "./slices/auth.slice";
import chatReducer from "./slices/chat.slice";
import agentsReducer from "./slices/agents.slice";
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
import workspaceReducer from "./slices/workspace.slice";
import navbarReducer from "./slices/navbar.slice";
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
import devicesReducer from "./slices/devices.slice";
import toolCallsReducer from "./slices/toolCalls.slice";
// Rubic-specific slices
import skillsReducer from "./slices/skills.slice";
import enterpriseTeamReducer from "./slices/enterpriseTeam.slice";
// Middleware
import { websocketMiddleware } from "./middleware/websocket.middleware";

export const makeStore = () => {
  const store = configureStore({
    reducer: {
      // RTK Query
      [apiSlice.reducerPath]: apiSlice.reducer,
      // Core domain slices
      auth: authReducer,
      chat: chatReducer,
      agents: agentsReducer,
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
      workspace: workspaceReducer,
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
      devices: devicesReducer,
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
// Core slices
export * from "./slices/auth.slice";
export * from "./slices/chat.slice";
export * from "./slices/agents.slice";
export * from "./slices/sessions.slice";
// files.slice merged into library.slice
export * from "./slices/websocket.slice";
export * from "./slices/ui.slice";
// Feature slices (Manus-style)
export * from "./slices/connectors.slice";
export * from "./slices/notifications.slice";
export * from "./slices/scheduledTasks.slice";
export * from "./slices/team.slice";
export * from "./slices/projects.slice";
export * from "./slices/experiment.slice";
export * from "./slices/knowledge.slice";
export * from "./slices/configs.slice";
// Additional feature slices
export * from "./slices/workspace.slice";
export * from "./slices/navbar.slice";
export * from "./slices/webDev.slice";
export * from "./slices/codeViewer.slice";
export * from "./slices/filePreviewer.slice";
export * from "./slices/slideEditor.slice";
export * from "./slices/aiCanvas.slice";
export * from "./slices/onboarding.slice";
export * from "./slices/billing.slice";
// Complete Manus-style slices
export * from "./slices/sessionSwitch.slice";
export * from "./slices/community.slice";
export * from "./slices/fileManagement.slice";
export * from "./slices/fileConnector.slice";
export * from "./slices/products.slice";
export * from "./slices/fileShare.slice";
export * from "./slices/mapReduce.slice";
export * from "./slices/mailAgent.slice";
export * from "./slices/webDevUsage.slice";
export * from "./slices/library.slice";
export * from "./slices/timeline.slice";
export * from "./slices/login.slice";
export * from "./slices/example.slice";
export * from "./slices/guestPage.slice";
export * from "./slices/myBrowser.slice";
// New Manus slices
export * from "./slices/agentWorkspace.slice";
export * from "./slices/webdevAuth.slice";
export * from "./slices/aiCanvasEditor.slice";
// chatPage.slice merged into chat.slice
export * from "./slices/search.slice";
export * from "./slices/devices.slice";
export * from "./slices/toolCalls.slice";
// Rubic-specific slices
export * from "./slices/skills.slice";
export * from "./slices/enterpriseTeam.slice";

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

// Resolve ambiguous export * collisions (multiple slices export the same action names)
export { setLoading } from "./slices/auth.slice";
export { setError } from "./slices/auth.slice";
export { setSearchQuery } from "./slices/sessions.slice";
export { setFilterStatus } from "./slices/sessions.slice";
export { setSortBy } from "./slices/sessions.slice";
export { setSortOrder } from "./slices/sessions.slice";
