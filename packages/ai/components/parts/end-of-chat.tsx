"use client";

import * as React from "react";
import { useState } from "react";
import { cn } from "@repo/design-system/lib/utils";
import { StarIcon, FileSearchIcon } from "lucide-react";
import { Suggestions, type Suggestion } from "./suggestions";

// ============================================================================
// Types
// ============================================================================

export interface EndOfChatProps {
  /** Whether the task completed (shows "Task completed" badge) */
  taskCompleted?: boolean;
  /** Current star rating (1-5), undefined = no rating yet */
  rating?: number;
  /** Called when user clicks a star */
  onRate?: (rating: number) => void;
  /** Called when user clicks "View all files" — shows link when provided */
  onViewFiles?: () => void;
  /** Follow-up suggestions */
  suggestions?: Suggestion[];
  /** Called when user selects a suggestion */
  onSelectSuggestion?: (text: string) => void;
  className?: string;
}

// ============================================================================
// Checkmark SVG (matches Manus exactly — custom path, not lucide)
// ============================================================================

function CheckmarkIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn("flex-shrink-0", className)}
      height="18"
      width="18"
      fill="none"
      viewBox="0 0 17 16"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        clipRule="evenodd"
        d="M13.8081 3.57564C14.0424 3.80995 14.0424 4.18985 13.8081 4.42417L6.47478 11.7575C6.24047 11.9918 5.86057 11.9918 5.62626 11.7575L2.29292 8.42417C2.05861 8.18985 2.05861 7.80995 2.29292 7.57564C2.52724 7.34132 2.90714 7.34132 3.14145 7.57564L6.05052 10.4847L12.9596 3.57564C13.1939 3.34132 13.5738 3.34132 13.8081 3.57564Z"
        fill="currentColor"
        fillRule="evenodd"
      />
    </svg>
  );
}

// ============================================================================
// Rating Stars
// ============================================================================

function RatingStars({ rating, onRate }: { rating?: number; onRate?: (rating: number) => void }) {
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <div className="flex items-center" onMouseLeave={() => setHovered(null)}>
      {[1, 2, 3, 4, 5].map((star) => {
        const isFilled =
          hovered !== null ? star <= hovered : rating !== undefined && star <= rating;

        return (
          <button
            key={star}
            type="button"
            className="p-0.5 cursor-pointer select-none transition-colors"
            onMouseEnter={() => setHovered(star)}
            onClick={() => onRate?.(star)}
            aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
          >
            <StarIcon
              className={cn(
                "size-4 transition-colors",
                isFilled
                  ? "text-yellow-500 fill-yellow-500"
                  : "text-muted-foreground/30 fill-muted-foreground/30"
              )}
            />
          </button>
        );
      })}
    </div>
  );
}

// ============================================================================
// EndOfChat Component — Manus-style
// ============================================================================

export function EndOfChat({
  taskCompleted = true,
  rating,
  onRate,
  onViewFiles,
  suggestions,
  onSelectSuggestion,
  className,
}: EndOfChatProps) {
  return (
    <div className={cn("w-full space-y-5 mt-1", className)}>
      {/* Row 1: Task completed badge + Rating pill */}
      <div className="flex items-center flex-wrap justify-between gap-2">
        {/* Task completed badge */}
        {taskCompleted && (
          <div className="flex items-center gap-1.5 text-sm text-emerald-500">
            <CheckmarkIcon />
            Task completed
          </div>
        )}

        {/* Rating pill */}
        {onRate && (
          <div className="flex items-center gap-2 py-1.5 ps-4 pe-3 bg-muted/50 rounded-lg">
            <span className="text-sm text-muted-foreground">How was this result?</span>
            <RatingStars rating={rating} onRate={onRate} />
          </div>
        )}
      </div>

      {/* View all files link */}
      {onViewFiles && (
        <button
          type="button"
          onClick={onViewFiles}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <FileSearchIcon className="size-4" />
          View all files
        </button>
      )}

      {/* Divider */}
      {suggestions && suggestions.length > 0 && (
        <>
          <hr className="border-t border-border/60" />

          {/* Suggested follow-ups */}
          <div>
            <div className="text-muted-foreground/60 text-[13px] leading-[18px] font-medium mb-1">
              Suggested follow-ups
            </div>
            <Suggestions suggestions={suggestions} onSelect={onSelectSuggestion ?? (() => {})} />
          </div>
        </>
      )}
    </div>
  );
}
