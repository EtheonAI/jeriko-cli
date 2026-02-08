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
  SearchIcon,
  GlobeIcon,
  FileTextIcon,
  TerminalIcon,
  ImageIcon,
  CodeIcon,
  BellIcon,
  RocketIcon,
} from "lucide-react";
import type { StaticToolUIPart, DynamicToolUIPart, ToolInvocationState } from "../../lib/types/ui-message";
import { getToolName } from "../../lib/types/ui-message";
import { ToolStates } from "./tool-states";
import { ApprovalCard } from "./renderers/approval-card";

// ============================================================================
// Types
// ============================================================================

export interface ToolCardProps {
  part: StaticToolUIPart | DynamicToolUIPart;
  className?: string;
  children?: React.ReactNode;
  onApproval?: (toolCallId: string, approved: boolean, reason?: string) => void;
  defaultExpanded?: boolean;
}

// ============================================================================
// Tool category icons
// ============================================================================

const TOOL_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  // Search
  web_search: SearchIcon,
  // Browser
  browser_navigate: GlobeIcon,
  browser_view: GlobeIcon,
  browser_click: GlobeIcon,
  browser_input: GlobeIcon,
  browser_scroll_up: GlobeIcon,
  browser_scroll_down: GlobeIcon,
  browser_move_mouse: GlobeIcon,
  browser_press_key: GlobeIcon,
  browser_select_option: GlobeIcon,
  browser_console_exec: GlobeIcon,
  browser_console_view: GlobeIcon,
  browser_screenshot: GlobeIcon,
  browser_restart: GlobeIcon,
  // File
  file_read: FileTextIcon,
  file_write: FileTextIcon,
  file_str_replace: FileTextIcon,
  file_find_in_content: FileTextIcon,
  file_find_by_name: FileTextIcon,
  // Shell
  shell_exec: TerminalIcon,
  shell_view: TerminalIcon,
  shell_wait: TerminalIcon,
  shell_write_to_process: TerminalIcon,
  shell_kill_process: TerminalIcon,
  // Code
  code_execute: CodeIcon,
  // Image
  generate_image: ImageIcon,
  // Communication
  message_notify_user: BellIcon,
  message_ask_user: BellIcon,
  // Deploy
  deploy_expose_port: RocketIcon,
  deploy_apply_deployment: RocketIcon,
  // Schedule & Analytics
  schedule_recurring_task: ClockIcon,
  check_outcomes: SearchIcon,
  // Planning
  show_plan: CodeIcon,
};

// ============================================================================
// Component
// ============================================================================

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
  const ToolIcon = TOOL_ICONS[toolName] ?? CodeIcon;

  // Show approval UI when needed
  if (part.state === "approval-requested") {
    return (
      <div data-testid="tool-card" data-tool-name={toolName} data-tool-state="approval-requested" className={cn("my-2", className)}>
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

  return (
    <div
      data-testid="tool-card"
      data-tool-name={toolName}
      data-tool-state={part.state}
      className={cn(
        "my-2 overflow-hidden rounded-xl border transition-colors duration-200",
        part.state === "input-streaming" && "border-blue-500/20",
        part.state === "input-available" && "border-yellow-500/20",
        part.state === "output-available" && "border-border/40",
        part.state === "output-error" && "border-destructive/20",
        part.state === "output-denied" && "border-orange-500/20",
        !["input-streaming", "input-available", "output-available", "output-error", "output-denied"].includes(part.state) &&
          "border-border/40",
        className
      )}
    >
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-muted/20"
      >
        {/* Tool icon */}
        <div
          className={cn(
            "flex size-6 items-center justify-center rounded-lg",
            color
          )}
        >
          {animate ? (
            <LoaderIcon className="size-3.5 animate-spin" />
          ) : (
            <ToolIcon className="size-3.5" />
          )}
        </div>

        {/* Title + status */}
        <div className="min-w-0 flex-1">
          <span className="text-sm font-medium text-foreground/80">
            {(part as { title?: string }).title ?? formatToolName(toolName)}
          </span>
        </div>

        {/* Status badge */}
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
            part.state === "input-streaming" && "bg-blue-500/10 text-blue-500",
            part.state === "input-available" && "bg-yellow-500/10 text-yellow-500",
            part.state === "approval-responded" && "bg-blue-500/10 text-blue-500",
            part.state === "output-available" && "bg-green-500/10 text-green-500",
            part.state === "output-error" && "bg-destructive/10 text-destructive",
            part.state === "output-denied" && "bg-orange-500/10 text-orange-500"
          )}
        >
          {label}
        </span>

        <ChevronDownIcon
          className={cn(
            "size-4 text-muted-foreground/40 transition-transform duration-200",
            isExpanded && "rotate-180"
          )}
        />
      </button>

      {/* Content */}
      <div
        className={cn(
          "grid transition-all duration-300 ease-in-out",
          isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="overflow-hidden">
          <div className="border-t border-border/30 p-3">
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
              <div className="rounded-lg bg-destructive/5 p-3 text-sm text-destructive">
                <div className="flex items-center gap-2">
                  <AlertCircleIcon className="size-4" />
                  <span className="font-medium">Error</span>
                </div>
                <p className="mt-1 text-destructive/80">{part.errorText ?? "An unknown error occurred"}</p>
              </div>
            )}

            {/* Denied state */}
            {part.state === "output-denied" && (
              <div className="rounded-lg bg-orange-500/5 p-3 text-sm text-orange-600 dark:text-orange-400">
                <div className="flex items-center gap-2">
                  <ShieldXIcon className="size-4" />
                  <span className="font-medium">Execution Denied</span>
                </div>
                {part.approval?.reason && (
                  <p className="mt-1 opacity-80">Reason: {part.approval.reason}</p>
                )}
              </div>
            )}

            {/* Output available - render the tool content */}
            {part.state === "output-available" && children}
          </div>
        </div>
      </div>

      {/* Active progress bar */}
      {(part.state === "input-streaming" || part.state === "input-available" || part.state === "approval-responded") && (
        <div className="h-[1px] w-full overflow-hidden bg-blue-500/10">
          <div className="h-full w-1/3 animate-[shimmer_1.5s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-blue-500/30 to-transparent" />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

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
        label: "Preparing",
        animate: true,
      };
    case "input-available":
      return {
        icon: ClockIcon,
        color: "bg-yellow-500/10 text-yellow-500",
        label: "Running",
        animate: false,
      };
    case "approval-requested":
      return {
        icon: ShieldCheckIcon,
        color: "bg-orange-500/10 text-orange-500",
        label: "Approval",
        animate: false,
      };
    case "approval-responded":
      return {
        icon: LoaderIcon,
        color: "bg-blue-500/10 text-blue-500",
        label: "Executing",
        animate: true,
      };
    case "output-available":
      return {
        icon: CheckIcon,
        color: "bg-green-500/10 text-green-500",
        label: "Done",
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
