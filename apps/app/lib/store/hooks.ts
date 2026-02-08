import { useDispatch, useSelector, useStore } from "react-redux";
import { createSelector } from "@reduxjs/toolkit";
import type { AppDispatch, RootState, AppStore } from "./index";
import { selectIsFeatureEnabled, selectVariant } from "./slices/experiment.slice";
import type { AgentSession } from "./slices/sessions.slice";
import type { Agent } from "./slices/agents.slice";
import type { Connector, InstalledConnector } from "./slices/connectors.slice";
import type { Notification } from "./slices/notifications.slice";
import type { Project } from "./slices/projects.slice";
import type { ScheduledTask } from "./slices/scheduledTasks.slice";
import type { Attachment } from "./slices/knowledge.slice";

// Use throughout your app instead of plain `useDispatch` and `useSelector`
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
export const useAppStore = useStore.withTypes<AppStore>();

// ================== CORE STATE SELECTORS ==================
export const useAuth = () => useAppSelector((state) => state.auth);
export const useSessions = () => useAppSelector((state) => state.sessions);
export const useChat = () => useAppSelector((state) => state.chat);
export const useAgents = () => useAppSelector((state) => state.agents);
// files merged into library — use useLibrary() instead
export const useWebSocket = () => useAppSelector((state) => state.websocket);
export const useUI = () => useAppSelector((state) => state.ui);

// ================== NEW FEATURE STATE SELECTORS ==================
export const useConnectors = () => useAppSelector((state) => state.connectors);
export const useNotifications = () => useAppSelector((state) => state.notifications);
export const useScheduledTasks = () => useAppSelector((state) => state.scheduledTasks);
export const useTeam = () => useAppSelector((state) => state.team);
export const useProjects = () => useAppSelector((state) => state.projects);
export const useExperiment = () => useAppSelector((state) => state.experiment);
export const useKnowledge = () => useAppSelector((state) => state.knowledge);
export const useConfigs = () => useAppSelector((state) => state.configs);

// ================== AUTH SELECTORS ==================
export const useCurrentUser = () => useAppSelector((state) => state.auth.user);
export const useIsAuthenticated = () => useAppSelector((state) => state.auth.isAuthenticated);
export const useAuthLoading = () => useAppSelector((state) => state.auth.isLoading);

// ================== SESSION SELECTORS (memoized) ==================
const selectCurrentSession = createSelector(
  [
    (state: RootState) => state.sessions.sessions,
    (state: RootState) => state.sessions.currentSessionId,
  ],
  (sessions, currentSessionId): AgentSession | null =>
    currentSessionId
      ? (sessions.find((s: AgentSession) => s.id === currentSessionId) ?? null)
      : null
);
export const useCurrentSession = () => useAppSelector(selectCurrentSession);

export const useSessionMessages = (sessionId: string | null) =>
  useAppSelector((state) => {
    if (!sessionId) return [];
    return state.chat.messages[sessionId] || [];
  });

export const useSessionAgents = (sessionId: string | null) =>
  useAppSelector((state) => {
    if (!sessionId) return [];
    return state.agents.agents[sessionId] || [];
  });

const selectRecentSessions = createSelector(
  [
    (state: RootState) => state.sessions.sessions,
    (state: RootState) => state.sessions.recentSessionIds,
  ],
  (sessions, recentSessionIds): AgentSession[] =>
    recentSessionIds
      .map((id: string) => sessions.find((s: AgentSession) => s.id === id))
      .filter(Boolean) as AgentSession[]
);
export const useRecentSessions = () => useAppSelector(selectRecentSessions);

const selectPinnedSessions = createSelector(
  [(state: RootState) => state.sessions.sessions],
  (sessions): AgentSession[] => sessions.filter((s: AgentSession) => s.isPinned)
);
export const usePinnedSessions = () => useAppSelector(selectPinnedSessions);

// ================== AGENT SELECTORS (memoized) ==================
const selectSelectedAgent = createSelector(
  [(state: RootState) => state.agents.agents, (state: RootState) => state.agents.selectedAgentId],
  (agents, selectedAgentId) => {
    if (!selectedAgentId) return null;
    for (const sessionAgents of Object.values(agents)) {
      if (!Array.isArray(sessionAgents)) continue;
      const agent = sessionAgents.find((a: Agent) => a.id === selectedAgentId);
      if (agent) return agent;
    }
    return null;
  }
);
export const useSelectedAgent = () => useAppSelector(selectSelectedAgent);

export const useAgentTasks = (agentId: string | null) =>
  useAppSelector((state) => {
    if (!agentId) return [];
    return state.agents.tasks[agentId] || [];
  });

// ================== UI SELECTORS ==================
export const useToasts = () => useAppSelector((state) => state.ui.toasts);
export const useModals = () => useAppSelector((state) => state.ui.modals);
export const useSidebarState = () => useAppSelector((state) => state.ui.sidebarState);
export const useTheme = () => useAppSelector((state) => state.ui.theme);
export const useIsMobile = () => useAppSelector((state) => state.ui.isMobile);

// ================== CONNECTOR SELECTORS ==================
export const useAvailableConnectors = () =>
  useAppSelector((state) => state.connectors.availableConnectors);

export const useInstalledConnectors = () =>
  useAppSelector((state) => state.connectors.installedConnectors);

export const useConnectorById = (connectorId: string | null) =>
  useAppSelector((state) => {
    if (!connectorId) return null;
    return (
      state.connectors.availableConnectors.find((c: Connector) => c.id === connectorId) ||
      state.connectors.installedConnectors.find((c: InstalledConnector) => c.id === connectorId) ||
      null
    );
  });

export const useConnectorsByCategory = (category: string) =>
  useAppSelector((state) =>
    state.connectors.availableConnectors.filter((c: Connector) => c.category === category)
  );

// ================== NOTIFICATION SELECTORS (memoized) ==================
export const useUnreadNotificationCount = () =>
  useAppSelector((state) => state.notifications.unreadCount);

const selectUnreadNotifications = createSelector(
  [(state: RootState) => state.notifications.notifications],
  (notifications): Notification[] => notifications.filter((n: Notification) => !n.isRead)
);
export const useUnreadNotifications = () => useAppSelector(selectUnreadNotifications);

export const useNotificationsByType = (type: string) =>
  useAppSelector((state) =>
    state.notifications.notifications.filter((n: Notification) => n.type === type)
  );

// ================== TEAM SELECTORS ==================
export const useCurrentTeam = () => useAppSelector((state) => state.team.currentTeam);

export const useTeamMembers = () => useAppSelector((state) => state.team.members);

export const useTeamInvitations = () => useAppSelector((state) => state.team.invitations);

// ================== PROJECT SELECTORS ==================
export const useCurrentProject = () => useAppSelector((state) => state.projects.currentProject);

export const useProjectSessions = (projectId: string | null) =>
  useAppSelector((state) => {
    if (!projectId) return [];
    return state.projects.projectSessions[projectId] || [];
  });

const selectActiveProjects = createSelector(
  [(state: RootState) => state.projects.projects],
  (projects): Project[] => projects.filter((p: Project) => p.status === "active")
);
export const useActiveProjects = () => useAppSelector(selectActiveProjects);

// ================== SCHEDULED TASK SELECTORS ==================
const selectActiveScheduledTasks = createSelector(
  [(state: RootState) => state.scheduledTasks.tasks],
  (tasks): ScheduledTask[] =>
    tasks.filter((t: ScheduledTask) => ["pending", "running"].includes(t.status))
);
export const useActiveScheduledTasks = () => useAppSelector(selectActiveScheduledTasks);

export const useScheduledTaskExecutions = (taskId: string | null) =>
  useAppSelector((state) => {
    if (!taskId) return [];
    return state.scheduledTasks.executions[taskId] || [];
  });

// ================== KNOWLEDGE SELECTORS ==================
export const useAttachments = () => useAppSelector((state) => state.knowledge.attachments);

export const useAttachmentGroups = () => useAppSelector((state) => state.knowledge.groups);

const selectFavoriteAttachments = createSelector(
  [(state: RootState) => state.knowledge.attachments],
  (attachments): Attachment[] => attachments.filter((a: Attachment) => a.isFavorite)
);
export const useFavoriteAttachments = () => useAppSelector(selectFavoriteAttachments);

// ================== EXPERIMENT/FEATURE FLAG SELECTORS ==================
export const useFeatureFlag = (featureKey: string) =>
  useAppSelector((state) => selectIsFeatureEnabled(state, featureKey));

export const useExperimentVariant = (featureKey: string) =>
  useAppSelector((state) => selectVariant(state, featureKey));

export const useIsFeatureEnabled = (featureKey: string) =>
  useAppSelector((state) => {
    const flag = state.experiment.featureFlags[featureKey];
    return flag?.enabled ?? false;
  });

// ================== CONFIG SELECTORS ==================
export const useClientConfig = () => useAppSelector((state) => state.configs.clientConfig);

export const useAgentEmailInfo = () => useAppSelector((state) => state.configs.agentEmailInfo);

export const usePaymentInfo = () => useAppSelector((state) => state.configs.paymentInfo);

export const useFeatures = () => useAppSelector((state) => state.configs.features);

// ================== CHAT SELECTORS ==================
export const useChatTaskMode = () => useAppSelector((state) => state.chat.taskMode);

export const useChatFiles = () => useAppSelector((state) => state.chat.files);

export const useIsStreaming = () => useAppSelector((state) => state.chat.isStreaming);

// ================== WEBSOCKET SELECTORS ==================
export const useConnectionStatus = () => useAppSelector((state) => state.websocket.status);

export const useIsConnected = () =>
  useAppSelector((state) => state.websocket.status === "connected");

export const useSubscribedRooms = () => useAppSelector((state) => state.websocket.rooms);

export const useDevices = () => useAppSelector((state) => state.devices);

// ================== ADDITIONAL MANUS-STYLE SELECTORS ==================
export const useWorkspace = () => useAppSelector((state) => state.workspace);
export const useNavbar = () => useAppSelector((state) => state.navbar);
export const useWebDev = () => useAppSelector((state) => state.webDev);
export const useCodeViewer = () => useAppSelector((state) => state.codeViewer);
export const useFilePreviewer = () => useAppSelector((state) => state.filePreviewer);
export const useSlideEditor = () => useAppSelector((state) => state.slideEditor);
export const useAiCanvas = () => useAppSelector((state) => state.aiCanvas);
export const useOnboarding = () => useAppSelector((state) => state.onboarding);
export const useBilling = () => useAppSelector((state) => state.billing);

// ================== COMPLETE MANUS-STYLE SELECTORS ==================
export const useSessionSwitch = () => useAppSelector((state) => state.sessionSwitch);
export const useCommunity = () => useAppSelector((state) => state.community);
export const useFileManagement = () => useAppSelector((state) => state.fileManagement);
export const useFileConnector = () => useAppSelector((state) => state.fileConnector);
export const useProducts = () => useAppSelector((state) => state.products);
export const useFileShare = () => useAppSelector((state) => state.fileShare);
export const useMapReduce = () => useAppSelector((state) => state.mapReduce);
export const useMailAgent = () => useAppSelector((state) => state.mailAgent);
export const useWebDevUsage = () => useAppSelector((state) => state.webDevUsage);
export const useLibrary = () => useAppSelector((state) => state.library);
export const useTimeline = () => useAppSelector((state) => state.timeline);
export const useLogin = () => useAppSelector((state) => state.login);
export const useExample = () => useAppSelector((state) => state.example);
export const useGuestPage = () => useAppSelector((state) => state.guestPage);
export const useMyBrowser = () => useAppSelector((state) => state.myBrowser);

// ================== NEW MANUS SLICES ==================
export const useAgentWorkspace = () => useAppSelector((state) => state.agentWorkspace);
export const useWebdevAuth = () => useAppSelector((state) => state.webdevAuth);
export const useAiCanvasEditor = () => useAppSelector((state) => state.aiCanvasEditor);
export const useBiz = () => useAppSelector((state) => state.biz);
export const useMeeting = () => useAppSelector((state) => state.meeting);

// ================== INTEGRATION HOOKS ==================
// Re-export integration hooks that combine better-auth, WebSocket, and RTK Query
export {
  useAuthIntegration,
  useWebSocketIntegration,
  useNotificationsIntegration,
  useChatIntegration,
  useSessionsIntegration,
} from "./hooks/index";
