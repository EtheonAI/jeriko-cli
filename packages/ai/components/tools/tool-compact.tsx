"use client";

import * as React from "react";
import { cn } from "@repo/design-system/lib/utils";
import {
  CheckIcon,
  LoaderIcon,
  AlertCircleIcon,
  XIcon,
  SearchIcon,
  GlobeIcon,
  FileTextIcon,
  TerminalIcon,
  ImageIcon,
  CodeIcon,
  BellIcon,
  RocketIcon,
} from "lucide-react";
import type { ToolInvocationState } from "../../lib/types/ui-message";

// ============================================================================
// Types
// ============================================================================

export interface ToolCompactProps {
  toolName: string;
  state: ToolInvocationState;
  title?: string;
  summary?: string;
  className?: string;
}

// ============================================================================
// Tool category icons
// ============================================================================

const TOOL_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  web_search: SearchIcon,
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
  file_read: FileTextIcon,
  file_write: FileTextIcon,
  file_str_replace: FileTextIcon,
  file_find_in_content: FileTextIcon,
  file_find_by_name: FileTextIcon,
  shell_exec: TerminalIcon,
  shell_view: TerminalIcon,
  shell_wait: TerminalIcon,
  shell_write_to_process: TerminalIcon,
  shell_kill_process: TerminalIcon,
  code_execute: CodeIcon,
  generate_image: ImageIcon,
  message_notify_user: BellIcon,
  message_ask_user: BellIcon,
  schedule_recurring_task: BellIcon,
  check_outcomes: SearchIcon,
  deploy_expose_port: RocketIcon,
  deploy_apply_deployment: RocketIcon,
};

// ============================================================================
// Component
// ============================================================================

export function ToolCompact({
  toolName,
  state,
  title,
  summary,
  className,
}: ToolCompactProps) {
  const ToolIcon = TOOL_ICONS[toolName] ?? CodeIcon;
  const { StatusIcon, statusColor, animate, label } = getCompactStateInfo(state);
  const displayName = title ?? formatToolName(toolName);

  return (
    <div
      data-testid="tool-compact"
      data-tool-name={toolName}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg border px-3 py-1.5",
        "transition-colors duration-200",
        state === "input-streaming" && "border-blue-500/20 bg-blue-500/[0.03]",
        state === "input-available" && "border-yellow-500/20 bg-yellow-500/[0.03]",
        state === "output-available" && "border-green-500/15 bg-green-500/[0.02]",
        state === "output-error" && "border-destructive/20 bg-destructive/[0.03]",
        state === "output-denied" && "border-orange-500/20 bg-orange-500/[0.03]",
        !["input-streaming", "input-available", "output-available", "output-error", "output-denied"].includes(state) &&
          "border-border/40",
        className
      )}
    >
      {/* Tool icon */}
      <ToolIcon className="size-3.5 text-muted-foreground/60" />

      {/* Tool name */}
      <span className="text-sm text-foreground/80">{displayName}</span>

      {/* Summary (if provided) */}
      {summary && state === "output-available" && (
        <span className="max-w-[200px] truncate text-xs text-muted-foreground/50">
          {summary}
        </span>
      )}

      {/* Status indicator */}
      <div className={cn("flex items-center gap-1", statusColor)}>
        <StatusIcon
          className={cn(
            "size-3.5",
            animate && "animate-spin"
          )}
        />
        <span className="text-xs">{label}</span>
      </div>
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function getCompactStateInfo(state: ToolInvocationState) {
  switch (state) {
    case "input-streaming":
      return {
        StatusIcon: LoaderIcon,
        statusColor: "text-blue-500",
        animate: true,
        label: "",
      };
    case "input-available":
    case "approval-responded":
      return {
        StatusIcon: LoaderIcon,
        statusColor: "text-blue-500",
        animate: true,
        label: "",
      };
    case "approval-requested":
      return {
        StatusIcon: AlertCircleIcon,
        statusColor: "text-orange-500",
        animate: false,
        label: "Approval",
      };
    case "output-available":
      return {
        StatusIcon: CheckIcon,
        statusColor: "text-green-500/70",
        animate: false,
        label: "",
      };
    case "output-error":
      return {
        StatusIcon: AlertCircleIcon,
        statusColor: "text-destructive",
        animate: false,
        label: "Error",
      };
    case "output-denied":
      return {
        StatusIcon: XIcon,
        statusColor: "text-orange-500",
        animate: false,
        label: "Denied",
      };
    default:
      return {
        StatusIcon: LoaderIcon,
        statusColor: "text-muted-foreground",
        animate: false,
        label: "",
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
