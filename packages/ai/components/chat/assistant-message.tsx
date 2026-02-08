"use client";

import * as React from "react";
import { useState, useCallback } from "react";
import { cn } from "@repo/design-system/lib/utils";
import { Button } from "@repo/design-system/components/ui/button";
import {
  CopyIcon,
  CheckIcon,
  RefreshCwIcon,
  ThumbsUpIcon,
  ThumbsDownIcon,
  SparklesIcon,
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
  DataUIPart,
} from "../../lib/types/ui-message";
import { isToolUIPart, isDataUIPart } from "../../lib/types/ui-message";
import { TextPart } from "../parts/text-part";
import { ReasoningPart } from "../parts/reasoning-part";
import { FilePart } from "../parts/file-part";
import { ToolPart } from "../parts/tool-part";
import { SourcesGroup } from "../parts/sources-group";
import { ChainOfThought } from "../parts/chain-of-thought";
import { PlanDisplay } from "../parts/plan-display";
import { TaskList } from "../parts/task-list";
import { QueueDisplay } from "../parts/queue-display";
import { AttachmentsGrid } from "../parts/attachments-grid";
import type { ChainOfThoughtStep } from "../parts/chain-of-thought";
import type { PlanStep } from "../parts/plan-display";
import type { TaskItem } from "../parts/task-list";
import type { QueueSection } from "../parts/queue-display";

// ============================================================================
// Types
// ============================================================================

export interface AssistantMessageProps {
  message: UIMessage;
  className?: string;
  assistant?: { name?: string; image?: string };
  onAction?: (action: string) => void;
  onToolApproval?: (toolCallId: string, approved: boolean, reason?: string) => void;
  onViewInCanvas?: (toolCallId: string) => void;
  showAvatar?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function AssistantMessage({
  message,
  className,
  assistant,
  onAction,
  onToolApproval,
  onViewInCanvas,
  showAvatar = true,
}: AssistantMessageProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    const text = message.parts
      .filter((p): p is TextUIPart => p.type === "text")
      .map((p) => p.text)
      .join("");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    onAction?.("copy");
  }, [message.parts, onAction]);

  // Collect sources for grouped display
  const sources = message.parts.filter(
    (p): p is SourceUrlUIPart | SourceDocumentUIPart =>
      p.type === "source-url" || p.type === "source-document"
  );

  // Collect file attachments for grid display
  const files = message.parts.filter(
    (p): p is FileUIPart => p.type === "file"
  );

  // Check streaming state
  const isStreaming = message.parts.some(
    (p) =>
      (p.type === "text" && (p as TextUIPart).state === "streaming") ||
      (p.type === "reasoning" && (p as ReasoningUIPart).state === "streaming") ||
      (isToolUIPart(p) && (p.state === "input-streaming" || p.state === "input-available"))
  );

  // Render individual parts
  const renderPart = (part: UIMessagePart, index: number) => {
    switch (part.type) {
      case "text":
        return <TextPart key={`text-${index}`} part={part as TextUIPart} />;

      case "reasoning":
        return <ReasoningPart key={`reasoning-${index}`} part={part as ReasoningUIPart} />;

      // Files handled in grid below
      case "file":
        return null;

      // Sources handled in group below
      case "source-url":
      case "source-document":
        return null;

      case "step-start":
        return null;

      default:
        // Tool parts
        if (isToolUIPart(part)) {
          return (
            <ToolPart
              key={`tool-${index}`}
              part={part as StaticToolUIPart | DynamicToolUIPart}
              onApproval={onToolApproval}
              onViewInCanvas={onViewInCanvas}
            />
          );
        }

        // Data parts (chain-of-thought, plan, tasks, queue)
        if (isDataUIPart(part)) {
          return renderDataPart(part as DataUIPart, index);
        }

        return null;
    }
  };

  return (
    <div className={cn("group flex gap-3", className)}>
      {/* Avatar */}
      {showAvatar && (
        <div className="flex size-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-600">
          {assistant?.image ? (
            <img
              src={assistant.image}
              alt={assistant.name ?? "AI"}
              className="size-8 rounded-full"
            />
          ) : (
            <SparklesIcon className="size-4 text-white" />
          )}
        </div>
      )}

      {/* Content */}
      <div className="min-w-0 flex-1 space-y-3">
        {/* Message parts */}
        {message.parts.map((part, i) => renderPart(part, i))}

        {/* File attachments (grouped grid) */}
        {files.length > 0 && (
          <AttachmentsGrid files={files} variant="grid" />
        )}

        {/* Grouped sources */}
        {sources.length > 0 && (
          <SourcesGroup sources={sources} />
        )}

        {/* Actions toolbar */}
        {!isStreaming && message.parts.some((p) => p.type === "text") && (
          <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground hover:text-foreground"
              onClick={handleCopy}
            >
              {copied ? (
                <CheckIcon className="size-3.5 text-green-500" />
              ) : (
                <CopyIcon className="size-3.5" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground hover:text-foreground"
              onClick={() => onAction?.("regenerate")}
            >
              <RefreshCwIcon className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground hover:text-foreground"
              onClick={() => onAction?.("like")}
            >
              <ThumbsUpIcon className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground hover:text-foreground"
              onClick={() => onAction?.("dislike")}
            >
              <ThumbsDownIcon className="size-3.5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Data Part Renderer
// ============================================================================

function renderDataPart(part: DataUIPart, index: number): React.ReactNode {
  const data = part.data as Record<string, unknown>;

  switch (part.type) {
    case "data-chain-of-thought":
      return (
        <ChainOfThought
          key={`cot-${index}`}
          steps={(data.steps as ChainOfThoughtStep[]) ?? []}
          title={data.title as string | undefined}
        />
      );

    case "data-plan":
      return (
        <PlanDisplay
          key={`plan-${index}`}
          title={data.title as string | undefined}
          description={data.description as string | undefined}
          steps={(data.steps as PlanStep[]) ?? []}
          isStreaming={(data.isStreaming as boolean) ?? false}
        />
      );

    case "data-tasks":
      return (
        <TaskList
          key={`tasks-${index}`}
          title={data.title as string | undefined}
          tasks={(data.tasks as TaskItem[]) ?? []}
        />
      );

    case "data-queue":
      return (
        <QueueDisplay
          key={`queue-${index}`}
          sections={(data.sections as QueueSection[]) ?? []}
        />
      );

    default:
      return null;
  }
}
