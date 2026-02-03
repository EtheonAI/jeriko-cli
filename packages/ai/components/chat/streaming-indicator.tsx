"use client";

import * as React from "react";
import { cn } from "@repo/design-system/lib/utils";

export interface StreamingIndicatorProps {
  isActive?: boolean;
  typingUsers?: string[];
  className?: string;
  variant?: "dots" | "pulse" | "text";
}

/**
 * StreamingIndicator - Shows typing/streaming animation
 */
export function StreamingIndicator({
  isActive = false,
  typingUsers = [],
  className,
  variant = "dots",
}: StreamingIndicatorProps) {
  if (!isActive && typingUsers.length === 0) {
    return null;
  }

  const label = typingUsers.length > 0
    ? typingUsers.length === 1
      ? `${typingUsers[0]} is typing`
      : typingUsers.length === 2
      ? `${typingUsers[0]} and ${typingUsers[1]} are typing`
      : `${typingUsers[0]} and ${typingUsers.length - 1} others are typing`
    : "Thinking";

  if (variant === "text") {
    return (
      <div className={cn("flex items-center gap-2 text-sm text-muted-foreground", className)}>
        <span>{label}</span>
        <span className="animate-pulse">...</span>
      </div>
    );
  }

  if (variant === "pulse") {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <div className="size-2 animate-pulse rounded-full bg-primary" />
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
    );
  }

  // Default: dots
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="flex items-center gap-1">
        <div
          className="size-2 animate-bounce rounded-full bg-muted-foreground/60"
          style={{ animationDelay: "0ms" }}
        />
        <div
          className="size-2 animate-bounce rounded-full bg-muted-foreground/60"
          style={{ animationDelay: "150ms" }}
        />
        <div
          className="size-2 animate-bounce rounded-full bg-muted-foreground/60"
          style={{ animationDelay: "300ms" }}
        />
      </div>
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  );
}
