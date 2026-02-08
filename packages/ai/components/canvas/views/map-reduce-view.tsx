"use client";

import * as React from "react";
import { LayoutGridIcon } from "lucide-react";

// ============================================================================
// Types
// ============================================================================

export interface MapReduceViewProps {
  /** Placeholder for future task grid data */
  tasks?: Array<{ id: string; label: string; status: string }>;
}

// ============================================================================
// Component
// ============================================================================

export function MapReduceView({ tasks }: MapReduceViewProps) {
  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border/10 bg-canvas-surface px-3 py-2">
        <LayoutGridIcon className="size-3.5 text-cyan-400" />
        <span className="text-xs font-medium text-muted-foreground/70">Parallel Processing</span>
      </div>

      {/* Content */}
      <div className="flex flex-1 items-center justify-center bg-canvas-deep">
        {tasks && tasks.length > 0 ? (
          <div className="grid w-full max-w-lg grid-cols-2 gap-3 p-6">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="rounded-lg border border-border/10 bg-canvas-surface p-3"
              >
                <div className="mb-1 text-xs font-medium text-foreground/80">{task.label}</div>
                <div className="text-xs text-muted-foreground/50">{task.status}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-muted-foreground/40">
            <LayoutGridIcon className="mx-auto mb-3 size-12 opacity-30" />
            <p className="text-sm">Map/Reduce Tasks</p>
            <p className="mt-1 text-xs text-muted-foreground/30">Parallel subtask execution</p>
          </div>
        )}
      </div>
    </div>
  );
}
