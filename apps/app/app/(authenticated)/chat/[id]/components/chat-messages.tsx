"use client";

import { useCallback } from "react";
import type { UIMessage } from "ai";
import type { SourceUrlUIPart, SourceDocumentUIPart } from "@repo/ai/lib/types";
import { toast } from "sonner";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import { ChatMessage } from "./chat-message";
import { EmptyState } from "./empty-state";
import { ThinkingIndicator } from "./thinking-indicator";

const STARTER_SUGGESTIONS = [
  "Search the web for the latest news",
  "Write a Python script to analyze data",
  "Help me draft a professional email",
  "Explain how machine learning works",
];

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
}: ChatMessagesProps) {
  const handleCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success("Copied to clipboard");
    });
  }, []);

  return (
    <Conversation className="min-h-0 flex-1">
      <ConversationContent data-testid="message-list" className="mx-auto max-w-3xl">
        {messages.length === 0 ? (
          <EmptyState onSuggestionClick={onSendMessage} />
        ) : (
          messages.map((message, index) => (
            <ChatMessage
              key={message.id}
              message={message}
              isLastMessage={index === messages.length - 1}
              isStreaming={isStreaming}
              feedback={feedback[message.id]}
              onCopy={handleCopy}
              onRegenerate={onRegenerate}
              onFeedback={onFeedback}
              onViewSources={onViewSources}
              onViewInCanvas={onViewInCanvas}
            />
          ))
        )}

        {/* Thinking indicator */}
        {status === "submitted" && <ThinkingIndicator />}
      </ConversationContent>
      <ConversationScrollButton />
    </Conversation>
  );
}
