"use client";

import * as React from "react";
import { cn } from "@repo/design-system/lib/utils";
import { Skeleton } from "@repo/design-system/components/ui/skeleton";
import { LoaderIcon } from "lucide-react";

export interface ToolStatesProps {
  state: "streaming" | "executing" | "loading";
  className?: string;
  message?: string;
}

/**
 * ToolStates - Loading/streaming states for tool cards
 */
export function ToolStates({
  state,
  className,
  message,
}: ToolStatesProps) {
  if (state === "streaming") {
    return (
      <div className={cn("space-y-2", className)}>
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-2 text-sm text-muted-foreground", className)}>
      <LoaderIcon className="size-4 animate-spin" />
      <span>{message ?? (state === "executing" ? "Executing..." : "Loading...")}</span>
    </div>
  );
}
