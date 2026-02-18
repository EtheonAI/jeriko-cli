/**
 * Integration Hooks Index
 *
 * These hooks integrate Redux slices with:
 * - better-auth (authentication)
 * - WebSocket (real-time updates, streaming)
 * - vanilla tRPC (API calls)
 *
 * Pattern: tRPC fetch → dispatch to Redux → components useAppSelector
 * Mutations: optimistic dispatch → API call → revert on failure
 * WebSocket: events dispatch to same slice via middleware
 */

// Auth integration (better-auth + Redux)
export { useAuthIntegration } from "./useAuth";
export { default as useAuth } from "./useAuth";

// WebSocket integration (real-time connection)
export { useWebSocketIntegration } from "./useWebSocket";
export { default as useWebSocket } from "./useWebSocket";

// Notifications integration (vanilla tRPC + WebSocket)
export { useNotificationsIntegration } from "./useNotifications";
export { default as useNotifications } from "./useNotifications";

// Chat integration (WebSocket streaming)
export { useChatIntegration } from "./useChat";
export { default as useChat } from "./useChat";

// Sessions integration
export { useSessionsIntegration } from "./useSessions";
export { default as useSessions } from "./useSessions";

// Data integration hooks
export { useAgentsData } from "./useAgentsData";
export { useScheduledTasksData } from "./useScheduledTasksData";

// Phase 1 hooks — tRPC → Redux sync
export { useBillingData } from "./useBillingData";
export { useConnectorsData } from "./useConnectorsData";
export { useLibraryData } from "./useLibraryData";
export { useSearchData } from "./useSearchData";
export { useProjectsData } from "./useProjectsData";
export { useSkillsData } from "./useSkillsData";
export { useMailData } from "./useMailData";
export { useWebhooksData } from "./useWebhooksData";
export { useUserData } from "./useUserData";
