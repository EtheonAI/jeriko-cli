"use client";

import * as React from "react";
import { useState, useEffect, useRef } from "react";
import { cn } from "@repo/design-system/lib/utils";
import { ChevronDownIcon, BrainIcon, LoaderIcon } from "lucide-react";
import type { ReasoningUIPart } from "../../lib/types/ui-message";

export interface ReasoningPartProps {
  part: ReasoningUIPart;
  className?: string;
  defaultOpen?: boolean;
}

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
  const seconds = Math.max(1, Math.round(wordCount / 4));

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border/40",
        isStreaming && "border-violet-500/20 bg-violet-500/[0.02]",
        !isStreaming && "bg-muted/10",
        className
      )}
    >
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors",
          "hover:bg-muted/30"
        )}
      >
        <div
          className={cn(
            "flex size-6 items-center justify-center rounded-lg",
            isStreaming
              ? "bg-violet-500/15"
              : "bg-muted/60"
          )}
        >
          {isStreaming ? (
            <LoaderIcon className="size-3.5 animate-spin text-violet-500" />
          ) : (
            <BrainIcon className="size-3.5 text-violet-500/70" />
          )}
        </div>

        <span className="flex-1 text-sm font-medium text-foreground/80">
          {isStreaming ? "Thinking..." : "Thought process"}
        </span>

        {!isStreaming && (
          <span className="text-xs text-muted-foreground/60">
            {seconds}s
          </span>
        )}

        <ChevronDownIcon
          className={cn(
            "size-4 text-muted-foreground/50 transition-transform duration-200",
            isOpen && "rotate-180"
          )}
        />
      </button>

      {/* Content */}
      <div
        className={cn(
          "grid transition-all duration-300 ease-in-out",
          isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="overflow-hidden">
          <div
            ref={contentRef}
            className={cn(
              "border-t border-border/30 px-3 py-3",
              isStreaming && "max-h-60 overflow-y-auto"
            )}
          >
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground/80">
              {part.text}
              {isStreaming && (
                <span className="ml-0.5 inline-block h-4 w-[2px] animate-pulse rounded-full bg-violet-400/60 align-text-bottom" />
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Streaming progress bar */}
      {isStreaming && (
        <div className="h-[1px] w-full overflow-hidden bg-violet-500/10">
          <div className="h-full w-1/3 animate-[shimmer_1.5s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-violet-500/30 to-transparent" />
        </div>
      )}
    </div>
  );
}
