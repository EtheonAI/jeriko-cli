"use client";

import * as React from "react";
import { Suspense } from "react";
import { cn } from "@repo/design-system/lib/utils";
import { ShieldXIcon } from "lucide-react";
import type { StaticToolUIPart, DynamicToolUIPart } from "../../lib/types/ui-message";
import { getToolName } from "../../lib/types/ui-message";
import { ToolCompact } from "../tools/tool-compact";
import { ToolInlineCompact } from "../tools/renderers/tool-inline-compact";
import { useToolRegistry } from "../tools/tool-registry";
import { ApprovalCard } from "../tools/renderers/approval-card";
import { TOOL_VIEW_MAP } from "../canvas/use-canvas";

// ============================================================================
// Types
// ============================================================================

export interface ToolPartProps {
  part: StaticToolUIPart | DynamicToolUIPart;
  className?: string;
  onApproval?: (toolCallId: string, approved: boolean, reason?: string) => void;
  onViewInCanvas?: (toolCallId: string) => void;
  variant?: "auto" | "compact" | "expanded";
  /** Timestamp text to show on hover */
  timestamp?: string;
}

// Tools that get their full custom renderer (not pill)
const FULL_RENDERER_TOOLS = new Set([
  "generate_image",
  "message_notify_user",
  "message_ask_user",
  "gmail_send",
  "outlook_send",
]);

// Debug mode
const DEBUG_TOOLS = typeof window !== "undefined"
  && (globalThis as Record<string, unknown>).__NEXT_DATA__
  ? process.env.NEXT_PUBLIC_DEBUG_TOOLS === "true"
  : false;

// ============================================================================
// Component
// ============================================================================

export function ToolPart({
  part,
  className,
  onApproval,
  onViewInCanvas,
  variant = "auto",
  timestamp,
}: ToolPartProps) {
  const { getRenderer } = useToolRegistry();

  if (!part || !part.toolCallId || !part.state) return null;

  const toolName = getToolName(part);
  const hasCanvasView = !!TOOL_VIEW_MAP[toolName];

  // Approval requested — always show approval card
  if (part.state === "approval-requested") {
    return (
      <div
        data-testid="tool-card"
        data-tool-name={toolName}
        data-tool-state="approval-requested"
        className={cn("my-2", className)}
      >
        <ApprovalCard
          toolName={toolName}
          toolCallId={part.toolCallId}
          input={part.input}
          title={(part as { title?: string }).title}
          onApprove={(reason) => onApproval?.(part.toolCallId, true, reason)}
          onDeny={(reason) => onApproval?.(part.toolCallId, false, reason)}
        />
      </div>
    );
  }

  // Denied
  if (part.state === "output-denied") {
    return (
      <div
        data-testid="tool-card"
        data-tool-name={toolName}
        data-tool-state="output-denied"
        className={cn("my-2", className)}
      >
        <div className="rounded-lg bg-orange-500/5 border border-orange-500/20 p-3 text-sm text-orange-600 dark:text-orange-400">
          <div className="flex items-center gap-2">
            <ShieldXIcon className="size-4" />
            <span className="font-medium">Execution Denied</span>
          </div>
          {part.approval?.reason && (
            <p className="mt-1 opacity-80">Reason: {part.approval.reason}</p>
          )}
        </div>
      </div>
    );
  }

  // show_plan — render with its own renderer
  if (toolName === "show_plan") {
    const ToolRenderer = getRenderer(toolName);
    return (
      <div
        data-testid="tool-card"
        data-tool-name={toolName}
        data-tool-state={part.state}
        className={cn("my-1", className)}
      >
        <Suspense fallback={<ToolCompact toolName={toolName} state={part.state} />}>
          <ToolRenderer
            toolName={toolName}
            toolCallId={part.toolCallId}
            state={part.state}
            input={part.input}
            output={part.output}
            errorText={part.errorText}
          />
        </Suspense>
      </div>
    );
  }

  // Canvas-mapped tools → clickable pill that opens canvas
  if (hasCanvasView && !DEBUG_TOOLS && variant !== "expanded") {
    return (
      <div
        data-testid="tool-card"
        data-tool-name={toolName}
        data-tool-state={part.state}
        className={cn("my-0.5", className)}
      >
        <ToolInlineCompact
          toolName={toolName}
          state={part.state}
          input={part.input as Record<string, unknown> | undefined}
          output={part.output as Record<string, unknown> | undefined}
          onClick={onViewInCanvas ? () => onViewInCanvas(part.toolCallId) : undefined}
          timestamp={timestamp}
        />
      </div>
    );
  }

  // Full renderer tools (generate_image)
  if (FULL_RENDERER_TOOLS.has(toolName) || variant === "expanded" || DEBUG_TOOLS) {
    const ToolRenderer = getRenderer(toolName);
    return (
      <div
        data-testid="tool-card"
        data-tool-name={toolName}
        data-tool-state={part.state}
        className={cn("my-2", className)}
      >
        <Suspense fallback={<ToolCompact toolName={toolName} state={part.state} />}>
          <ToolRenderer
            toolName={toolName}
            toolCallId={part.toolCallId}
            state={part.state}
            input={part.input}
            output={part.output}
            errorText={part.errorText}
          />
        </Suspense>
      </div>
    );
  }

  // Everything else → compact pill (also clickable if canvas-mapped)
  const summary = getCompactSummary(toolName, part);
  const title = (part as { title?: string }).title;
  return (
    <ToolCompact
      toolName={toolName}
      state={part.state}
      title={title}
      summary={summary}
      className={className}
    />
  );
}

// ============================================================================
// Helpers
// ============================================================================

function getCompactSummary(
  toolName: string,
  part: StaticToolUIPart | DynamicToolUIPart
): string | undefined {
  if (part.state !== "output-available") return undefined;

  const input = part.input as Record<string, unknown> | undefined;
  const output = part.output as Record<string, unknown> | undefined;

  switch (toolName) {
    case "message_notify_user":
      return (input?.text as string) ?? (output?.text as string) ?? (input?.message as string);
    case "message_ask_user":
      return (input?.text as string) ?? (output?.text as string);
    case "schedule_recurring_task":
      return input?.name as string | undefined;
    case "check_outcomes":
      return (output?.summary as string) ?? undefined;
    default:
      return undefined;
  }
}
