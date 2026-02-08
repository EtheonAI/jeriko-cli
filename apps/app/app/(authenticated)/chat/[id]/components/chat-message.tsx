"use client";

import * as React from "react";
import { Fragment, useMemo } from "react";
import type { UIMessage } from "ai";
import type { SourceUrlUIPart, SourceDocumentUIPart } from "@repo/ai/lib/types";
import {
  Message,
  MessageContent,
} from "@/components/ai-elements/message";
import { MessageRenderer } from "./message-renderer";
import { MessageActionsBar } from "./message-actions-bar";

interface ChatMessageProps {
  message: UIMessage;
  isLastMessage: boolean;
  isStreaming: boolean;
  feedback?: number;
  onCopy: (text: string) => void;
  onRegenerate: () => void;
  onFeedback: (messageId: string, rating: number) => void;
  onViewSources?: (sources: (SourceUrlUIPart | SourceDocumentUIPart)[]) => void;
  onViewInCanvas?: (toolCallId: string) => void;
}

export const ChatMessage = React.memo(
  function ChatMessage({
    message,
    isLastMessage,
    isStreaming,
    feedback,
    onCopy,
    onRegenerate,
    onFeedback,
    onViewSources,
    onViewInCanvas,
  }: ChatMessageProps) {
    const isAssistant = message.role === "assistant";

    const fullText = useMemo(
      () =>
        message.parts
          .filter((p) => p.type === "text" && "text" in p)
          .map((p) => ("text" in p ? p.text : ""))
          .join("\n"),
      [message.parts]
    );

    const showActions =
      isAssistant && fullText && !(isLastMessage && isStreaming);

    return (
      <Fragment>
        <Message from={message.role}>
          <MessageContent>
            <MessageRenderer
              message={message}
              isLastMessage={isLastMessage}
              isStreaming={isStreaming}
              onViewSources={onViewSources}
              onViewInCanvas={onViewInCanvas}
            />
          </MessageContent>
        </Message>

        {showActions && (
          <MessageActionsBar
            messageId={message.id}
            fullText={fullText}
            isLastMessage={isLastMessage}
            feedback={feedback}
            onCopy={onCopy}
            onRegenerate={onRegenerate}
            onFeedback={onFeedback}
          />
        )}
      </Fragment>
    );
  },
  (prev, next) =>
    prev.message.id === next.message.id &&
    prev.message.parts === next.message.parts &&
    prev.isLastMessage === next.isLastMessage &&
    prev.isStreaming === next.isStreaming &&
    prev.feedback === next.feedback &&
    prev.onViewSources === next.onViewSources &&
    prev.onViewInCanvas === next.onViewInCanvas
);
