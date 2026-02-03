"use client";

import * as React from "react";
import { createContext, useContext, useMemo, type ComponentType } from "react";
import type { ToolInvocationState } from "../../lib/types/ui-message";
import { WebSearch } from "./renderers/web-search";
import { CodeBlock } from "./renderers/code-block";
import { TerminalOutput } from "./renderers/terminal-output";
import { FilePreview } from "./renderers/file-preview";
import { GenericTool } from "./renderers/generic-tool";
import { PlanTool } from "./renderers/plan-tool";
import { ProgressTool } from "./renderers/progress-tool";

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
 */
const defaultRenderers: Record<string, ToolRenderer> = {
  // Web search
  web_search: WebSearch as ToolRenderer,
  search_web: WebSearch as ToolRenderer,
  tavily_search: WebSearch as ToolRenderer,
  exa_search: WebSearch as ToolRenderer,
  perplexity_search: WebSearch as ToolRenderer,
  google_search: WebSearch as ToolRenderer,
  bing_search: WebSearch as ToolRenderer,

  // Code execution
  code_interpreter: CodeBlock as ToolRenderer,
  execute_code: CodeBlock as ToolRenderer,
  run_code: CodeBlock as ToolRenderer,
  python: CodeBlock as ToolRenderer,
  javascript: CodeBlock as ToolRenderer,

  // Shell/Terminal
  shell_command: TerminalOutput as ToolRenderer,
  execute_shell: TerminalOutput as ToolRenderer,
  run_command: TerminalOutput as ToolRenderer,
  terminal: TerminalOutput as ToolRenderer,
  bash: TerminalOutput as ToolRenderer,
  exec: TerminalOutput as ToolRenderer,

  // File operations
  file_read: FilePreview as ToolRenderer,
  file_write: FilePreview as ToolRenderer,
  read_file: FilePreview as ToolRenderer,
  write_file: FilePreview as ToolRenderer,
  create_file: FilePreview as ToolRenderer,
  edit_file: FilePreview as ToolRenderer,
  file_preview: FilePreview as ToolRenderer,

  // Planning & Progress
  plan: PlanTool as ToolRenderer,
  create_plan: PlanTool as ToolRenderer,
  project_plan: PlanTool as ToolRenderer,
  progress: ProgressTool as ToolRenderer,
  track_progress: ProgressTool as ToolRenderer,
  update_progress: ProgressTool as ToolRenderer,

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
export function ToolRegistry({
  children,
  customRenderers = {},
}: ToolRegistryProviderProps) {
  const renderers = useMemo(
    () => ({ ...defaultRenderers, ...customRenderers }),
    [customRenderers]
  );

  const getRenderer = (toolName: string): ToolRenderer => {
    return renderers[toolName] ?? renderers["*"] ?? GenericTool;
  };

  const registerRenderer = (toolName: string, renderer: ToolRenderer) => {
    renderers[toolName] = renderer;
  };

  return (
    <ToolRegistryContext.Provider
      value={{ renderers, getRenderer, registerRenderer }}
    >
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
