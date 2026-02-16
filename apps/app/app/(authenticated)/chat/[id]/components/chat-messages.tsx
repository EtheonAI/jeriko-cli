"use client";

import { useCallback, useMemo } from "react";
import type { UIMessage } from "ai";
import type { SourceUrlUIPart, SourceDocumentUIPart } from "@repo/ai/lib/types";
import { EndOfChat } from "@repo/ai/components/parts";
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
  onSendMessage: (text: string) => void;
  onRegenerate: () => void;
  onFeedback: (messageId: string, rating: number) => void;
  onViewSources?: (sources: (SourceUrlUIPart | SourceDocumentUIPart)[]) => void;
  onViewInCanvas?: (toolCallId: string) => void;
  onViewFiles?: () => void;
}

/**
 * Generate follow-up suggestions and detect task completion state.
 * Manus-style: show context-aware suggestions after the assistant finishes.
 * Returns both suggestions and whether the agent used tools (= task mode).
 */
function useEndOfChatState(messages: UIMessage[], isStreaming: boolean) {
  return useMemo(() => {
    if (isStreaming || messages.length === 0) {
      return { suggestions: [], usedTools: false };
    }

    const lastMsg = messages[messages.length - 1];
    if (!lastMsg || lastMsg.role !== "assistant") {
      return { suggestions: [], usedTools: false };
    }

    // Check what tools were used
    const parts = lastMsg.parts ?? [];
    const hasAnyTool = parts.some(
      (p) =>
        typeof p === "object" &&
        "type" in p &&
        typeof p.type === "string" &&
        p.type.startsWith("tool-")
    );
    const hasCode = parts.some(
      (p) =>
        typeof p === "object" &&
        "type" in p &&
        typeof p.type === "string" &&
        (p.type.startsWith("tool-file_") ||
          p.type.startsWith("tool-shell_") ||
          p.type === "tool-code_execute")
    );
    const hasBrowser = parts.some(
      (p) =>
        typeof p === "object" &&
        "type" in p &&
        typeof p.type === "string" &&
        p.type.startsWith("tool-browser_")
    );
    const hasSearch = parts.some(
      (p) =>
        typeof p === "object" &&
        "type" in p &&
        typeof p.type === "string" &&
        (p.type === "tool-web_search" ||
          p.type === "tool-search_web" ||
          p.type === "tool-info_search_web")
    );

    let suggestions;
    if (hasCode) {
      suggestions = [
        { text: "Run and test the code" },
        { text: "Explain what this does" },
        { text: "Modify this further" },
      ];
    } else if (hasBrowser) {
      suggestions = [
        { text: "Continue browsing" },
        { text: "Extract key information" },
        { text: "Search for something else" },
      ];
    } else if (hasSearch) {
      suggestions = [
        { text: "Search for more details" },
        { text: "Summarize the findings" },
        { text: "Compare with alternatives" },
      ];
    } else {
      suggestions = [
        { text: "Tell me more" },
        { text: "Can you help with something else?" },
        { text: "Explain in more detail" },
      ];
    }

    return { suggestions, usedTools: hasAnyTool };
  }, [messages, isStreaming]);
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

    // Find the last assistant message
    const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
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
  onSendMessage,
  onRegenerate,
  onFeedback,
  onViewSources,
  onViewInCanvas,
  onViewFiles,
}: ChatMessagesProps) {
  const handleCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success("Copied to clipboard");
    });
  }, []);

  const thinking = useThinkingState(messages, status, isStreaming);
  const endOfChat = useEndOfChatState(messages, isStreaming);

  // Get the last assistant message ID for rating
  const lastAssistantId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i]?.role === "assistant") return messages[i]!.id;
    }
    return null;
  }, [messages]);

  // Detect if the last assistant message has file parts (for "View all files" link)
  const hasFileParts = useMemo(() => {
    if (isStreaming || messages.length === 0) return false;
    const lastMsg = messages[messages.length - 1];
    if (!lastMsg || lastMsg.role !== "assistant") return false;
    return (lastMsg.parts ?? []).some(
      (p) => typeof p === "object" && "type" in p && p.type === "file"
    );
  }, [messages, isStreaming]);

  return (
    <Conversation className="min-h-0 flex-1">
      <ConversationContent data-testid="message-list" className="mx-auto max-w-3xl">
        {messages.length === 0 && !thinking.show ? (
          <EmptyState onSuggestionClick={onSendMessage} />
        ) : (
          <>
            {messages.map((message, index) => (
              <ChatMessage
                key={message.id}
                message={message}
                isLastMessage={index === messages.length - 1}
                isStreaming={isStreaming}
                onCopy={handleCopy}
                onRegenerate={onRegenerate}
                onViewSources={onViewSources}
                onViewInCanvas={onViewInCanvas}
              />
            ))}

            {/* Thinking indicator — shown during initial load and between tool calls */}
            {thinking.show && <ThinkingIndicator label={thinking.label} />}

            {/* End-of-chat section — Manus-style task completion + rating + suggestions */}
            {!thinking.show && endOfChat.suggestions.length > 0 && (
              <div className="mt-4 mb-2">
                <EndOfChat
                  taskCompleted={endOfChat.usedTools}
                  rating={lastAssistantId ? feedback[lastAssistantId] : undefined}
                  onRate={
                    endOfChat.usedTools && lastAssistantId
                      ? (rating) => onFeedback(lastAssistantId, rating)
                      : undefined
                  }
                  onViewFiles={hasFileParts ? onViewFiles : undefined}
                  suggestions={endOfChat.suggestions}
                  onSelectSuggestion={onSendMessage}
                />
              </div>
            )}
          </>
        )}
      </ConversationContent>
      <ConversationScrollButton />
    </Conversation>
  );
}
