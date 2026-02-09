"use client";

import * as React from "react";
import { cn } from "@repo/design-system/lib/utils";
import {
  CheckIcon,
  LoaderIcon,
  AlertCircleIcon,
  XIcon,
  GlobeIcon,
  TerminalIcon,
  FileTextIcon,
  CodeIcon,
  SearchIcon,
  RocketIcon,
} from "lucide-react";
import type { ToolInvocationState } from "../../../lib/types/ui-message";

// ============================================================================
// Types
// ============================================================================

export interface ToolInlineCompactProps {
  toolName: string;
  state: ToolInvocationState;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  className?: string;
}

// ============================================================================
// Tool category icons & labels
// ============================================================================

const TOOL_CATEGORY: Record<string, {
  icon: React.ComponentType<{ className?: string }>;
  getLabel: (input?: Record<string, unknown>, output?: Record<string, unknown>) => string;
  getDoneLabel: (input?: Record<string, unknown>, output?: Record<string, unknown>) => string;
}> = {
  // Browser tools
  browser_navigate: {
    icon: GlobeIcon,
    getLabel: (input) => `Navigating to ${tryHostname(input?.url as string)}`,
    getDoneLabel: (_, output) => `Loaded ${(output?.title as string) || "page"}`,
  },
  browser_view: {
    icon: GlobeIcon,
    getLabel: () => "Viewing page",
    getDoneLabel: () => "Viewed page",
  },
  browser_click: {
    icon: GlobeIcon,
    getLabel: () => "Clicking element",
    getDoneLabel: () => "Clicked",
  },
  browser_input: {
    icon: GlobeIcon,
    getLabel: (input) => `Typing "${truncate(input?.text as string, 20)}"`,
    getDoneLabel: () => "Typed text",
  },
  browser_scroll: {
    icon: GlobeIcon,
    getLabel: () => "Scrolling",
    getDoneLabel: () => "Scrolled",
  },
  browser_scroll_up: {
    icon: GlobeIcon,
    getLabel: () => "Scrolling up",
    getDoneLabel: () => "Scrolled up",
  },
  browser_scroll_down: {
    icon: GlobeIcon,
    getLabel: () => "Scrolling down",
    getDoneLabel: () => "Scrolled down",
  },
  browser_move_mouse: {
    icon: GlobeIcon,
    getLabel: () => "Moving mouse",
    getDoneLabel: () => "Moved mouse",
  },
  browser_key_press: {
    icon: GlobeIcon,
    getLabel: (input) => `Pressing ${(input?.key as string) || "key"}`,
    getDoneLabel: () => "Pressed key",
  },
  browser_press_key: {
    icon: GlobeIcon,
    getLabel: (input) => `Pressing ${(input?.key as string) || "key"}`,
    getDoneLabel: () => "Pressed key",
  },
  browser_select_option: {
    icon: GlobeIcon,
    getLabel: () => "Selecting option",
    getDoneLabel: () => "Selected",
  },
  browser_console_exec: {
    icon: GlobeIcon,
    getLabel: () => "Running console script",
    getDoneLabel: () => "Executed",
  },
  browser_console_view: {
    icon: GlobeIcon,
    getLabel: () => "Viewing console",
    getDoneLabel: () => "Viewed console",
  },
  browser_screenshot: {
    icon: GlobeIcon,
    getLabel: () => "Taking screenshot",
    getDoneLabel: () => "Screenshot captured",
  },
  browser_restart: {
    icon: GlobeIcon,
    getLabel: (input) => `Restarting browser${input?.url ? ` → ${tryHostname(input.url as string)}` : ""}`,
    getDoneLabel: () => "Browser restarted",
  },
  // Search tools
  web_search: {
    icon: SearchIcon,
    getLabel: (input) => `Searching "${truncate(input?.query as string, 30)}"`,
    getDoneLabel: (_, output) => {
      const results = output?.results;
      const count = Array.isArray(results) ? results.length : 0;
      return count > 0 ? `${count} results` : "Search complete";
    },
  },
  search_web: {
    icon: SearchIcon,
    getLabel: (input) => `Searching "${truncate(input?.query as string, 30)}"`,
    getDoneLabel: (_, output) => {
      const results = output?.results;
      const count = Array.isArray(results) ? results.length : 0;
      return count > 0 ? `${count} results` : "Search complete";
    },
  },
  info_search_web: {
    icon: SearchIcon,
    getLabel: (input) => `Searching "${truncate(input?.query as string, 30)}"`,
    getDoneLabel: (_, output) => {
      const results = output?.results;
      const count = Array.isArray(results) ? results.length : 0;
      return count > 0 ? `${count} results` : "Search complete";
    },
  },
  // Shell tools
  shell_exec: {
    icon: TerminalIcon,
    getLabel: (input) => `$ ${truncate(input?.command as string, 40)}`,
    getDoneLabel: (_, output) => {
      const code = output?.exit_code ?? output?.exitCode;
      return code === 0 || code === undefined ? "Exit 0" : `Exit ${code}`;
    },
  },
  shell_view: {
    icon: TerminalIcon,
    getLabel: () => "Viewing terminal",
    getDoneLabel: () => "Viewed",
  },
  shell_wait: {
    icon: TerminalIcon,
    getLabel: () => "Waiting for process",
    getDoneLabel: () => "Process ready",
  },
  shell_write_to_process: {
    icon: TerminalIcon,
    getLabel: () => "Writing to process",
    getDoneLabel: () => "Written",
  },
  shell_kill_process: {
    icon: TerminalIcon,
    getLabel: () => "Killing process",
    getDoneLabel: () => "Process killed",
  },
  // Code execution
  code_execute: {
    icon: CodeIcon,
    getLabel: () => "Running code",
    getDoneLabel: () => "Executed",
  },
  // File tools
  file_read: {
    icon: FileTextIcon,
    getLabel: (input) => `Reading ${fileName(input?.path ?? input?.file)}`,
    getDoneLabel: (_, output) => {
      const content = typeof output === "string" ? output : (output?.content as string);
      if (content) {
        const lines = content.split("\n").length;
        return `${lines} lines`;
      }
      return "Read";
    },
  },
  file_write: {
    icon: FileTextIcon,
    getLabel: (input) => `Writing ${fileName(input?.path ?? input?.file)}`,
    getDoneLabel: () => "Written",
  },
  file_str_replace: {
    icon: FileTextIcon,
    getLabel: (input) => `Editing ${fileName(input?.path ?? input?.file)}`,
    getDoneLabel: () => "Edited",
  },
  file_find_in_content: {
    icon: FileTextIcon,
    getLabel: (input) => `Searching for "${truncate(input?.pattern as string ?? input?.query as string, 20)}"`,
    getDoneLabel: (_, output) => {
      const matches = output?.matches;
      const count = Array.isArray(matches) ? matches.length : 0;
      return count > 0 ? `${count} matches` : "Searched";
    },
  },
  file_find_by_name: {
    icon: FileTextIcon,
    getLabel: (input) => `Finding ${truncate(input?.pattern as string ?? input?.name as string, 20)}`,
    getDoneLabel: (_, output) => {
      const files = output?.files;
      const count = Array.isArray(files) ? files.length : 0;
      return count > 0 ? `${count} files` : "Searched";
    },
  },
  // Deploy tools
  deploy_expose_port: {
    icon: RocketIcon,
    getLabel: (input) => `Exposing port ${input?.port ?? ""}`,
    getDoneLabel: (_, output) => {
      const url = output?.url as string;
      return url ? `Live at ${tryHostname(url)}` : "Port exposed";
    },
  },
  deploy_apply_deployment: {
    icon: RocketIcon,
    getLabel: () => "Deploying",
    getDoneLabel: (_, output) => {
      const url = output?.url as string;
      return url ? `Live at ${tryHostname(url)}` : "Deployed";
    },
  },
  make_manus_page: {
    icon: RocketIcon,
    getLabel: () => "Creating page",
    getDoneLabel: (_, output) => {
      const url = output?.url as string;
      return url ? `Live at ${tryHostname(url)}` : "Page created";
    },
  },
};

// ============================================================================
// Status helpers
// ============================================================================

function getStatusInfo(state: ToolInvocationState) {
  switch (state) {
    case "input-streaming":
    case "input-available":
    case "approval-responded":
      return { StatusIcon: LoaderIcon, color: "text-blue-500", animate: true };
    case "output-available":
      return { StatusIcon: CheckIcon, color: "text-green-500/70", animate: false };
    case "output-error":
      return { StatusIcon: AlertCircleIcon, color: "text-destructive", animate: false };
    case "output-denied":
      return { StatusIcon: XIcon, color: "text-orange-500", animate: false };
    default:
      return { StatusIcon: LoaderIcon, color: "text-muted-foreground", animate: false };
  }
}

// ============================================================================
// Component
// ============================================================================

export function ToolInlineCompact({
  toolName,
  state,
  input,
  output,
  className,
}: ToolInlineCompactProps) {
  const category = TOOL_CATEGORY[toolName];
  const ToolIcon = category?.icon ?? CodeIcon;
  const { StatusIcon, color, animate } = getStatusInfo(state);

  const isDone = state === "output-available";
  const isError = state === "output-error";
  const isDenied = state === "output-denied";

  // Generate label text
  let label: string;
  if (isDone && category) {
    label = category.getDoneLabel(input, output);
  } else if (isError) {
    label = "Failed";
  } else if (isDenied) {
    label = "Denied";
  } else if (category) {
    label = category.getLabel(input, output);
  } else {
    label = formatToolName(toolName);
  }

  return (
    <div
      data-testid="tool-inline-compact"
      data-tool-name={toolName}
      data-tool-state={state}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1",
        "text-xs text-muted-foreground/80",
        "transition-colors duration-200",
        isDone && "text-muted-foreground/60",
        isError && "text-destructive/80",
        isDenied && "text-orange-500/80",
        className,
      )}
    >
      <ToolIcon className="size-3 shrink-0 opacity-60" />
      <span className="truncate max-w-[300px]">{label}</span>
      <StatusIcon
        className={cn(
          "size-3 shrink-0",
          color,
          animate && "animate-spin",
        )}
      />
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function tryHostname(url?: string): string {
  if (!url) return "...";
  try {
    return new URL(url).hostname;
  } catch {
    return url.length > 30 ? url.slice(0, 30) + "..." : url;
  }
}

function truncate(str?: string, max = 20): string {
  if (!str) return "...";
  return str.length > max ? str.slice(0, max) + "..." : str;
}

function fileName(path?: unknown): string {
  if (typeof path !== "string" || !path) return "file";
  return path.split("/").pop() ?? path;
}

function formatToolName(name: string): string {
  return name
    .replace(/_/g, " ")
    .replace(/([A-Z])/g, " $1")
    .replace(/^\w/, (c) => c.toUpperCase())
    .trim();
}
