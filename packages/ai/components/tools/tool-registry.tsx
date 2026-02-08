"use client";

import * as React from "react";
import { createContext, useContext, useMemo, type ComponentType } from "react";
import type { ToolInvocationState } from "../../lib/types/ui-message";

// Renderers — one per visual category
import { FilePreview } from "./renderers/file-preview";
import { GenericTool } from "./renderers/generic-tool";
import { ProgressTool } from "./renderers/progress-tool";
import { ImageResult } from "./renderers/image-result";
import { DeployResult } from "./renderers/deploy-result";
import { WebSearchEnhanced } from "./renderers/web-search-enhanced";
import { CodeBlockEnhanced } from "./renderers/code-block-enhanced";
import { TerminalOutputEnhanced } from "./renderers/terminal-output-enhanced";
import { BrowserViewerEnhanced } from "./renderers/browser-viewer-enhanced";
import { ShowPlanRenderer } from "./renderers/show-plan";

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
 * Default tool renderers — 33 canonical agent tools + 5 aliases from TOOL_VIEW_MAP.
 * Every tool name that can appear in the SSE stream or TOOL_VIEW_MAP has a renderer.
 * Unknown tools fall through to GenericTool via "*".
 */
const defaultRenderers: Record<string, ToolRenderer> = {
  // Search (+ aliases for TOOL_VIEW_MAP compatibility)
  web_search: WebSearchEnhanced as ToolRenderer,
  search_web: WebSearchEnhanced as ToolRenderer,
  info_search_web: WebSearchEnhanced as ToolRenderer,

  // Code execution
  code_execute: CodeBlockEnhanced as ToolRenderer,

  // Shell / Terminal
  shell_exec: TerminalOutputEnhanced as ToolRenderer,
  shell_view: TerminalOutputEnhanced as ToolRenderer,
  shell_wait: TerminalOutputEnhanced as ToolRenderer,
  shell_write_to_process: TerminalOutputEnhanced as ToolRenderer,
  shell_kill_process: TerminalOutputEnhanced as ToolRenderer,

  // File operations
  file_read: FilePreview as ToolRenderer,
  file_write: FilePreview as ToolRenderer,
  file_str_replace: FilePreview as ToolRenderer,
  file_find_in_content: FilePreview as ToolRenderer,
  file_find_by_name: FilePreview as ToolRenderer,

  // Browser
  browser_navigate: BrowserViewerEnhanced as ToolRenderer,
  browser_view: BrowserViewerEnhanced as ToolRenderer,
  browser_click: BrowserViewerEnhanced as ToolRenderer,
  browser_input: BrowserViewerEnhanced as ToolRenderer,
  browser_scroll: BrowserViewerEnhanced as ToolRenderer,
  browser_scroll_up: BrowserViewerEnhanced as ToolRenderer,
  browser_scroll_down: BrowserViewerEnhanced as ToolRenderer,
  browser_move_mouse: BrowserViewerEnhanced as ToolRenderer,
  browser_key_press: BrowserViewerEnhanced as ToolRenderer,
  browser_press_key: BrowserViewerEnhanced as ToolRenderer,
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
  make_manus_page: DeployResult as ToolRenderer,

  // Planning
  show_plan: ShowPlanRenderer as ToolRenderer,

  // Communication
  message_notify_user: ProgressTool as ToolRenderer,
  message_ask_user: ProgressTool as ToolRenderer,

  // Scheduling & Analytics
  schedule_recurring_task: ProgressTool as ToolRenderer,
  check_outcomes: ProgressTool as ToolRenderer,

  // Fallback for any unknown tool
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
