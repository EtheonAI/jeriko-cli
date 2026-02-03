"use client";

import * as React from "react";
import { useState } from "react";
import { cn } from "@repo/design-system/lib/utils";
import {
  ChevronDownIcon,
  CheckIcon,
  XIcon,
  LoaderIcon,
  AlertCircleIcon,
  ClockIcon,
  ShieldCheckIcon,
  ShieldXIcon,
} from "lucide-react";
import type { StaticToolUIPart, DynamicToolUIPart, ToolInvocationState } from "../../lib/types/ui-message";
import { getToolName } from "../../lib/types/ui-message";
import { ToolStates } from "./tool-states";
import { ApprovalCard } from "./renderers/approval-card";

export interface ToolCardProps {
  part: StaticToolUIPart | DynamicToolUIPart;
  className?: string;
  children?: React.ReactNode;
  onApproval?: (toolCallId: string, approved: boolean, reason?: string) => void;
  defaultExpanded?: boolean;
}

/**
 * ToolCard - Wrapper for tool invocations with state handling
 */
export function ToolCard({
  part,
  className,
  children,
  onApproval,
  defaultExpanded = true,
}: ToolCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const toolName = getToolName(part);

  const { icon: StateIcon, color, label, animate } = getStateInfo(part.state);

  // Show approval UI when needed
  if (part.state === "approval-requested") {
    return (
      <div className={cn("my-2", className)}>
        <ApprovalCard
          toolName={toolName}
          toolCallId={part.toolCallId}
          input={part.input}
          title={part.title}
          onApprove={(reason) => onApproval?.(part.toolCallId, true, reason)}
          onDeny={(reason) => onApproval?.(part.toolCallId, false, reason)}
        />
      </div>
    );
  }

  return (
    <div className={cn("my-2 overflow-hidden rounded-lg border border-border", className)}>
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between bg-muted/30 px-3 py-2 text-left transition-colors hover:bg-muted/50"
      >
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "flex size-6 items-center justify-center rounded-md",
              color
            )}
          >
            <StateIcon
              className={cn(
                "size-3.5",
                animate && "animate-spin"
              )}
            />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium">
              {part.title ?? formatToolName(toolName)}
            </span>
            <span className="text-xs text-muted-foreground">{label}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Error indicator */}
          {part.state === "output-error" && (
            <span className="text-xs text-destructive">Failed</span>
          )}

          {/* Denied indicator */}
          {part.state === "output-denied" && (
            <span className="text-xs text-orange-500">Denied</span>
          )}

          <ChevronDownIcon
            className={cn(
              "size-4 text-muted-foreground transition-transform",
              isExpanded && "rotate-180"
            )}
          />
        </div>
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="border-t border-border p-3">
          {/* Streaming skeleton */}
          {part.state === "input-streaming" && (
            <ToolStates state="streaming" />
          )}

          {/* Pending/executing states */}
          {(part.state === "input-available" || part.state === "approval-responded") && (
            <ToolStates state="executing" />
          )}

          {/* Error state */}
          {part.state === "output-error" && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              <div className="flex items-center gap-2">
                <AlertCircleIcon className="size-4" />
                <span className="font-medium">Error</span>
              </div>
              <p className="mt-1">{part.errorText ?? "An unknown error occurred"}</p>
            </div>
          )}

          {/* Denied state */}
          {part.state === "output-denied" && (
            <div className="rounded-md bg-orange-500/10 p-3 text-sm text-orange-600 dark:text-orange-400">
              <div className="flex items-center gap-2">
                <ShieldXIcon className="size-4" />
                <span className="font-medium">Execution Denied</span>
              </div>
              {part.approval?.reason && (
                <p className="mt-1">Reason: {part.approval.reason}</p>
              )}
            </div>
          )}

          {/* Output available - render the tool content */}
          {part.state === "output-available" && children}
        </div>
      )}
    </div>
  );
}

function getStateInfo(state: ToolInvocationState): {
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  label: string;
  animate: boolean;
} {
  switch (state) {
    case "input-streaming":
      return {
        icon: LoaderIcon,
        color: "bg-blue-500/10 text-blue-500",
        label: "Preparing...",
        animate: true,
      };

    case "input-available":
      return {
        icon: ClockIcon,
        color: "bg-yellow-500/10 text-yellow-500",
        label: "Pending execution",
        animate: false,
      };

    case "approval-requested":
      return {
        icon: ShieldCheckIcon,
        color: "bg-orange-500/10 text-orange-500",
        label: "Awaiting approval",
        animate: false,
      };

    case "approval-responded":
      return {
        icon: LoaderIcon,
        color: "bg-blue-500/10 text-blue-500",
        label: "Executing...",
        animate: true,
      };

    case "output-available":
      return {
        icon: CheckIcon,
        color: "bg-green-500/10 text-green-500",
        label: "Completed",
        animate: false,
      };

    case "output-error":
      return {
        icon: AlertCircleIcon,
        color: "bg-destructive/10 text-destructive",
        label: "Failed",
        animate: false,
      };

    case "output-denied":
      return {
        icon: XIcon,
        color: "bg-orange-500/10 text-orange-500",
        label: "Denied",
        animate: false,
      };

    default:
      return {
        icon: ClockIcon,
        color: "bg-muted text-muted-foreground",
        label: "Unknown",
        animate: false,
      };
  }
}

function formatToolName(name: string): string {
  return name
    .replace(/_/g, " ")
    .replace(/([A-Z])/g, " $1")
    .replace(/^\w/, (c) => c.toUpperCase())
    .trim();
}
