"use client";

import * as React from "react";
import { cn } from "@repo/design-system/lib/utils";
import {
  GlobeIcon,
  TerminalIcon,
  FileTextIcon,
  CodeIcon,
  SearchIcon,
  RocketIcon,
  PencilIcon,
  ImageIcon,
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
// Tool category icons & labels (Manus-style descriptive labels)
// ============================================================================

const TOOL_CATEGORY: Record<
  string,
  {
    icon: React.ComponentType<{ className?: string }>;
    getLabel: (input?: Record<string, unknown>, output?: Record<string, unknown>) => string;
  }
> = {
  // Browser tools
  browser_navigate: {
    icon: GlobeIcon,
    getLabel: (input) => {
      const url = input?.url as string | undefined;
      return url ? `Navigate to ${tryHostname(url)}` : "Navigating to page";
    },
  },
  browser_view: {
    icon: GlobeIcon,
    getLabel: () => "Viewing page state",
  },
  browser_click: {
    icon: GlobeIcon,
    getLabel: (input) => {
      const desc = input?.description as string | undefined;
      return desc ? `Click: ${truncate(desc, 40)}` : "Clicking element";
    },
  },
  browser_input: {
    icon: GlobeIcon,
    getLabel: (input) => {
      const text = input?.text as string | undefined;
      return text ? `Typing "${truncate(text, 30)}"` : "Typing text";
    },
  },
  browser_scroll: {
    icon: GlobeIcon,
    getLabel: () => "Scrolling page",
  },
  browser_scroll_up: {
    icon: GlobeIcon,
    getLabel: () => "Scrolling up",
  },
  browser_scroll_down: {
    icon: GlobeIcon,
    getLabel: () => "Scrolling down",
  },
  browser_move_mouse: {
    icon: GlobeIcon,
    getLabel: () => "Moving cursor",
  },
  browser_key_press: {
    icon: GlobeIcon,
    getLabel: (input) => `Pressing ${(input?.key as string) || "key"}`,
  },
  browser_press_key: {
    icon: GlobeIcon,
    getLabel: (input) => `Pressing ${(input?.key as string) || "key"}`,
  },
  browser_select_option: {
    icon: GlobeIcon,
    getLabel: () => "Selecting option",
  },
  browser_console_exec: {
    icon: GlobeIcon,
    getLabel: () => "Running console command",
  },
  browser_console_view: {
    icon: GlobeIcon,
    getLabel: () => "Viewing console output",
  },
  browser_screenshot: {
    icon: GlobeIcon,
    getLabel: () => "Capturing screenshot",
  },
  browser_restart: {
    icon: GlobeIcon,
    getLabel: (input) =>
      input?.url
        ? `Restarting browser at ${tryHostname(input.url as string)}`
        : "Restarting browser",
  },
  // Search tools
  web_search: {
    icon: SearchIcon,
    getLabel: (input) => {
      const query = input?.query as string | undefined;
      return query ? `Searching: ${truncate(query, 40)}` : "Searching the web";
    },
  },
  search_web: {
    icon: SearchIcon,
    getLabel: (input) => {
      const query = input?.query as string | undefined;
      return query ? `Searching: ${truncate(query, 40)}` : "Searching the web";
    },
  },
  info_search_web: {
    icon: SearchIcon,
    getLabel: (input) => {
      const query = input?.query as string | undefined;
      return query ? `Searching: ${truncate(query, 40)}` : "Searching the web";
    },
  },
  // Shell tools
  shell_exec: {
    icon: TerminalIcon,
    getLabel: (input) => {
      const cmd = input?.command as string | undefined;
      return cmd ? `$ ${truncate(cmd, 50)}` : "Running command";
    },
  },
  shell_view: {
    icon: TerminalIcon,
    getLabel: () => "Viewing terminal output",
  },
  shell_wait: {
    icon: TerminalIcon,
    getLabel: () => "Waiting for process",
  },
  shell_write_to_process: {
    icon: TerminalIcon,
    getLabel: () => "Writing to process",
  },
  shell_kill_process: {
    icon: TerminalIcon,
    getLabel: () => "Stopping process",
  },
  // Code execution
  code_execute: {
    icon: CodeIcon,
    getLabel: () => "Running code",
  },
  // File tools
  file_read: {
    icon: FileTextIcon,
    getLabel: (input) => `Reading ${fileName(input?.path ?? input?.file)}`,
  },
  file_write: {
    icon: PencilIcon,
    getLabel: (input) => `Creating file: ${fileName(input?.path ?? input?.file)}`,
  },
  file_str_replace: {
    icon: PencilIcon,
    getLabel: (input) => `Editing ${fileName(input?.path ?? input?.file)}`,
  },
  file_find_in_content: {
    icon: SearchIcon,
    getLabel: (input) =>
      `Searching for "${truncate((input?.pattern as string) ?? (input?.query as string), 25)}"`,
  },
  file_find_by_name: {
    icon: SearchIcon,
    getLabel: (input) =>
      `Finding ${truncate((input?.pattern as string) ?? (input?.name as string), 25)}`,
  },
  // Deploy tools
  deploy_expose_port: {
    icon: RocketIcon,
    getLabel: (input) => `Exposing port ${input?.port ?? ""}`,
  },
  deploy_apply_deployment: {
    icon: RocketIcon,
    getLabel: () => "Deploying application",
  },
  make_manus_page: {
    icon: RocketIcon,
    getLabel: () => "Creating page",
  },
  // Image
  generate_image: {
    icon: ImageIcon,
    getLabel: (input) => {
      const prompt = input?.prompt as string | undefined;
      return prompt ? `Generating: ${truncate(prompt, 35)}` : "Generating image";
    },
  },
};

// ============================================================================
// Component — Manus-style pill badge
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

  const isActive =
    state === "input-streaming" || state === "input-available" || state === "approval-responded";

  // Generate label
  let label: string;
  if (category) {
    label = category.getLabel(input, output);
  } else {
    label = formatToolName(toolName);
  }

  // Build full title for tooltip
  const titleAttr = buildTitle(toolName, input);

  return (
    <div
      data-testid="tool-inline-compact"
      data-tool-name={toolName}
      data-tool-state={state}
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
          title={titleAttr}
        >
          {/* Icon */}
          <div className="w-[21px] inline-flex items-center flex-shrink-0 text-muted-foreground">
            <ToolIcon className={cn("size-[18px]", isActive && "text-blue-400")} />
          </div>

          {/* Label */}
          <div className="text-[13px] text-muted-foreground max-w-full truncate">{label}</div>

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

function buildTitle(toolName: string, input?: Record<string, unknown>): string {
  const category = TOOL_CATEGORY[toolName];
  if (!category) return formatToolName(toolName);

  // For browser tools, show the URL if available
  if (toolName.startsWith("browser_") && input?.url) {
    return `Browsing: ${input.url as string}`;
  }
  // For search tools, show the query
  if (toolName.includes("search") && input?.query) {
    return `Searching: ${input.query as string}`;
  }
  // For file tools, show the path
  if (toolName.startsWith("file_") && (input?.path || input?.file)) {
    return `File: ${(input.path ?? input.file) as string}`;
  }
  // For shell, show the command
  if (toolName === "shell_exec" && input?.command) {
    return `$ ${input.command as string}`;
  }

  return category.getLabel(input);
}
