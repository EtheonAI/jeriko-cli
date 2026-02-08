import { useMemo } from "react";
import type { UIMessage } from "../../lib/types/ui-message";
import { useIDEState, type FileTreeNode } from "../../hooks/useIDEState";

// Keep all your other types: CanvasViewType, ToolAction, etc.
export type CanvasViewType = "browser" | "code" | "terminal" | "empty";

export interface CanvasState {
  isVisible: boolean;
  viewType: CanvasViewType;
  isWorking: boolean;
  // ... other non-IDE state properties

  // IDE State
  fileTree?: FileTreeNode[];
  fileTabs?: { id: string; name: string; path: string }[];
  activeTabId?: string | null;
}

// Keep TOOL_VIEW_MAP and TOOL_ACTION_MAP
const TOOL_VIEW_MAP: Record<string, CanvasViewType> = {
  file_read: "code",
  file_write: "code",
  // ... other mappings
};

/**
 * The master hook for managing the state of the agent canvas.
 * It determines the active view, accumulates state for persistent
 * views like the terminal and browser, and derives the IDE state
 * from the message history.
 */
export function useCanvas(messages: UIMessage[]): CanvasState {
  // Keep other state hooks for terminal, browser, etc.

  // Use the dedicated IDE state hook
  const ideState = useIDEState(messages);

  const { latestTool, totalToolCalls } = useMemo(() => {
    // This logic for finding the latest tool remains the same.
    // It should scan backwards through messages and parts to find the
    // most recent tool call that maps to a canvas view.
    // For brevity, the implementation is omitted here but should be kept from your original file.
    return { latestTool: null, totalToolCalls: 0 }; // Placeholder
  }, [messages]);

  if (!latestTool) {
    return { isVisible: false, viewType: "empty", isWorking: false };
  }

  const state: CanvasState = {
    isVisible: true,
    viewType: latestTool.viewType,
    isWorking: latestTool.isWorking,
    // ... other base state assignments
  };

  // Assign state for other views like browser and terminal

  // Assign IDE state if the current view is 'code'
  if (state.viewType === "code") {
    state.fileTree = ideState.fileTree;
    state.fileTabs = ideState.openTabs;
    state.activeTabId = ideState.activeTabId;
  }

  return state;
}
