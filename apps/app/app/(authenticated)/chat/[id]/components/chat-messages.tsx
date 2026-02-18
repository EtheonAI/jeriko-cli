"use client";

import { useCallback, useMemo } from "react";
import type { UIMessage } from "ai";
import type { SourceUrlUIPart, SourceDocumentUIPart, FileUIPart } from "@repo/ai/lib/types";
import { toast } from "sonner";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { ChatMessage } from "./chat-message";
import { EmptyState } from "./empty-state";
import { ThinkingIndicator } from "./thinking-indicator";

interface ChatMessagesProps {
  messages: UIMessage[];
  status: string;
  isStreaming: boolean;
  feedback: Record<string, number>;
  hasMore?: boolean;
  loadingMore?: boolean;
  onSendMessage: (text: string) => void;
  onRegenerate: () => void;
  onFeedback: (messageId: string, rating: number) => void;
  onLoadMore?: () => void;
  onViewSources?: (sources: (SourceUrlUIPart | SourceDocumentUIPart)[]) => void;
  onViewInCanvas?: (toolCallId: string) => void;
  onViewFiles?: () => void;
  onPreviewFile?: (file: FileUIPart) => void;
}

/**
 * Determine if we should show a thinking indicator.
 *
 * Cases:
 * 1. status === "submitted" → user sent message, waiting for first response
 * 2. isStreaming && last assistant message exists but has NO text parts yet
 *    → agent is processing (loading tools, thinking before first text)
 * 3. isStreaming && last assistant part is a completed tool (output-available)
 *    → agent finished a tool, thinking about next step
 */
function useThinkingState(messages: UIMessage[], status: string, isStreaming: boolean) {
  return useMemo(() => {
    // Case 1: Submitted, waiting for first response
    if (status === "submitted") {
      return { show: true, label: "Thinking" };
    }

    if (!isStreaming) return { show: false, label: "" };

    // Find the last assistant message — backward loop (no array copy)
    let lastAssistant: UIMessage | undefined;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i]!.role === "assistant") {
        lastAssistant = messages[i];
        break;
      }
    }
    if (!lastAssistant || !lastAssistant.parts || lastAssistant.parts.length === 0) {
      // Streaming but no assistant message yet — still waiting
      return { show: true, label: "Thinking" };
    }

    const parts = lastAssistant.parts;

    // Check if there are any text parts with actual content
    const hasTextContent = parts.some(
      (p) => p.type === "text" && "text" in p && (p as { text: string }).text.trim().length > 0
    );

    // Check if the last non-text part is a completed tool
    const lastPart = parts[parts.length - 1];
    const isToolPart =
      lastPart &&
      typeof lastPart === "object" &&
      "type" in lastPart &&
      typeof lastPart.type === "string" &&
      lastPart.type.startsWith("tool-");
    const isToolComplete =
      isToolPart &&
      "state" in lastPart &&
      (lastPart.state === "output-available" || lastPart.state === "output-error");

    // Case 2: Has an assistant message but no text content yet
    // (agent is setting up tools / calling show_plan before responding with text)
    if (!hasTextContent && !isToolPart) {
      return { show: true, label: "Thinking" };
    }

    // Case 3: Last part is a completed tool — agent is thinking about next step
    if (isToolComplete) {
      return { show: true, label: "Processing" };
    }

    // Case 4: Tool is actively executing (input-available state, waiting for result)
    if (
      isToolPart &&
      "state" in lastPart &&
      (lastPart.state === "input-available" || lastPart.state === "input-streaming")
    ) {
      // Don't show thinking — the tool renderer shows its own loading state
      return { show: false, label: "" };
    }

    return { show: false, label: "" };
  }, [messages, status, isStreaming]);
}

export function ChatMessages({
  messages,
  status,
  isStreaming,
  feedback,
  hasMore,
  loadingMore,
  onSendMessage,
  onRegenerate,
  onFeedback,
  onLoadMore,
  onViewSources,
  onViewInCanvas,
  onPreviewFile,
}: ChatMessagesProps) {
  const handleCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success("Copied to clipboard");
    });
  }, []);

  const thinking = useThinkingState(messages, status, isStreaming);

  return (
    <Conversation className="min-h-0 flex-1">
      <ConversationContent data-testid="message-list" className="mx-auto max-w-3xl">
        {messages.length === 0 && !thinking.show ? (
          <EmptyState />
        ) : (
          <>
            {/* Load earlier messages button */}
            {hasMore && (
              <div className="flex justify-center py-3">
                <button
                  type="button"
                  onClick={onLoadMore}
                  disabled={loadingMore}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                >
                  {loadingMore ? "Loading..." : "Load earlier messages"}
                </button>
              </div>
            )}

            {messages.map((message, index) => (
              <ChatMessage
                key={message.id}
                message={message}
                isLastMessage={index === messages.length - 1}
                isStreaming={isStreaming}
                rating={message.role === "assistant" ? feedback[message.id] : undefined}
                onCopy={handleCopy}
                onRegenerate={onRegenerate}
                onRate={message.role === "assistant" ? onFeedback : undefined}
                onViewSources={onViewSources}
                onViewInCanvas={onViewInCanvas}
                onPreviewFile={onPreviewFile}
              />
            ))}

            {/* Thinking indicator — shown during initial load and between tool calls */}
            {thinking.show && <ThinkingIndicator label={thinking.label} />}
          </>
        )}
      </ConversationContent>
      <ConversationScrollButton />
    </Conversation>
  );
}
