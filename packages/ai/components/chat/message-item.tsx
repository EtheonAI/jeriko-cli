"use client";

import * as React from "react";
import { cn } from "@repo/design-system/lib/utils";
import type { UIMessage } from "../../lib/types/ui-message";
import { UserMessage } from "./user-message";
import { AssistantMessage } from "./assistant-message";

export interface MessageItemProps {
  message: UIMessage;
  className?: string;
  onAction?: (action: string, messageId: string) => void;
  onToolApproval?: (toolCallId: string, approved: boolean, reason?: string) => void;
}

/**
 * MessageItem - Routes messages to appropriate component based on role
 */
export function MessageItem({
  message,
  className,
  onAction,
  onToolApproval,
}: MessageItemProps) {
  const handleAction = (action: string) => {
    onAction?.(action, message.id);
  };

  switch (message.role) {
    case "user":
      return (
        <UserMessage
          message={message}
          className={className}
          onAction={handleAction}
        />
      );

    case "assistant":
      return (
        <AssistantMessage
          message={message}
          className={className}
          onAction={handleAction}
          onToolApproval={onToolApproval}
        />
      );

    case "system":
      return (
        <div
          className={cn(
            "mx-auto max-w-2xl rounded-lg bg-muted/50 px-4 py-2 text-center text-sm text-muted-foreground",
            className
          )}
        >
          {message.parts
            .filter((p) => p.type === "text")
            .map((p) => (p as { type: "text"; text: string }).text)
            .join("")}
        </div>
      );

    default:
      return null;
  }
}
