// =============================================================================
// ManusCanvas.tsx (with Redux Selector Comments)
// =============================================================================
// This is the same ManusCanvas component, but with added comments indicating
// exactly which Redux state slice and property would be used to populate
// each prop via a `useSelector` hook.
// =============================================================================

import React from "react";
// ... (all imports from the previous ManusCanvas.tsx file)

// ... (all sub-components: ActionBadge, BrowserUrlBar, etc. are the same)

// =============================================================================
// MAIN COMPONENT (with Redux selector comments)
// =============================================================================

export function ManusCanvas({
  // useSelector((state) => state.agentWorkspace.sidebarType || inferViewFromWebsocket(state.websocket))
  viewType = "empty",

  // useSelector((state) => state.agentWorkspace.isSidebarPreviewFullscreen)
  isFullscreen = false,
  onToggleFullscreen,
  onClose,

  // useSelector((state) => getLatestBrowserUrlFromWebsocket(state.websocket))
  browserUrl,
  // useSelector((state) => state.sessions.entities[currentSessionId]?.webpageScreenshots?.latest)
  browserScreenshot,
  // useSelector((state) => isLatestToolCallLoading(state.websocket))
  browserLoading,

  // useSelector((state) => state.codeViewer.directoryList)
  fileTree,
  // useSelector((state) => state.codeViewer.fileTabList)
  fileTabs,
  // useSelector((state) => state.codeViewer.fileDataSource[state.codeViewer.activeTabId])
  activeFileContent,
  activeFileLanguage,

  // useSelector((state) => getTerminalHistoryFromWebsocket(state.websocket))
  terminalOutput,

  // useSelector((state) => state.filePreviewer.previewData?.displayFilename)
  previewFileName,
  // useSelector((state) => state.filePreviewer.previewData?.raw[0]?.fileContent)
  previewContent,
  // useSelector((state) => state.filePreviewer.previewData?.category)
  previewFileType,

  // useSelector((state) => state.slideEditor.slides)
  slides,
  // useSelector((state) => state.filePreviewer.currentSlideId)
  currentSlideIndex,

  // useSelector((state) => getLatestActionFromWebsocket(state.websocket))
  currentAction,
  // useSelector((state) => getLatestStatusUpdateFromWebsocket(state.websocket).text)
  statusText,
  // useSelector((state) => getLatestStatusUpdateFromWebsocket(state.websocket).currentStep)
  currentStep,
  // useSelector((state) => getLatestStatusUpdateFromWebsocket(state.websocket).totalSteps)
  totalSteps,
  // useSelector((state) => isAgentWorking(state.websocket))
  isWorking = false,

  // useSelector((state) => state.timeline.percentage)
  timelinePercentage = 0,
  onTimelineChange,
}: ManusCanvasProps) {
  // ... (the rest of the component logic is identical)
}
