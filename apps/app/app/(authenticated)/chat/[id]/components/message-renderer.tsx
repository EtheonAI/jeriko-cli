"use client";

import * as React from "react";
import { useMemo } from "react";
import type { UIMessage } from "ai";
import {
  TextPartRenderer,
  ReasoningPartRenderer,
  FilePartRenderer,
  ToolPartRenderer,
  SourcesGroup,
} from "@repo/ai/components/parts";
import type {
  TextUIPart,
  ReasoningUIPart,
  FileUIPart,
  StaticToolUIPart,
  DynamicToolUIPart,
  SourceUrlUIPart,
  SourceDocumentUIPart,
  UIMessagePart,
} from "@repo/ai/lib/types";
import {
  isTextUIPart,
  isReasoningUIPart,
  isFileUIPart,
  isToolUIPart,
  isSourceUrlUIPart,
  isSourceDocumentUIPart,
  isStepStartUIPart,
  getToolName,
} from "@repo/ai/lib/types";

// ============================================================================
// Constants
// ============================================================================

/** Tools rendered by PlannerBar — skip inline rendering to avoid duplication */
const PLANNER_TOOLS = new Set(["show_plan"]);

// ============================================================================
// Component
// ============================================================================

interface MessageRendererProps {
  message: UIMessage;
  isLastMessage: boolean;
  isStreaming: boolean;
  onViewSources?: (sources: (SourceUrlUIPart | SourceDocumentUIPart)[]) => void;
  onViewInCanvas?: (toolCallId: string) => void;
}

export function MessageRenderer({
  message,
  isLastMessage,
  isStreaming,
  onViewSources,
  onViewInCanvas,
}: MessageRendererProps) {
  const parts = message.parts as unknown as UIMessagePart[];

  // Collect native source parts for grouped display at the bottom
  const sources = useMemo(() => {
    if (!parts || !Array.isArray(parts)) return [];
    const collected: (SourceUrlUIPart | SourceDocumentUIPart)[] = [];
    const seenUrls = new Set<string>();

    for (const part of parts) {
      if (!part || typeof part !== "object" || !("type" in part)) continue;

      if (isSourceUrlUIPart(part)) {
        if (!seenUrls.has(part.url)) {
          seenUrls.add(part.url);
          collected.push(part);
        }
      } else if (isSourceDocumentUIPart(part)) {
        collected.push(part);
      }
    }
    return collected;
  }, [parts]);

  return (
    <>
      {(parts ?? []).map((part, i) => {
        // Skip undefined/null/malformed parts
        if (!part || typeof part !== "object" || !("type" in part)) return null;

        // Skip step-start markers
        if (isStepStartUIPart(part)) return null;

        // Skip native source parts — rendered as SourcesGroup below
        if (isSourceUrlUIPart(part) || isSourceDocumentUIPart(part)) return null;

        // Text
        if (isTextUIPart(part)) {
          if (!part.text) return null;
          return (
            <TextPartRenderer
              key={`${message.id}-text-${i}`}
              part={part as TextUIPart}
            />
          );
        }

        // Reasoning
        if (isReasoningUIPart(part)) {
          return (
            <ReasoningPartRenderer
              key={`${message.id}-reasoning-${i}`}
              part={part as ReasoningUIPart}
            />
          );
        }

        // File parts
        if (isFileUIPart(part)) {
          return (
            <FilePartRenderer
              key={`${message.id}-file-${i}`}
              part={part as FileUIPart}
            />
          );
        }

        // Tool parts
        if (isToolUIPart(part)) {
          const toolPart = part as StaticToolUIPart | DynamicToolUIPart;
          const toolName = getToolName(toolPart);

          // Skip show_plan — PlannerBar is the single plan UI
          if (PLANNER_TOOLS.has(toolName)) return null;

          return (
            <ToolPartRenderer
              key={`${message.id}-tool-${toolPart.toolCallId}`}
              part={toolPart}
              onViewInCanvas={onViewInCanvas}
            />
          );
        }

        // File parts / Data parts — skip
        return null;
      })}

      {/* Sources group at bottom of message */}
      {sources.length > 0 && <SourcesGroup sources={sources} onViewSources={onViewSources} />}
    </>
  );
}
