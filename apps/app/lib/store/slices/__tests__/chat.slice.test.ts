import { describe, it, expect } from "vitest";
import chatReducer, {
  addMessage,
  normalizeMessageParts,
  type ChatState,
  type Message,
} from "../chat.slice";

describe("chat.slice - P6.4 message-part normalization", () => {
  const initialState: ChatState = {
    messages: {},
    isStreaming: false,
    currentStreamingSessionId: null,
    inputValue: "",
    isLoading: false,
    error: null,
    taskMode: "agent",
    inputMode: "text",
    files: [],
    chatExtData: null,
    showSharePopover: false,
    playbookInfo: null,
    typingUsers: [],
    sendQuestionBehavior: null,
    slideTemplateList: [],
    slideTemplateListLoading: false,
    recommendedPlaybooksV2: { playbooks: null, loading: false, total: 0, currentPage: 0 },
    dataVisualization: null,
    debugModelOverride: { enabled: false, config: null, configText: "" },
    isPageVisible: true,
    fileSuggestions: [],
    inputPlaybookId: null,
    inputPlaybookTemplate: null,
    isAppBannerVisible: false,
    imageStyleList: [],
    imageStyleListLoading: false,
    agentModeIntroduceScene: null,
    pinnedSlideTemplateId: null,
    textContentLength: 0,
    editorContent: {},
    dagExpanded: true,
    selectedAgentId: null,
    sidebarType: null,
    sidebarOpen: false,
    isAtBottom: true,
    hasNewMessages: false,
    uiMessages: {},
    streamingState: {
      messageId: null,
      activePartId: null,
      partialText: "",
    },
    pendingApprovals: [],
    sources: {},
    activeSessionId: null,
  };

  describe("normalizeMessageParts", () => {
    it("should filter out null parts", () => {
      const messageWithNullParts: Message = {
        id: "msg-1",
        sessionId: "session-1",
        role: "assistant",
        content: "Test",
        parts: [{ type: "text" }, null, { type: "tool" }] as unknown as Record<string, unknown>[],
        createdAt: new Date().toISOString(),
      };

      const stateWithMessage = chatReducer(initialState, addMessage(messageWithNullParts));

      const normalizedState = chatReducer(
        stateWithMessage,
        normalizeMessageParts({ sessionId: "session-1", messageId: "msg-1" })
      );

      const message = normalizedState.messages["session-1"]?.find((m) => m.id === "msg-1");
      expect(message?.parts).toHaveLength(2);
      expect(message?.parts?.every((p) => p !== null)).toBe(true);
    });

    it("should filter out undefined parts", () => {
      const messageWithUndefinedParts: Message = {
        id: "msg-2",
        sessionId: "session-1",
        role: "assistant",
        content: "Test",
        parts: [{ type: "text" }, undefined, { type: "tool" }] as unknown as Record<
          string,
          unknown
        >[],
        createdAt: new Date().toISOString(),
      };

      const stateWithMessage = chatReducer(initialState, addMessage(messageWithUndefinedParts));

      const normalizedState = chatReducer(
        stateWithMessage,
        normalizeMessageParts({ sessionId: "session-1", messageId: "msg-2" })
      );

      const message = normalizedState.messages["session-1"]?.find((m) => m.id === "msg-2");
      expect(message?.parts).toHaveLength(2);
      expect(message?.parts?.every((p) => p !== undefined)).toBe(true);
    });

    it("should filter out non-object parts", () => {
      const messageWithInvalidParts: Message = {
        id: "msg-3",
        sessionId: "session-1",
        role: "assistant",
        content: "Test",
        parts: [{ type: "text" }, "invalid", 123, { type: "tool" }] as unknown as Record<
          string,
          unknown
        >[],
        createdAt: new Date().toISOString(),
      };

      const stateWithMessage = chatReducer(initialState, addMessage(messageWithInvalidParts));

      const normalizedState = chatReducer(
        stateWithMessage,
        normalizeMessageParts({ sessionId: "session-1", messageId: "msg-3" })
      );

      const message = normalizedState.messages["session-1"]?.find((m) => m.id === "msg-3");
      expect(message?.parts).toHaveLength(2);
      expect(message?.parts?.every((p) => typeof p === "object")).toBe(true);
    });

    it("should handle message with no parts", () => {
      const messageNoParts: Message = {
        id: "msg-4",
        sessionId: "session-1",
        role: "user",
        content: "Test",
        createdAt: new Date().toISOString(),
      };

      const stateWithMessage = chatReducer(initialState, addMessage(messageNoParts));

      const normalizedState = chatReducer(
        stateWithMessage,
        normalizeMessageParts({ sessionId: "session-1", messageId: "msg-4" })
      );

      const message = normalizedState.messages["session-1"]?.find((m) => m.id === "msg-4");
      expect(message?.parts).toBeUndefined();
    });

    it("should handle message with empty parts array", () => {
      const messageEmptyParts: Message = {
        id: "msg-5",
        sessionId: "session-1",
        role: "assistant",
        content: "Test",
        parts: [],
        createdAt: new Date().toISOString(),
      };

      const stateWithMessage = chatReducer(initialState, addMessage(messageEmptyParts));

      const normalizedState = chatReducer(
        stateWithMessage,
        normalizeMessageParts({ sessionId: "session-1", messageId: "msg-5" })
      );

      const message = normalizedState.messages["session-1"]?.find((m) => m.id === "msg-5");
      expect(message?.parts).toEqual([]);
    });

    it("should not affect messages that don't exist", () => {
      const state = chatReducer(
        initialState,
        normalizeMessageParts({ sessionId: "session-1", messageId: "nonexistent" })
      );
      expect(state.messages["session-1"]).toBeUndefined();
    });
  });
});
