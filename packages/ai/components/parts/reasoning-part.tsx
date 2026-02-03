"use client";

import * as React from "react";
import { useState } from "react";
import { cn } from "@repo/design-system/lib/utils";
import { ChevronDownIcon, BrainIcon } from "lucide-react";
import type { ReasoningUIPart } from "../../lib/types/ui-message";

export interface ReasoningPartProps {
  part: ReasoningUIPart;
  className?: string;
  defaultOpen?: boolean;
}

/**
 * ReasoningPart - Collapsible thinking/reasoning content
 */
export function ReasoningPart({
  part,
  className,
  defaultOpen = false,
}: ReasoningPartProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const isStreaming = part.state === "streaming";

  // Count words/lines for summary
  const wordCount = part.text.split(/\s+/).filter(Boolean).length;
  const preview = part.text.slice(0, 100).trim();

  return (
    <div className={cn("rounded-lg border border-dashed border-border/60 bg-muted/30", className)}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between px-3 py-2 hover:bg-muted/50"
      >
        <div className="flex items-center gap-2">
          <div className="flex size-6 items-center justify-center rounded-md bg-violet-500/10">
            <BrainIcon className="size-3.5 text-violet-500" />
          </div>
          <span className="text-sm font-medium">
            {isStreaming ? "Thinking..." : "Thought"}
          </span>
          {!isStreaming && (
            <span className="text-xs text-muted-foreground">
              ({wordCount} words)
            </span>
          )}
        </div>
        <ChevronDownIcon
          className={cn(
            "size-4 text-muted-foreground transition-transform",
            isOpen && "rotate-180"
          )}
        />
      </button>

      {isOpen && (
        <div className="border-t border-dashed border-border/60 px-3 py-3">
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">
            {part.text}
            {isStreaming && (
              <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-muted-foreground" />
            )}
          </p>
        </div>
      )}

      {/* Preview when collapsed */}
      {!isOpen && preview && (
        <div className="px-3 pb-2">
          <p className="truncate text-xs text-muted-foreground/70 italic">
            {preview}...
          </p>
        </div>
      )}
    </div>
  );
}
