"use client";

import * as React from "react";
import { cn } from "@repo/design-system/lib/utils";
import { ArrowRightIcon } from "lucide-react";

// ============================================================================
// Types
// ============================================================================

export interface Suggestion {
  text: string;
  description?: string;
}

export interface SuggestionsProps {
  suggestions: Suggestion[];
  onSelect: (suggestion: string) => void;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function Suggestions({
  suggestions,
  onSelect,
  className,
}: SuggestionsProps) {
  if (suggestions.length === 0) return null;

  return (
    <div
      className={cn(
        "flex gap-2 overflow-x-auto pb-1 scrollbar-none",
        className
      )}
    >
      {suggestions.map((suggestion, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onSelect(suggestion.text)}
          className={cn(
            "group flex flex-shrink-0 items-center gap-2 rounded-xl",
            "border border-border/40 bg-background px-3.5 py-2",
            "text-left text-sm text-foreground/80",
            "transition-all duration-150",
            "hover:border-border hover:bg-muted/40 hover:text-foreground",
            "active:scale-[0.98]"
          )}
        >
          <span className="whitespace-nowrap">{suggestion.text}</span>
          <ArrowRightIcon className="size-3.5 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground/60" />
        </button>
      ))}
    </div>
  );
}
