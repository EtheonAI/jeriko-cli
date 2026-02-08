"use client";

import * as React from "react";
import { useState } from "react";
import {
  PresentationIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "lucide-react";
import { cn } from "@repo/design-system/lib/utils";

// ============================================================================
// Types
// ============================================================================

export interface SlidesViewProps {
  slides?: string[];
  currentIndex?: number;
}

// ============================================================================
// Component
// ============================================================================

export function SlidesView({ slides, currentIndex = 0 }: SlidesViewProps) {
  const [index, setIndex] = useState(currentIndex);
  const total = slides?.length || 0;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/10 bg-canvas-surface px-3 py-2">
        <div className="flex items-center gap-2">
          <PresentationIcon className="size-3.5 text-purple-400" />
          <span className="text-xs font-medium text-muted-foreground/70">
            Slide Editor
          </span>
        </div>
        <span className="text-xs text-muted-foreground/50">
          {total > 0 ? `${index + 1} / ${total}` : "No slides"}
        </span>
      </div>

      {/* Slide content */}
      <div className="relative flex flex-1 items-center justify-center bg-canvas-deep p-6">
        {slides && slides[index] ? (
          <div className="aspect-video w-full max-w-2xl overflow-hidden rounded-lg bg-white shadow-2xl">
            <img
              src={slides[index]}
              alt={`Slide ${index + 1}`}
              className="size-full object-contain"
            />
          </div>
        ) : (
          <div className="text-center text-muted-foreground/40">
            <PresentationIcon className="mx-auto mb-3 size-12 opacity-30" />
            <p className="text-sm">No slides to display</p>
          </div>
        )}

        {/* Navigation arrows */}
        {total > 1 && (
          <>
            <button
              type="button"
              className={cn(
                "absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-muted/20 p-2 text-foreground transition-colors hover:bg-muted/40",
                index === 0 && "pointer-events-none opacity-30"
              )}
              onClick={() => setIndex(Math.max(0, index - 1))}
              disabled={index === 0}
            >
              <ChevronLeftIcon className="size-4" />
            </button>
            <button
              type="button"
              className={cn(
                "absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-muted/20 p-2 text-foreground transition-colors hover:bg-muted/40",
                index === total - 1 && "pointer-events-none opacity-30"
              )}
              onClick={() => setIndex(Math.min(total - 1, index + 1))}
              disabled={index === total - 1}
            >
              <ChevronRightIcon className="size-4" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
