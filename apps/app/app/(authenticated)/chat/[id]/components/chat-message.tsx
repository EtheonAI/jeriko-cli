"use client";

import * as React from "react";
import { Fragment, useMemo, useState } from "react";
import type { UIMessage } from "ai";
import type { SourceUrlUIPart, SourceDocumentUIPart, FileUIPart } from "@repo/ai/lib/types";
import { cn } from "@repo/design-system/lib/utils";
import { StarIcon } from "lucide-react";
import { Message, MessageContent } from "@/components/ai-elements/message";
import { MessageRenderer } from "./message-renderer";
import { MessageActionsBar } from "./message-actions-bar";

function formatRelativeTime(date: Date | string): string {
  const now = Date.now();
  const then = typeof date === "string" ? new Date(date).getTime() : date.getTime();
  const diffMs = now - then;
  if (diffMs < 0) return "just now";

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return "just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(then));
}

// ============================================================================
// Inline Rating Stars — per-message, no label text
// ============================================================================

function InlineRating({
  rating,
  onRate,
}: {
  rating?: number;
  onRate: (rating: number) => void;
}) {
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <div
      className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity"
      onMouseLeave={() => setHovered(null)}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const isFilled =
          hovered !== null ? star <= hovered : rating !== undefined && star <= rating;

        return (
          <button
            key={star}
            type="button"
            className="p-[2px] cursor-pointer select-none"
            onMouseEnter={() => setHovered(star)}
            onClick={() => onRate(star)}
            aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
          >
            <StarIcon
              className={cn(
                "size-3.5 transition-colors",
                isFilled
                  ? "text-yellow-500 fill-yellow-500"
                  : "text-[var(--rubic-icon-disable)] fill-[var(--rubic-icon-disable)]"
              )}
            />
          </button>
        );
      })}
    </div>
  );
}

// ============================================================================
// ChatMessage
// ============================================================================

interface ChatMessageProps {
  message: UIMessage;
  isLastMessage: boolean;
  isStreaming: boolean;
  rating?: number;
  onCopy: (text: string) => void;
  onRegenerate: () => void;
  onRate?: (messageId: string, rating: number) => void;
  onViewSources?: (sources: (SourceUrlUIPart | SourceDocumentUIPart)[]) => void;
  onViewInCanvas?: (toolCallId: string) => void;
  onPreviewFile?: (file: FileUIPart) => void;
}

export const ChatMessage = React.memo(
  function ChatMessage({
    message,
    isLastMessage,
    isStreaming,
    rating,
    onCopy,
    onRegenerate,
    onRate,
    onViewSources,
    onViewInCanvas,
    onPreviewFile,
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

    // createdAt is set by page.tsx from DB but not typed on UIMessage
    const createdAt = (message as unknown as Record<string, unknown>).createdAt as
      | string
      | undefined;

    const showActions = isAssistant && fullText && !(isLastMessage && isStreaming);

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
              onPreviewFile={onPreviewFile}
            />
          </MessageContent>
        </Message>

        {showActions && (
          <div className="flex items-center gap-2">
            <MessageActionsBar
              fullText={fullText}
              isLastMessage={isLastMessage}
              onCopy={onCopy}
              onRegenerate={onRegenerate}
            />
            {onRate && (
              <InlineRating
                rating={rating}
                onRate={(r) => onRate(message.id, r)}
              />
            )}
            {createdAt && (
              <span className="text-xs text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity select-none">
                {formatRelativeTime(createdAt)}
              </span>
            )}
          </div>
        )}
      </Fragment>
    );
  },
  (prev, next) =>
    prev.message.id === next.message.id &&
    prev.message.parts === next.message.parts &&
    prev.message.metadata === next.message.metadata &&
    prev.isLastMessage === next.isLastMessage &&
    prev.isStreaming === next.isStreaming &&
    prev.rating === next.rating &&
    prev.onViewSources === next.onViewSources &&
    prev.onViewInCanvas === next.onViewInCanvas &&
    prev.onPreviewFile === next.onPreviewFile
);
