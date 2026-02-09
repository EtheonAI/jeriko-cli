"use client";

import * as React from "react";
import { cn } from "@repo/design-system/lib/utils";
import { ShieldXIcon, MonitorIcon } from "lucide-react";
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
}

// Tools that keep their full custom renderers inline (no canvas view)
const NON_CANVAS_FULL_RENDERERS = new Set([
  "show_plan",
  "message_notify_user",
  "message_ask_user",
  "schedule_recurring_task",
  "check_outcomes",
  "generate_image",
]);

// Debug mode — set NEXT_PUBLIC_DEBUG_TOOLS=true to restore full inline rendering
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
}: ToolPartProps) {
  const { getRenderer } = useToolRegistry();

  // Safety: skip rendering if part is malformed (missing required fields)
  if (!part || !part.toolCallId || !part.state) return null;

  const toolName = getToolName(part);
  const hasCanvasView = !!TOOL_VIEW_MAP[toolName];

  // Approval requested — always show approval card regardless of variant
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

  // Denied — always show denied message
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

  // Canvas-mapped tools → compact inline indicator (unless debug mode)
  if (hasCanvasView && !DEBUG_TOOLS && variant !== "expanded") {
    return (
      <div
        data-testid="tool-card"
        data-tool-name={toolName}
        data-tool-state={part.state}
        className={cn("group/tool relative my-0.5", className)}
      >
        <ToolInlineCompact
          toolName={toolName}
          state={part.state}
          input={part.input as Record<string, unknown> | undefined}
          output={part.output as Record<string, unknown> | undefined}
        />

        {/* "View in Canvas" pin — hover to reveal */}
        {onViewInCanvas && part.state === "output-available" && (
          <div
            role="button"
            tabIndex={0}
            onClick={() => onViewInCanvas(part.toolCallId)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onViewInCanvas(part.toolCallId);
              }
            }}
            title="View in canvas"
            className="absolute right-0 top-0.5 flex size-6 cursor-pointer items-center justify-center rounded-md bg-muted/80 text-muted-foreground opacity-0 shadow-sm transition-opacity hover:bg-muted hover:text-foreground group-hover/tool:opacity-100"
          >
            <MonitorIcon className="size-3" />
          </div>
        )}
      </div>
    );
  }

  // Non-canvas tools with compact pills (message_notify_user, etc.)
  const useCompactPill =
    variant === "compact" ||
    (variant === "auto" && NON_CANVAS_FULL_RENDERERS.has(toolName) &&
      toolName !== "show_plan" && toolName !== "generate_image");

  if (useCompactPill) {
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

  // Full renderers — non-canvas tools (show_plan, generate_image) + debug mode
  const ToolRenderer = getRenderer(toolName);

  return (
    <div
      data-testid="tool-card"
      data-tool-name={toolName}
      data-tool-state={part.state}
      className={cn("group/tool relative my-2", className)}
    >
      <ToolRenderer
        toolName={toolName}
        toolCallId={part.toolCallId}
        state={part.state}
        input={part.input}
        output={part.output}
        errorText={part.errorText}
      />

      {/* "View in Canvas" pin — only for tools with canvas views + completed output */}
      {hasCanvasView && onViewInCanvas && part.state === "output-available" && (
        <div
          role="button"
          tabIndex={0}
          onClick={() => onViewInCanvas(part.toolCallId)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onViewInCanvas(part.toolCallId);
            }
          }}
          title="View in canvas"
          className="absolute right-2 top-2 flex size-7 cursor-pointer items-center justify-center rounded-md bg-muted/80 text-muted-foreground opacity-0 shadow-sm transition-opacity hover:bg-muted hover:text-foreground group-hover/tool:opacity-100"
        >
          <MonitorIcon className="size-3.5" />
        </div>
      )}
    </div>
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
