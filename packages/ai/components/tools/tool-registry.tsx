"use client";

import * as React from "react";
import { createContext, useContext, useMemo, type ComponentType } from "react";
import type { ToolInvocationState } from "../../lib/types/ui-message";

// Renderers — lazy-loaded to avoid pulling heavy deps (Shiki, Mermaid, etc.)
// into the initial bundle. Only GenericTool and ProgressTool load eagerly
// since they're lightweight and used as fallbacks.
import { GenericTool } from "./renderers/generic-tool";
import { ProgressTool } from "./renderers/progress-tool";
import { lazy } from "react";

const FilePreview = lazy(() => import("./renderers/file-preview").then(m => ({ default: m.FilePreview })));
const ImageResult = lazy(() => import("./renderers/image-result").then(m => ({ default: m.ImageResult })));
const DeployResult = lazy(() => import("./renderers/deploy-result").then(m => ({ default: m.DeployResult })));
const WebSearchEnhanced = lazy(() => import("./renderers/web-search-enhanced").then(m => ({ default: m.WebSearchEnhanced })));
const CodeBlockEnhanced = lazy(() => import("./renderers/code-block-enhanced").then(m => ({ default: m.CodeBlockEnhanced })));
const TerminalOutputEnhanced = lazy(() => import("./renderers/terminal-output-enhanced").then(m => ({ default: m.TerminalOutputEnhanced })));
const BrowserViewerEnhanced = lazy(() => import("./renderers/browser-viewer-enhanced").then(m => ({ default: m.BrowserViewerEnhanced })));
const ShowPlanRenderer = lazy(() => import("./renderers/show-plan").then(m => ({ default: m.ShowPlanRenderer })));
const DeviceCommandRenderer = lazy(() => import("./renderers/device-command").then(m => ({ default: m.DeviceCommandRenderer })));
const MessageNotifyRenderer = lazy(() => import("./renderers/message-notify-renderer").then(m => ({ default: m.MessageNotifyRenderer })));
const MessageDraftRenderer = lazy(() => import("./renderers/message-draft-renderer").then(m => ({ default: m.MessageDraftRenderer })));

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
 * Default tool renderers — 49 canonical agent tools + aliases from TOOL_VIEW_MAP.
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
  file_view: FilePreview as ToolRenderer,

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
  browser_save_image: BrowserViewerEnhanced as ToolRenderer,
  browser_upload_file: BrowserViewerEnhanced as ToolRenderer,
  browser_fill_form: BrowserViewerEnhanced as ToolRenderer,
  browser_find_keyword: BrowserViewerEnhanced as ToolRenderer,
  browser_close: BrowserViewerEnhanced as ToolRenderer,

  // Image generation
  generate_image: ImageResult as ToolRenderer,

  // Deployment
  deploy_expose_port: DeployResult as ToolRenderer,
  deploy_apply_deployment: DeployResult as ToolRenderer,
  make_manus_page: DeployResult as ToolRenderer,

  // Planning
  show_plan: ShowPlanRenderer as ToolRenderer,

  // Communication — Manus-style: shows text + file cards for attachments
  message_notify_user: MessageNotifyRenderer as ToolRenderer,
  message_ask_user: MessageNotifyRenderer as ToolRenderer,

  // Scheduling & Analytics
  schedule_task: ProgressTool as ToolRenderer,
  schedule_recurring_task: ProgressTool as ToolRenderer,
  check_outcomes: ProgressTool as ToolRenderer,
  track_analytics: ProgressTool as ToolRenderer,

  // Idle (no-op)
  idle: ProgressTool as ToolRenderer,

  // Text editor (unified file editor)
  text_editor: FilePreview as ToolRenderer,

  // Image utilities
  image_rmbg: ImageResult as ToolRenderer,
  image_search_upload: ImageResult as ToolRenderer,

  // Email (Gmail & Outlook) — full draft renderer for send, progress for download
  gmail_send: MessageDraftRenderer as ToolRenderer,
  gmail_download: ProgressTool as ToolRenderer,
  outlook_send: MessageDraftRenderer as ToolRenderer,
  outlook_download: ProgressTool as ToolRenderer,

  // Skills
  skills_sync: ProgressTool as ToolRenderer,
  skills_package: ProgressTool as ToolRenderer,

  // Slides
  slide_init: ProgressTool as ToolRenderer,
  slide_modify: ProgressTool as ToolRenderer,
  slide_add_notes: ProgressTool as ToolRenderer,
  slide_present: DeployResult as ToolRenderer,

  // Parallel tasks
  parallel_tasks: ProgressTool as ToolRenderer,

  // WebDev IDE
  webdev_init_project: DeployResult as ToolRenderer,
  webdev_save_checkpoint: ProgressTool as ToolRenderer,
  webdev_check_status: ProgressTool as ToolRenderer,
  webdev_restart_server: ProgressTool as ToolRenderer,
  webdev_rollback_checkpoint: ProgressTool as ToolRenderer,
  webdev_execute_sql: ProgressTool as ToolRenderer,
  webdev_push_schema: ProgressTool as ToolRenderer,
  webdev_list_versions: ProgressTool as ToolRenderer,
  webdev_add_feature: ProgressTool as ToolRenderer,

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
    // Direct match first
    if (renderers[toolName]) return renderers[toolName];
    // Dynamic device tools: device_{id}_command → DeviceCommandRenderer
    if (toolName.startsWith("device_")) return DeviceCommandRenderer as ToolRenderer;
    // Dynamic Composio tools: app_* → GenericTool
    return renderers["*"] ?? GenericTool;
  };

  const registerRenderer = (toolName: string, renderer: ToolRenderer) => {
    // Intentional no-op: React Compiler disallows mutating useMemo results.
    // Use customRenderers prop on ToolRegistry instead.
    void toolName;
    void renderer;
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
      getRenderer: (toolName: string) => {
        if (defaultRenderers[toolName]) return defaultRenderers[toolName];
        if (toolName.startsWith("device_")) return DeviceCommandRenderer as ToolRenderer;
        return defaultRenderers["*"] ?? GenericTool;
      },
      registerRenderer: () => {
        console.warn("ToolRegistryProvider not found. Renderer not registered.");
      },
    };
  }

  return context;
}
