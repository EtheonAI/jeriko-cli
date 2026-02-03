"use client";

import * as React from "react";
import { cn } from "@repo/design-system/lib/utils";
import { ExternalLinkIcon, FileTextIcon, GlobeIcon } from "lucide-react";
import type { SourceUrlUIPart, SourceDocumentUIPart } from "../../lib/types/ui-message";

export interface SourcePartProps {
  part: SourceUrlUIPart | SourceDocumentUIPart;
  className?: string;
  variant?: "inline" | "card";
}

/**
 * SourcePart - Renders source citations
 */
export function SourcePart({
  part,
  className,
  variant = "inline",
}: SourcePartProps) {
  if (part.type === "source-url") {
    return (
      <SourceUrl
        part={part}
        className={className}
        variant={variant}
      />
    );
  }

  return (
    <SourceDocument
      part={part}
      className={className}
      variant={variant}
    />
  );
}

function SourceUrl({
  part,
  className,
  variant,
}: {
  part: SourceUrlUIPart;
  className?: string;
  variant: "inline" | "card";
}) {
  const domain = getDomain(part.url);
  const favicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;

  if (variant === "inline") {
    return (
      <a
        href={part.url}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          "inline-flex items-center gap-1 rounded-md bg-muted/50 px-1.5 py-0.5 text-xs text-primary hover:bg-muted hover:underline",
          className
        )}
      >
        <img
          src={favicon}
          alt=""
          className="size-3"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
        <span className="max-w-[150px] truncate">
          {part.title ?? domain}
        </span>
        <sup className="text-[10px] text-muted-foreground">[{part.sourceId}]</sup>
      </a>
    );
  }

  return (
    <a
      href={part.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "group flex items-center gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-muted/50",
        className
      )}
    >
      <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
        <img
          src={favicon}
          alt=""
          className="size-5"
          onError={(e) => {
            (e.target as HTMLImageElement).replaceWith(
              document.createElement("span")
            );
          }}
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <span className="truncate text-sm font-medium group-hover:text-primary">
            {part.title ?? "Source"}
          </span>
          <ExternalLinkIcon className="size-3 flex-shrink-0 text-muted-foreground" />
        </div>
        <span className="truncate text-xs text-muted-foreground">
          {domain}
        </span>
      </div>
      <span className="flex size-6 items-center justify-center rounded-full bg-muted text-xs font-medium">
        {part.sourceId}
      </span>
    </a>
  );
}

function SourceDocument({
  part,
  className,
  variant,
}: {
  part: SourceDocumentUIPart;
  className?: string;
  variant: "inline" | "card";
}) {
  if (variant === "inline") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-md bg-muted/50 px-1.5 py-0.5 text-xs",
          className
        )}
      >
        <FileTextIcon className="size-3 text-muted-foreground" />
        <span className="max-w-[150px] truncate">{part.title}</span>
        <sup className="text-[10px] text-muted-foreground">[{part.sourceId}]</sup>
      </span>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border border-border bg-card p-3",
        className
      )}
    >
      <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
        <FileTextIcon className="size-5 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <span className="truncate text-sm font-medium">
          {part.title}
        </span>
        {part.filename && (
          <span className="block truncate text-xs text-muted-foreground">
            {part.filename}
          </span>
        )}
      </div>
      <span className="flex size-6 items-center justify-center rounded-full bg-muted text-xs font-medium">
        {part.sourceId}
      </span>
    </div>
  );
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return url;
  }
}
