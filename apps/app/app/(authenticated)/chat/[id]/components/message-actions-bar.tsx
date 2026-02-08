"use client";

import { useState } from "react";
import {
  CopyIcon,
  RefreshCcwIcon,
  StarIcon,
} from "lucide-react";
import {
  MessageAction,
  MessageActions,
} from "@/components/ai-elements/message";
import { cn } from "@repo/design-system/lib/utils";

interface MessageActionsBarProps {
  messageId: string;
  fullText: string;
  isLastMessage: boolean;
  feedback?: number; // 1-5 star rating
  onCopy: (text: string) => void;
  onRegenerate: () => void;
  onFeedback: (messageId: string, rating: number) => void;
}

export function MessageActionsBar({
  messageId,
  fullText,
  isLastMessage,
  feedback,
  onCopy,
  onRegenerate,
  onFeedback,
}: MessageActionsBarProps) {
  const [hoveredStar, setHoveredStar] = useState<number | null>(null);

  return (
    <MessageActions>
      <MessageAction
        tooltip="Copy"
        label="Copy"
        onClick={() => onCopy(fullText)}
      >
        <CopyIcon className="size-3" />
      </MessageAction>

      {isLastMessage && (
        <MessageAction
          tooltip="Regenerate"
          label="Regenerate"
          onClick={onRegenerate}
        >
          <RefreshCcwIcon className="size-3" />
        </MessageAction>
      )}

      {/* 5-star rating */}
      <div
        className="inline-flex items-center gap-0"
        onMouseLeave={() => setHoveredStar(null)}
      >
        {[1, 2, 3, 4, 5].map((star) => {
          const isFilled = hoveredStar !== null
            ? star <= hoveredStar
            : feedback !== undefined && star <= feedback;

          return (
            <button
              key={star}
              type="button"
              className={cn(
                "inline-flex size-6 items-center justify-center rounded-md transition-colors",
                "hover:bg-accent hover:text-accent-foreground",
                isFilled ? "text-yellow-500" : "text-muted-foreground/50",
              )}
              onMouseEnter={() => setHoveredStar(star)}
              onClick={() => onFeedback(messageId, star)}
              aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
            >
              <StarIcon
                className="size-3"
                fill={isFilled ? "currentColor" : "none"}
              />
            </button>
          );
        })}
      </div>
    </MessageActions>
  );
}
