"use client";

import * as React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import {
  setMessages as setReduxMessages,
  addMessage,
  setStreaming,
  setCurrentStreamingMessage,
  setInputValue,
  type Message,
} from "@/lib/store/slices/chat.slice";
import { setSelectedAgent, type Agent, type AgentTask } from "@/lib/store/slices/agents.slice";
import { useSocket } from "@/lib/socket/provider";
import {
  ChatContainer,
  MessageList,
  ChatComposer,
  AgentDagPanel,
  type ChatComposerRef,
} from "@repo/ai/components";
import { useRealTimeChat } from "@repo/ai/hooks";
import type { UIMessage, MessagePart } from "@repo/ai/lib/types";
import type { ChatAttachment } from "@repo/ai/components/input/chat-composer";

// Extended attachment with file reference for local use
interface LocalAttachment extends ChatAttachment {
  file?: File;
}
import { SourcesPanel } from "./components/sources-panel";
import { ConnectionStatus } from "./components/connection-status";

interface ChatPageClientProps {
  sessionId: string;
  initialMessages?: Message[];
  user?: {
    name?: string | null;
    email: string;
    image?: string | null;
  };
}

/**
 * ChatPageClient - Main chat page client component with Redux integration
 */
export function ChatPageClient({ sessionId, initialMessages = [], user }: ChatPageClientProps) {
  const dispatch = useAppDispatch();
  const composerRef = React.useRef<ChatComposerRef>(null);

  // Redux state
  const reduxMessages = useAppSelector((state) => state.chat.messages[sessionId] ?? []);
  const isStreaming = useAppSelector((state) => state.chat.isStreaming);
  const agents = useAppSelector((state) => state.agents.agents[sessionId] ?? []);
  const tasks = useAppSelector((state) => state.agents.tasks);
  const selectedAgentId = useAppSelector((state) => state.agents.selectedAgentId);

  // Socket connection
  const { isConnected, joinRoom, leaveRoom } = useSocket();

  // Local UI state
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarType, setSidebarType] = useState<"sources" | "agents" | null>(null);
  const [attachments, setAttachments] = useState<LocalAttachment[]>([]);

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

  // Real-time chat hook
  const {
    messages,
    setMessages,
    status,
    error,
    sendMessage,
    stop,
    regenerate,
    addToolApprovalResponse,
    pendingToolCalls,
    hasToolsAwaitingApproval,
  } = useRealTimeChat({
    id: sessionId,
    messages: initialUIMessages,
    sessionId,
    api: "/api/chat",
    onFinish: ({ message, messages }) => {
      // Sync back to Redux
      const reduxMsgs: Message[] = messages.map((m) => ({
        id: m.id,
        sessionId,
        role: m.role,
        content: m.parts
          .filter((p) => p.type === "text")
          .map((p) => (p as { type: "text"; text: string }).text)
          .join(""),
        createdAt: m.createdAt?.toISOString() ?? new Date().toISOString(),
        metadata: m.metadata,
      }));
      dispatch(setReduxMessages({ sessionId, messages: reduxMsgs }));
    },
    onError: (err) => {
      console.error("Chat error:", err);
    },
  });

  // Consume initial message from home page (sessionStorage)
  const initialConsumedRef = React.useRef(false);
  useEffect(() => {
    if (initialConsumedRef.current) return;
    const key = `chat-${sessionId}-initial`;
    const stored = sessionStorage.getItem(key);
    if (!stored) return;

    initialConsumedRef.current = true;
    sessionStorage.removeItem(key);

    try {
      const { parts } = JSON.parse(stored) as { parts: MessagePart[] };
      const textPart = parts?.find((p): p is { type: "text"; text: string } => p.type === "text");
      if (textPart?.text) {
        // Small delay to let the hook initialize
        setTimeout(() => {
          sendMessage({ text: textPart.text });
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
    dispatch(setStreaming(status === "streaming"));
  }, [status, dispatch]);

  // Handle send message
  const handleSendMessage = useCallback(
    (parts: MessagePart[], files?: ChatAttachment[]) => {
      const textPart = parts.find((p) => p.type === "text") as
        | { type: "text"; text: string }
        | undefined;

      // Convert to LocalAttachment to access file property
      const localFiles = files as LocalAttachment[] | undefined;
      const fileArray = localFiles?.filter((f) => f.file).map((f) => f.file!);

      sendMessage({
        text: textPart?.text,
        files: fileArray,
      });

      // Clear attachments
      setAttachments([]);
    },
    [sendMessage]
  );

  // Handle file selection
  const handleFileSelect = useCallback((files: FileList) => {
    const newAttachments: LocalAttachment[] = Array.from(files).map((file, i) => ({
      id: `file-${Date.now()}-${i}`,
      name: file.name,
      type: file.type,
      size: file.size,
      file,
    }));
    setAttachments((prev) => [...prev, ...newAttachments]);
  }, []);

  // Handle message action
  const handleMessageAction = useCallback(
    (action: string, messageId: string) => {
      switch (action) {
        case "regenerate":
          regenerate({ messageId });
          break;
        case "copy":
          // Handled in component
          break;
        case "edit":
          // TODO: Implement edit
          break;
        case "delete":
          // TODO: Implement delete
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
        <div className="p-4">
          {/* Agent DAG */}
          {agentData.length > 0 && (
            <div className="mb-4">
              <AgentDagPanel
                agents={agentData}
                selectedAgentId={selectedAgentId}
                onAgentSelect={handleAgentSelect}
                compact
              />
            </div>
          )}

          {/* Composer */}
          <div className="mx-auto max-w-3xl">
            <ChatComposer
              ref={composerRef}
              onSubmit={handleSendMessage}
              onCancel={stop}
              isLoading={status === "submitted"}
              isStreaming={status === "streaming"}
              attachments={attachments}
              onAttachmentsChange={setAttachments}
              onFileSelect={handleFileSelect}
              placeholder="Ask anything..."
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
      <div className="mx-auto max-w-3xl">
        <MessageList
          messages={messages}
          isStreaming={status === "streaming"}
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
