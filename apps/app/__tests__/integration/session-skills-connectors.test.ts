/**
 * Integration Test: Session Skills & Connectors State Management
 *
 * Tests:
 * 1. SessionSettings includes skillIds field
 * 2. updateSessionSkills action correctly updates session state
 * 3. updateSessionConnectors action correctly updates session state
 * 4. WorkspaceSidebarType includes Manus-parity types
 * 5. agentWorkspace sidebar toggles work with new types
 */

import { describe, it, expect, beforeEach } from "vitest";
import { configureStore } from "@reduxjs/toolkit";
import sessionsReducer, {
  addSession,
  updateSession,
  updateSessionSkills,
  updateSessionConnectors,
  type AgentSession,
  type SessionSettings,
} from "../../lib/store/slices/sessions.slice";
import agentWorkspaceReducer, {
  setWorkspaceSidebarType,
  toggleWorkspaceSidebar,
  type WorkspaceSidebarType,
} from "../../lib/store/slices/agentWorkspace.slice";

// ============================================================================
// Helpers
// ============================================================================

function makeSession(overrides?: Partial<AgentSession>): AgentSession {
  return {
    id: "sess-test-123",
    userId: "user-456",
    title: "Test Session",
    status: "active",
    mode: "agent",
    isShared: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ============================================================================
// Sessions Slice Tests
// ============================================================================

describe("Sessions Slice: Skills & Connectors", () => {
  let store: ReturnType<typeof configureStore>;

  beforeEach(() => {
    store = configureStore({
      reducer: { sessions: sessionsReducer },
    });
  });

  describe("SessionSettings Interface", () => {
    it("should accept skillIds in session settings", () => {
      const settings: SessionSettings = {
        skillIds: ["web-search", "browser", "code-interpreter"],
        connectorIds: ["conn-1", "conn-2"],
        model: "claude-sonnet-4-5-20250929",
      };

      expect(settings.skillIds).toEqual(["web-search", "browser", "code-interpreter"]);
      expect(settings.connectorIds).toEqual(["conn-1", "conn-2"]);
    });

    it("should accept empty skillIds", () => {
      const settings: SessionSettings = {
        skillIds: [],
      };
      expect(settings.skillIds).toEqual([]);
    });

    it("should accept undefined skillIds (optional)", () => {
      const settings: SessionSettings = {};
      expect(settings.skillIds).toBeUndefined();
    });
  });

  describe("updateSessionSkills action", () => {
    it("should update session with skill IDs", () => {
      store.dispatch(addSession(makeSession({ id: "sess-1" })));
      store.dispatch(updateSessionSkills({
        id: "sess-1",
        skillIds: ["web-search", "browser"],
      }));

      const state = (store.getState() as { sessions: ReturnType<typeof sessionsReducer> }).sessions;
      const session = state.sessions.find((s) => s.id === "sess-1");

      expect(session?.settings?.skillIds).toEqual(["web-search", "browser"]);
    });

    it("should create settings object if not present", () => {
      store.dispatch(addSession(makeSession({ id: "sess-2", settings: undefined })));
      store.dispatch(updateSessionSkills({
        id: "sess-2",
        skillIds: ["code-interpreter"],
      }));

      const state = (store.getState() as { sessions: ReturnType<typeof sessionsReducer> }).sessions;
      const session = state.sessions.find((s) => s.id === "sess-2");

      expect(session?.settings).toBeDefined();
      expect(session?.settings?.skillIds).toEqual(["code-interpreter"]);
    });

    it("should preserve existing settings when updating skills", () => {
      store.dispatch(addSession(makeSession({
        id: "sess-3",
        settings: {
          model: "claude-sonnet-4-5-20250929",
          connectorIds: ["conn-1"],
        },
      })));
      store.dispatch(updateSessionSkills({
        id: "sess-3",
        skillIds: ["web-search"],
      }));

      const state = (store.getState() as { sessions: ReturnType<typeof sessionsReducer> }).sessions;
      const session = state.sessions.find((s) => s.id === "sess-3");

      expect(session?.settings?.model).toBe("claude-sonnet-4-5-20250929");
      expect(session?.settings?.connectorIds).toEqual(["conn-1"]);
      expect(session?.settings?.skillIds).toEqual(["web-search"]);
    });

    it("should update updatedAt timestamp", () => {
      const oldDate = "2026-01-01T00:00:00.000Z";
      store.dispatch(addSession(makeSession({ id: "sess-4", updatedAt: oldDate })));
      store.dispatch(updateSessionSkills({
        id: "sess-4",
        skillIds: ["browser"],
      }));

      const state = (store.getState() as { sessions: ReturnType<typeof sessionsReducer> }).sessions;
      const session = state.sessions.find((s) => s.id === "sess-4");

      expect(session?.updatedAt).not.toBe(oldDate);
    });

    it("should handle non-existent session gracefully", () => {
      store.dispatch(updateSessionSkills({
        id: "nonexistent",
        skillIds: ["web-search"],
      }));

      const state = (store.getState() as { sessions: ReturnType<typeof sessionsReducer> }).sessions;
      expect(state.sessions).toHaveLength(0);
    });
  });

  describe("updateSessionConnectors action", () => {
    it("should update session with connector IDs", () => {
      store.dispatch(addSession(makeSession({ id: "sess-5" })));
      store.dispatch(updateSessionConnectors({
        id: "sess-5",
        connectorIds: ["gmail-conn", "slack-conn"],
      }));

      const state = (store.getState() as { sessions: ReturnType<typeof sessionsReducer> }).sessions;
      const session = state.sessions.find((s) => s.id === "sess-5");

      expect(session?.settings?.connectorIds).toEqual(["gmail-conn", "slack-conn"]);
    });

    it("should create settings object if not present", () => {
      store.dispatch(addSession(makeSession({ id: "sess-6", settings: undefined })));
      store.dispatch(updateSessionConnectors({
        id: "sess-6",
        connectorIds: ["github-conn"],
      }));

      const state = (store.getState() as { sessions: ReturnType<typeof sessionsReducer> }).sessions;
      const session = state.sessions.find((s) => s.id === "sess-6");

      expect(session?.settings?.connectorIds).toEqual(["github-conn"]);
    });
  });
});

// ============================================================================
// Agent Workspace Slice Tests — Manus Parity Sidebar Types
// ============================================================================

describe("AgentWorkspace Slice: Manus Parity Sidebar Types", () => {
  let store: ReturnType<typeof configureStore>;

  beforeEach(() => {
    store = configureStore({
      reducer: { agentWorkspace: agentWorkspaceReducer },
    });
  });

  describe("WorkspaceSidebarType", () => {
    it("should accept 'planner' as valid sidebar type", () => {
      store.dispatch(setWorkspaceSidebarType("planner"));
      const state = (store.getState() as { agentWorkspace: ReturnType<typeof agentWorkspaceReducer> }).agentWorkspace;
      expect(state.sidebarType).toBe("planner");
    });

    it("should accept 'browser' as valid sidebar type", () => {
      store.dispatch(setWorkspaceSidebarType("browser"));
      const state = (store.getState() as { agentWorkspace: ReturnType<typeof agentWorkspaceReducer> }).agentWorkspace;
      expect(state.sidebarType).toBe("browser");
    });

    it("should accept 'webdev' as valid sidebar type", () => {
      store.dispatch(setWorkspaceSidebarType("webdev"));
      const state = (store.getState() as { agentWorkspace: ReturnType<typeof agentWorkspaceReducer> }).agentWorkspace;
      expect(state.sidebarType).toBe("webdev");
    });

    it("should still accept original types: agents, sources, files, computer", () => {
      const originalTypes: WorkspaceSidebarType[] = ["agents", "sources", "files", "computer"];

      for (const type of originalTypes) {
        store.dispatch(setWorkspaceSidebarType(type));
        const state = (store.getState() as { agentWorkspace: ReturnType<typeof agentWorkspaceReducer> }).agentWorkspace;
        expect(state.sidebarType).toBe(type);
      }
    });

    it("should accept null (closed)", () => {
      store.dispatch(setWorkspaceSidebarType("browser"));
      store.dispatch(setWorkspaceSidebarType(null));
      const state = (store.getState() as { agentWorkspace: ReturnType<typeof agentWorkspaceReducer> }).agentWorkspace;
      expect(state.sidebarType).toBeNull();
    });
  });

  describe("Toggle with new types", () => {
    it("should toggle planner sidebar on/off", () => {
      store.dispatch(toggleWorkspaceSidebar("planner"));
      let state = (store.getState() as { agentWorkspace: ReturnType<typeof agentWorkspaceReducer> }).agentWorkspace;
      expect(state.sidebarType).toBe("planner");

      store.dispatch(toggleWorkspaceSidebar("planner"));
      state = (store.getState() as { agentWorkspace: ReturnType<typeof agentWorkspaceReducer> }).agentWorkspace;
      expect(state.sidebarType).toBeNull();
    });

    it("should switch between browser and webdev sidebar types", () => {
      store.dispatch(setWorkspaceSidebarType("browser"));
      let state = (store.getState() as { agentWorkspace: ReturnType<typeof agentWorkspaceReducer> }).agentWorkspace;
      expect(state.sidebarType).toBe("browser");

      store.dispatch(setWorkspaceSidebarType("webdev"));
      state = (store.getState() as { agentWorkspace: ReturnType<typeof agentWorkspaceReducer> }).agentWorkspace;
      expect(state.sidebarType).toBe("webdev");
      expect(state.prevAutoOpenedSidebarType).toBe("browser");
    });
  });

  describe("Workspace layout recomputation", () => {
    it("should update layout when sidebar type changes", () => {
      store.dispatch(setWorkspaceSidebarType("browser"));
      const state = (store.getState() as { agentWorkspace: ReturnType<typeof agentWorkspaceReducer> }).agentWorkspace;

      expect(state.workspaceLayout.isSidebarVisible).toBe(true);
      expect(state.workspaceLayout.isAnyPanelOpen).toBe(true);
      expect(state.workspaceLayout.layoutMode).toBe("expanded");
    });

    it("should show compact layout when all panels closed", () => {
      store.dispatch(setWorkspaceSidebarType(null));
      const state = (store.getState() as { agentWorkspace: ReturnType<typeof agentWorkspaceReducer> }).agentWorkspace;

      expect(state.workspaceLayout.isSidebarVisible).toBe(false);
      expect(state.workspaceLayout.isAnyPanelOpen).toBe(false);
      expect(state.workspaceLayout.layoutMode).toBe("compact");
    });
  });
});
