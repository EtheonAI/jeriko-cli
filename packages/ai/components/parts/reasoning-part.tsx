"use client";

import * as React from "react";
import { useState, useEffect, useRef } from "react";
import { cn } from "@repo/design-system/lib/utils";
import { ChevronUpIcon, BrainIcon } from "lucide-react";
import type { ReasoningUIPart } from "../../lib/types/ui-message";

export interface ReasoningPartProps {
  part: ReasoningUIPart;
  className?: string;
  defaultOpen?: boolean;
}

/**
 * ReasoningPart — Manus-style collapsible pill.
 * Renders as an inline pill badge "Thinking..." or "Thought process (N words)"
 * with a chevron to expand/collapse the reasoning content.
 */
export function ReasoningPart({
  part,
  className,
  defaultOpen = false,
}: ReasoningPartProps) {
  const isStreaming = part.state === "streaming";
  const wasStreamingRef = useRef(false);
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const contentRef = useRef<HTMLDivElement>(null);

  // Auto-open when streaming starts, auto-close when done
  useEffect(() => {
    if (isStreaming && !wasStreamingRef.current) {
      setIsOpen(true);
    }
    if (!isStreaming && wasStreamingRef.current) {
      setIsOpen(false);
    }
    wasStreamingRef.current = isStreaming;
  }, [isStreaming]);

  // Auto-scroll content during streaming
  useEffect(() => {
    if (isStreaming && isOpen && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [isStreaming, isOpen, part.text]);

  const wordCount = part.text.split(/\s+/).filter(Boolean).length;

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {/* Pill trigger — same rounded pill style as tool labels */}
      <div
        className={cn(
          "rounded-[15px] inline-flex px-2.5 py-[3px]",
          "border border-[var(--rubic-border-light)] bg-[var(--rubic-fill-gray)]",
          "flex-col items-start gap-0 w-max max-w-full",
          isStreaming && "border-blue-500/20 bg-blue-500/[0.03]"
        )}
      >
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1 text-[14px] text-[var(--rubic-text-secondary)] cursor-pointer select-none"
        >
          <BrainIcon className={cn("size-[18px] flex-shrink-0", isStreaming && "text-blue-400")} />
          <span>
            {isStreaming
              ? "Thinking..."
              : `Thought process${wordCount > 0 ? ` (${wordCount})` : ""}`}
          </span>
          <ChevronUpIcon
            className={cn(
              "size-4 transition-transform duration-300",
              !isOpen && "rotate-180"
            )}
          />
        </button>
      </div>

      {/* Expanded content — shows below the pill */}
      <div
        className={cn(
          "transition-[max-height,opacity] duration-150 ease-in-out overflow-hidden",
          isOpen ? "max-h-[100000px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div
          ref={contentRef}
          className={cn(
            "pl-3 border-l-2 border-[var(--rubic-border-light)] ml-3",
            isStreaming && "max-h-60 overflow-y-auto"
          )}
        >
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--rubic-text-secondary)]">
            {part.text}
            {isStreaming && (
              <span className="ml-0.5 inline-block h-4 w-[2px] animate-pulse rounded-full bg-blue-400/60 align-text-bottom" />
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
