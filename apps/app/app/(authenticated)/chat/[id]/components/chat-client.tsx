"use client";

import { useCallback, useEffect, useState } from "react";
import { useSocket } from "@/lib/socket/provider";
import { ToolRegistry, AgentCanvas, useCanvas, usePlannerState, PlannerBar } from "@repo/ai/components";
import type { UIMessage as RepoUIMessage, SourceUrlUIPart, SourceDocumentUIPart } from "@repo/ai/lib/types";
import type { Message as ReduxMessage } from "@/lib/store/slices/chat.slice";

// Hooks
import { useChatSession } from "../hooks/use-chat-session";
import { useCanvasPanel } from "../hooks/use-canvas-panel";
import { useFeedback } from "../hooks/use-feedback";
import { useInitialMessage } from "../hooks/use-initial-message";

// Components
import { ChatHeader } from "./chat-header";
import { ChatLayout } from "./chat-layout";
import { ChatMessages } from "./chat-messages";
import { ChatPrompt } from "@/app/(authenticated)/components/chat-prompt/chat-prompt";
import { FileManagementPanel } from "./file-management-panel";

// ============================================================================
// Types
// ============================================================================

interface ChatClientProps {
  sessionId: string;
  initialMessages?: ReduxMessage[];
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
  user,
}: ChatClientProps) {
  // Core chat hook — useChat is the source of truth
  const {
    messages,
    status,
    isStreaming,
    sendMessage,
    stop,
    regenerate,
  } = useChatSession({ sessionId, initialMessages });

  // Cast for @repo/ai hooks
  const repoMessages = messages as unknown as RepoUIMessage[];

  // Planner — derived from show_plan tool calls in messages
  const plannerState = usePlannerState(repoMessages);
  const [plannerExpanded, setPlannerExpanded] = useState(false);

  // Canvas
  const canvasState = useCanvas(repoMessages);
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

  // File management panel
  const [filesPanelOpen, setFilesPanelOpen] = useState(false);

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
    (text: string) => {
      if (!text.trim()) return;
      sendMessage(text);
    },
    [sendMessage]
  );

  const handleToggleFileManagement = useCallback(() => {
    setFilesPanelOpen((prev) => !prev);
  }, []);

  // Pin a tool call to the canvas and force-open it
  const handleViewInCanvas = useCallback(
    (toolCallId: string) => {
      canvasState.onPinToolCall?.(toolCallId);
      forceOpen();
    },
    [canvasState.onPinToolCall, forceOpen]
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
    [canvasState.onBrowserNavigate, canvasState.onSelectView, forceOpen]
  );

  return (
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
              fileContents={canvasState.fileContents}
              terminalOutput={canvasState.terminalOutput}
              sandboxId={canvasState.sandboxId}
              previewFileName={canvasState.previewFileName}
              previewContent={canvasState.previewContent}
              previewFileType={canvasState.previewFileType}
              slides={canvasState.slides}
              currentSlideIndex={canvasState.currentSlideIndex}
              timelinePercentage={canvasState.timelinePercentage}
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
          onSendMessage={handleSendMessage}
          onRegenerate={regenerate}
          onFeedback={handleFeedback}
          onViewSources={handleViewSources}
          onViewInCanvas={handleViewInCanvas}
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
              onSubmit={(text) => handleSendMessage(text)}
              onCancel={stop}
              isStreaming={isStreaming}
              showQuickActions={false}
              showAnimatedPlaceholder={messages.length === 0}
              placeholder={messages.length > 0 ? "Ask anything..." : undefined}
            />
          </div>
        </div>
      </ChatLayout>
    </ToolRegistry>
  );
}
