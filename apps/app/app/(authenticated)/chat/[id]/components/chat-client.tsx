"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { useSocket } from "@/lib/socket/provider";
import { ToolRegistry, AgentCanvas, usePlannerState, PlannerBar } from "@repo/ai/components";
import { useE2BStream } from "@repo/ai/hooks/use-e2b-stream";
import { useE2BTerminal } from "@repo/ai/hooks/use-e2b-terminal";
import type { UIMessage as RepoUIMessage, SourceUrlUIPart, SourceDocumentUIPart, FileUIPart } from "@repo/ai/lib/types";
import type { Message as ReduxMessage } from "@/lib/store/slices/chat.slice";
import type { SubmitOptions } from "@/app/(authenticated)/components/unified-prompt/types";
import type { Attachment } from "@repo/ai/lib/types";
import type { LibraryFile } from "@/app/(authenticated)/files/components/library-file-card";
import { trpc } from "@/lib/trpc/client";
import { useAppDispatch } from "@/lib/store/hooks";
import { toggleSessionSwitch } from "@/lib/store/slices/sessionSwitch.slice";
import { SessionSwitchDialog } from "@/app/(authenticated)/components/session-switch-dialog";

// Hooks
import { useChatSession } from "../hooks/use-chat-session";
import { useCanvasPanel } from "../hooks/use-canvas-panel";
import { useFeedback } from "../hooks/use-feedback";
import { useInitialMessage } from "../hooks/use-initial-message";
import { useSSEToEntities } from "../hooks/use-sse-to-entities";
import { useCanvasFromEntities } from "../hooks/use-canvas-entities";

// Components
import { ChatHeader } from "./chat-header";
import { ChatLayout } from "./chat-layout";
import { ChatMessages } from "./chat-messages";
import { ChatPrompt } from "@/app/(authenticated)/components/chat-prompt/chat-prompt";
import { FileManagementPanel } from "./file-management-panel";
import { LibraryPreviewModal } from "@/app/(authenticated)/files/components/library-preview-modal";

// ============================================================================
// Types
// ============================================================================

interface ChatClientProps {
  sessionId: string;
  initialMessages?: ReduxMessage[];
  hasMoreMessages?: boolean;
  user?: {
    name?: string | null;
    email: string;
    image?: string | null;
  };
}

// ============================================================================
// Component
// ============================================================================

export function ChatClient({
  sessionId,
  initialMessages = [],
  hasMoreMessages = false,
  user,
}: ChatClientProps) {
  // Session switcher — Cmd+K global shortcut
  const dispatch = useAppDispatch();
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        dispatch(toggleSessionSwitch());
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [dispatch]);

  // Core chat hook — useChat is the source of truth
  const {
    messages,
    setMessages,
    status,
    isStreaming,
    sendMessage,
    stop,
    regenerate,
  } = useChatSession({ sessionId, initialMessages });

  // Cast for @repo/ai hooks
  const repoMessages = messages as unknown as RepoUIMessage[];

  // Bridge: normalize SSE tool parts into Redux websocket.toolEvents (dispatch-only, no selectors)
  useSSEToEntities(messages as unknown as import("ai").UIMessage[], sessionId, isStreaming);

  // Planner — derived from show_plan tool calls in messages.
  // Pass isStreaming so in_progress steps auto-complete when stream ends.
  const plannerState = usePlannerState(repoMessages, isStreaming);
  const [plannerExpanded, setPlannerExpanded] = useState(false);

  // Canvas — reads from Redux websocket.toolEvents via memoized selectors (Manus parity)
  const canvasState = useCanvasFromEntities(sessionId, isStreaming);

  // Live E2B browser — Neko WebRTC (preferred) or E2B stream or screenshot polling (fallback)
  const e2bBrowser = useE2BStream({
    sandboxId: canvasState.sandboxId,
    enabled: canvasState.viewType === "browser" && canvasState.isVisible,
    nekoUrl: canvasState.nekoUrl,
    streamUrl: canvasState.streamUrl,
  });

  // Sync polled screenshots into canvas state (flows through browserScreenshot → BrowserView)
  useEffect(() => {
    if (e2bBrowser.screenshot && canvasState.onBrowserScreenshotUpdate) {
      canvasState.onBrowserScreenshotUpdate(
        e2bBrowser.screenshot,
        e2bBrowser.url ?? undefined,
        e2bBrowser.title ?? undefined,
      );
    }
  }, [e2bBrowser.screenshot, e2bBrowser.url, e2bBrowser.title]); // eslint-disable-line react-hooks/exhaustive-deps

  // Live E2B terminal — WebSocket PTY stream
  const e2bTerminal = useE2BTerminal({
    sandboxId: canvasState.sandboxId,
    enabled: canvasState.viewType === "terminal" && canvasState.isVisible,
  });

  const { showCanvas, canvasFullscreen, onClose, onToggleFullscreen, forceOpen } =
    useCanvasPanel({
      sessionId,
      hasCanvasContent: canvasState.isVisible,
      isStreaming,
      messageCount: messages.length,
    });

  // Feedback — persisted 5-star ratings
  const { feedback, handleFeedback } = useFeedback(sessionId);

  // Auto-send queued message from dashboard
  useInitialMessage({ sessionId, sendMessage });

  // User control state — when user clicks "Take Control" in browser canvas,
  // the prompt pauses and the canvas switches to live Neko WebRTC stream.
  const [userControlActive, setUserControlActive] = useState(false);

  // Pagination — load earlier messages on demand
  const [hasMore, setHasMore] = useState(hasMoreMessages);
  const [loadingMore, setLoadingMore] = useState(false);
  const cursorRef = useRef<string | null>(
    hasMoreMessages && initialMessages.length > 0 ? initialMessages[0]!.id : null
  );
  const utils = trpc.useUtils();

  const handleLoadMore = useCallback(async () => {
    if (loadingMore || !hasMore || !cursorRef.current) return;
    setLoadingMore(true);
    try {
      const result = await utils.messages.listPaginated.fetch({
        sessionId,
        cursor: cursorRef.current,
        limit: 50,
      });
      if (result.messages.length > 0) {
        // Convert DB messages to UIMessage format and prepend
        const olderMessages = result.messages.map((m: any) => ({
          id: m.id,
          role: m.role as "user" | "assistant" | "system",
          parts: m.parts?.length
            ? (m.parts as any)
            : [{ type: "text" as const, text: m.content ?? "" }],
          metadata: m.metadata,
          createdAt: typeof m.createdAt === "string" ? m.createdAt : m.createdAt?.toISOString?.() ?? new Date().toISOString(),
        }));
        setMessages((prev: any[]) => [...olderMessages, ...prev]);
      }
      cursorRef.current = result.nextCursor;
      setHasMore(!!result.nextCursor);
    } catch (err) {
      console.error("Failed to load more messages:", err);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, sessionId, utils.messages.listPaginated, setMessages]);

  // File management panel
  const [filesPanelOpen, setFilesPanelOpen] = useState(false);

  // File preview modal — reuses LibraryPreviewModal from /files page
  const [previewFile, setPreviewFile] = useState<LibraryFile | null>(null);

  // Socket room join/leave
  const { isConnected, joinRoom, leaveRoom } = useSocket();
  useEffect(() => {
    if (isConnected) joinRoom(sessionId);
    return () => {
      if (isConnected) leaveRoom(sessionId);
    };
  }, [sessionId, isConnected, joinRoom, leaveRoom]);

  // Handlers
  const handleSendMessage = useCallback(
    (text: string, attachments: Attachment[] = [], options?: SubmitOptions) => {
      if (!text.trim() && attachments.length === 0) return;
      const body: Record<string, unknown> = {};
      if (options?.skills?.length) body.skills = options.skills;
      if (options?.connections?.length) body.connections = options.connections;
      sendMessage(
        text,
        Object.keys(body).length > 0 || attachments.length > 0
          ? { body, attachments }
          : undefined
      );
    },
    [sendMessage]
  );

  const handleToggleFileManagement = useCallback(() => {
    setFilesPanelOpen((prev) => !prev);
  }, []);

  // Open file deliverable in LibraryPreviewModal (same as /files page)
  const handlePreviewFile = useCallback(
    (file: FileUIPart) => {
      setPreviewFile({
        id: "",
        sessionId,
        name: file.filename ?? "file",
        path: file.filename ?? "file",
        mimeType: file.mediaType,
        size: null,
        storageKey: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        resolvedUrl: file.url,
      });
    },
    [sessionId]
  );

  // Pin a tool call to the canvas and force-open it
  const handleViewInCanvas = useCallback(
    (toolCallId: string) => {
      canvasState.onPinToolCall?.(toolCallId);
      forceOpen();
    },
    [canvasState, forceOpen]
  );

  // Open first source URL in browser canvas when sources are clicked
  const handleViewSources = useCallback(
    (sources: (SourceUrlUIPart | SourceDocumentUIPart)[]) => {
      const firstUrl = sources.find(
        (s): s is SourceUrlUIPart => s.type === "source-url"
      );
      if (firstUrl && canvasState.onBrowserNavigate) {
        // Force canvas to browser view and open it
        canvasState.onSelectView?.("browser");
        canvasState.onBrowserNavigate(firstUrl.url);
        forceOpen();
      } else if (firstUrl) {
        window.open(firstUrl.url, "_blank", "noopener,noreferrer");
      }
    },
    [canvasState, forceOpen]
  );

  return (
    <>
    <SessionSwitchDialog />
    <LibraryPreviewModal
      file={previewFile}
      onClose={() => setPreviewFile(null)}
      inlineContent={null}
    />
    <ToolRegistry>
      {/* Header */}
      <ChatHeader
        sessionId={sessionId}
        user={user ?? { email: "" }}
        messages={repoMessages}
        onToggleFileManagement={handleToggleFileManagement}
        isFileManagementOpen={filesPanelOpen}
      />

      {/* Main layout */}
      <ChatLayout
        canvas={
          showCanvas ? (
            <AgentCanvas
              viewType={canvasState.viewType}
              isFullscreen={canvasFullscreen}
              onToggleFullscreen={onToggleFullscreen}
              onClose={onClose}
              pinnedToolCallId={canvasState.pinnedToolCallId}
              onUnpin={canvasState.onUnpin}
              browserUrl={canvasState.browserUrl}
              browserScreenshot={canvasState.browserScreenshot}
              browserLoading={canvasState.browserLoading}
              browserContent={canvasState.browserContent}
              browserTitle={canvasState.browserTitle}
              browserSearchResults={canvasState.browserSearchResults}
              onBrowserNavigate={canvasState.onBrowserNavigate}
              onBrowserBack={canvasState.onBrowserBack}
              onBrowserForward={canvasState.onBrowserForward}
              onBrowserRefresh={canvasState.onBrowserRefresh}
              onBrowserScreenshotUpdate={canvasState.onBrowserScreenshotUpdate}
              canGoBack={canvasState.canGoBack}
              canGoForward={canvasState.canGoForward}
              fileTree={canvasState.fileTree}
              fileTabs={canvasState.fileTabs}
              activeFileContent={canvasState.activeFileContent}
              activeFileLanguage={canvasState.activeFileLanguage}
              onSelectFile={canvasState.onSelectFile}
              onSelectTab={canvasState.onSelectTab}
              onCloseTab={canvasState.onCloseTab}
              previewUrl={canvasState.previewUrl}
              fileContents={canvasState.allFileContents}
              terminalOutput={canvasState.terminalOutput}
              liveTerminalOutput={e2bTerminal.output}
              liveTerminalConnected={e2bTerminal.isConnected}
              onTerminalSendInput={e2bTerminal.sendInput}
              terminalSessions={canvasState.terminalSessions}
              activeTerminalSession={canvasState.activeTerminalSession}
              terminalSessionIds={canvasState.terminalSessionIds}
              onSelectTerminalSession={canvasState.onSelectTerminalSession}
              nekoUrl={canvasState.nekoUrl}
              streamUrl={canvasState.streamUrl}
              onUserControlChange={setUserControlActive}
              sandboxId={canvasState.sandboxId}
              previewFileName={canvasState.previewFileName}
              previewContent={canvasState.previewContent}
              previewFileType={canvasState.previewFileType}
              slides={canvasState.slides}
              currentSlideIndex={canvasState.currentSlideIndex}
              mapReduceTasks={canvasState.mapReduceTasks}
              mapReduceOverallProgress={canvasState.mapReduceOverallProgress}
              aiCanvasContent={canvasState.aiCanvasContent}
              timelinePercentage={canvasState.timelinePercentage}
              onTimelineChange={canvasState.onTimelineChange}
              currentStep={canvasState.currentStep}
              totalSteps={canvasState.totalSteps}
              currentAction={canvasState.currentAction}
              statusText={canvasState.statusText}
              isWorking={canvasState.isWorking}
              availableViews={canvasState.availableViews}
              onSelectView={canvasState.onSelectView}
            />
          ) : undefined
        }
        filePanel={
          filesPanelOpen ? (
            <FileManagementPanel
              messages={repoMessages}
              sessionId={sessionId}
              onClose={() => setFilesPanelOpen(false)}
            />
          ) : undefined
        }
      >
        {/* Messages */}
        <ChatMessages
          messages={messages}
          status={status}
          isStreaming={isStreaming}
          feedback={feedback}
          hasMore={hasMore}
          loadingMore={loadingMore}
          onSendMessage={handleSendMessage}
          onRegenerate={regenerate}
          onFeedback={handleFeedback}
          onLoadMore={handleLoadMore}
          onViewSources={handleViewSources}
          onViewInCanvas={handleViewInCanvas}
          onPreviewFile={handlePreviewFile}
        />

        {/* Planner bar — above prompt, only visible when agent calls show_plan */}
        {plannerState.hasSteps && (
          <PlannerBar
            state={plannerState}
            isExpanded={plannerExpanded}
            onToggleExpanded={() => setPlannerExpanded((p) => !p)}
          />
        )}

        {/* Prompt — pinned to bottom */}
        <div className="shrink-0 bg-background">
          <div className="mx-auto w-full max-w-3xl px-4 pb-4">
            <ChatPrompt
              onSubmit={(text, attachments, options) => handleSendMessage(text, attachments, options)}
              onCancel={stop}
              isStreaming={isStreaming}
              disabled={userControlActive}
              showQuickActions={false}
              showAnimatedPlaceholder={messages.length === 0}
              placeholder={userControlActive ? "You have browser control — release to resume chat" : messages.length > 0 ? "Ask anything..." : undefined}
            />
          </div>
        </div>
      </ChatLayout>
    </ToolRegistry>
    </>
  );
}
