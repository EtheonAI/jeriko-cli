"use client";

import * as React from "react";
import { cn } from "@repo/design-system/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@repo/design-system/components/ui/avatar";
import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import {
  MoreHorizontalIcon,
  CopyIcon,
  RefreshCwIcon,
  ThumbsUpIcon,
  ThumbsDownIcon,
  BotIcon,
} from "lucide-react";
import type {
  UIMessage,
  UIMessagePart,
  TextUIPart,
  ReasoningUIPart,
  FileUIPart,
  SourceUrlUIPart,
  SourceDocumentUIPart,
  StaticToolUIPart,
  DynamicToolUIPart,
} from "../../lib/types/ui-message";
import { isToolUIPart } from "../../lib/types/ui-message";
import { TextPart } from "../parts/text-part";
import { ReasoningPart } from "../parts/reasoning-part";
import { FilePart } from "../parts/file-part";
import { SourcePart } from "../parts/source-part";
import { ToolPart } from "../parts/tool-part";

// Note: These are imported directly from files, not from the index barrel,
// to avoid name conflicts with types from the 'ai' package

export interface AssistantMessageProps {
  message: UIMessage;
  className?: string;
  assistant?: {
    name?: string;
    image?: string;
  };
  onAction?: (action: string) => void;
  onToolApproval?: (toolCallId: string, approved: boolean, reason?: string) => void;
  showAvatar?: boolean;
}

/**
 * AssistantMessage - Renders assistant messages with all part types
 */
export function AssistantMessage({
  message,
  className,
  assistant,
  onAction,
  onToolApproval,
  showAvatar = true,
}: AssistantMessageProps) {
  const handleCopy = () => {
    const textContent = message.parts
      .filter((p): p is TextUIPart => p.type === "text")
      .map((p) => p.text)
      .join("");
    navigator.clipboard.writeText(textContent);
    onAction?.("copy");
  };

  // Group parts for rendering
  const renderPart = (part: UIMessagePart, index: number) => {
    switch (part.type) {
      case "text":
        return (
          <TextPart
            key={`${message.id}-text-${index}`}
            part={part as TextUIPart}
          />
        );

      case "reasoning":
        return (
          <ReasoningPart
            key={`${message.id}-reasoning-${index}`}
            part={part as ReasoningUIPart}
          />
        );

      case "file":
        return (
          <FilePart
            key={`${message.id}-file-${index}`}
            part={part as FileUIPart}
          />
        );

      case "source-url":
        return (
          <SourcePart
            key={`${message.id}-source-${index}`}
            part={part as SourceUrlUIPart}
          />
        );

      case "source-document":
        return (
          <SourcePart
            key={`${message.id}-source-doc-${index}`}
            part={part as SourceDocumentUIPart}
          />
        );

      case "step-start":
        return (
          <div
            key={`${message.id}-step-${index}`}
            className="my-2 border-t border-dashed border-border"
          />
        );

      default:
        // Handle tool parts and data parts
        if (isToolUIPart(part)) {
          return (
            <ToolPart
              key={`${message.id}-tool-${index}`}
              part={part as StaticToolUIPart | DynamicToolUIPart}
              onApproval={onToolApproval}
            />
          );
        }

        // Data parts
        if (part.type.startsWith("data-")) {
          return null; // Let app handle custom data parts
        }

        return null;
    }
  };

  // Collect sources for potential sidebar
  const sources = message.parts.filter(
    (p): p is SourceUrlUIPart | SourceDocumentUIPart =>
      p.type === "source-url" || p.type === "source-document"
  );

  // Check if any tool is streaming
  const hasStreamingTool = message.parts.some(
    (p) => isToolUIPart(p) && p.state === "input-streaming"
  );

  // Check if any text is streaming
  const hasStreamingText = message.parts.some(
    (p): p is TextUIPart => p.type === "text" && p.state === "streaming"
  );

  return (
    <div className={cn("group flex gap-3", className)}>
      {/* Avatar */}
      {showAvatar && (
        <Avatar className="size-8 flex-shrink-0">
          <AvatarImage src={assistant?.image} alt={assistant?.name ?? "Assistant"} />
          <AvatarFallback className="bg-gradient-to-br from-violet-500 to-purple-600">
            <BotIcon className="size-4 text-white" />
          </AvatarFallback>
        </Avatar>
      )}

      {/* Message content */}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {/* Assistant name */}
        {assistant?.name && (
          <span className="text-sm font-medium text-foreground">
            {assistant.name}
          </span>
        )}

        {/* Parts */}
        <div className="flex flex-col gap-2">
          {message.parts.map((part, index) => renderPart(part, index))}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2">
          {/* Timestamp */}
          {message.createdAt && !hasStreamingText && !hasStreamingTool && (
            <span className="text-xs text-muted-foreground">
              {formatTime(message.createdAt)}
            </span>
          )}

          {/* Model info */}
          {message.metadata?.model && (
            <span className="text-xs text-muted-foreground">
              {message.metadata.model}
            </span>
          )}

          {/* Actions */}
          <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={handleCopy}
            >
              <CopyIcon className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => onAction?.("regenerate")}
            >
              <RefreshCwIcon className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => onAction?.("like")}
            >
              <ThumbsUpIcon className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => onAction?.("dislike")}
            >
              <ThumbsDownIcon className="size-3.5" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-7">
                  <MoreHorizontalIcon className="size-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={handleCopy}>
                  <CopyIcon className="mr-2 size-4" />
                  Copy
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onAction?.("regenerate")}>
                  <RefreshCwIcon className="mr-2 size-4" />
                  Regenerate
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(date));
}
