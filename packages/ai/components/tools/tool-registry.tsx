"use client";

import * as React from "react";
import { createContext, useContext, useMemo, type ComponentType } from "react";
import type { ToolInvocationState } from "../../lib/types/ui-message";

// Standard renderers
import { WebSearch } from "./renderers/web-search";
import { CodeBlock } from "./renderers/code-block";
import { TerminalOutput } from "./renderers/terminal-output";
import { FilePreview } from "./renderers/file-preview";
import { GenericTool } from "./renderers/generic-tool";
import { PlanTool } from "./renderers/plan-tool";
import { ProgressTool } from "./renderers/progress-tool";
import { BrowserViewer } from "./renderers/browser-viewer";
import { ImageResult } from "./renderers/image-result";
import { DeployResult } from "./renderers/deploy-result";

// Enhanced renderers with animations and rich UI
import { WebSearchEnhanced } from "./renderers/web-search-enhanced";
import { CodeBlockEnhanced } from "./renderers/code-block-enhanced";
import { TerminalOutputEnhanced } from "./renderers/terminal-output-enhanced";
import { BrowserViewerEnhanced } from "./renderers/browser-viewer-enhanced";
import { PlanToolEnhanced } from "./renderers/plan-tool-enhanced";

export interface ToolRendererProps<TInput = unknown, TOutput = unknown> {
  toolName: string;
  toolCallId: string;
  state: ToolInvocationState;
  input: TInput | undefined;
  output?: TOutput;
  errorText?: string;
}

export type ToolRenderer = ComponentType<ToolRendererProps>;

interface ToolRegistryContextValue {
  renderers: Record<string, ToolRenderer>;
  getRenderer: (toolName: string) => ToolRenderer;
  registerRenderer: (toolName: string, renderer: ToolRenderer) => void;
}

const ToolRegistryContext = createContext<ToolRegistryContextValue | null>(null);

/**
 * Default tool renderers mapping
 * Uses enhanced renderers with animations and rich UI
 */
const defaultRenderers: Record<string, ToolRenderer> = {
  // Web search (enhanced with expandable results, citations)
  web_search: WebSearchEnhanced as ToolRenderer,
  search_web: WebSearchEnhanced as ToolRenderer,
  tavily_search: WebSearchEnhanced as ToolRenderer,
  exa_search: WebSearchEnhanced as ToolRenderer,
  perplexity_search: WebSearchEnhanced as ToolRenderer,
  google_search: WebSearchEnhanced as ToolRenderer,
  bing_search: WebSearchEnhanced as ToolRenderer,

  // Code execution (enhanced with syntax highlighting, line numbers)
  code_interpreter: CodeBlockEnhanced as ToolRenderer,
  execute_code: CodeBlockEnhanced as ToolRenderer,
  run_code: CodeBlockEnhanced as ToolRenderer,
  python: CodeBlockEnhanced as ToolRenderer,
  javascript: CodeBlockEnhanced as ToolRenderer,
  code_execute: CodeBlockEnhanced as ToolRenderer,

  // Shell/Terminal (enhanced with ANSI colors, collapsible output)
  shell_command: TerminalOutputEnhanced as ToolRenderer,
  shell_exec: TerminalOutputEnhanced as ToolRenderer,
  shell_view: TerminalOutputEnhanced as ToolRenderer,
  shell_wait: TerminalOutputEnhanced as ToolRenderer,
  shell_write_to_process: TerminalOutputEnhanced as ToolRenderer,
  shell_kill_process: TerminalOutputEnhanced as ToolRenderer,
  execute_shell: TerminalOutputEnhanced as ToolRenderer,
  run_command: TerminalOutputEnhanced as ToolRenderer,
  terminal: TerminalOutputEnhanced as ToolRenderer,
  bash: TerminalOutputEnhanced as ToolRenderer,
  exec: TerminalOutputEnhanced as ToolRenderer,

  // File operations
  file_read: FilePreview as ToolRenderer,
  file_write: FilePreview as ToolRenderer,
  file_str_replace: FilePreview as ToolRenderer,
  read_file: FilePreview as ToolRenderer,
  write_file: FilePreview as ToolRenderer,
  create_file: FilePreview as ToolRenderer,
  edit_file: FilePreview as ToolRenderer,
  file_preview: FilePreview as ToolRenderer,

  // Browser (enhanced with zoom, fullscreen, console)
  browser_navigate: BrowserViewerEnhanced as ToolRenderer,
  browser_view: BrowserViewerEnhanced as ToolRenderer,
  browser_click: BrowserViewerEnhanced as ToolRenderer,
  browser_input: BrowserViewerEnhanced as ToolRenderer,
  browser_scroll: BrowserViewerEnhanced as ToolRenderer,
  browser_key_press: BrowserViewerEnhanced as ToolRenderer,
  browser_select_option: BrowserViewerEnhanced as ToolRenderer,
  browser_console_exec: BrowserViewerEnhanced as ToolRenderer,
  browser_console_view: BrowserViewerEnhanced as ToolRenderer,
  browser_screenshot: BrowserViewerEnhanced as ToolRenderer,
  browser_restart: BrowserViewerEnhanced as ToolRenderer,

  // Image generation
  generate_image: ImageResult as ToolRenderer,

  // Deployment
  deploy_expose_port: DeployResult as ToolRenderer,
  deploy_apply_deployment: DeployResult as ToolRenderer,

  // Planning & Progress (enhanced with timeline, progress bar)
  plan: PlanToolEnhanced as ToolRenderer,
  create_plan: PlanToolEnhanced as ToolRenderer,
  project_plan: PlanToolEnhanced as ToolRenderer,
  progress: ProgressTool as ToolRenderer,
  track_progress: ProgressTool as ToolRenderer,
  update_progress: ProgressTool as ToolRenderer,

  // Communication (user notifications shown as progress)
  message_notify_user: ProgressTool as ToolRenderer,
  message_ask_user: ProgressTool as ToolRenderer,

  // Fallback
  "*": GenericTool,
};

interface ToolRegistryProviderProps {
  children: React.ReactNode;
  customRenderers?: Record<string, ToolRenderer>;
}

/**
 * ToolRegistryProvider - Provides tool renderer mapping
 */
export function ToolRegistry({ children, customRenderers = {} }: ToolRegistryProviderProps) {
  const renderers = useMemo(() => ({ ...defaultRenderers, ...customRenderers }), [customRenderers]);

  const getRenderer = (toolName: string): ToolRenderer => {
    return renderers[toolName] ?? renderers["*"] ?? GenericTool;
  };

  const registerRenderer = (toolName: string, renderer: ToolRenderer) => {
    renderers[toolName] = renderer;
  };

  return (
    <ToolRegistryContext.Provider value={{ renderers, getRenderer, registerRenderer }}>
      {children}
    </ToolRegistryContext.Provider>
  );
}

/**
 * useToolRegistry - Access tool registry
 */
export function useToolRegistry(): ToolRegistryContextValue {
  const context = useContext(ToolRegistryContext);

  if (!context) {
    // Return default implementation if no provider
    return {
      renderers: defaultRenderers,
      getRenderer: (toolName: string) =>
        defaultRenderers[toolName] ?? defaultRenderers["*"] ?? GenericTool,
      registerRenderer: () => {
        console.warn("ToolRegistryProvider not found. Renderer not registered.");
      },
    };
  }

  return context;
}
