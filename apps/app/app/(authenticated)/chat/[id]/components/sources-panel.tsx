"use client";

import * as React from "react";
import { cn } from "@repo/design-system/lib/utils";
import { Button } from "@repo/design-system/components/ui/button";
import { ScrollArea } from "@repo/design-system/components/ui/scroll-area";
import {
  XIcon,
  ExternalLinkIcon,
  FileTextIcon,
  GlobeIcon,
} from "lucide-react";

interface Source {
  type: "source-url" | "source-document";
  sourceId: string;
  url?: string;
  title?: string;
  mediaType?: string;
  filename?: string;
}

interface SourcesPanelProps {
  sources: Source[];
  onClose: () => void;
  className?: string;
}

/**
 * SourcesPanel - Expandable sidebar showing message sources/citations
 */
export function SourcesPanel({ sources, onClose, className }: SourcesPanelProps) {
  // Deduplicate sources by sourceId
  const uniqueSources = React.useMemo(() => {
    const seen = new Set<string>();
    return sources.filter((source) => {
      if (seen.has(source.sourceId)) return false;
      seen.add(source.sourceId);
      return true;
    });
  }, [sources]);

  return (
    <div className={cn("flex h-full w-80 flex-col", className)}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="font-medium">Sources ({uniqueSources.length})</h2>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={onClose}
        >
          <XIcon className="size-4" />
        </Button>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="space-y-2 p-4">
          {uniqueSources.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">
              No sources available
            </p>
          ) : (
            uniqueSources.map((source) => (
              <SourceCard key={source.sourceId} source={source} />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function SourceCard({ source }: { source: Source }) {
  const isUrl = source.type === "source-url";

  if (isUrl && source.url) {
    const domain = getDomain(source.url);
    const favicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;

    return (
      <a
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        className="group flex items-start gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-muted/50"
      >
        <div className="flex size-10 flex-shrink-0 items-center justify-center rounded-lg bg-muted">
          <img
            src={favicon}
            alt=""
            className="size-5"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
          <GlobeIcon className="size-5 text-muted-foreground hidden" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <span className="truncate text-sm font-medium group-hover:text-primary">
              {source.title ?? "Source"}
            </span>
            <ExternalLinkIcon className="size-3 flex-shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          </div>
          <span className="text-xs text-muted-foreground">{domain}</span>
        </div>
        <span className="flex size-6 items-center justify-center rounded-full bg-muted text-xs font-medium">
          {source.sourceId}
        </span>
      </a>
    );
  }

  // Document source
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border p-3">
      <div className="flex size-10 flex-shrink-0 items-center justify-center rounded-lg bg-muted">
        <FileTextIcon className="size-5 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <span className="truncate text-sm font-medium">
          {source.title ?? "Document"}
        </span>
        {source.filename && (
          <span className="block truncate text-xs text-muted-foreground">
            {source.filename}
          </span>
        )}
      </div>
      <span className="flex size-6 items-center justify-center rounded-full bg-muted text-xs font-medium">
        {source.sourceId}
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
