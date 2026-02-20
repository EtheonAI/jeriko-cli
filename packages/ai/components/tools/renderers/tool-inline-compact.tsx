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
  /** Click handler — opens canvas when provided */
  onClick?: () => void;
  /** Hover timestamp text (e.g. "Sunday", "5m ago") */
  timestamp?: string;
}

// ============================================================================
// Tool category icons & labels
// ============================================================================

// Manus-style: label (action text) + arg (displayed in <code> mono font)
// Matches TOOL_FUNCTION_MAP + TOOL_FUNCTION_ARG_MAP from Manus constants/tool.ts
interface ToolCategoryEntry {
  icon: React.ComponentType<{ className?: string }>;
  getLabel: (input?: Record<string, unknown>, output?: Record<string, unknown>) => string;
  /** Optional: argument value shown in mono <code> after the label (Manus-style) */
  getArg?: (input?: Record<string, unknown>) => string | undefined;
}

const TOOL_CATEGORY: Record<string, ToolCategoryEntry> = {
  // Browser tools — labels match Manus TOOL_FUNCTION_MAP exactly
  browser_navigate: {
    icon: GlobeIcon,
    getLabel: () => "Navigating to",
    getArg: (input) => input?.url ? tryHostname(input.url as string) : undefined,
  },
  browser_view: { icon: GlobeIcon, getLabel: () => "Viewing webpage" },
  browser_click: {
    icon: GlobeIcon,
    getLabel: () => "Clicking",
    getArg: (input) => {
      const desc = (input?.element ?? input?.description) as string | undefined;
      return desc ? truncate(desc, 40) : undefined;
    },
  },
  browser_input: {
    icon: GlobeIcon,
    getLabel: () => "Entering text",
    getArg: (input) => {
      const text = input?.text as string | undefined;
      return text ? truncate(text, 30) : undefined;
    },
  },
  browser_scroll: { icon: GlobeIcon, getLabel: () => "Scrolling page" },
  browser_scroll_up: { icon: GlobeIcon, getLabel: () => "Scrolling up" },
  browser_scroll_down: { icon: GlobeIcon, getLabel: () => "Scrolling down" },
  browser_move_mouse: { icon: GlobeIcon, getLabel: () => "Moving mouse" },
  browser_key_press: {
    icon: GlobeIcon,
    getLabel: () => "Pressing key",
    getArg: (input) => (input?.key as string) || undefined,
  },
  browser_press_key: {
    icon: GlobeIcon,
    getLabel: () => "Pressing key",
    getArg: (input) => (input?.key as string) || undefined,
  },
  browser_select_option: { icon: GlobeIcon, getLabel: () => "Selecting option" },
  browser_console_exec: { icon: GlobeIcon, getLabel: () => "Executing JS code" },
  browser_console_view: { icon: GlobeIcon, getLabel: () => "Viewing console output" },
  browser_screenshot: { icon: GlobeIcon, getLabel: () => "Capturing screenshot" },
  browser_restart: {
    icon: GlobeIcon,
    getLabel: () => "Restarting browser",
    getArg: (input) => input?.url ? tryHostname(input.url as string) : undefined,
  },
  // Search tools — Manus: "Searching web"
  web_search: {
    icon: SearchIcon,
    getLabel: () => "Searching web",
    getArg: (input) => {
      const query = input?.query as string | undefined;
      return query ? truncate(query, 40) : undefined;
    },
  },
  search_web: {
    icon: SearchIcon,
    getLabel: () => "Searching web",
    getArg: (input) => {
      const query = input?.query as string | undefined;
      return query ? truncate(query, 40) : undefined;
    },
  },
  info_search_web: {
    icon: SearchIcon,
    getLabel: () => "Searching web",
    getArg: (input) => {
      const query = input?.query as string | undefined;
      return query ? truncate(query, 40) : undefined;
    },
  },
  // Shell tools — labels match Manus TOOL_FUNCTION_MAP
  shell_exec: {
    icon: TerminalIcon,
    getLabel: () => "Executing command",
    getArg: (input) => {
      const cmd = input?.command as string | undefined;
      return cmd ? truncate(cmd, 50) : undefined;
    },
  },
  shell_view: { icon: TerminalIcon, getLabel: () => "Viewing command output" },
  shell_wait: { icon: TerminalIcon, getLabel: () => "Waiting for command" },
  shell_write_to_process: { icon: TerminalIcon, getLabel: () => "Writing data to process" },
  shell_kill_process: { icon: TerminalIcon, getLabel: () => "Terminating process" },
  // Code execution
  code_execute: { icon: CodeIcon, getLabel: () => "Running code" },
  // File tools — labels match Manus TOOL_FUNCTION_MAP + stripped path in <code>
  file_read: {
    icon: FileTextIcon,
    getLabel: () => "Reading file",
    getArg: (input) => stripSandboxPath((input?.file ?? input?.path) as string | undefined),
  },
  file_write: {
    icon: PencilIcon,
    getLabel: () => "Writing file",
    getArg: (input) => stripSandboxPath((input?.file ?? input?.path) as string | undefined),
  },
  file_str_replace: {
    icon: PencilIcon,
    getLabel: () => "Replacing file content",
    getArg: (input) => stripSandboxPath((input?.file ?? input?.path) as string | undefined),
  },
  file_find_in_content: {
    icon: SearchIcon,
    getLabel: () => "Searching file content",
    getArg: (input) => {
      const pat = (input?.pattern as string) ?? (input?.query as string);
      return pat ? truncate(pat, 25) : undefined;
    },
  },
  file_find_by_name: {
    icon: SearchIcon,
    getLabel: () => "Finding file",
    getArg: (input) => {
      const pat = (input?.pattern as string) ?? (input?.name as string);
      return pat ? truncate(pat, 25) : undefined;
    },
  },
  // Deploy tools
  deploy_expose_port: {
    icon: RocketIcon,
    getLabel: () => "Exposing port",
    getArg: (input) => input?.port != null ? String(input.port) : undefined,
  },
  deploy_apply_deployment: { icon: RocketIcon, getLabel: () => "Deploying application" },
  make_manus_page: { icon: RocketIcon, getLabel: () => "Creating page" },
  // Image
  generate_image: {
    icon: ImageIcon,
    getLabel: () => "Generating image",
    getArg: (input) => {
      const prompt = input?.prompt as string | undefined;
      return prompt ? truncate(prompt, 35) : undefined;
    },
  },
  // Text editor (Manus-style file editing)
  text_editor: {
    icon: PencilIcon,
    getLabel: () => "Replacing file content",
    getArg: (input) => stripSandboxPath((input?.path ?? input?.file) as string | undefined),
  },
  // Slides
  slide_present: { icon: RocketIcon, getLabel: () => "Presenting slides" },
  // Progress / outcomes
  check_outcomes: { icon: SearchIcon, getLabel: () => "Checking outcomes" },
  // WebDev IDE tools
  webdev_init_project: {
    icon: CodeIcon,
    getLabel: () => "Initializing project",
    getArg: (input) => input?.name ? truncate(input.name as string, 30) : undefined,
  },
  webdev_save_checkpoint: { icon: CodeIcon, getLabel: () => "Saving checkpoint" },
  webdev_check_status: { icon: CodeIcon, getLabel: () => "Checking project status" },
  webdev_restart_server: { icon: CodeIcon, getLabel: () => "Restarting dev server" },
  webdev_rollback_checkpoint: { icon: CodeIcon, getLabel: () => "Rolling back checkpoint" },
  webdev_execute_sql: {
    icon: CodeIcon,
    getLabel: () => "Running SQL",
    getArg: (input) => input?.query ? truncate(input.query as string, 30) : undefined,
  },
  webdev_push_schema: { icon: CodeIcon, getLabel: () => "Pushing database schema" },
  webdev_list_versions: { icon: CodeIcon, getLabel: () => "Listing project versions" },
  webdev_add_feature: {
    icon: CodeIcon,
    getLabel: () => "Adding feature",
    getArg: (input) => (input?.feature as string) || undefined,
  },
  webdev_read_debug_logs: { icon: CodeIcon, getLabel: () => "Reading browser debug logs" },
};

// ============================================================================
// Component — Manus-style inline pill
// ============================================================================

export function ToolInlineCompact({
  toolName,
  state,
  input,
  output,
  className,
  onClick,
  timestamp,
}: ToolInlineCompactProps) {
  const category = TOOL_CATEGORY[toolName];
  const ToolIcon = category?.icon ?? CodeIcon;

  const isActive =
    state === "input-streaming" || state === "input-available" || state === "approval-responded";

  // Generate label + optional arg (Manus-style split rendering)
  let label: string;
  let arg: string | undefined;
  if (category) {
    label = category.getLabel(input, output);
    arg = category.getArg?.(input);
  } else {
    label = formatToolName(toolName);
  }

  const titleAttr = buildTitle(toolName, input);

  return (
    <div
      data-testid="tool-inline-compact"
      data-tool-name={toolName}
      data-tool-state={state}
      className={cn("flex items-center group/pill gap-2 w-full", className)}
    >
      {/* Pill container — fixed 28px height like Manus */}
      <div className="flex-1 min-w-0 h-7">
        <div
          role={onClick ? "button" : undefined}
          tabIndex={onClick ? 0 : undefined}
          onClick={onClick}
          onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } } : undefined}
          className={cn(
            "rounded-[15px] px-[10px] py-[3px]",
            "border border-[var(--rubic-border-light)] bg-[var(--rubic-fill-gray)]",
            "inline-flex max-w-full gap-2 items-center",
            "relative h-full overflow-hidden",
            "select-none",
            onClick && "cursor-pointer hover:bg-[var(--rubic-fill-gray-dark)] dark:hover:bg-white/[0.02]",
            "transition-colors duration-150",
            isActive && "border-blue-500/20 bg-blue-500/[0.05]"
          )}
          title={titleAttr}
        >
          {/* Icon — Manus: w-[16px] container, :size="21" icon, text-primary */}
          <div className="w-[16px] inline-flex items-center flex-shrink-0 text-[var(--rubic-text-primary)]">
            <ToolIcon className={cn("size-[21px]", isActive && "text-blue-400")} />
          </div>

          {/* Label + Arg — Manus-style: action text + mono code arg in pill */}
          <div className="flex-1 h-full min-w-0 inline-flex items-center text-[14px] text-[var(--rubic-text-secondary)] max-w-full">
            <span className="whitespace-nowrap">{label}</span>
            {arg && (
              <span className="flex-1 min-w-0 rounded-[6px] px-1 ml-1 text-[12px] font-mono text-ellipsis overflow-hidden whitespace-nowrap text-[var(--rubic-text-tertiary)]">
                <code>{arg}</code>
              </span>
            )}
          </div>

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

      {/* Hover timestamp — appears on row hover like Manus */}
      {timestamp && (
        <div className="shrink-0 text-[12px] text-[var(--rubic-text-tertiary)] invisible group-hover/pill:visible transition-opacity">
          {timestamp}
        </div>
      )}
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

/** Strip sandbox prefixes from file paths (Manus strips /home/ubuntu/) */
function stripSandboxPath(path?: string | null): string | undefined {
  if (typeof path !== "string" || !path) return undefined;
  // Strip common sandbox home dir prefixes
  const stripped = path
    .replace(/^\/home\/ubuntu\//, "")
    .replace(/^\/home\/user\//, "")
    .replace(/^~\//, "");
  return stripped || path.split("/").pop() || path;
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

  if (toolName.startsWith("browser_") && input?.url) {
    return `Browsing: ${input.url as string}`;
  }
  if (toolName.includes("search") && input?.query) {
    return `Searching: ${input.query as string}`;
  }
  if ((toolName.startsWith("file_") || toolName === "text_editor") && (input?.path || input?.file)) {
    return `File: ${(input.path ?? input.file) as string}`;
  }
  if (toolName === "shell_exec" && input?.command) {
    return `$ ${input.command as string}`;
  }

  const label = category.getLabel(input);
  const arg = category.getArg?.(input);
  return arg ? `${label} ${arg}` : label;
}
