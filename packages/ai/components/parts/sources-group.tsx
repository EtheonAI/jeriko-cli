"use client";

import * as React from "react";
import { cn } from "@repo/design-system/lib/utils";
import {
  GlobeIcon,
  FileTextIcon,
  BookOpenIcon,
} from "lucide-react";
import type { SourceUrlUIPart, SourceDocumentUIPart } from "../../lib/types/ui-message";

// ============================================================================
// Types
// ============================================================================

export interface SourcesGroupProps {
  sources: (SourceUrlUIPart | SourceDocumentUIPart)[];
  className?: string;
  onViewSources?: (sources: (SourceUrlUIPart | SourceDocumentUIPart)[]) => void;
}

// ============================================================================
// Component
// ============================================================================

/**
 * SourcesGroup — renders sources as inline pill labels with favicons.
 * Clicking any pill fires `onViewSources` to open the canvas with the full list.
 * Falls back to opening the URL in a new tab if no callback provided.
 */
export function SourcesGroup({
  sources,
  className,
  onViewSources,
}: SourcesGroupProps) {
  if (sources.length === 0) return null;

  const handleClick = (source: SourceUrlUIPart | SourceDocumentUIPart) => {
    if (onViewSources) {
      onViewSources(sources);
    } else if (source.type === "source-url") {
      window.open(source.url, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div className={cn("mt-3 flex flex-wrap items-center gap-2", className)}>
      <span className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wide mr-0.5">
        Sources
      </span>
      {sources.map((source, i) => (
        <SourcePill
          key={`${source.sourceId}-${i}`}
          source={source}
          index={i + 1}
          onClick={() => handleClick(source)}
        />
      ))}
    </div>
  );
}

// ============================================================================
// Source Pill
// ============================================================================

function SourcePill({
  source,
  index,
  onClick,
}: {
  source: SourceUrlUIPart | SourceDocumentUIPart;
  index: number;
  onClick: () => void;
}) {
  if (source.type === "source-url") {
    const domain = getDomain(source.url);
    const favicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=16`;

    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/40",
          "px-2.5 py-1 text-xs text-foreground/70 transition-all duration-150",
          "hover:border-primary/30 hover:bg-primary/5 hover:text-foreground",
          "active:scale-95"
        )}
      >
        <img
          src={favicon}
          alt=""
          className="size-3.5 rounded-full"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
        <span className="max-w-[120px] truncate">
          {source.title ?? domain}
        </span>
        <span className="flex size-4 items-center justify-center rounded-full bg-muted text-[9px] font-medium text-muted-foreground">
          {index}
        </span>
      </button>
    );
  }

  // Document source
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/40",
        "px-2.5 py-1 text-xs text-foreground/70 transition-all duration-150",
        "hover:border-primary/30 hover:bg-primary/5 hover:text-foreground",
        "active:scale-95"
      )}
    >
      {source.filename ? (
        <FileTextIcon className="size-3.5 text-muted-foreground" />
      ) : (
        <BookOpenIcon className="size-3.5 text-muted-foreground" />
      )}
      <span className="max-w-[120px] truncate">
        {source.title ?? source.filename ?? "Document"}
      </span>
      <span className="flex size-4 items-center justify-center rounded-full bg-muted text-[9px] font-medium text-muted-foreground">
        {index}
      </span>
    </button>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return url;
  }
}
