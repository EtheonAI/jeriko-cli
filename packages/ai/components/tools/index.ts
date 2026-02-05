/**
 * Tool Components - Export all tool renderers and utilities
 */

// Core Components
export { ToolCard, type ToolCardProps } from "./tool-card";
export {
  ToolRegistry,
  useToolRegistry,
  type ToolRendererProps,
  type ToolRenderer,
} from "./tool-registry";
export { ToolStates, type ToolStatesProps } from "./tool-states";

// Activity Tracker
export {
  AgentActivityTracker,
  type ActivityStep,
  type ActivityStatus,
  type AgentActivityTrackerProps,
} from "./agent-activity-tracker";

// Enhanced Renderers (with animations, rich UI)
export { WebSearchEnhanced } from "./renderers/web-search-enhanced";
export { CodeBlockEnhanced } from "./renderers/code-block-enhanced";
export { TerminalOutputEnhanced } from "./renderers/terminal-output-enhanced";
export { BrowserViewerEnhanced } from "./renderers/browser-viewer-enhanced";
export { PlanToolEnhanced } from "./renderers/plan-tool-enhanced";

// Standard Renderers
export { ProgressTracker, type ProgressTrackerProps } from "./renderers/progress-tracker";
export { CodeBlock, type CodeBlockProps } from "./renderers/code-block";
export { TerminalOutput, type TerminalOutputProps } from "./renderers/terminal-output";
export { FilePreview, type FilePreviewProps } from "./renderers/file-preview";
export { WebSearch, type WebSearchProps } from "./renderers/web-search";
export { BrowserViewer, type BrowserViewerProps } from "./renderers/browser-viewer";
export { ApprovalCard, type ApprovalCardProps } from "./renderers/approval-card";
export { GenericTool, type GenericToolProps } from "./renderers/generic-tool";
export { PlanTool } from "./renderers/plan-tool";
export { ProgressTool } from "./renderers/progress-tool";
export { ImageResult } from "./renderers/image-result";
export { DeployResult } from "./renderers/deploy-result";

// CSS: Import in your global styles
// @import "@repo/ai/components/tools/tool-animations.css";
