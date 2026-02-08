"use client";

import * as React from "react";
import { PaintbrushIcon } from "lucide-react";

// ============================================================================
// Types
// ============================================================================

export interface AICanvasViewProps {
  /** Placeholder for future canvas content */
  content?: string;
}

// ============================================================================
// Component
// ============================================================================

export function AICanvasView({ content }: AICanvasViewProps) {
  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border/10 bg-canvas-surface px-3 py-2">
        <PaintbrushIcon className="size-3.5 text-pink-400" />
        <span className="text-xs font-medium text-muted-foreground/70">AI Canvas</span>
      </div>

      {/* Content */}
      <div className="flex flex-1 items-center justify-center bg-canvas-deep">
        {content ? (
          <div className="p-6">
            <img src={content} alt="AI Canvas" className="max-h-full max-w-full rounded-lg" />
          </div>
        ) : (
          <div className="text-center text-muted-foreground/40">
            <PaintbrushIcon className="mx-auto mb-3 size-12 opacity-30" />
            <p className="text-sm">Canvas workspace</p>
            <p className="mt-1 text-xs text-muted-foreground/30">
              Draw, annotate, and create with AI
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
