"use client";

/**
 * ToolCompact — Manus-style compact pill for non-canvas tools.
 *
 * Used for message_notify_user, message_ask_user, schedule_recurring_task, etc.
 * Matches the same pill styling as ToolInlineCompact for visual consistency.
 */

import * as React from "react";
import { cn } from "@repo/design-system/lib/utils";
import {
  SearchIcon,
  GlobeIcon,
  FileTextIcon,
  TerminalIcon,
  ImageIcon,
  CodeIcon,
  RocketIcon,
  BarChart3Icon,
  ListTodoIcon,
  ClockIcon,
  MessageSquareIcon,
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
  message_notify_user: MessageSquareIcon,
  message_ask_user: MessageSquareIcon,
  schedule_recurring_task: ClockIcon,
  check_outcomes: SearchIcon,
  track_analytics: BarChart3Icon,
  show_plan: ListTodoIcon,
  deploy_expose_port: RocketIcon,
  deploy_apply_deployment: RocketIcon,
};

// ============================================================================
// Component — Manus-style pill (same design as ToolInlineCompact)
// ============================================================================

export function ToolCompact({ toolName, state, title, summary, className }: ToolCompactProps) {
  const ToolIcon = TOOL_ICONS[toolName] ?? CodeIcon;
  const displayName = title ?? formatToolName(toolName);
  const isActive =
    state === "input-streaming" || state === "input-available" || state === "approval-responded";

  return (
    <div
      data-testid="tool-compact"
      data-tool-name={toolName}
      className={cn("flex items-center group/pill gap-2 w-full", className)}
    >
      <div className="flex-1 min-w-0 h-7">
        <div
          className={cn(
            "rounded-[15px] px-2.5 py-[3px]",
            "border border-white/[0.06] bg-black/20",
            "inline-flex max-w-full gap-1 items-center",
            "relative h-full overflow-hidden",
            "cursor-pointer select-none",
            "hover:bg-white/[0.02]",
            "transition-colors duration-150",
            isActive && "border-blue-500/20 bg-blue-500/[0.05] shimmer-pill"
          )}
        >
          {/* Icon */}
          <div className="w-[21px] inline-flex items-center flex-shrink-0 text-muted-foreground">
            <ToolIcon className={cn("size-[18px]", isActive && "text-blue-400")} />
          </div>

          {/* Label */}
          <div className="text-[13px] text-muted-foreground max-w-full truncate">{displayName}</div>

          {/* Summary text */}
          {summary && state === "output-available" && (
            <div className="text-[13px] text-muted-foreground/50 max-w-[200px] truncate ml-0.5">
              — {summary}
            </div>
          )}

          {/* Active pulse dot */}
          {isActive && (
            <div className="flex-shrink-0 ml-0.5">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex size-1.5 rounded-full bg-blue-400" />
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function formatToolName(name: string): string {
  return name
    .replace(/_/g, " ")
    .replace(/([A-Z])/g, " $1")
    .replace(/^\w/, (c) => c.toUpperCase())
    .trim();
}
