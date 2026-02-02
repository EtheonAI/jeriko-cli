/**
 * Integration Hooks Index
 *
 * These hooks integrate Redux slices with:
 * - better-auth (authentication)
 * - WebSocket (real-time updates, streaming)
 * - RTK Query (API calls)
 *
 * Each hook documents what triggers each action:
 * - API Call: Makes HTTP request via RTK Query
 * - WebSocket: Sends/receives message via WebSocket
 * - Streaming: Handles streaming data via WebSocket
 * - State: Updates Redux state only (no network)
 */

// Auth integration (better-auth + Redux)
export { useAuthIntegration } from "./useAuth";
export { default as useAuth } from "./useAuth";

// WebSocket integration (real-time connection)
export { useWebSocketIntegration } from "./useWebSocket";
export { default as useWebSocket } from "./useWebSocket";

// Notifications integration (WebSocket + RTK Query)
export { useNotificationsIntegration } from "./useNotifications";
export { default as useNotifications } from "./useNotifications";

// Chat integration (WebSocket streaming + RTK Query)
export { useChatIntegration } from "./useChat";
export { default as useChat } from "./useChat";

// Sessions integration (WebSocket + RTK Query)
export { useSessionsIntegration } from "./useSessions";
export { default as useSessions } from "./useSessions";
