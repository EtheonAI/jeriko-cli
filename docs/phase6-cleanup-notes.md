# Phase 6 - Cleanup Notes (P6.19)

## Overview

This document tracks potential cleanup opportunities for unused selectors and actions across Phase 6 slices.

## Methodology

Since this is a greenfield implementation with new slices, we focus on:

1. Ensuring exported actions are actually used
2. Identifying duplicated functionality
3. Marking Manus compatibility shims for future removal

## Slices Reviewed

### websocket.slice.ts

**Status**: Clean

- All actions have clear purposes
- Reconnect policy actions are well-structured
- Manus compatibility action in extraReducers is properly labeled

**Future Cleanup Candidates**:

- `extraReducers` Manus compatibility action ("websocket/connected") - remove when Manus deprecated

### toolCalls.slice.ts

**Status**: Clean

- New slice, all actions are intentional
- Correlation ID indexing is efficient
- No legacy code

### fileManagement.slice.ts

**Status**: Clean (P6.8 enhanced)

- Upload progress tracking enhanced in P6.8
- All actions have clear use cases
- Google Drive picker integration is actively used

**Potential Optimization**:

- Consider combining `setIsUploading` with upload queue state (auto-derive from queue)

### myBrowser.slice.ts

**Status**: Clean (P6.9 enhanced)

- Frame metadata added in P6.9
- Browser settings actions are comprehensive
- Recent captures management is clean

### agentWorkspace.slice.ts

**Status**: Clean (P6.10 enhanced)

- Aggregate workspace layout added in P6.10
- Plan event mappings added in P6.7
- recomputeWorkspaceLayout helper properly reuses logic

### notifications.slice.ts

**Status**: Clean (P6.14 enhanced)

- Action routing system added in P6.14
- Manus compatibility shims in extraReducers

**Future Cleanup Candidates**:

- Manus compatibility extraReducers (notification/\* actions) - remove when deprecated
- Consider consolidating `categoryNotifications` with main `notifications` array

### ui.slice.ts

**Status**: Clean (P6.15 enhanced)

- Panel layout management added in P6.15
- All Manus-aligned properties properly labeled

**Potential Optimization**:

- Panel z-index calculation could be memoized if performance issues arise

## Recommendations

### Immediate (Phase 6)

✅ All slices are clean - no immediate cleanup needed
✅ All new Phase 6 features properly integrated

### Future (Post-Manus Migration)

- Remove Manus compatibility extraReducers from:
  - websocket.slice.ts
  - notifications.slice.ts
- Evaluate if `categoryNotifications` can be replaced with filtered selectors
- Consider auto-deriving `isUploading` from upload queue state

### Code Quality Notes

- All new Phase 6 code follows RTK best practices
- State normalization (IDs + entities) used where appropriate
- Aggregate state properly computed with helper functions
- Event mappings clearly labeled with P6.x task numbers

## Testing Coverage Needs

See P6.21 for integration test plan covering:

- Websocket event → slice state flow
- Upload progress tracking
- Frame metadata management
- Notification action routing
- Panel layout state transitions
