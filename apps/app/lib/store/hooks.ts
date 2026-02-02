import { useDispatch, useSelector, useStore } from "react-redux";
import type { AppDispatch, RootState, AppStore } from "./index";

// Use throughout your app instead of plain `useDispatch` and `useSelector`
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
export const useAppStore = useStore.withTypes<AppStore>();

// Typed selectors for common state
export const useAuth = () => useAppSelector((state) => state.auth);
export const useSessions = () => useAppSelector((state) => state.sessions);
export const useChat = () => useAppSelector((state) => state.chat);
export const useAgents = () => useAppSelector((state) => state.agents);
export const useFiles = () => useAppSelector((state) => state.files);
export const useWebSocket = () => useAppSelector((state) => state.websocket);
export const useUI = () => useAppSelector((state) => state.ui);

// Session-specific selectors
export const useCurrentSession = () =>
  useAppSelector((state) => {
    const { sessions, currentSessionId } = state.sessions;
    return currentSessionId ? sessions.find((s) => s.id === currentSessionId) : null;
  });

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

// Agent-specific selectors
export const useSelectedAgent = () =>
  useAppSelector((state) => {
    const { agents, selectedAgentId } = state.agents;
    if (!selectedAgentId) return null;
    for (const sessionAgents of Object.values(agents)) {
      const agent = sessionAgents.find((a) => a.id === selectedAgentId);
      if (agent) return agent;
    }
    return null;
  });

export const useAgentTasks = (agentId: string | null) =>
  useAppSelector((state) => {
    if (!agentId) return [];
    return state.agents.tasks[agentId] || [];
  });

// UI selectors
export const useToasts = () => useAppSelector((state) => state.ui.toasts);
export const useModals = () => useAppSelector((state) => state.ui.modals);
export const useSidebarState = () => useAppSelector((state) => state.ui.sidebarState);
