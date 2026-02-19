/**
 * Canvas - Agent workspace panel
 *
 * Displays the agent's active tool context (browser, code, terminal, file preview,
 * slides, AI canvas, web dev IDE, map/reduce) in a right-side panel alongside the chat.
 */

export { AgentCanvas, type AgentCanvasProps } from "./agent-canvas";
export {
  useCanvas,
  TOOL_VIEW_MAP,
  type CanvasState,
  type CanvasViewType,
  type ToolAction,
  type ToolActionType,
} from "./use-canvas";
export { ViewTabs } from "./view-tabs";

// View components (for direct use if needed)
export { BrowserView } from "./views/browser-view";
export { CodeView, type FileNode, type FileTab } from "./views/code-view";
export { TerminalView } from "./views/terminal-view";
export { FilePreviewView } from "./views/file-preview-view";
export { EmptyView } from "./views/empty-view";
export { SlidesView } from "./views/slides-view";
export { WebDevIDEView } from "./views/web-dev-ide-view";
export { MapReduceView } from "./views/map-reduce-view";
export { AICanvasView, type CanvasStateSnapshot, type Annotation } from "./views/ai-canvas-view";
export { ScreenshotOverlay } from "./views/screenshot-overlay";
