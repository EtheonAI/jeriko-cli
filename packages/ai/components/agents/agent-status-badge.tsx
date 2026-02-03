"use client";

import * as React from "react";
import { cn } from "@repo/design-system/lib/utils";
import {
  CheckIcon,
  CircleIcon,
  LoaderIcon,
  PauseIcon,
  XIcon,
} from "lucide-react";

export type AgentStatus =
  | "idle"
  | "thinking"
  | "executing"
  | "waiting"
  | "completed"
  | "failed";

export interface AgentStatusBadgeProps {
  status: AgentStatus;
  className?: string;
  size?: "sm" | "md";
  showLabel?: boolean;
}

/**
 * AgentStatusBadge - Status indicator with animation
 */
export function AgentStatusBadge({
  status,
  className,
  size = "md",
  showLabel = false,
}: AgentStatusBadgeProps) {
  const { icon: Icon, color, label, animate, pulse } = getStatusInfo(status);

  const sizeClasses = {
    sm: "size-4",
    md: "size-5",
  };

  const iconSizeClasses = {
    sm: "size-2.5",
    md: "size-3",
  };

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <div
        className={cn(
          "relative flex items-center justify-center rounded-full",
          sizeClasses[size],
          color
        )}
      >
        {/* Pulse animation for active states */}
        {pulse && (
          <div
            className={cn(
              "absolute inset-0 animate-ping rounded-full opacity-50",
              color
            )}
          />
        )}

        <Icon
          className={cn(
            iconSizeClasses[size],
            animate && "animate-spin"
          )}
        />
      </div>

      {showLabel && (
        <span className="text-xs text-muted-foreground">{label}</span>
      )}
    </div>
  );
}

function getStatusInfo(status: AgentStatus): {
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  label: string;
  animate: boolean;
  pulse: boolean;
} {
  switch (status) {
    case "idle":
      return {
        icon: CircleIcon,
        color: "bg-muted text-muted-foreground",
        label: "Idle",
        animate: false,
        pulse: false,
      };

    case "thinking":
      return {
        icon: LoaderIcon,
        color: "bg-violet-500/20 text-violet-500",
        label: "Thinking",
        animate: true,
        pulse: true,
      };

    case "executing":
      return {
        icon: LoaderIcon,
        color: "bg-blue-500/20 text-blue-500",
        label: "Executing",
        animate: true,
        pulse: true,
      };

    case "waiting":
      return {
        icon: PauseIcon,
        color: "bg-yellow-500/20 text-yellow-500",
        label: "Waiting",
        animate: false,
        pulse: false,
      };

    case "completed":
      return {
        icon: CheckIcon,
        color: "bg-green-500/20 text-green-500",
        label: "Completed",
        animate: false,
        pulse: false,
      };

    case "failed":
      return {
        icon: XIcon,
        color: "bg-destructive/20 text-destructive",
        label: "Failed",
        animate: false,
        pulse: false,
      };

    default:
      return {
        icon: CircleIcon,
        color: "bg-muted text-muted-foreground",
        label: "Unknown",
        animate: false,
        pulse: false,
      };
  }
}
