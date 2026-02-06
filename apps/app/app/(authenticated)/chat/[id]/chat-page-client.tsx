"use client";

// Import tool animations CSS
import "@repo/ai/components/tools/tool-animations.css";

import * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import {
  setMessages as setReduxMessages,
  setStreaming,
  setCurrentStreamingSession,
  setChatLoading,
  setChatError,
  type Message,
} from "@/lib/store/slices/chat.slice";
import { setSelectedAgent, type Agent, type AgentTask } from "@/lib/store/slices/agents.slice";
import { updateSession as updateSessionInStore } from "@/lib/store/slices/sessions.slice";
import { useAgentsData } from "@/lib/store/hooks/useAgentsData";
import { useSocket } from "@/lib/socket/provider";
import { ChatContainer, MessageList, AgentDagPanel } from "@repo/ai/components";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage as AIUIMessage } from "ai";
import type { UIMessage, MessagePart, Attachment } from "@repo/ai/lib/types";
import {
  UnifiedPrompt,
  type UnifiedPromptRef,
  type SubmitOptions,
} from "@/app/(authenticated)/components/unified-prompt";
import { SourcesPanel } from "./components/sources-panel";
import { ConnectionStatus } from "./components/connection-status";
import { getTrpcClient } from "@/lib/trpc/vanilla";

// ============================================================================
// Component
// ============================================================================

interface ChatPageClientProps {
  sessionId: string;
  initialMessages?: Message[];
  user?: {
    name?: string | null;
    email: string;
    image?: string | null;
  };
}

export function ChatPageClient({ sessionId, initialMessages = [], user }: ChatPageClientProps) {
  const dispatch = useAppDispatch();
  const composerRef = React.useRef<UnifiedPromptRef>(null);
  const hasLoadedRef = useRef(false);

  // Model state
  const [selectedModel, setSelectedModel] = useState<string | undefined>(undefined);

  // Redux state
  const reduxMessages = useAppSelector((state) => state.chat.messages[sessionId] ?? []);
  const isStreaming = useAppSelector((state) => state.chat.isStreaming);
  const { agents, tasks } = useAgentsData(sessionId, { autoFetch: false });
  const selectedAgentId = useAppSelector((state) => state.agents.selectedAgentId);

  // Socket connection
  const { isConnected, joinRoom, leaveRoom } = useSocket();

  // Local UI state
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarType, setSidebarType] = useState<"sources" | "agents" | null>(null);

  // Convert redux messages to UIMessage format
  const initialUIMessages = useMemo<UIMessage[]>(() => {
    const msgs = initialMessages.length > 0 ? initialMessages : reduxMessages;
    return msgs.map((msg: Message) => ({
      id: msg.id,
      role: msg.role as "user" | "assistant" | "system",
      parts: [{ type: "text" as const, text: msg.content }],
      metadata: msg.metadata,
      createdAt: new Date(msg.createdAt),
    }));
  }, [initialMessages, reduxMessages]);

  // Initial load (HTTP-first)
  useEffect(() => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;

    if (initialMessages.length > 0) {
      dispatch(setReduxMessages({ sessionId, messages: initialMessages }));
      return;
    }

    if (reduxMessages.length > 0) return;

    dispatch(setChatLoading(true));
    getTrpcClient()
      .messages.list.query({ sessionId })
      .then((messages) => {
        const mapped: Message[] = messages.map((m: any) => ({
          id: m.id,
          sessionId: m.sessionId,
          role: m.role,
          content: m.content,
          createdAt: m.createdAt?.toISOString?.() ?? new Date().toISOString(),
          metadata: m.metadata ?? undefined,
        }));
        dispatch(setReduxMessages({ sessionId, messages: mapped }));
      })
      .catch((error: any) => {
        dispatch(setChatError(error?.message || "Failed to load messages"));
      })
      .finally(() => {
        dispatch(setChatLoading(false));
      });
  }, [dispatch, initialMessages, reduxMessages.length, sessionId]);

  // AI SDK v6 transport (stable ref, created once)
  const transportRef = useRef(new DefaultChatTransport({ api: "/api/chat" }));

  // AI SDK v6 useChat — official hook handles streaming, state, and rendering correctly
  const {
    messages: rawMessages,
    setMessages: setRawMessages,
    status,
    error,
    sendMessage: sdkSendMessage,
    stop,
    regenerate,
    addToolApprovalResponse,
  } = useChat({
    id: sessionId,
    transport: transportRef.current,
    experimental_throttle: 50,
    onFinish: ({ messages: finishedMessages }) => {
      // Sync to Redux
      const reduxMsgs: Message[] = finishedMessages.map((m) => ({
        id: m.id,
        sessionId,
        role: m.role,
        content: (m.parts ?? [])
          .filter((p) => p.type === "text" && "text" in p)
          .map((p) => (p as { type: "text"; text: string }).text ?? "")
          .join(""),
        createdAt: new Date().toISOString(),
        metadata: m.metadata as Record<string, unknown> | undefined,
      }));
      dispatch(setReduxMessages({ sessionId, messages: reduxMsgs }));

      // Bump session updatedAt so sidebar re-sorts this chat to the top
      dispatch(
        updateSessionInStore({ id: sessionId, updates: { updatedAt: new Date().toISOString() } })
      );
    },
    onError: (err) => {
      console.error("Chat error:", err);
    },
  });

  // Cast AI SDK messages to our custom UIMessage type for rendering components.
  // Both types are structurally compatible at runtime.
  const messages = rawMessages as unknown as UIMessage[];
  const setMessages = setRawMessages as unknown as (
    msgs: UIMessage[] | ((prev: UIMessage[]) => UIMessage[])
  ) => void;

  // Wrap sendMessage to always include chatId/sessionId in body
  const sendMessage = useCallback(
    (
      text: string,
      options?: { body?: Record<string, unknown>; headers?: Record<string, string> }
    ) => {
      const body = { chatId: sessionId, ...(options?.body ?? {}) };
      return sdkSendMessage({ text }, { ...options, body });
    },
    [sdkSendMessage, sessionId]
  );

  // Sync DB-loaded messages into useChat state after initial load.
  // The hook creates the Chat object on first render — async DB loads
  // won't be picked up unless we explicitly call setMessages.
  const hasSyncedRef = useRef(false);
  useEffect(() => {
    // Only sync once, don't overwrite during streaming, and only when we have data
    if (hasSyncedRef.current) return;
    if (status === "streaming" || status === "submitted") return;
    if (initialUIMessages.length === 0) return;
    // Don't overwrite if the hook already has messages (e.g. from sessionStorage auto-send)
    if (messages.length > 0) {
      hasSyncedRef.current = true;
      return;
    }
    hasSyncedRef.current = true;
    setMessages(initialUIMessages);
  }, [initialUIMessages, messages.length, status, setMessages]);

  // Use messages directly so text streams in real-time.
  // useDeferredValue was deferring MessageList updates during rapid streaming,
  // causing text to only appear after streaming finished (or on refresh).

  // ============================================================================
  // Session storage initial message consumer
  // ============================================================================

  const initialConsumedRef = React.useRef(false);
  useEffect(() => {
    if (initialConsumedRef.current) return;
    const key = `chat-${sessionId}-initial`;
    const stored = sessionStorage.getItem(key);
    if (!stored) return;

    initialConsumedRef.current = true;
    sessionStorage.removeItem(key);

    try {
      const { parts, model } = JSON.parse(stored) as {
        parts: MessagePart[];
        model?: string;
      };

      if (model) {
        setSelectedModel(model);
      }

      const textPart = parts?.find((p): p is { type: "text"; text: string } => p.type === "text");
      if (textPart?.text) {
        setTimeout(() => {
          sendMessage(textPart.text, { body: { model } });
        }, 100);
      }
    } catch {
      // Ignore parse errors
    }
  }, [sessionId, sendMessage]);

  // Join/leave room on mount
  useEffect(() => {
    if (isConnected) {
      joinRoom(sessionId);
    }
    return () => {
      if (isConnected) {
        leaveRoom(sessionId);
      }
    };
  }, [sessionId, isConnected, joinRoom, leaveRoom]);

  // Update streaming state in Redux
  useEffect(() => {
    const isActive = status === "streaming" || status === "submitted";
    dispatch(setStreaming(isActive));
    if (isActive) {
      dispatch(setCurrentStreamingSession(sessionId));
    } else {
      dispatch(setCurrentStreamingSession(null));
    }
  }, [status, sessionId, dispatch]);

  // Handle send message from UnifiedPrompt
  const handleSendMessage = useCallback(
    (input: string, attachments: Attachment[], options: SubmitOptions) => {
      if (options.model) {
        setSelectedModel(options.model);
      }

      sendMessage(input, { body: { model: options.model } });
    },
    [sendMessage]
  );

  // Handle message action
  const handleMessageAction = useCallback(
    (action: string, messageId: string) => {
      switch (action) {
        case "regenerate":
          regenerate({ messageId });
          break;
        case "copy":
          break;
        case "edit":
          break;
        case "delete":
          break;
      }
    },
    [regenerate]
  );

  // Handle tool approval
  const handleToolApproval = useCallback(
    (toolCallId: string, approved: boolean, reason?: string) => {
      addToolApprovalResponse({ id: toolCallId, approved, reason });
    },
    [addToolApprovalResponse]
  );

  // Handle agent select
  const handleAgentSelect = useCallback(
    (agentId: string) => {
      dispatch(setSelectedAgent(agentId === selectedAgentId ? null : agentId));
      setSidebarType("agents");
      setSidebarOpen(true);
    },
    [dispatch, selectedAgentId]
  );

  // Convert agents to AgentData format
  const agentData = useMemo(() => {
    return agents.map((agent: Agent) => ({
      id: agent.id,
      type: agent.type,
      name: agent.name,
      status: agent.status,
      currentTask: agent.currentTask,
      progress: agent.progress,
      tasks: (tasks[agent.id] ?? []).map((task: AgentTask) => ({
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status,
        startedAt: task.startedAt,
        completedAt: task.completedAt,
      })),
      metadata: agent.metadata,
    }));
  }, [agents, tasks]);

  // Collect sources from messages
  const sources = useMemo(() => {
    return messages.flatMap((msg) =>
      msg.parts
        .filter((p) => p.type === "source-url" || p.type === "source-document")
        .map(
          (p) =>
            p as {
              type: "source-url" | "source-document";
              sourceId: string;
              url?: string;
              title?: string;
            }
        )
    );
  }, [messages]);

  return (
    <ChatContainer
      className="h-full"
      header={
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-medium">Chat</h1>
            <ConnectionStatus isConnected={isConnected} />
          </div>
          {sources.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setSidebarType("sources");
                setSidebarOpen(!sidebarOpen || sidebarType !== "sources");
              }}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              {sources.length} sources
            </button>
          )}
        </div>
      }
      footer={
        <div className="px-4 pb-4 pt-2">
          <div className="mx-auto max-w-3xl space-y-3">
            {/* Agent DAG (multi-agent only) */}
            {agentData.length > 0 && (
              <AgentDagPanel
                agents={agentData}
                selectedAgentId={selectedAgentId}
                onAgentSelect={handleAgentSelect}
                compact
              />
            )}

            {/* Prompt */}
            <UnifiedPrompt
              ref={composerRef}
              onSubmit={handleSendMessage}
              onCancel={stop}
              disabled={status === "submitted"}
              isStreaming={status === "streaming"}
              initialModel={selectedModel}
              showAnimatedPlaceholder={false}
            />
          </div>
        </div>
      }
      sidebar={
        sidebarType === "sources" ? (
          <SourcesPanel sources={sources} onClose={() => setSidebarOpen(false)} />
        ) : undefined
      }
      sidebarOpen={sidebarOpen}
      sidebarPosition="right"
    >
      <div className="mx-auto h-full max-w-3xl">
        <MessageList
          messages={messages}
          isStreaming={status === "streaming" || status === "submitted"}
          onMessageAction={handleMessageAction}
          onToolApproval={handleToolApproval}
          emptyState={
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
                <span className="text-2xl">✨</span>
              </div>
              <div>
                <h2 className="text-lg font-medium">Start a conversation</h2>
                <p className="text-sm text-muted-foreground">Ask anything to get started</p>
              </div>
            </div>
          }
        />
      </div>
    </ChatContainer>
  );
}
