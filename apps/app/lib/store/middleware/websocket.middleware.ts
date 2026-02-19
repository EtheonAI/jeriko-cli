import type { Middleware, Dispatch, UnknownAction } from "@reduxjs/toolkit";
import {
  setConnectionStatus,
  setSocketId,
  joinRoom,
  leaveRoom,
  setLastError,
  setLastPongTime,
  setTaskFinished,
  setContextLengthStatus,
} from "../slices/websocket.slice";
import {
  addExecution,
  addScheduledTask,
  deleteScheduledTask,
  updateExecution,
  updateScheduledTask,
} from "../slices/scheduledTasks.slice";
import {
  updateSession,
  addSession,
  removeSession,
  type AgentSession,
} from "../slices/sessions.slice";
import {
  addNotification,
  markAsRead as markNotificationAsRead,
  type Notification,
} from "../slices/notifications.slice";

import { addMessage, appendToMessage, updateMessage, addToolApproval, setChatError, type Message } from "../slices/chat.slice";
import { startToolCall, completeToolCall, failToolCall, updateToolCallMetadata } from "../slices/toolCalls.slice";
import { addUsageRecord } from "../slices/billing.slice";
import {
  setFrameMetadata,
  type BrowserFrameMetadata,
} from "../slices/myBrowser.slice";
import { addSegmentEvent } from "../slices/timeline.slice";
import {
  setProject,
  type WebDevProject,
} from "../slices/webDev.slice";
import { addFile, updateFile, type FileItem } from "../slices/library.slice";
import { setConnectorSyncStatus } from "../slices/connectors.slice";
import {
  startTask as startMapTask,
  updateProgress as updateMapProgress,
  addResult as addMapResult,
  completeTask as completeMapTask,
} from "../slices/mapReduce.slice";
import type { ScheduledTask, ScheduledTaskExecution } from "../slices/scheduledTasks.slice";
import { setShouldShowMeetingIntro } from "../slices/meeting.slice";
import {
  appendDataSource as appendCommunityItem,
  toggleLike as toggleCommunityLike,
  type CommunityItem,
} from "../slices/community.slice";
import {
  updateFileConnectorStatus,
  type FileConnectorAppType,
} from "../slices/fileConnector.slice";
import { setShareInfo, type ShareInfo } from "../slices/fileShare.slice";
import { addUserSkill, removeUserSkill, type Skill } from "../slices/skills.slice";
import { addMember, removeMember, type TeamMember } from "../slices/team.slice";
import { apiSlice } from "../api/api.slice";

// ==================================================================
// Event types — single source of truth for all WS events
// ==================================================================

export type WebSocketEvent =
  | { type: "connected"; data?: { clientId?: string } }
  | { type: "error"; data?: { message?: string } }
  | { type: "server:shutdown"; data?: { reason?: string } }
  | { type: "subscribed"; data?: { channel?: string } }
  | { type: "unsubscribed"; data?: { channel?: string } }
  | { type: "session:update"; data?: { sessionId?: string; updates?: Partial<AgentSession> } }
  | { type: "session:new"; data?: { session?: AgentSession } }
  | { type: "session:deleted"; data?: { sessionId?: string } }
  | { type: "notification:new"; data?: Notification }
  | { type: "notification:read"; data?: { notificationId?: string; id?: string } }
  | { type: "message:new"; data?: { message?: Message } & Partial<Message> }
  | {
      type: "message:update";
      data?: { sessionId?: string; messageId?: string; updates?: Partial<Message> };
    }
  | { type: "device:status"; data?: { deviceId?: string; status?: string; lastHeartbeat?: string } }
  | { type: "scheduledTask:new"; data?: { task?: ScheduledTask } }
  | {
      type: "scheduledTask:update";
      data?: { taskId?: string; task?: ScheduledTask; updates?: Partial<ScheduledTask> };
    }
  | { type: "scheduledTask:deleted"; data?: { taskId?: string } }
  | { type: "scheduledTask:execution:new"; data?: { execution?: ScheduledTaskExecution } }
  | {
      type: "scheduledTask:execution:update";
      data?: { taskId?: string; executionId?: string; updates?: Partial<ScheduledTaskExecution> };
    }
  // Canonical orchestrator event names
  | { type: "session.created"; data?: { sessionId?: string; sandboxId?: string | null } }
  | { type: "message.start"; data?: { messageId?: string; role?: string; sessionId?: string; content?: string } }
  | { type: "message.chunk"; data?: { messageId?: string; delta?: string; sessionId?: string } }
  | { type: "message.complete"; data?: { messageId?: string; content?: string; sessionId?: string } }
  | { type: "tool_call.start"; data?: { toolCallId?: string; toolName?: string; args?: Record<string, unknown>; sessionId?: string; messageId?: string } }
  | { type: "tool_call.result"; data?: { toolCallId?: string; result?: Record<string, unknown> } }
  | { type: "tool_call.error"; data?: { toolCallId?: string; error?: string } }
  | { type: "plan.update"; data?: { planId?: string; phases?: unknown[]; currentPhase?: number } }
  | { type: "plan.advance"; data?: { planId?: string; nextPhase?: number } }
  | { type: "credits.update"; data?: { remaining?: number; used?: number } }
  // Sandbox events
  | { type: "sandbox.status"; data?: { sessionId?: string; status?: string; sandboxId?: string } }
  | { type: "sandbox.browser.frame"; data?: { frameId?: string; tabId?: string; url?: string; title?: string; frameType?: string; screenshot?: string; markdown?: string; elements?: unknown[]; viewport?: { width: number; height: number } } }
  | { type: "sandbox.terminal.chunk"; data?: { sessionId?: string; terminalId?: string; output?: string } }
  // Tool call progress
  | { type: "tool_call.progress"; data?: { toolCallId?: string; progress?: number; message?: string } }
  // File events
  | { type: "file.uploaded"; data?: { file?: FileItem } }
  | { type: "file.ready"; data?: { fileId?: string; url?: string; updates?: Partial<FileItem> } }
  // Connector events
  | { type: "connector.status"; data?: { connectionId?: string; status?: "idle" | "syncing" | "error"; errorMessage?: string } }
  // Orchestrator error
  | { type: "orchestrator.error"; data?: { sessionId?: string; message?: string; code?: string } }
  // Task finished
  | { type: "task.finished"; data?: { sessionId?: string; status?: string } }
  // Message info/ask
  | { type: "message.info"; data?: { sessionId?: string; messageId?: string; content?: string; metadata?: Record<string, unknown> } }
  | { type: "message.ask"; data?: { sessionId?: string; messageId?: string; toolCallId?: string; toolName?: string; input?: unknown; content?: string } }
  // Map-reduce events
  | { type: "map_started"; data?: { jobId?: string; title?: string; totalSubtasks?: number } }
  | { type: "map_subtask_complete"; data?: { jobId?: string; subtaskIndex?: number; result?: { id?: string; key?: string; value?: unknown } } }
  | { type: "map_all_complete"; data?: { jobId?: string; results?: unknown[] } }
  // WebDev events
  | { type: "webdev_project_created"; data?: { project?: WebDevProject } }
  // Context length warning
  | { type: "context_length.warning"; data?: { status?: "normal" | "warning" | "critical" | "exceeded" } }
  // Meeting events
  | { type: "meeting:intro:show"; data?: Record<string, unknown> }
  | { type: "meeting:intro:dismiss"; data?: Record<string, unknown> }
  // Knowledge events
  | { type: "knowledge:updated"; data?: { id?: string; updates?: Record<string, unknown> } }
  // Experiment events
  | { type: "experiment:variant:update"; data?: { key?: string; value?: unknown } }
  // Community events
  | { type: "community:item:new"; data?: CommunityItem }
  | { type: "community:item:like"; data?: { itemId?: string } }
  // File connector events
  | { type: "fileConnector:status"; data?: { appType?: FileConnectorAppType; connected?: boolean; accountEmail?: string } }
  // File share events
  | { type: "file.shared"; data?: ShareInfo }
  // Skill events
  | { type: "skill:installed"; data?: Skill }
  | { type: "skill:removed"; data?: { skillId?: string } }
  // Team events
  | { type: "team:member:added"; data?: TeamMember }
  | { type: "team:member:removed"; data?: { memberId?: string } }
  | { type: "pong"; data?: { ts?: number } };

// WebSocket middleware actions
export const WS_CONNECT = "websocket/connect";
export const WS_DISCONNECT = "websocket/disconnect";
export const WS_JOIN_ROOM = "websocket/joinRoom";
export const WS_LEAVE_ROOM = "websocket/leaveRoom";
export const WS_SEND = "websocket/send";

// Action creators
export const wsConnect = () => ({ type: WS_CONNECT });
export const wsDisconnect = () => ({ type: WS_DISCONNECT });
export const wsJoinRoom = (roomId: string) => ({ type: WS_JOIN_ROOM, payload: roomId });
export const wsLeaveRoom = (roomId: string) => ({ type: WS_LEAVE_ROOM, payload: roomId });
export const wsSend = (event: string, data: unknown) => ({
  type: WS_SEND,
  payload: { event, data },
});

// ─── Configuration ─────────────────────────────────────────────────

const BASE_RECONNECT_DELAY_MS = 500;
const MAX_RECONNECT_DELAY_MS = 30000;
const MAX_RECONNECT_ATTEMPTS = 15;
const PING_INTERVAL_MS = 25000; // Slightly under 30s to account for network jitter
const PONG_TIMEOUT_MS = 10000; // Consider connection dead if no pong within 10s
const MAX_PENDING_MESSAGES = 100;

// ─── Module-level state ────────────────────────────────────────────

let socket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let pingInterval: ReturnType<typeof setInterval> | null = null;
let pongTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempts = 0;
let shouldReconnect = true;
let lastPingTime = 0;

// Bounded message queue for offline sends
const pendingMessages: Array<{ event: string; data: unknown }> = [];

// ─── Conflation buffer for high-frequency events ──────────────────
// Terminal chunks, message chunks, and tool progress can arrive at 100+ Hz.
// Dispatching each one individually causes render thrashing. Instead, we
// accumulate them and flush at ~60fps (16ms).

type ConflationKey = string; // e.g. "terminal:session123:term1" or "chunk:session123:msg456"

interface PendingTerminalChunk {
  type: "terminal";
  segmentId: string;
  sessionId: string;
  output: string; // accumulated output
}

interface PendingToolProgress {
  type: "toolProgress";
  correlationId: string;
  progress?: number;
  message?: string;
}

type ConflatedEvent = PendingTerminalChunk | PendingToolProgress;

const conflationBuffer = new Map<ConflationKey, ConflatedEvent>();
let conflationTimer: ReturnType<typeof setTimeout> | null = null;

function flushConflationBuffer(dispatch: Dispatch<UnknownAction>) {
  if (conflationBuffer.size === 0) return;
  const entries = Array.from(conflationBuffer.values());
  conflationBuffer.clear();
  conflationTimer = null;

  for (const entry of entries) {
    switch (entry.type) {
      case "terminal":
        dispatch(
          addSegmentEvent({
            segmentId: entry.segmentId,
            event: {
              id: `term_${Date.now()}_${entry.segmentId}`,
              sessionId: entry.sessionId,
              segmentId: entry.segmentId,
              type: "shell_exec",
              title: "Terminal output",
              data: { output: entry.output },
              timestamp: new Date().toISOString(),
            },
          })
        );
        break;
      case "toolProgress":
        dispatch(
          updateToolCallMetadata({
            correlationId: entry.correlationId,
            metadata: {
              progress: entry.progress,
              progressMessage: entry.message,
            },
          })
        );
        break;
    }
  }
}

function scheduleConflationFlush(dispatch: Dispatch<UnknownAction>) {
  if (!conflationTimer) {
    conflationTimer = setTimeout(() => flushConflationBuffer(dispatch), 16);
  }
}

// ─── Helpers ───────────────────────────────────────────────────────

function cleanupSocket() {
  if (pongTimeoutTimer) {
    clearTimeout(pongTimeoutTimer);
    pongTimeoutTimer = null;
  }
  if (pingInterval) {
    clearInterval(pingInterval);
    pingInterval = null;
  }
  if (socket) {
    socket.onopen = null;
    socket.onclose = null;
    socket.onerror = null;
    socket.onmessage = null;
    if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
      socket.close(1000, "Client cleanup");
    }
    socket = null;
  }
}

function drainPendingMessages() {
  while (pendingMessages.length > 0 && socket?.readyState === WebSocket.OPEN) {
    const msg = pendingMessages.shift()!;
    socket.send(JSON.stringify({ type: msg.event, data: msg.data }));
  }
}

function startPingInterval(dispatch: Dispatch<UnknownAction>) {
  if (pingInterval) clearInterval(pingInterval);
  pingInterval = setInterval(() => {
    if (socket?.readyState === WebSocket.OPEN) {
      lastPingTime = Date.now();
      socket.send(JSON.stringify({ type: "ping" }));

      // Start pong timeout — if no pong arrives, connection is dead
      if (pongTimeoutTimer) clearTimeout(pongTimeoutTimer);
      pongTimeoutTimer = setTimeout(() => {
        if (socket) {
          console.warn("[WS] Pong timeout — closing dead connection");
          socket.close(4000, "Pong timeout");
        }
      }, PONG_TIMEOUT_MS);
    }
  }, PING_INTERVAL_MS);
}

/** Exponential backoff with jitter */
function scheduleReconnect(dispatch: Dispatch<UnknownAction>) {
  if (!shouldReconnect) return;
  if (reconnectTimer) return;
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    dispatch(setLastError("Max reconnection attempts reached. Please refresh the page."));
    dispatch(setConnectionStatus("error"));
    return;
  }

  // Exponential backoff with ±25% jitter to prevent thundering herd
  const exponential = BASE_RECONNECT_DELAY_MS * Math.pow(2, reconnectAttempts);
  const capped = Math.min(MAX_RECONNECT_DELAY_MS, exponential);
  const jitter = capped * (0.75 + Math.random() * 0.5); // [75%, 125%] of capped

  reconnectAttempts++;
  dispatch(setConnectionStatus("connecting"));

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    dispatch(wsConnect());
  }, jitter);
}

async function fetchGatewayToken(): Promise<string | null> {
  try {
    const response = await fetch("/api/gateway-token");
    if (!response.ok) return null;
    const data = await response.json();
    return data?.token ?? null;
  } catch {
    return null;
  }
}

// ─── Middleware ─────────────────────────────────────────────────────

export const websocketMiddleware: Middleware = (store) => (next) => (action) => {
  const dispatch = store.dispatch as Dispatch<UnknownAction>;

  switch ((action as { type: string }).type) {
    case WS_CONNECT: {
      cleanupSocket();
      shouldReconnect = true;

      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }

      const wsBaseUrl = process.env.NEXT_PUBLIC_GATEWAY_WS_URL || "ws://localhost:3001/v1/stream";
      dispatch(setConnectionStatus("connecting"));

      void (async () => {
        // Always fetch fresh token on every connect (handles reconnect with expired token)
        const token = await fetchGatewayToken();
        if (!token) {
          dispatch(setLastError("Failed to fetch gateway token"));
          dispatch(setConnectionStatus("error"));
          scheduleReconnect(dispatch);
          return;
        }

        try {
          // Use Sec-WebSocket-Protocol for token passing (avoids leaking JWT in URL/logs)
          // Protocol format: ["access_token", "<jwt>"]
          // Falls back to query param if protocol negotiation fails
          socket = new WebSocket(wsBaseUrl, ["access_token", token]);

          socket.onopen = () => {
            reconnectAttempts = 0;
            dispatch(setConnectionStatus("connected"));
            dispatch(setLastError(null));
            startPingInterval(dispatch);
            drainPendingMessages();

            // Re-join all rooms that were active before disconnect.
            // This implements the "catch-up + live follow" pattern from
            // ReactiveTrader — components don't need to know about reconnection.
            const state = store.getState() as { websocket?: { rooms?: string[] } };
            const rooms = state.websocket?.rooms;
            if (rooms && rooms.length > 0 && socket) {
              for (const roomId of rooms) {
                socket.send(JSON.stringify({ type: "subscribe", data: { channel: roomId } }));
              }
            }
          };

          socket.onclose = (event) => {
            cleanupSocket();
            dispatch(setConnectionStatus("disconnected"));
            dispatch(setSocketId(null));

            // 4001 = auth failure — don't reconnect
            if (event.code === 4001) {
              dispatch(setLastError("Authentication failed"));
              dispatch(setConnectionStatus("error"));
              return;
            }

            scheduleReconnect(dispatch);
          };

          socket.onerror = () => {
            // The close event will fire after this, which handles reconnection
            dispatch(setLastError("WebSocket connection error"));
          };

          socket.onmessage = (event) => {
            try {
              const data = JSON.parse(event.data);
              if (!data || typeof data.type !== "string") return;
              handleWebSocketMessage(dispatch, data as WebSocketEvent, store.getState);
            } catch {
              // Silently ignore unparseable messages
            }
          };
        } catch {
          dispatch(setLastError("WebSocket connection failed"));
          dispatch(setConnectionStatus("error"));
          scheduleReconnect(dispatch);
        }
      })();
      break;
    }

    case WS_DISCONNECT: {
      shouldReconnect = false;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      // Flush any pending conflated events before disconnecting
      if (conflationTimer) {
        clearTimeout(conflationTimer);
        conflationTimer = null;
      }
      flushConflationBuffer(dispatch);
      conflationBuffer.clear();
      cleanupSocket();
      pendingMessages.length = 0;
      reconnectAttempts = 0;
      dispatch(setConnectionStatus("disconnected"));
      break;
    }

    case WS_JOIN_ROOM: {
      const roomId = (action as { payload: string }).payload;
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "subscribe", data: { channel: roomId } }));
        dispatch(joinRoom(roomId));
      }
      break;
    }

    case WS_LEAVE_ROOM: {
      const roomId = (action as { payload: string }).payload;
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "unsubscribe", data: { channel: roomId } }));
      }
      dispatch(leaveRoom(roomId));
      break;
    }

    case WS_SEND: {
      const { event, data } = (action as { payload: { event: string; data: unknown } }).payload;
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: event, data }));
      } else {
        // Bounded queue — drop oldest messages if full
        if (pendingMessages.length >= MAX_PENDING_MESSAGES) {
          pendingMessages.shift();
        }
        pendingMessages.push({ event, data });
      }
      break;
    }

    default:
      break;
  }

  return next(action);
};

// ─── Message handler ───────────────────────────────────────────────

function handleWebSocketMessage(dispatch: Dispatch<UnknownAction>, event: WebSocketEvent, getState: () => unknown) {
  switch (event.type) {
    // Connection events
    case "connected":
      dispatch(setSocketId(event.data?.clientId ?? null));
      break;

    case "error":
      dispatch(setLastError(event.data?.message ?? "WebSocket error"));
      break;

    case "server:shutdown":
      // Server is going away — reconnect soon
      dispatch(setLastError("Server restarting, reconnecting..."));
      break;

    case "subscribed":
    case "unsubscribed":
      // Acknowledgment from server — no action needed
      break;

    // Session events
    case "session.created":
      if (event.data?.sessionId) {
        const now = new Date().toISOString();
        dispatch(
          addSession({
            id: event.data.sessionId,
            userId: "unknown",
            title: "New Session",
            status: "active",
            mode: "agent",
            isShared: false,
            createdAt: now,
            updatedAt: now,
          })
        );
        dispatch(apiSlice.util.invalidateTags(["Session"]));
      }
      break;

    case "session:update":
      if (event.data?.sessionId && event.data?.updates) {
        dispatch(
          updateSession({
            id: event.data.sessionId,
            updates: event.data.updates,
          })
        );
        dispatch(apiSlice.util.invalidateTags(["Session"]));
      }
      break;

    case "session:new":
      if (event.data?.session?.id) {
        dispatch(addSession(event.data.session));
        dispatch(apiSlice.util.invalidateTags(["Session"]));
      }
      break;

    case "session:deleted":
      if (event.data?.sessionId) {
        dispatch(removeSession(event.data.sessionId));
        dispatch(apiSlice.util.invalidateTags(["Session"]));
      }
      break;

    // Notification events
    case "notification:new":
      if (event.data?.id && event.data?.type && event.data?.title) {
        dispatch(addNotification(event.data as Notification));
        dispatch(apiSlice.util.invalidateTags(["Notification"]));
      }
      break;

    case "notification:read":
      if (event.data?.notificationId || event.data?.id) {
        dispatch(markNotificationAsRead(event.data.notificationId ?? event.data.id!));
        dispatch(apiSlice.util.invalidateTags(["Notification"]));
      }
      break;

    // Message events
    case "message.start":
      if (event.data?.messageId && event.data?.sessionId) {
        dispatch(
          addMessage({
            id: event.data.messageId,
            sessionId: event.data.sessionId,
            role: (event.data.role as "user" | "assistant" | "system" | "tool") ?? "assistant",
            content: event.data.content ?? "",
            createdAt: new Date().toISOString(),
          })
        );
      }
      break;

    case "message.chunk":
      if (event.data?.sessionId && event.data?.messageId) {
        dispatch(
          appendToMessage({
            sessionId: event.data.sessionId,
            messageId: event.data.messageId,
            content: event.data.delta ?? "",
          })
        );
      }
      break;

    case "message.complete":
      if (event.data?.sessionId && event.data?.messageId) {
        dispatch(
          updateMessage({
            sessionId: event.data.sessionId,
            messageId: event.data.messageId,
            updates: { content: event.data.content ?? "" },
          })
        );
      }
      break;

    case "message:new":
      if (event.data?.message?.id && event.data.message.sessionId) {
        dispatch(addMessage(event.data.message));
      } else if (event.data?.id && event.data?.sessionId) {
        dispatch(addMessage(event.data as unknown as Message));
      }
      break;

    case "message:update":
      if (event.data?.sessionId && event.data?.messageId) {
        dispatch(
          updateMessage({
            sessionId: event.data.sessionId,
            messageId: event.data.messageId,
            updates: event.data.updates ?? {},
          })
        );
      }
      break;

    // Canonical tool call events
    case "tool_call.start":
      if (event.data?.toolCallId && event.data?.toolName && event.data?.sessionId) {
        dispatch(
          startToolCall({
            correlationId: event.data.toolCallId,
            toolName: event.data.toolName,
            sessionId: event.data.sessionId,
            messageId: event.data.messageId,
            input: event.data.args ?? {},
          })
        );
      }
      break;

    case "tool_call.result":
      if (event.data?.toolCallId) {
        dispatch(
          completeToolCall({
            correlationId: event.data.toolCallId,
            output: event.data.result ?? {},
          })
        );
      }
      break;

    case "tool_call.error":
      if (event.data?.toolCallId) {
        dispatch(
          failToolCall({
            correlationId: event.data.toolCallId,
            error: event.data.error ?? "Tool execution failed",
          })
        );
      }
      break;

    // Plan events — dispatch to timeline + clear error
    case "plan.update":
      dispatch(setLastError(null));
      if (event.data?.planId) {
        dispatch(
          addSegmentEvent({
            segmentId: "plan",
            event: {
              id: `plan_update_${Date.now()}`,
              sessionId: "",
              segmentId: "plan",
              type: "status_change",
              title: "Plan updated",
              data: {
                planId: event.data.planId,
                phases: event.data.phases,
                currentPhase: event.data.currentPhase,
              },
              timestamp: new Date().toISOString(),
            },
          })
        );
      }
      break;

    case "plan.advance":
      dispatch(setLastError(null));
      if (event.data?.planId) {
        dispatch(
          addSegmentEvent({
            segmentId: "plan",
            event: {
              id: `plan_advance_${Date.now()}`,
              sessionId: "",
              segmentId: "plan",
              type: "status_change",
              title: "Plan phase advanced",
              data: {
                planId: event.data.planId,
                nextPhase: event.data.nextPhase,
              },
              timestamp: new Date().toISOString(),
            },
          })
        );
      }
      break;

    // Sandbox events
    case "sandbox.status":
      if (event.data?.sessionId && event.data?.status) {
        dispatch(
          updateSession({
            id: event.data.sessionId,
            updates: {
              metadata: {
                sandboxStatus: event.data.status,
                sandboxId: event.data.sandboxId,
              },
            },
          })
        );
      }
      break;

    case "sandbox.browser.frame":
      if (event.data?.frameId) {
        dispatch(
          setFrameMetadata({
            frameId: event.data.frameId,
            tabId: event.data.tabId ?? "default",
            url: event.data.url ?? "",
            title: event.data.title ?? "",
            frameType: (event.data.frameType as BrowserFrameMetadata["frameType"]) ?? "main_frame",
            isActive: true,
            lastActiveAt: new Date().toISOString(),
            viewport: event.data.viewport
              ? { ...event.data.viewport, devicePixelRatio: 1 }
              : undefined,
            metadata: {
              screenshot: event.data.screenshot,
              markdown: event.data.markdown,
              elements: event.data.elements,
            },
          })
        );
      }
      break;

    case "sandbox.terminal.chunk":
      if (event.data?.sessionId) {
        // Conflation: accumulate terminal chunks and flush at ~60fps.
        // Terminal output can arrive at 100+ Hz during active shell execution.
        const segId = event.data.terminalId ?? "terminal";
        const termKey: ConflationKey = `terminal:${event.data.sessionId}:${segId}`;
        const existing = conflationBuffer.get(termKey);
        if (existing && existing.type === "terminal") {
          existing.output += event.data.output ?? "";
        } else {
          conflationBuffer.set(termKey, {
            type: "terminal",
            segmentId: segId,
            sessionId: event.data.sessionId,
            output: event.data.output ?? "",
          });
        }
        scheduleConflationFlush(dispatch);
      }
      break;

    // Tool call progress — conflated at ~60fps to prevent render thrashing
    case "tool_call.progress":
      if (event.data?.toolCallId) {
        const progressKey: ConflationKey = `progress:${event.data.toolCallId}`;
        conflationBuffer.set(progressKey, {
          type: "toolProgress",
          correlationId: event.data.toolCallId,
          progress: event.data.progress,
          message: event.data.message,
        });
        scheduleConflationFlush(dispatch);
      }
      break;

    // File events
    case "file.uploaded":
      if (event.data?.file?.id) {
        dispatch(addFile(event.data.file));
        dispatch(apiSlice.util.invalidateTags(["File"]));
      }
      break;

    case "file.ready":
      if (event.data?.fileId) {
        dispatch(
          updateFile({
            id: event.data.fileId,
            updates: { ...event.data.updates, storageKey: event.data.url ?? undefined } as Partial<FileItem>,
          })
        );
        dispatch(apiSlice.util.invalidateTags(["File"]));
      }
      break;

    // Connector status
    case "connector.status":
      if (event.data?.connectionId && event.data?.status) {
        dispatch(
          setConnectorSyncStatus({
            connectionId: event.data.connectionId,
            status: event.data.status,
            errorMessage: event.data.errorMessage,
          })
        );
        dispatch(apiSlice.util.invalidateTags(["Connector"]));
      }
      break;

    // Orchestrator error
    case "orchestrator.error":
      if (event.data?.message) {
        dispatch(setChatError(event.data.message));
        dispatch(setLastError(event.data.message));
      }
      break;

    // Task finished — mark session complete + flag
    case "task.finished":
      dispatch(setTaskFinished(true));
      if (event.data?.sessionId) {
        dispatch(
          updateSession({
            id: event.data.sessionId,
            updates: {
              status: (event.data.status as AgentSession["status"]) ?? "completed",
              completedAt: new Date().toISOString(),
            },
          })
        );
        dispatch(apiSlice.util.invalidateTags(["Session"]));
      }
      break;

    // Message info (non-interactive agent notification)
    case "message.info":
      if (event.data?.sessionId && event.data?.messageId) {
        dispatch(
          addMessage({
            id: event.data.messageId,
            sessionId: event.data.sessionId,
            role: "assistant",
            content: event.data.content ?? "",
            metadata: { ...event.data.metadata, type: "info" },
            createdAt: new Date().toISOString(),
          })
        );
      }
      break;

    // Message ask (agent requests user input / tool approval)
    case "message.ask":
      if (event.data?.sessionId && event.data?.toolCallId && event.data?.toolName) {
        dispatch(
          addToolApproval({
            id: `approval_${event.data.toolCallId}`,
            toolCallId: event.data.toolCallId,
            toolName: event.data.toolName,
            input: event.data.input ?? {},
            sessionId: event.data.sessionId,
            messageId: event.data.messageId ?? "",
            createdAt: new Date().toISOString(),
          })
        );
      }
      if (event.data?.sessionId && event.data?.content) {
        dispatch(
          addMessage({
            id: event.data.messageId ?? `ask_${Date.now()}`,
            sessionId: event.data.sessionId,
            role: "assistant",
            content: event.data.content,
            metadata: { type: "ask" },
            createdAt: new Date().toISOString(),
          })
        );
      }
      break;

    // Map-reduce events (orchestrator-worker pattern)
    case "map_started":
      if (event.data?.jobId && event.data?.title) {
        dispatch(
          startMapTask({
            id: event.data.jobId,
            name: event.data.title,
            totalItems: event.data.totalSubtasks ?? 0,
          })
        );
      }
      break;

    case "map_subtask_complete":
      if (event.data?.jobId) {
        const subtaskIndex = event.data.subtaskIndex ?? 0;
        const totalSubtasks =
          ((getState() as { mapReduce: { currentTask: { totalItems: number } | null } })
            .mapReduce?.currentTask?.totalItems) ?? 1;
        dispatch(
          updateMapProgress({
            processedItems: subtaskIndex + 1,
            progress: Math.round(((subtaskIndex + 1) / totalSubtasks) * 100),
          })
        );
        if (event.data.result) {
          dispatch(
            addMapResult({
              id: event.data.result.id ?? `subtask_${subtaskIndex}`,
              key: event.data.result.key ?? `subtask_${subtaskIndex}`,
              value: event.data.result.value,
            })
          );
        }
      }
      break;

    case "map_all_complete":
      if (event.data?.jobId) {
        dispatch(completeMapTask());
      }
      break;

    // WebDev project created
    case "webdev_project_created":
      if (event.data?.project) {
        dispatch(setProject(event.data.project));
      }
      break;

    // Context length warning
    case "context_length.warning":
      if (event.data?.status) {
        dispatch(setContextLengthStatus(event.data.status));
      }
      break;

    case "credits.update":
      if (typeof event.data?.used === "number") {
        dispatch(
          addUsageRecord({
            date: new Date().toISOString(),
            credits: event.data.used,
            type: "chat",
            description: "Agent execution usage",
          })
        );
        dispatch(apiSlice.util.invalidateTags(["Billing"]));
      }
      break;

    // Device events — slice removed, handled by tRPC
    case "device:status":
      break;

    // Scheduled task events
    case "scheduledTask:new":
      if (event.data?.task?.id) {
        dispatch(addScheduledTask(event.data.task));
        dispatch(apiSlice.util.invalidateTags(["ScheduledTask"]));
      }
      break;

    case "scheduledTask:update":
      if (event.data?.taskId || event.data?.task?.id) {
        dispatch(
          updateScheduledTask({
            id: event.data.taskId ?? event.data.task!.id,
            updates: event.data.updates ?? event.data.task ?? {},
          })
        );
        dispatch(apiSlice.util.invalidateTags(["ScheduledTask"]));
      }
      break;

    case "scheduledTask:deleted":
      if (event.data?.taskId) {
        dispatch(deleteScheduledTask(event.data.taskId));
        dispatch(apiSlice.util.invalidateTags(["ScheduledTask"]));
      }
      break;

    case "scheduledTask:execution:new":
      if (event.data?.execution?.id) {
        dispatch(addExecution(event.data.execution));
        dispatch(apiSlice.util.invalidateTags(["ScheduledTask"]));
      }
      break;

    case "scheduledTask:execution:update":
      if (event.data?.taskId && event.data?.executionId) {
        dispatch(
          updateExecution({
            taskId: event.data.taskId,
            executionId: event.data.executionId,
            updates: event.data.updates ?? {},
          })
        );
        dispatch(apiSlice.util.invalidateTags(["ScheduledTask"]));
      }
      break;

    // Meeting events
    case "meeting:intro:show":
      dispatch(setShouldShowMeetingIntro(true));
      break;

    case "meeting:intro:dismiss":
      dispatch(setShouldShowMeetingIntro(false));
      break;

    // Knowledge events — invalidate RTK Query cache
    case "knowledge:updated":
      dispatch(apiSlice.util.invalidateTags(["Knowledge"]));
      break;

    // Experiment events — invalidate RTK Query cache
    case "experiment:variant:update":
      dispatch(apiSlice.util.invalidateTags(["Experiment"]));
      break;

    // Community events
    case "community:item:new":
      if (event.data?.id) {
        dispatch(appendCommunityItem([event.data]));
      }
      break;

    case "community:item:like":
      if (event.data?.itemId) {
        dispatch(toggleCommunityLike(event.data.itemId));
      }
      break;

    // File connector status
    case "fileConnector:status":
      if (event.data?.appType) {
        dispatch(
          updateFileConnectorStatus({
            appType: event.data.appType,
            connected: event.data.connected ?? false,
            accountEmail: event.data.accountEmail,
          })
        );
      }
      break;

    // File shared
    case "file.shared":
      if (event.data?.id) {
        dispatch(setShareInfo(event.data));
      }
      break;

    // Skill events
    case "skill:installed":
      if (event.data?.id) {
        dispatch(addUserSkill(event.data));
      }
      break;

    case "skill:removed":
      if (event.data?.skillId) {
        dispatch(removeUserSkill(event.data.skillId));
      }
      break;

    // Team events
    case "team:member:added":
      if (event.data?.id) {
        dispatch(addMember(event.data));
      }
      break;

    case "team:member:removed":
      if (event.data?.memberId) {
        dispatch(removeMember(event.data.memberId));
      }
      break;

    // Heartbeat — cancel pong timeout
    case "pong":
      if (pongTimeoutTimer) {
        clearTimeout(pongTimeoutTimer);
        pongTimeoutTimer = null;
      }
      dispatch(setLastPongTime(Date.now()));
      break;

    default: {
      const unhandled = event as { type: string };
      if (unhandled.type !== "ping") {
        console.warn("[WS] Unknown event type:", unhandled.type);
      }
    }
  }
}
