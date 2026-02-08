"use client";

import * as React from "react";
import { FileTextIcon } from "lucide-react";

// ============================================================================
// Types
// ============================================================================

export interface FilePreviewViewProps {
  fileName?: string;
  content?: string;
  fileType?: "image" | "pdf" | "markdown" | "text" | "html";
}

// ============================================================================
// Component
// ============================================================================

export function FilePreviewView({ fileName, content, fileType }: FilePreviewViewProps) {
  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border/10 bg-canvas-surface px-3 py-2">
        <FileTextIcon className="size-3.5 text-orange-400" />
        <span className="truncate text-xs font-medium text-foreground/80">
          {fileName || "Untitled"}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto bg-canvas-deep p-4">
        {fileType === "image" && content ? (
          <img src={content} alt={fileName} className="mx-auto max-w-full rounded" />
        ) : (
          <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-foreground/80">
            {content || "No content to preview"}
          </pre>
        )}
      </div>
    </div>
  );
}
