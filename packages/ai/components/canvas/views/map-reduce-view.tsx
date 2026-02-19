"use client";

import * as React from "react";
import { LayoutGridIcon, CheckCircleIcon, XCircleIcon, LoaderIcon } from "lucide-react";
import { cn } from "@repo/design-system/lib/utils";

// ============================================================================
// Types
// ============================================================================

export interface MapReduceViewProps {
  /** Tasks with status and optional progress */
  tasks?: Array<{ id: string; label: string; status: string; progress?: number }>;
  /** Overall progress 0-100 */
  overallProgress?: number;
}

// ============================================================================
// Status icon helper
// ============================================================================

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "completed":
    case "complete":
      return <CheckCircleIcon className="size-4 text-green-400" />;
    case "failed":
    case "error":
      return <XCircleIcon className="size-4 text-red-400" />;
    case "running":
    case "in_progress":
      return <LoaderIcon className="size-4 animate-spin text-blue-400" />;
    default:
      return <div className="size-4 rounded-full border-2 border-muted-foreground/30" />;
  }
}

// ============================================================================
// Component
// ============================================================================

export function MapReduceView({ tasks, overallProgress }: MapReduceViewProps) {
  const hasTasks = tasks && tasks.length > 0;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/10 bg-canvas-surface px-3 py-2">
        <div className="flex items-center gap-2">
          <LayoutGridIcon className="size-3.5 text-cyan-400" />
          <span className="text-xs font-medium text-muted-foreground/70">
            Parallel Processing
          </span>
        </div>
        {overallProgress != null && overallProgress > 0 && (
          <span className="text-xs text-muted-foreground/50">
            {Math.round(overallProgress)}%
          </span>
        )}
      </div>

      {/* Overall progress bar */}
      {overallProgress != null && overallProgress > 0 && (
        <div className="border-b border-border/10 bg-canvas-surface px-3 py-2">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/20">
            <div
              className={cn(
                "h-full rounded-full transition-[width] duration-300",
                overallProgress >= 100 ? "bg-green-500" : "bg-blue-500"
              )}
              style={{ width: `${Math.min(100, overallProgress)}%` }}
            />
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex flex-1 items-start justify-center overflow-auto bg-canvas-deep">
        {hasTasks ? (
          <div className="grid w-full max-w-lg grid-cols-1 gap-3 p-6">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center gap-3 rounded-lg border border-border/10 bg-canvas-surface p-4"
              >
                <StatusIcon status={task.status} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-foreground/80">
                    {task.label}
                  </div>
                  <div className="mt-0.5 text-xs capitalize text-muted-foreground/50">
                    {task.status.replace(/_/g, " ")}
                  </div>
                </div>
                {task.progress != null && task.progress > 0 && task.progress < 100 && (
                  <span className="flex-shrink-0 text-xs font-mono text-muted-foreground/40">
                    {Math.round(task.progress)}%
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center text-center text-muted-foreground/40">
            <div>
              <LayoutGridIcon className="mx-auto mb-3 size-12 opacity-30" />
              <p className="text-sm">Map/Reduce Tasks</p>
              <p className="mt-1 text-xs text-muted-foreground/30">
                Parallel subtask execution
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
