"use client";

import * as React from "react";
import { cn } from "@repo/design-system/lib/utils";
import {
  ArrowRightIcon,
  MessageCircleMoreIcon,
  ArchiveIcon,
  CodeIcon,
  GlobeIcon,
  SearchIcon,
  FileTextIcon,
  SparklesIcon,
} from "lucide-react";

// ============================================================================
// Types
// ============================================================================

export interface Suggestion {
  text: string;
  description?: string;
  /** Optional icon hint — auto-detected from text if not provided */
  icon?: "chat" | "archive" | "code" | "globe" | "search" | "file" | "sparkles";
}

export interface SuggestionsProps {
  suggestions: Suggestion[];
  onSelect: (suggestion: string) => void;
  className?: string;
}

// ============================================================================
// Icon map
// ============================================================================

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  chat: MessageCircleMoreIcon,
  archive: ArchiveIcon,
  code: CodeIcon,
  globe: GlobeIcon,
  search: SearchIcon,
  file: FileTextIcon,
  sparkles: SparklesIcon,
};

/** Auto-detect icon from suggestion text */
function detectIcon(text: string): React.ComponentType<{ className?: string }> {
  const lower = text.toLowerCase();
  if (lower.includes("search") || lower.includes("find")) return SearchIcon;
  if (
    lower.includes("code") ||
    lower.includes("run") ||
    lower.includes("test") ||
    lower.includes("generate a webpage") ||
    lower.includes("generate a website")
  )
    return CodeIcon;
  if (lower.includes("browse") || lower.includes("web") || lower.includes("page")) return GlobeIcon;
  if (lower.includes("file") || lower.includes("document") || lower.includes("report"))
    return FileTextIcon;
  if (lower.includes("presentation") || lower.includes("create")) return ArchiveIcon;
  return MessageCircleMoreIcon;
}

// ============================================================================
// Component — Manus-style vertical suggestion rows
// ============================================================================

export function Suggestions({ suggestions, onSelect, className }: SuggestionsProps) {
  if (suggestions.length === 0) return null;

  return (
    <div className={cn("flex flex-col gap-0", className)}>
      {suggestions.map((suggestion, i) => {
        const Icon = suggestion.icon
          ? (ICON_MAP[suggestion.icon] ?? MessageCircleMoreIcon)
          : detectIcon(suggestion.text);

        return (
          <button
            key={i}
            type="button"
            onClick={() => onSelect(suggestion.text)}
            className={cn(
              "group/suggestion flex items-center justify-between gap-4",
              "px-3 py-[9px] -mx-3",
              "cursor-pointer select-none",
              "relative",
              "transition-all duration-150",
              "hover:bg-[var(--rubic-fill-gray)] hover:rounded-[10px]",
              // Bottom separator — hidden on hover (Manus style)
              i < suggestions.length - 1 && [
                "after:content-[''] after:absolute after:bottom-0 after:left-3 after:right-3",
                "after:h-px after:bg-[var(--rubic-border-main)]",
                "hover:after:hidden",
              ]
            )}
          >
            {/* Left: icon + text */}
            <div className="flex items-center gap-2 min-w-0">
              <Icon className="size-4 flex-shrink-0 text-[var(--rubic-text-tertiary)]" />
              <span className="text-sm text-[var(--rubic-text-secondary)] flex-1 min-w-0">
                {suggestion.text}
              </span>
            </div>

            {/* Right: arrow */}
            <ArrowRightIcon className="size-4 flex-shrink-0 text-[var(--rubic-icon-disable)] transition-transform group-hover/suggestion:translate-x-0.5 group-hover/suggestion:text-[var(--rubic-text-tertiary)]" />
          </button>
        );
      })}
    </div>
  );
}
