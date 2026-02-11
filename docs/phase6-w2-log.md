# Phase 6 W2 - Slice Event Mapping & Integration Tests

**Date**: 2026-02-10
**Goal**: Complete remaining slice updates with event mappings and integration tests

## Tasks Overview

- [x] P6.5: websocket reconnect policy (DONE)
- [x] P6.6: toolCalls slice (DONE)
- [ ] P6.7: plan slice event mappings
- [ ] P6.8: fileManagement upload progress
- [ ] P6.9: myBrowser frame metadata
- [ ] P6.10: agentWorkspace aggregate state
- [ ] P6.14: notifications action routing
- [ ] P6.15: ui deterministic panel layout
- [ ] P6.19: cleanup unused selectors/actions
- [ ] P6.21: integration tests websocket-event->slice flow

## Task Details

### P6.5: websocket reconnect policy ✅

**Status**: Complete
**File**: `apps/app/lib/store/slices/websocket.slice.ts`
**Changes**:

- Added ReconnectConfig interface with policy types (exponential, linear, fixed, disabled)
- Added reconnect state management (reconnectConfig, nextReconnectDelay, isReconnecting)
- Added actions: setReconnectConfig, startReconnecting, stopReconnecting, reconnectSuccess, reconnectFailed
- Implemented exponential backoff calculation with configurable parameters

### P6.6: toolCalls slice ✅

**Status**: Complete
**File**: `apps/app/lib/store/slices/toolCalls.slice.ts`
**Changes**:

- Created new toolCalls slice with correlationId-based tracking
- Dual index: byCorrelationId (O(1) lookups) and bySessionId (filtering)
- Track active calls, recent calls (last 100), and statistics
- Actions: setToolCall, startToolCall, completeToolCall, failToolCall, cancelToolCall
- Duration tracking and metadata support

### P6.7: plan slice event mappings ✅

**Status**: Complete
**File**: `apps/app/lib/store/slices/agentWorkspace.slice.ts`
**Changes**:

- Added extraReducers for websocket plan events
- Event mappings: `websocket/plan:expanded`, `websocket/plan:collapsed`, `websocket/plan:toggle`
- Timeline events: `websocket/timeline:play`, `websocket/timeline:pause`, `websocket/timeline:toggle`
- Workspace events: sidebar open/close, fileHistory open/close
- All events trigger `recomputeWorkspaceLayout` for deterministic state

### P6.8: fileManagement upload progress ✅

**Status**: Complete
**File**: `apps/app/lib/store/slices/fileManagement.slice.ts`
**Changes**:

- Enhanced upload queue items with: fileName, fileSize, bytesUploaded, startedAt, completedAt
- Added upload metrics: uploadSpeed (bytes/sec), estimatedTimeRemaining (seconds)
- Added aggregate state: totalUploadProgress (percentage), activeUploadsCount
- Updated `updateUploadProgress` to calculate overall progress for all uploads
- Auto-set `isUploading` false when no active uploads

### P6.9: myBrowser frame metadata ✅

**Status**: Complete
**File**: `apps/app/lib/store/slices/myBrowser.slice.ts`
**Changes**:

- Added `BrowserFrameMetadata` interface with frame tracking
- Fields: frameId, tabId, url, title, frameType, isActive, lastActiveAt
- Viewport info: width, height, devicePixelRatio
- Performance metrics: loadTime, domContentLoadedTime, firstContentfulPaint
- Added state: frames (Record), activeFrameId, frameCount
- Actions: setFrameMetadata, updateFrameMetadata, removeFrame, setActiveFrame, clearAllFrames
- Automatic active frame tracking and deactivation of other frames

### P6.10: agentWorkspace aggregate state ✅

**Status**: Complete
**File**: `apps/app/lib/store/slices/agentWorkspace.slice.ts`
**Changes**:

- Added `workspaceLayout` aggregate state object
- Computed visibility flags: isAnyPanelOpen, isComputerVisible, isPlannerVisible, isSidebarVisible, isFileHistoryVisible
- Computed layoutMode: "compact" | "expanded" | "fullscreen" | "split"
- Panel stack for navigation history
- Created `recomputeWorkspaceLayout` helper function
- All panel-related reducers call helper to maintain consistency
- Deterministic layout calculation based on open panel count

### P6.14: notifications action routing ✅

**Status**: Complete
**File**: `apps/app/lib/store/slices/notifications.slice.ts`
**Changes**:

- Enhanced `NotificationAction` interface with routing types
- actionType: "navigation" | "dispatch" | "external" | "callback"
- Added route, dispatchAction, externalUrl, callbackId fields
- Added pendingActions array to track in-flight actions
- Added actionHistory with max size limit (default 100)
- Actions: triggerNotificationAction, completeNotificationAction, clearPendingActions, clearActionHistory
- Auto-mark notification as read when action triggered

### P6.15: ui deterministic panel layout ✅

**Status**: Complete
**File**: `apps/app/lib/store/slices/ui.slice.ts`
**Changes**:

- Added `PanelLayoutConfig` interface for panel definitions
- Added panelLayout state with panels, activePanel, panelOrder, layoutMode
- Layout modes: "grid" | "floating" | "tabbed" | "split"
- Grid config: rows, cols, gaps
- Actions: registerPanel, updatePanelLayout, setPanelVisible, setPanelMinimized
- setActivePanel brings panel to front and updates z-indices
- Z-order maintained via panelOrder array

### P6.19: cleanup unused selectors/actions ✅

**Status**: Complete
**File**: `docs/phase6-cleanup-notes.md`
**Changes**:

- Reviewed all Phase 6 slices for unused code
- Documented Manus compatibility shims for future removal
- All slices are clean - no immediate cleanup needed
- Identified future optimization opportunities (post-Manus migration)
- All new Phase 6 code follows RTK best practices

### P6.21: integration tests websocket-event→slice flow ✅

**Status**: Complete
**File**: `apps/app/__tests__/integration/phase6-websocket-slice-flow.test.ts`
**Changes**:

- Comprehensive integration test suite (13 tests)
- Tests for all Phase 6 enhancements:
  - P6.5: Websocket reconnect policy (exponential backoff, max attempts)
  - P6.6: Tool calls lifecycle and session indexing
  - P6.8: Upload progress tracking and aggregate metrics
  - P6.9: Frame metadata management and active tracking
  - P6.10: Workspace aggregate state recomputation
  - P6.14: Notification action routing and history
  - P6.15: Panel layout management and z-ordering
- Cross-slice integration test for full websocket flow
- All tests passing ✅

---

## Test Commands Log

```bash
# Run Phase 6 integration tests
npx vitest run apps/app/__tests__/integration/phase6-websocket-slice-flow.test.ts
# Result: ✓ 13 tests passed
```
