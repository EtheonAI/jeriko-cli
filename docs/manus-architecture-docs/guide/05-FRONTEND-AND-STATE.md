# Part 5: Frontend, State Management, WebSocket, and Real-Time UI

> **This is the user-facing layer.** The frontend receives real-time events via WebSocket, manages state across 12+ slices, and renders the timeline of messages, tool calls, plans, and file attachments. This document provides the complete implementation.

---

## 1. State Architecture

Manus uses Redux Toolkit with 41 slices. You do NOT need all 41. Here are the **12 critical slices** you must implement, and the rest are optional enhancements.

### 1.1 Critical Slices (Must Have)

| Slice | Purpose | Key State |
|-------|---------|-----------|
| `auth` | User authentication | `user`, `token`, `isAuthenticated` |
| `sessions` | Session list + current | `sessions[]`, `currentSessionId`, `isLoading` |
| `timeline` | Messages + tool calls | `segmentEventsMap`, `segmentEndpoints` |
| `chat` | Input state | `inputValue`, `attachedFiles[]`, `isProcessing` |
| `ui` | Theme + layout | `theme`, `sidebarOpen`, `rightPanelView` |
| `websocket` | Connection state | `connected`, `reconnecting` |
| `agentWorkspace` | Plan display | `currentPlan`, `phases[]`, `currentPhaseId` |
| `browserView` | Remote browser | `screenshotUrl`, `pageUrl`, `isLoading` |
| `fileManagement` | File uploads | `uploadingFiles[]`, `sessionFiles[]` |
| `codeViewer` | Code display | `currentFile`, `language`, `content` |
| `connectors` | External services | `connectors[]`, `activeConnections[]` |
| `notification` | Toasts + alerts | `notifications[]` |

### 1.2 Optional Slices (Nice to Have)

| Slice | Purpose |
|-------|---------|
| `knowledge` | User's persistent knowledge items |
| `scheduledTasks` | Scheduled task management |
| `slideEditor` | Presentation editor |
| `mapReduce` | Parallel task progress |
| `fileShare` | Shared file links |
| `filePreviewer` | File preview modal |

---

## 2. Zustand Store Implementation

Using Zustand instead of Redux for simplicity. Same patterns, less boilerplate.

### 2.1 Store Setup

```typescript
// src/client/store/index.ts

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { createAuthSlice, AuthSlice } from './slices/auth';
import { createSessionsSlice, SessionsSlice } from './slices/sessions';
import { createTimelineSlice, TimelineSlice } from './slices/timeline';
import { createChatSlice, ChatSlice } from './slices/chat';
import { createUISlice, UISlice } from './slices/ui';
import { createWebSocketSlice, WebSocketSlice } from './slices/websocket';
import { createAgentWorkspaceSlice, AgentWorkspaceSlice } from './slices/agent-workspace';
import { createBrowserViewSlice, BrowserViewSlice } from './slices/browser-view';
import { createFileManagementSlice, FileManagementSlice } from './slices/file-management';
import { createNotificationSlice, NotificationSlice } from './slices/notification';

export type AppStore = AuthSlice & SessionsSlice & TimelineSlice & ChatSlice &
  UISlice & WebSocketSlice & AgentWorkspaceSlice & BrowserViewSlice &
  FileManagementSlice & NotificationSlice;

export const useStore = create<AppStore>()(
  devtools(
    persist(
      immer((...a) => ({
        ...createAuthSlice(...a),
        ...createSessionsSlice(...a),
        ...createTimelineSlice(...a),
        ...createChatSlice(...a),
        ...createUISlice(...a),
        ...createWebSocketSlice(...a),
        ...createAgentWorkspaceSlice(...a),
        ...createBrowserViewSlice(...a),
        ...createFileManagementSlice(...a),
        ...createNotificationSlice(...a),
      })),
      {
        name: 'agent-store',
        // Only persist auth and UI preferences
        partialize: (state) => ({
          token: state.token,
          user: state.user,
          theme: state.theme,
          sidebarOpen: state.sidebarOpen,
        }),
      }
    )
  )
);
```

### 2.2 Auth Slice

```typescript
// src/client/store/slices/auth.ts

import { StateCreator } from 'zustand';

export interface AuthSlice {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  setUser: (user: User) => void;
  setToken: (token: string) => void;
}

export const createAuthSlice: StateCreator<AuthSlice, [['zustand/immer', never]]> = (set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,

  login: async (email, password) => {
    set((state) => { state.isLoading = true; });
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      set((state) => {
        state.user = data.user;
        state.token = data.token;
        state.isAuthenticated = true;
        state.isLoading = false;
      });
    } catch (error) {
      set((state) => { state.isLoading = false; });
      throw error;
    }
  },

  logout: () => {
    set((state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
    });
  },

  setUser: (user) => set((state) => { state.user = user; }),
  setToken: (token) => set((state) => { state.token = token; state.isAuthenticated = true; }),
});
```

### 2.3 Sessions Slice

```typescript
// src/client/store/slices/sessions.ts

export interface SessionsSlice {
  sessions: Session[];
  currentSessionId: string | null;
  isLoading: boolean;
  fetchSessions: () => Promise<void>;
  createSession: (title?: string) => Promise<Session>;
  selectSession: (sessionId: string) => void;
  deleteSession: (sessionId: string) => Promise<void>;
  updateSessionTitle: (sessionId: string, title: string) => void;
}

export const createSessionsSlice: StateCreator<SessionsSlice, [['zustand/immer', never]]> = (set, get) => ({
  sessions: [],
  currentSessionId: null,
  isLoading: false,

  fetchSessions: async () => {
    set((state) => { state.isLoading = true; });
    const res = await fetch('/api/sessions', {
      headers: { 'Authorization': `Bearer ${get().token}` },
    });
    const sessions = await res.json();
    set((state) => {
      state.sessions = sessions;
      state.isLoading = false;
    });
  },

  createSession: async (title) => {
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${get().token}`,
      },
      body: JSON.stringify({ title }),
    });
    const session = await res.json();
    set((state) => {
      state.sessions.unshift(session);
      state.currentSessionId = session.id;
    });
    return session;
  },

  selectSession: (sessionId) => {
    set((state) => { state.currentSessionId = sessionId; });
  },

  deleteSession: async (sessionId) => {
    await fetch(`/api/sessions/${sessionId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${get().token}` },
    });
    set((state) => {
      state.sessions = state.sessions.filter(s => s.id !== sessionId);
      if (state.currentSessionId === sessionId) {
        state.currentSessionId = state.sessions[0]?.id || null;
      }
    });
  },

  updateSessionTitle: (sessionId, title) => {
    set((state) => {
      const session = state.sessions.find(s => s.id === sessionId);
      if (session) session.title = title;
    });
  },
});
```

### 2.4 Timeline Slice — THE CORE

This is the most important slice. It manages the conversation timeline with messages, tool calls, and tool results.

```typescript
// src/client/store/slices/timeline.ts

export interface TimelineEvent {
  id: string;
  type: 'message' | 'tool_call' | 'tool_result' | 'plan_update' | 'error';
  timestamp: number;
  data: any;
}

export interface TimelineSlice {
  // Segment-based pagination (matches Manus's architecture)
  // Each segment is a page of events
  segmentEventsMap: Record<string, TimelineEvent[]>; // segmentId → events
  segmentEndpoints: Record<string, { hasMore: boolean; cursor: string | null }>;
  currentSegmentId: string | null;

  // Convenience accessors
  getCurrentEvents: () => TimelineEvent[];

  // Actions triggered by WebSocket events
  addTimelineEvent: (sessionId: string, event: TimelineEvent) => void;
  setSegmentEvents: (segmentId: string, events: TimelineEvent[]) => void;
  clearTimeline: () => void;

  // Fetch history for a session
  fetchSessionTimeline: (sessionId: string) => Promise<void>;
}

export const createTimelineSlice: StateCreator<TimelineSlice, [['zustand/immer', never]]> = (set, get) => ({
  segmentEventsMap: {},
  segmentEndpoints: {},
  currentSegmentId: null,

  getCurrentEvents: () => {
    const segmentId = get().currentSegmentId;
    if (!segmentId) return [];
    return get().segmentEventsMap[segmentId] || [];
  },

  addTimelineEvent: (sessionId, event) => {
    set((state) => {
      if (!state.segmentEventsMap[sessionId]) {
        state.segmentEventsMap[sessionId] = [];
      }
      state.segmentEventsMap[sessionId].push(event);
    });
  },

  setSegmentEvents: (segmentId, events) => {
    set((state) => {
      state.segmentEventsMap[segmentId] = events;
    });
  },

  clearTimeline: () => {
    set((state) => {
      state.segmentEventsMap = {};
      state.segmentEndpoints = {};
      state.currentSegmentId = null;
    });
  },

  fetchSessionTimeline: async (sessionId) => {
    const res = await fetch(`/api/sessions/${sessionId}`, {
      headers: { 'Authorization': `Bearer ${get().token}` },
    });
    const data = await res.json();

    // Convert messages and tool calls to timeline events
    const events: TimelineEvent[] = [];

    for (const msg of data.messages) {
      events.push({
        id: msg.id,
        type: 'message',
        timestamp: new Date(msg.createdAt).getTime(),
        data: {
          role: msg.role,
          content: msg.content,
          contentType: msg.contentType,
          attachments: msg.metadata?.attachments,
        },
      });
    }

    for (const tc of data.toolCalls) {
      events.push({
        id: tc.id,
        type: 'tool_call',
        timestamp: new Date(tc.createdAt).getTime(),
        data: {
          toolName: tc.toolName,
          args: tc.args,
          result: tc.result,
          status: tc.status,
        },
      });
    }

    // Sort by timestamp
    events.sort((a, b) => a.timestamp - b.timestamp);

    set((state) => {
      state.segmentEventsMap[sessionId] = events;
      state.currentSegmentId = sessionId;
    });

    // Set plan if exists
    if (data.plan) {
      set((state) => {
        state.currentPlan = data.plan;
      });
    }
  },
});
```

### 2.5 Agent Workspace Slice (Plan Display)

```typescript
// src/client/store/slices/agent-workspace.ts

export interface Plan {
  goal: string;
  phases: Array<{ id: number; title: string }>;
  currentPhaseId: number;
}

export interface AgentWorkspaceSlice {
  currentPlan: Plan | null;
  isAgentRunning: boolean;
  agentStatus: 'idle' | 'planning' | 'executing' | 'waiting' | 'completed' | 'error';
  tokensUsed: number;
  stepsCompleted: number;

  setPlan: (plan: Plan) => void;
  advancePlan: (phaseId: number) => void;
  setAgentStatus: (status: AgentWorkspaceSlice['agentStatus']) => void;
  setAgentRunning: (running: boolean) => void;
  updateMetrics: (tokens: number, steps: number) => void;
}

export const createAgentWorkspaceSlice: StateCreator<AgentWorkspaceSlice, [['zustand/immer', never]]> = (set) => ({
  currentPlan: null,
  isAgentRunning: false,
  agentStatus: 'idle',
  tokensUsed: 0,
  stepsCompleted: 0,

  setPlan: (plan) => set((state) => {
    state.currentPlan = plan;
    state.agentStatus = 'planning';
  }),

  advancePlan: (phaseId) => set((state) => {
    if (state.currentPlan) {
      state.currentPlan.currentPhaseId = phaseId;
    }
  }),

  setAgentStatus: (status) => set((state) => { state.agentStatus = status; }),
  setAgentRunning: (running) => set((state) => { state.isAgentRunning = running; }),
  updateMetrics: (tokens, steps) => set((state) => {
    state.tokensUsed = tokens;
    state.stepsCompleted = steps;
  }),
});
```

---

## 3. WebSocket Hook — The Real-Time Engine

This hook connects to the WebSocket server and dispatches events to the store.

```typescript
// src/client/hooks/useWebSocket.ts

import { useEffect, useRef, useCallback } from 'react';
import { useStore } from '../store';
import { nanoid } from 'nanoid';

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  const token = useStore((s) => s.token);
  const currentSessionId = useStore((s) => s.currentSessionId);
  const addTimelineEvent = useStore((s) => s.addTimelineEvent);
  const setPlan = useStore((s) => s.setPlan);
  const advancePlan = useStore((s) => s.advancePlan);
  const setAgentRunning = useStore((s) => s.setAgentRunning);
  const setAgentStatus = useStore((s) => s.setAgentStatus);
  const addNotification = useStore((s) => s.addNotification);

  const connect = useCallback(() => {
    if (!token) return;

    const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws?token=${token}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      useStore.setState({ wsConnected: true, wsReconnecting: false });

      // Subscribe to current session
      if (currentSessionId) {
        ws.send(JSON.stringify({ type: 'subscribe', sessionId: currentSessionId }));
      }

      // Start heartbeat
      const heartbeat = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 30000);

      ws.addEventListener('close', () => clearInterval(heartbeat));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      handleWebSocketEvent(data);
    };

    ws.onclose = () => {
      useStore.setState({ wsConnected: false });
      // Reconnect after 3 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        useStore.setState({ wsReconnecting: true });
        connect();
      }, 3000);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    wsRef.current = ws;
  }, [token, currentSessionId]);

  // ============================================================
  // HANDLE ALL WEBSOCKET EVENTS
  // ============================================================
  const handleWebSocketEvent = useCallback((event: any) => {
    const sessionId = currentSessionId;
    if (!sessionId) return;

    switch (event.type) {
      // ---- MESSAGE ----
      case 'message':
        addTimelineEvent(sessionId, {
          id: nanoid(),
          type: 'message',
          timestamp: event.timestamp || Date.now(),
          data: {
            role: event.role,
            content: event.content,
            contentType: event.messageType,
            attachments: event.attachments,
          },
        });

        if (event.role === 'assistant') {
          setAgentRunning(true);
          setAgentStatus('executing');
        }
        break;

      // ---- TOOL CALL (started) ----
      case 'tool_call':
        addTimelineEvent(sessionId, {
          id: event.toolCallId,
          type: 'tool_call',
          timestamp: event.timestamp || Date.now(),
          data: {
            toolName: event.toolName,
            args: event.args,
            status: 'running',
          },
        });
        setAgentStatus('executing');
        break;

      // ---- TOOL RESULT (completed) ----
      case 'tool_result':
        // Update the existing tool_call event with its result
        useStore.setState((state) => {
          const events = state.segmentEventsMap[sessionId];
          if (events) {
            const toolCallEvent = events.find(e => e.id === event.toolCallId);
            if (toolCallEvent) {
              toolCallEvent.data.result = event.result;
              toolCallEvent.data.status = 'completed';
            }
          }
        });
        break;

      // ---- PLAN UPDATE ----
      case 'plan_update':
        setPlan({
          goal: event.plan.goal,
          phases: event.plan.phases,
          currentPhaseId: event.plan.currentPhaseId,
        });
        setAgentStatus('planning');
        break;

      // ---- PLAN ADVANCE ----
      case 'plan_advance':
        advancePlan(event.currentPhaseId);
        break;

      // ---- TASK FINISHED ----
      case 'task_finished':
        setAgentRunning(false);
        setAgentStatus(event.status === 'completed' ? 'completed' : 'idle');
        useStore.setState((state) => {
          state.tokensUsed = event.tokensUsed || 0;
          state.stepsCompleted = event.steps || 0;
        });
        break;

      // ---- BROWSER SCREENSHOT ----
      case 'browser_screenshot':
        useStore.setState((state) => {
          state.browserScreenshotUrl = event.url;
          state.browserPageUrl = event.pageUrl;
        });
        break;

      // ---- ERROR ----
      case 'error':
        addNotification({
          id: nanoid(),
          type: 'error',
          message: event.message,
          timestamp: Date.now(),
        });
        setAgentStatus('error');
        break;

      // ---- MAP PROGRESS ----
      case 'map_started':
      case 'map_progress':
      case 'map_completed':
        addTimelineEvent(sessionId, {
          id: nanoid(),
          type: 'tool_call',
          timestamp: Date.now(),
          data: { ...event, toolName: 'map' },
        });
        break;

      // ---- TEXT DELTA (streaming) ----
      case 'text_delta':
        // Append to the last assistant message
        useStore.setState((state) => {
          const events = state.segmentEventsMap[sessionId];
          if (events) {
            const lastMsg = [...events].reverse().find(
              e => e.type === 'message' && e.data.role === 'assistant'
            );
            if (lastMsg) {
              lastMsg.data.content = (lastMsg.data.content || '') + event.content;
            }
          }
        });
        break;
    }
  }, [currentSessionId]);

  // Connect on mount
  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, [connect]);

  // Resubscribe when session changes
  useEffect(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN && currentSessionId) {
      wsRef.current.send(JSON.stringify({ type: 'subscribe', sessionId: currentSessionId }));
    }
  }, [currentSessionId]);
}
```

---

## 4. Core UI Components

### 4.1 Timeline Component — The Main Chat View

```tsx
// src/client/components/Timeline.tsx

import React from 'react';
import { useStore } from '../store';
import { ToolCallCard } from './ToolCallCard';
import { MessageBubble } from './MessageBubble';
import { PlanUpdateCard } from './PlanUpdateCard';

export function Timeline() {
  const currentSessionId = useStore((s) => s.currentSessionId);
  const events = useStore((s) => s.segmentEventsMap[currentSessionId || ''] || []);
  const bottomRef = React.useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new events
  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events.length]);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {events.map((event) => {
        switch (event.type) {
          case 'message':
            return (
              <MessageBubble
                key={event.id}
                role={event.data.role}
                content={event.data.content}
                contentType={event.data.contentType}
                attachments={event.data.attachments}
                timestamp={event.timestamp}
              />
            );

          case 'tool_call':
            return (
              <ToolCallCard
                key={event.id}
                toolName={event.data.toolName}
                args={event.data.args}
                result={event.data.result}
                status={event.data.status}
                timestamp={event.timestamp}
              />
            );

          case 'plan_update':
            return (
              <PlanUpdateCard
                key={event.id}
                goal={event.data.goal}
                phases={event.data.phases}
              />
            );

          default:
            return null;
        }
      })}
      <div ref={bottomRef} />
    </div>
  );
}
```

### 4.2 Tool Call Card — Collapsible Tool Display

```tsx
// src/client/components/ToolCallCard.tsx

import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Terminal, FileText, Globe, Search, Image, Clock } from 'lucide-react';

const TOOL_ICONS: Record<string, React.ElementType> = {
  shell: Terminal,
  file: FileText,
  browser: Globe,
  search: Search,
  generate: Image,
  schedule: Clock,
};

const TOOL_LABELS: Record<string, string> = {
  shell: 'Running command',
  file: 'File operation',
  browser: 'Browsing web',
  search: 'Searching',
  generate: 'Generating image',
  plan: 'Updating plan',
  message: 'Sending message',
  match: 'Searching files',
  map: 'Parallel processing',
  expose: 'Exposing port',
  schedule: 'Scheduling task',
};

interface ToolCallCardProps {
  toolName: string;
  args: any;
  result: any;
  status: 'running' | 'completed' | 'error';
  timestamp: number;
}

export function ToolCallCard({ toolName, args, result, status, timestamp }: ToolCallCardProps) {
  const [expanded, setExpanded] = useState(false);
  const Icon = TOOL_ICONS[toolName] || Terminal;
  const label = TOOL_LABELS[toolName] || toolName;

  return (
    <div className="border border-border rounded-lg bg-muted/30 overflow-hidden">
      {/* Header — always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors"
      >
        <Icon className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium">{label}</span>

        {/* Brief summary */}
        <span className="text-xs text-muted-foreground truncate flex-1 text-left">
          {toolName === 'shell' && args?.command?.substring(0, 60)}
          {toolName === 'file' && `${args?.action} ${args?.path?.split('/').pop()}`}
          {toolName === 'browser' && args?.url?.substring(0, 60)}
          {toolName === 'search' && args?.queries?.[0]?.substring(0, 60)}
        </span>

        {/* Status indicator */}
        {status === 'running' && (
          <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
        )}
        {status === 'completed' && (
          <div className="w-2 h-2 rounded-full bg-green-500" />
        )}
        {status === 'error' && (
          <div className="w-2 h-2 rounded-full bg-red-500" />
        )}

        {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-border p-3 space-y-3">
          {/* Arguments */}
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-1">Input</div>
            <pre className="text-xs bg-background p-2 rounded overflow-x-auto max-h-40">
              {JSON.stringify(args, null, 2)}
            </pre>
          </div>

          {/* Result */}
          {result && (
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">Output</div>
              <pre className="text-xs bg-background p-2 rounded overflow-x-auto max-h-60">
                {typeof result === 'string' ? result : JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

### 4.3 Chat Input Component

```tsx
// src/client/components/ChatInput.tsx

import React, { useState, useRef } from 'react';
import { Send, Paperclip, Mic, X } from 'lucide-react';
import { useStore } from '../store';

export function ChatInput() {
  const [input, setInput] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const currentSessionId = useStore((s) => s.currentSessionId);
  const isAgentRunning = useStore((s) => s.isAgentRunning);
  const token = useStore((s) => s.token);
  const createSession = useStore((s) => s.createSession);

  const sendMessage = async () => {
    if (!input.trim() && files.length === 0) return;

    let sessionId = currentSessionId;

    // Create session if none exists
    if (!sessionId) {
      const session = await createSession(input.substring(0, 50));
      sessionId = session.id;
    }

    // Upload files first
    const uploadedFiles = [];
    for (const file of files) {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('sessionId', sessionId);

      const res = await fetch('/api/files/upload', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      uploadedFiles.push(data);
    }

    // Send message
    await fetch(`/api/sessions/${sessionId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        content: input,
        attachments: uploadedFiles.map(f => f.url),
      }),
    });

    setInput('');
    setFiles([]);
  };

  // Voice recording
  const toggleRecording = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
    } else {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const file = new File([blob], 'voice-message.webm', { type: 'audio/webm' });
        setFiles([...files, file]);
        stream.getTracks().forEach(t => t.stop());
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    }
  };

  return (
    <div className="border-t border-border p-4">
      {/* File previews */}
      {files.length > 0 && (
        <div className="flex gap-2 mb-2 flex-wrap">
          {files.map((file, i) => (
            <div key={i} className="flex items-center gap-1 bg-muted px-2 py-1 rounded text-xs">
              <span>{file.name}</span>
              <button onClick={() => setFiles(files.filter((_, j) => j !== i))}>
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2">
        {/* File upload */}
        <button onClick={() => fileInputRef.current?.click()} className="p-2 hover:bg-muted rounded">
          <Paperclip className="w-5 h-5" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => setFiles([...files, ...Array.from(e.target.files || [])])}
        />

        {/* Voice */}
        <button
          onClick={toggleRecording}
          className={`p-2 rounded ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'hover:bg-muted'}`}
        >
          <Mic className="w-5 h-5" />
        </button>

        {/* Text input */}
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
          placeholder={isAgentRunning ? 'Agent is working...' : 'Send a message...'}
          className="flex-1 resize-none border border-border rounded-lg p-3 bg-background focus:outline-none focus:ring-2 focus:ring-ring min-h-[44px] max-h-[200px]"
          rows={1}
        />

        {/* Send */}
        <button
          onClick={sendMessage}
          disabled={!input.trim() && files.length === 0}
          className="p-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
        >
          <Send className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
```

### 4.4 Plan Sidebar

```tsx
// src/client/components/PlanSidebar.tsx

import React from 'react';
import { useStore } from '../store';
import { CheckCircle2, Circle, Loader2 } from 'lucide-react';

export function PlanSidebar() {
  const plan = useStore((s) => s.currentPlan);
  const agentStatus = useStore((s) => s.agentStatus);
  const tokensUsed = useStore((s) => s.tokensUsed);

  if (!plan) return null;

  return (
    <div className="w-72 border-l border-border bg-muted/20 p-4 overflow-y-auto">
      <h3 className="font-semibold text-sm mb-1">Task Plan</h3>
      <p className="text-xs text-muted-foreground mb-4">{plan.goal}</p>

      <div className="space-y-2">
        {plan.phases.map((phase) => {
          const isCurrent = phase.id === plan.currentPhaseId;
          const isCompleted = phase.id < plan.currentPhaseId;

          return (
            <div
              key={phase.id}
              className={`flex items-start gap-2 p-2 rounded text-sm ${
                isCurrent ? 'bg-primary/10 border border-primary/20' : ''
              }`}
            >
              {isCompleted && <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />}
              {isCurrent && <Loader2 className="w-4 h-4 text-primary animate-spin mt-0.5 shrink-0" />}
              {!isCompleted && !isCurrent && <Circle className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />}
              <span className={isCompleted ? 'text-muted-foreground line-through' : ''}>
                {phase.title}
              </span>
            </div>
          );
        })}
      </div>

      {/* Metrics */}
      <div className="mt-6 pt-4 border-t border-border space-y-2">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Status</span>
          <span className="capitalize">{agentStatus}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Tokens used</span>
          <span>{tokensUsed.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}
```

---

## 5. App Layout

```tsx
// src/client/App.tsx

import React from 'react';
import { Route, Switch } from 'wouter';
import { useWebSocket } from './hooks/useWebSocket';
import { useStore } from './store';
import { SessionList } from './components/SessionList';
import { Timeline } from './components/Timeline';
import { ChatInput } from './components/ChatInput';
import { PlanSidebar } from './components/PlanSidebar';
import { Login } from './pages/Login';

function AgentChat() {
  useWebSocket(); // Connect to WebSocket

  const sidebarOpen = useStore((s) => s.sidebarOpen);
  const currentPlan = useStore((s) => s.currentPlan);

  return (
    <div className="h-screen flex bg-background text-foreground">
      {/* Left sidebar: Sessions */}
      {sidebarOpen && (
        <div className="w-64 border-r border-border">
          <SessionList />
        </div>
      )}

      {/* Center: Chat */}
      <div className="flex-1 flex flex-col min-w-0">
        <Timeline />
        <ChatInput />
      </div>

      {/* Right sidebar: Plan */}
      {currentPlan && <PlanSidebar />}
    </div>
  );
}

export default function App() {
  const isAuthenticated = useStore((s) => s.isAuthenticated);

  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/">{isAuthenticated ? <AgentChat /> : <Login />}</Route>
    </Switch>
  );
}
```
