/**
 * Phase 6 Integration Tests (P6.21)
 * Tests websocket event → slice state flow for all Phase 6 enhancements
 */

import { describe, it, expect, beforeEach } from "vitest";
import { configureStore } from "@reduxjs/toolkit";
import websocketReducer, {
  setReconnectConfig,
  startReconnecting,
  reconnectSuccess,
  reconnectFailed,
} from "../../lib/store/slices/websocket.slice";
import toolCallsReducer, {
  startToolCall,
  completeToolCall,
} from "../../lib/store/slices/toolCalls.slice";
import fileManagementReducer, {
  addToUploadQueue,
  updateUploadProgress,
  completeUpload,
} from "../../lib/store/slices/fileManagement.slice";
import myBrowserReducer, {
  setFrameMetadata,
  updateFrameMetadata,
  setActiveFrame,
} from "../../lib/store/slices/myBrowser.slice";
import agentWorkspaceReducer, {
  setIsPlannerExpanded,
  setWorkspaceSidebarType,
} from "../../lib/store/slices/agentWorkspace.slice";
import notificationsReducer, {
  addNotification,
  triggerNotificationAction,
  completeNotificationAction,
} from "../../lib/store/slices/notifications.slice";
import uiReducer, {
  registerPanel,
  updatePanelLayout,
  setActivePanel,
} from "../../lib/store/slices/ui.slice";

type RootState = {
  websocket: ReturnType<typeof websocketReducer>;
  toolCalls: ReturnType<typeof toolCallsReducer>;
  fileManagement: ReturnType<typeof fileManagementReducer>;
  myBrowser: ReturnType<typeof myBrowserReducer>;
  agentWorkspace: ReturnType<typeof agentWorkspaceReducer>;
  notifications: ReturnType<typeof notificationsReducer>;
  ui: ReturnType<typeof uiReducer>;
};

describe("Phase 6: Websocket Event → Slice Flow Integration", () => {
  let store: ReturnType<typeof configureStore>;

  beforeEach(() => {
    store = configureStore({
      reducer: {
        websocket: websocketReducer,
        toolCalls: toolCallsReducer,
        fileManagement: fileManagementReducer,
        myBrowser: myBrowserReducer,
        agentWorkspace: agentWorkspaceReducer,
        notifications: notificationsReducer,
        ui: uiReducer,
      },
    });
  });

  describe("P6.5: Websocket Reconnect Policy", () => {
    it("should handle exponential backoff reconnection flow", () => {
      // Configure exponential backoff
      store.dispatch(
        setReconnectConfig({
          policy: "exponential",
          maxAttempts: 5,
          baseDelay: 1000,
          maxDelay: 10000,
          backoffMultiplier: 2,
        })
      );

      let state = (store.getState() as RootState).websocket;
      expect(state.reconnectConfig.policy).toBe("exponential");

      // Start reconnecting (attempt 0)
      store.dispatch(startReconnecting());
      state = (store.getState() as RootState).websocket;
      expect(state.isReconnecting).toBe(true);
      expect(state.nextReconnectDelay).toBe(1000); // baseDelay * 2^0

      // Fail and retry (attempt 1)
      store.dispatch(reconnectFailed("Connection timeout"));
      state = (store.getState() as RootState).websocket;
      expect(state.reconnectAttempts).toBe(1);

      // Start next attempt
      store.dispatch(startReconnecting());
      state = (store.getState() as RootState).websocket;
      expect(state.nextReconnectDelay).toBe(2000); // baseDelay * 2^1

      // Succeed on attempt 2
      store.dispatch(reconnectSuccess());
      state = (store.getState() as RootState).websocket;
      expect(state.isReconnecting).toBe(false);
      expect(state.reconnectAttempts).toBe(0);
      expect(state.status).toBe("connected");
    });

    it("should stop reconnecting after max attempts", () => {
      store.dispatch(
        setReconnectConfig({
          policy: "exponential",
          maxAttempts: 3,
          baseDelay: 1000,
          maxDelay: 10000,
          backoffMultiplier: 2,
        })
      );

      // Attempt 1
      store.dispatch(startReconnecting());
      store.dispatch(reconnectFailed("Failed 1"));

      // Attempt 2
      store.dispatch(startReconnecting());
      store.dispatch(reconnectFailed("Failed 2"));

      // Attempt 3 - should stop
      store.dispatch(startReconnecting());
      store.dispatch(reconnectFailed("Failed 3"));

      const state = (store.getState() as RootState).websocket;
      expect(state.reconnectAttempts).toBe(3);
      expect(state.isReconnecting).toBe(false);
      expect(state.status).toBe("error");
    });
  });

  describe("P6.6: Tool Calls Slice", () => {
    it("should track tool call lifecycle by correlationId", () => {
      const correlationId = "tool-123";

      // Start tool call
      store.dispatch(
        startToolCall({
          correlationId,
          toolName: "bash",
          sessionId: "session-1",
          messageId: "msg-1",
          input: { command: "ls -la" },
          metadata: { agentId: "agent-1" },
        })
      );

      let state = (store.getState() as RootState).toolCalls;
      expect(state.byCorrelationId[correlationId]).toBeDefined();
      expect(state.byCorrelationId[correlationId]!.status).toBe("running");
      expect(state.activeCorrelationIds).toContain(correlationId);
      expect(state.stats.totalCalls).toBe(1);

      // Complete tool call
      store.dispatch(
        completeToolCall({
          correlationId,
          output: { stdout: "file1.txt\nfile2.txt" },
        })
      );

      state = (store.getState() as RootState).toolCalls;
      expect(state.byCorrelationId[correlationId]!.status).toBe("success");
      expect(state.byCorrelationId[correlationId]!.output).toBeDefined();
      expect(state.activeCorrelationIds).not.toContain(correlationId);
      expect(state.stats.successCount).toBe(1);
    });

    it("should maintain session index for filtering", () => {
      // Add multiple tool calls to same session
      store.dispatch(
        startToolCall({
          correlationId: "tool-1",
          toolName: "bash",
          sessionId: "session-1",
          input: {},
        })
      );
      store.dispatch(
        startToolCall({
          correlationId: "tool-2",
          toolName: "read",
          sessionId: "session-1",
          input: {},
        })
      );
      store.dispatch(
        startToolCall({
          correlationId: "tool-3",
          toolName: "bash",
          sessionId: "session-2",
          input: {},
        })
      );

      const state = (store.getState() as RootState).toolCalls;
      expect(state.bySessionId["session-1"]).toHaveLength(2);
      expect(state.bySessionId["session-2"]).toHaveLength(1);
    });
  });

  describe("P6.8: File Upload Progress Tracking", () => {
    it("should track detailed upload progress with metrics", () => {
      const uploadId = "upload-123";

      // Add to queue
      store.dispatch(
        addToUploadQueue({
          id: uploadId,
          file: "/path/to/file.pdf",
          fileName: "document.pdf",
          fileSize: 1024000, // 1MB
        })
      );

      let state = (store.getState() as RootState).fileManagement;
      expect(state.uploadQueue).toHaveLength(1);
      expect(state.uploadQueue[0]!.progress).toBe(0);

      // Update progress
      store.dispatch(
        updateUploadProgress({
          id: uploadId,
          progress: 50,
          bytesUploaded: 512000,
          uploadSpeed: 102400, // 100KB/s
          estimatedTimeRemaining: 5,
        })
      );

      state = (store.getState() as RootState).fileManagement;
      expect(state.uploadQueue[0]!.progress).toBe(50);
      expect(state.uploadQueue[0]!.bytesUploaded).toBe(512000);
      expect(state.uploadQueue[0]!.uploadSpeed).toBe(102400);
      expect(state.activeUploadsCount).toBe(1);
      expect(state.totalUploadProgress).toBe(50);

      // Complete upload
      store.dispatch(completeUpload(uploadId));

      state = (store.getState() as RootState).fileManagement;
      expect(state.uploadQueue[0]!.status).toBe("completed");
      expect(state.uploadQueue[0]!.progress).toBe(100);
      expect(state.activeUploadsCount).toBe(0);
      expect(state.isUploading).toBe(false);
    });

    it("should calculate aggregate progress for multiple uploads", () => {
      // Add 3 uploads
      store.dispatch(
        addToUploadQueue({
          id: "up-1",
          file: "f1",
          fileName: "file1.txt",
          fileSize: 1000,
        })
      );
      store.dispatch(
        addToUploadQueue({
          id: "up-2",
          file: "f2",
          fileName: "file2.txt",
          fileSize: 1000,
        })
      );
      store.dispatch(
        addToUploadQueue({
          id: "up-3",
          file: "f3",
          fileName: "file3.txt",
          fileSize: 1000,
        })
      );

      // Update each to different progress levels
      store.dispatch(updateUploadProgress({ id: "up-1", progress: 100 }));
      store.dispatch(updateUploadProgress({ id: "up-2", progress: 50 }));
      store.dispatch(updateUploadProgress({ id: "up-3", progress: 0 }));

      const state = (store.getState() as RootState).fileManagement;
      // Total = (100 + 50 + 0) / 3 = 50
      expect(state.totalUploadProgress).toBe(50);
    });
  });

  describe("P6.9: Browser Frame Metadata", () => {
    it("should manage frame metadata with active tracking", () => {
      const frame1 = {
        frameId: "frame-1",
        tabId: "tab-1",
        url: "https://example.com",
        title: "Example",
        frameType: "main_frame" as const,
        isActive: true,
        lastActiveAt: new Date().toISOString(),
      };

      const frame2 = {
        frameId: "frame-2",
        tabId: "tab-1",
        url: "https://example.com/iframe",
        title: "Iframe",
        frameType: "sub_frame" as const,
        isActive: false,
        lastActiveAt: new Date().toISOString(),
      };

      // Add first frame
      store.dispatch(setFrameMetadata(frame1));

      let state = (store.getState() as RootState).myBrowser;
      expect(state.frames["frame-1"]).toBeDefined();
      expect(state.activeFrameId).toBe("frame-1");
      expect(state.frameCount).toBe(1);

      // Add second frame (inactive)
      store.dispatch(setFrameMetadata(frame2));

      state = (store.getState() as RootState).myBrowser;
      expect(state.frameCount).toBe(2);
      expect(state.activeFrameId).toBe("frame-1"); // Still frame-1

      // Switch active frame
      store.dispatch(setActiveFrame("frame-2"));

      state = (store.getState() as RootState).myBrowser;
      expect(state.activeFrameId).toBe("frame-2");
      expect(state.frames["frame-1"]!.isActive).toBe(false);
      expect(state.frames["frame-2"]!.isActive).toBe(true);
    });

    it("should update frame metadata partially", () => {
      const frame = {
        frameId: "frame-1",
        tabId: "tab-1",
        url: "https://example.com",
        title: "Example",
        frameType: "main_frame" as const,
        isActive: true,
        lastActiveAt: new Date().toISOString(),
      };

      store.dispatch(setFrameMetadata(frame));

      // Update viewport
      store.dispatch(
        updateFrameMetadata({
          frameId: "frame-1",
          updates: {
            viewport: { width: 1920, height: 1080, devicePixelRatio: 2 },
          },
        })
      );

      const state = (store.getState() as RootState).myBrowser;
      expect(state.frames["frame-1"]!.viewport).toBeDefined();
      expect(state.frames["frame-1"]!.viewport?.width).toBe(1920);
      expect(state.frames["frame-1"]!.url).toBe("https://example.com"); // Unchanged
    });
  });

  describe("P6.10: Agent Workspace Aggregate State", () => {
    it("should recompute workspace layout on panel changes", () => {
      // Initially compact
      let state = (store.getState() as RootState).agentWorkspace;
      expect(state.workspaceLayout.layoutMode).toBe("compact");
      expect(state.workspaceLayout.isAnyPanelOpen).toBe(false);

      // Open planner
      store.dispatch(setIsPlannerExpanded(true));

      state = (store.getState() as RootState).agentWorkspace;
      expect(state.workspaceLayout.isPlannerVisible).toBe(true);
      expect(state.workspaceLayout.isAnyPanelOpen).toBe(true);
      expect(state.workspaceLayout.layoutMode).toBe("expanded"); // 1 panel open

      // Open sidebar
      store.dispatch(setWorkspaceSidebarType("files"));

      state = (store.getState() as RootState).agentWorkspace;
      expect(state.workspaceLayout.isSidebarVisible).toBe(true);
      expect(state.workspaceLayout.layoutMode).toBe("split"); // 2+ panels open
      expect(state.workspaceLayout.panelStack).toContain("planner");
      expect(state.workspaceLayout.panelStack).toContain("sidebar");
    });

    it("should handle websocket plan events", () => {
      // Dispatch websocket event
      store.dispatch({ type: "websocket/plan:expanded" });

      let state = (store.getState() as RootState).agentWorkspace;
      expect(state.isPlannerExpanded).toBe(true);
      expect(state.workspaceLayout.isPlannerVisible).toBe(true);

      // Collapse via websocket
      store.dispatch({ type: "websocket/plan:collapsed" });

      state = (store.getState() as RootState).agentWorkspace;
      expect(state.isPlannerExpanded).toBe(false);
      expect(state.workspaceLayout.isPlannerVisible).toBe(false);
    });
  });

  describe("P6.14: Notification Action Routing", () => {
    it("should route notification actions and track history", () => {
      const notification = {
        id: "notif-1",
        userId: "user-1",
        type: "task_complete" as const,
        priority: "normal" as const,
        title: "Task Complete",
        message: "Your task has finished",
        isRead: false,
        isArchived: false,
        createdAt: new Date().toISOString(),
        metadata: {
          actions: [
            {
              label: "View Results",
              action: "navigate",
              actionType: "navigation" as const,
              route: "/tasks/123",
              variant: "primary" as const,
            },
          ],
        },
      };

      // Add notification
      store.dispatch(addNotification(notification));

      let state = (store.getState() as RootState).notifications;
      expect(state.notifications).toHaveLength(1);
      expect(state.unreadCount).toBe(1);

      // Trigger action
      store.dispatch(
        triggerNotificationAction({
          notificationId: "notif-1",
          action: notification.metadata!.actions![0]!,
        })
      );

      state = (store.getState() as RootState).notifications;
      expect(state.pendingActions).toHaveLength(1);
      expect(state.pendingActions[0]!.notificationId).toBe("notif-1");
      // Auto-marked as read
      expect(state.notifications[0]!.isRead).toBe(true);
      expect(state.unreadCount).toBe(0);

      // Complete action
      store.dispatch(
        completeNotificationAction({
          notificationId: "notif-1",
          actionLabel: "View Results",
          success: true,
        })
      );

      state = (store.getState() as RootState).notifications;
      expect(state.pendingActions).toHaveLength(0);
      expect(state.actionHistory).toHaveLength(1);
      expect(state.actionHistory[0]!.success).toBe(true);
    });
  });

  describe("P6.15: UI Panel Layout", () => {
    it("should manage deterministic panel layout", () => {
      const panel1 = {
        id: "panel-chat",
        type: "right" as const,
        position: { x: 0, y: 0 },
        size: { width: 400, height: 600 },
        isVisible: true,
        isMinimized: false,
        zIndex: 1,
        isDocked: true,
      };

      const panel2 = {
        id: "panel-files",
        type: "left" as const,
        position: { x: 0, y: 0 },
        size: { width: 300, height: 600 },
        isVisible: true,
        isMinimized: false,
        zIndex: 1,
        isDocked: true,
      };

      // Register panels
      store.dispatch(registerPanel(panel1));
      store.dispatch(registerPanel(panel2));

      let state = (store.getState() as RootState).ui;
      expect(Object.keys(state.panelLayout.panels)).toHaveLength(2);
      expect(state.panelLayout.panelOrder).toHaveLength(2);

      // Set active panel (brings to front)
      store.dispatch(setActivePanel("panel-files"));

      state = (store.getState() as RootState).ui;
      expect(state.panelLayout.activePanel).toBe("panel-files");
      expect(state.panelLayout.panelOrder[1]).toBe("panel-files"); // Last = front
      expect(state.panelLayout.panels["panel-files"]!.zIndex).toBe(2);
      expect(state.panelLayout.panels["panel-chat"]!.zIndex).toBe(1);

      // Update panel layout
      store.dispatch(
        updatePanelLayout({
          id: "panel-chat",
          updates: { size: { width: 500, height: 700 } },
        })
      );

      state = (store.getState() as RootState).ui;
      expect(state.panelLayout.panels["panel-chat"]!.size.width).toBe(500);
    });
  });

  describe("Cross-Slice Integration", () => {
    it("should handle full websocket → multiple slices flow", () => {
      // Simulate websocket events affecting multiple slices

      // 1. Websocket connects
      store.dispatch({ type: "websocket/connected" });
      expect((store.getState() as RootState).websocket.status).toBe("connected");

      // 2. Tool call starts
      store.dispatch(
        startToolCall({
          correlationId: "tc-1",
          toolName: "bash",
          sessionId: "s-1",
          input: {},
        })
      );
      expect((store.getState() as RootState).toolCalls.activeCorrelationIds).toHaveLength(1);

      // 3. Upload starts
      store.dispatch(
        addToUploadQueue({
          id: "up-1",
          file: "test.pdf",
          fileName: "test.pdf",
          fileSize: 5000,
        })
      );
      expect((store.getState() as RootState).fileManagement.uploadQueue).toHaveLength(1);

      // 4. Workspace opens planner
      store.dispatch({ type: "websocket/plan:expanded" });
      expect((store.getState() as RootState).agentWorkspace.isPlannerExpanded).toBe(true);

      // 5. Notification arrives
      store.dispatch(
        addNotification({
          id: "n-1",
          userId: "u-1",
          type: "agent_update",
          priority: "normal",
          title: "Update",
          message: "Agent finished",
          isRead: false,
          isArchived: false,
          createdAt: new Date().toISOString(),
        })
      );
      expect((store.getState() as RootState).notifications.unreadCount).toBe(1);

      // Verify all state updated correctly
      const finalState = store.getState() as RootState;
      expect(finalState.websocket.status).toBe("connected");
      expect(finalState.toolCalls.stats.totalCalls).toBe(1);
      expect(finalState.fileManagement.uploadQueue[0]!.status).toBe("pending");
      expect(finalState.agentWorkspace.workspaceLayout.isPlannerVisible).toBe(true);
      expect(finalState.notifications.notifications).toHaveLength(1);
    });
  });
});
