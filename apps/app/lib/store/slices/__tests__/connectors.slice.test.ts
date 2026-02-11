import { describe, it, expect } from "vitest";
import connectorsReducer, {
  setComposioEventMappings,
  addComposioEventMapping,
  updateComposioEventMapping,
  removeComposioEventMapping,
  toggleComposioEventMapping,
  type ConnectorsState,
  type ComposioEventMapping,
} from "../connectors.slice";

describe("connectors.slice - P6.13 Composio event mapping", () => {
  const initialState: ConnectorsState = {
    availableConnectors: [],
    installedConnectors: [],
    categories: [
      "productivity",
      "developer",
      "communication",
      "data",
      "finance",
      "social",
      "custom",
    ],
    selectedConnectorId: null,
    searchQuery: "",
    selectedCategory: "all",
    isLoadingAvailable: false,
    isLoadingInstalled: false,
    isInstalling: false,
    connectionFlow: {
      isOpen: false,
      connectorId: null,
      step: "select",
      error: null,
    },
    composioEventMappings: [],
    temporaryEnabledOverrides: {},
    temporaryGithubRepositories: {},
    multipleEmailConfirmedInfo: {},
    multipleCalendarConfirmedInfo: {},
    githubRepositories: [],
    githubRepositoriesLoading: false,
    error: null,
  };

  const mockMapping: ComposioEventMapping = {
    composioEvent: "gmail.message.received",
    internalEvent: "email.inbox.new",
    enabled: true,
    metadata: { priority: "high" },
  };

  describe("setComposioEventMappings", () => {
    it("should set all event mappings", () => {
      const mappings: ComposioEventMapping[] = [
        mockMapping,
        {
          composioEvent: "slack.message.sent",
          internalEvent: "chat.message.sent",
          enabled: true,
        },
      ];

      const state = connectorsReducer(initialState, setComposioEventMappings(mappings));

      expect(state.composioEventMappings).toHaveLength(2);
      expect(state.composioEventMappings).toEqual(mappings);
    });

    it("should replace existing mappings", () => {
      const stateWithMapping = connectorsReducer(
        initialState,
        addComposioEventMapping(mockMapping)
      );

      const newMappings: ComposioEventMapping[] = [
        {
          composioEvent: "github.pr.opened",
          internalEvent: "vcs.pr.created",
          enabled: false,
        },
      ];

      const state = connectorsReducer(stateWithMapping, setComposioEventMappings(newMappings));

      expect(state.composioEventMappings).toHaveLength(1);
      expect(state.composioEventMappings[0]?.composioEvent).toBe("github.pr.opened");
    });
  });

  describe("addComposioEventMapping", () => {
    it("should add a new event mapping", () => {
      const state = connectorsReducer(initialState, addComposioEventMapping(mockMapping));

      expect(state.composioEventMappings).toHaveLength(1);
      expect(state.composioEventMappings[0]).toEqual(mockMapping);
    });

    it("should add multiple mappings", () => {
      const mapping2: ComposioEventMapping = {
        composioEvent: "slack.message.sent",
        internalEvent: "chat.message.sent",
        enabled: true,
      };

      let state = connectorsReducer(initialState, addComposioEventMapping(mockMapping));
      state = connectorsReducer(state, addComposioEventMapping(mapping2));

      expect(state.composioEventMappings).toHaveLength(2);
    });
  });

  describe("updateComposioEventMapping", () => {
    it("should update an existing mapping", () => {
      const stateWithMapping = connectorsReducer(
        initialState,
        addComposioEventMapping(mockMapping)
      );

      const state = connectorsReducer(
        stateWithMapping,
        updateComposioEventMapping({
          composioEvent: "gmail.message.received",
          updates: { internalEvent: "email.inbox.received", enabled: false },
        })
      );

      const mapping = state.composioEventMappings.find(
        (m) => m.composioEvent === "gmail.message.received"
      );
      expect(mapping?.internalEvent).toBe("email.inbox.received");
      expect(mapping?.enabled).toBe(false);
      expect(mapping?.metadata).toEqual({ priority: "high" }); // preserved
    });

    it("should not affect other mappings", () => {
      const mapping2: ComposioEventMapping = {
        composioEvent: "slack.message.sent",
        internalEvent: "chat.message.sent",
        enabled: true,
      };

      let state = connectorsReducer(initialState, addComposioEventMapping(mockMapping));
      state = connectorsReducer(state, addComposioEventMapping(mapping2));
      state = connectorsReducer(
        state,
        updateComposioEventMapping({
          composioEvent: "gmail.message.received",
          updates: { enabled: false },
        })
      );

      expect(state.composioEventMappings[0]?.enabled).toBe(false);
      expect(state.composioEventMappings[1]?.enabled).toBe(true);
    });

    it("should handle updating non-existent mapping gracefully", () => {
      const state = connectorsReducer(
        initialState,
        updateComposioEventMapping({
          composioEvent: "nonexistent.event",
          updates: { enabled: false },
        })
      );

      expect(state.composioEventMappings).toHaveLength(0);
    });
  });

  describe("removeComposioEventMapping", () => {
    it("should remove an event mapping", () => {
      const stateWithMapping = connectorsReducer(
        initialState,
        addComposioEventMapping(mockMapping)
      );

      const state = connectorsReducer(
        stateWithMapping,
        removeComposioEventMapping("gmail.message.received")
      );

      expect(state.composioEventMappings).toHaveLength(0);
    });

    it("should remove only the specified mapping", () => {
      const mapping2: ComposioEventMapping = {
        composioEvent: "slack.message.sent",
        internalEvent: "chat.message.sent",
        enabled: true,
      };

      let state = connectorsReducer(initialState, addComposioEventMapping(mockMapping));
      state = connectorsReducer(state, addComposioEventMapping(mapping2));
      state = connectorsReducer(state, removeComposioEventMapping("gmail.message.received"));

      expect(state.composioEventMappings).toHaveLength(1);
      expect(state.composioEventMappings[0]?.composioEvent).toBe("slack.message.sent");
    });

    it("should handle removing non-existent mapping gracefully", () => {
      const state = connectorsReducer(
        initialState,
        removeComposioEventMapping("nonexistent.event")
      );

      expect(state.composioEventMappings).toHaveLength(0);
    });
  });

  describe("toggleComposioEventMapping", () => {
    it("should toggle enabled state from true to false", () => {
      const stateWithMapping = connectorsReducer(
        initialState,
        addComposioEventMapping(mockMapping)
      );

      const state = connectorsReducer(
        stateWithMapping,
        toggleComposioEventMapping("gmail.message.received")
      );

      const mapping = state.composioEventMappings.find(
        (m) => m.composioEvent === "gmail.message.received"
      );
      expect(mapping?.enabled).toBe(false);
    });

    it("should toggle enabled state from false to true", () => {
      const disabledMapping: ComposioEventMapping = {
        ...mockMapping,
        enabled: false,
      };

      const stateWithMapping = connectorsReducer(
        initialState,
        addComposioEventMapping(disabledMapping)
      );

      const state = connectorsReducer(
        stateWithMapping,
        toggleComposioEventMapping("gmail.message.received")
      );

      const mapping = state.composioEventMappings.find(
        (m) => m.composioEvent === "gmail.message.received"
      );
      expect(mapping?.enabled).toBe(true);
    });

    it("should not affect other mappings", () => {
      const mapping2: ComposioEventMapping = {
        composioEvent: "slack.message.sent",
        internalEvent: "chat.message.sent",
        enabled: true,
      };

      let state = connectorsReducer(initialState, addComposioEventMapping(mockMapping));
      state = connectorsReducer(state, addComposioEventMapping(mapping2));
      state = connectorsReducer(state, toggleComposioEventMapping("gmail.message.received"));

      expect(state.composioEventMappings[0]?.enabled).toBe(false);
      expect(state.composioEventMappings[1]?.enabled).toBe(true);
    });

    it("should handle toggling non-existent mapping gracefully", () => {
      const state = connectorsReducer(
        initialState,
        toggleComposioEventMapping("nonexistent.event")
      );

      expect(state.composioEventMappings).toHaveLength(0);
    });
  });
});
