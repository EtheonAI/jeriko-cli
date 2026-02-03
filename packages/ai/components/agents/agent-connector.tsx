"use client";

import * as React from "react";
import { cn } from "@repo/design-system/lib/utils";
import { ArrowRightIcon, ChevronRightIcon } from "lucide-react";

export interface AgentConnectorProps {
  className?: string;
  direction?: "horizontal" | "vertical";
  status?: "pending" | "active" | "completed";
  showArrow?: boolean;
}

/**
 * AgentConnector - Connection lines between agent nodes
 */
export function AgentConnector({
  className,
  direction = "horizontal",
  status = "pending",
  showArrow = true,
}: AgentConnectorProps) {
  const color = {
    pending: "bg-border text-muted-foreground",
    active: "bg-primary text-primary",
    completed: "bg-green-500 text-green-500",
  }[status];

  if (direction === "vertical") {
    return (
      <div className={cn("flex flex-col items-center py-1", className)}>
        <div className={cn("h-4 w-0.5 rounded-full", color.split(" ")[0])} />
        {showArrow && (
          <ChevronRightIcon
            className={cn("size-3 rotate-90", color.split(" ")[1])}
          />
        )}
      </div>
    );
  }

  return (
    <div className={cn("flex items-center px-1", className)}>
      <div className={cn("h-0.5 w-4 rounded-full", color.split(" ")[0])} />
      {showArrow && (
        <ArrowRightIcon
          className={cn("size-3", color.split(" ")[1])}
        />
      )}
    </div>
  );
}
