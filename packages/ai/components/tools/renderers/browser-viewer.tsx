"use client";

import * as React from "react";
import { cn } from "@repo/design-system/lib/utils";
import { ExternalLinkIcon, GlobeIcon, ImageIcon, Loader2Icon } from "lucide-react";
import type { ToolRendererProps } from "../tool-registry";

interface BrowserNavigateInput {
  url: string;
}

interface BrowserNavigateOutput {
  url: string;
  title?: string;
  content?: string;
  source?: string;
  screenshot?: string;
  error?: string;
}

export interface BrowserViewerProps
  extends ToolRendererProps<BrowserNavigateInput, BrowserNavigateOutput> {}

/**
 * BrowserViewer - Renders browser navigation results and screenshots.
 * Used for browser_navigate and browser_screenshot tools.
 */
export function BrowserViewer({ toolName, state, input, output }: BrowserViewerProps) {
  const isScreenshot = toolName === "browser_screenshot";

  // Loading state
  if (state !== "output-available") {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2Icon className="size-4 animate-spin" />
        <span>
          {isScreenshot ? "Taking screenshot..." : `Navigating to ${input?.url ?? "page"}...`}
        </span>
      </div>
    );
  }

  // Error state
  if (output?.error) {
    return (
      <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
        <p className="text-sm text-destructive">
          {isScreenshot ? "Screenshot failed" : "Navigation failed"}: {output.error}
        </p>
      </div>
    );
  }

  // Screenshot result
  if (output?.screenshot) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ImageIcon className="size-4" />
          <span>Browser Screenshot</span>
        </div>
        <div className="overflow-hidden rounded-lg border border-border">
          <img
            src={`data:image/png;base64,${output.screenshot}`}
            alt="Browser screenshot"
            className="w-full"
          />
        </div>
      </div>
    );
  }

  // Navigate result
  return (
    <div className="space-y-2">
      {/* URL bar */}
      <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2">
        <GlobeIcon className="size-4 flex-shrink-0 text-muted-foreground" />
        <span className="flex-1 truncate text-sm">{output?.url ?? input?.url}</span>
        {output?.url && (
          <a
            href={output.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 text-muted-foreground hover:text-foreground"
          >
            <ExternalLinkIcon className="size-3.5" />
          </a>
        )}
      </div>

      {/* Page title */}
      {output?.title && <h4 className="text-sm font-medium">{output.title}</h4>}

      {/* Page content preview */}
      {output?.content && (
        <div className="max-h-60 overflow-y-auto rounded-lg border border-border bg-card p-3">
          <p className="whitespace-pre-wrap text-xs text-muted-foreground">
            {output.content.length > 2000 ? `${output.content.slice(0, 2000)}...` : output.content}
          </p>
        </div>
      )}

      {/* Source indicator */}
      {output?.source && <p className="text-xs text-muted-foreground">via {output.source}</p>}
    </div>
  );
}
