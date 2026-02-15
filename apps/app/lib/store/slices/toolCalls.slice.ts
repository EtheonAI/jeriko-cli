import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

/**
 * Tool Calls Slice (P6.6)
 * Manages tool call executions keyed by correlationId for tracking and debugging
 */

export type ToolCallStatus = "pending" | "running" | "success" | "error" | "cancelled";

export interface ToolCallInput {
  [key: string]: unknown;
}

export interface ToolCallOutput {
  [key: string]: unknown;
}

export interface ToolCall {
  id: string;
  correlationId: string; // Primary key for efficient lookups
  toolName: string;
  sessionId: string;
  messageId?: string;
  status: ToolCallStatus;
  input: ToolCallInput;
  output?: ToolCallOutput;
  error?: string;
  startedAt: string;
  completedAt?: string;
  duration?: number; // milliseconds
  metadata?: {
    agentId?: string;
    userId?: string;
    retryCount?: number;
    [key: string]: unknown;
  };
}

export interface ToolCallsState {
  // Keyed by correlationId for O(1) lookups
  byCorrelationId: Record<string, ToolCall>;
  // Secondary index by sessionId for filtering
  bySessionId: Record<string, string[]>; // sessionId -> correlationId[]
  // Active tool calls (for UI indicators)
  activeCorrelationIds: string[];
  // Recent calls (for debugging)
  recentCorrelationIds: string[]; // Last 100
  maxRecentCalls: number;
  // Stats
  stats: {
    totalCalls: number;
    successCount: number;
    errorCount: number;
    cancelledCount: number;
  };
  // Loading state
  isLoading: boolean;
  error: string | null;
}

const initialState: ToolCallsState = {
  byCorrelationId: {},
  bySessionId: {},
  activeCorrelationIds: [],
  recentCorrelationIds: [],
  maxRecentCalls: 100,
  stats: {
    totalCalls: 0,
    successCount: 0,
    errorCount: 0,
    cancelledCount: 0,
  },
  isLoading: false,
  error: null,
};

const toolCallsSlice = createSlice({
  name: "toolCalls",
  initialState,
  reducers: {
    // Add or update a tool call by correlationId
    setToolCall: (state, action: PayloadAction<ToolCall>) => {
      const { correlationId, sessionId, status } = action.payload;
      const existingCall = state.byCorrelationId[correlationId];

      // Store by correlationId
      state.byCorrelationId[correlationId] = action.payload;

      // Update session index
      if (!state.bySessionId[sessionId]) {
        state.bySessionId[sessionId] = [];
      }
      if (!state.bySessionId[sessionId].includes(correlationId)) {
        state.bySessionId[sessionId].push(correlationId);
      }

      // Track active calls
      if (status === "pending" || status === "running") {
        if (!state.activeCorrelationIds.includes(correlationId)) {
          state.activeCorrelationIds.push(correlationId);
        }
      } else {
        state.activeCorrelationIds = state.activeCorrelationIds.filter(
          (id) => id !== correlationId
        );
      }

      // Track recent calls
      if (!state.recentCorrelationIds.includes(correlationId)) {
        state.recentCorrelationIds.unshift(correlationId);
        if (state.recentCorrelationIds.length > state.maxRecentCalls) {
          state.recentCorrelationIds = state.recentCorrelationIds.slice(0, state.maxRecentCalls);
        }
      }

      // Update stats (only increment on new calls)
      if (!existingCall) {
        state.stats.totalCalls += 1;
      }

      // Update completion stats
      if (existingCall?.status !== status) {
        if (status === "success") state.stats.successCount += 1;
        if (status === "error") state.stats.errorCount += 1;
        if (status === "cancelled") state.stats.cancelledCount += 1;
      }
    },

    // Start a tool call
    startToolCall: (
      state,
      action: PayloadAction<{
        correlationId: string;
        toolName: string;
        sessionId: string;
        messageId?: string;
        input: ToolCallInput;
        metadata?: ToolCall["metadata"];
      }>
    ) => {
      const { correlationId, toolName, sessionId, messageId, input, metadata } = action.payload;

      const toolCall: ToolCall = {
        id: correlationId,
        correlationId,
        toolName,
        sessionId,
        messageId,
        status: "running",
        input,
        startedAt: new Date().toISOString(),
        metadata,
      };

      state.byCorrelationId[correlationId] = toolCall;

      if (!state.bySessionId[sessionId]) {
        state.bySessionId[sessionId] = [];
      }
      if (!state.bySessionId[sessionId].includes(correlationId)) {
        state.bySessionId[sessionId].push(correlationId);
      }

      if (!state.activeCorrelationIds.includes(correlationId)) {
        state.activeCorrelationIds.push(correlationId);
      }

      state.recentCorrelationIds.unshift(correlationId);
      if (state.recentCorrelationIds.length > state.maxRecentCalls) {
        state.recentCorrelationIds = state.recentCorrelationIds.slice(0, state.maxRecentCalls);
      }

      state.stats.totalCalls += 1;
    },

    // Complete a tool call successfully
    completeToolCall: (
      state,
      action: PayloadAction<{
        correlationId: string;
        output: ToolCallOutput;
      }>
    ) => {
      const { correlationId, output } = action.payload;
      const toolCall = state.byCorrelationId[correlationId];

      if (toolCall) {
        const completedAt = new Date().toISOString();
        const duration = new Date(completedAt).getTime() - new Date(toolCall.startedAt).getTime();

        toolCall.status = "success";
        toolCall.output = output;
        toolCall.completedAt = completedAt;
        toolCall.duration = duration;

        state.activeCorrelationIds = state.activeCorrelationIds.filter(
          (id) => id !== correlationId
        );
        state.stats.successCount += 1;
      }
    },

    // Fail a tool call
    failToolCall: (
      state,
      action: PayloadAction<{
        correlationId: string;
        error: string;
      }>
    ) => {
      const { correlationId, error } = action.payload;
      const toolCall = state.byCorrelationId[correlationId];

      if (toolCall) {
        const completedAt = new Date().toISOString();
        const duration = new Date(completedAt).getTime() - new Date(toolCall.startedAt).getTime();

        toolCall.status = "error";
        toolCall.error = error;
        toolCall.completedAt = completedAt;
        toolCall.duration = duration;

        state.activeCorrelationIds = state.activeCorrelationIds.filter(
          (id) => id !== correlationId
        );
        state.stats.errorCount += 1;
      }
    },

    // Cancel a tool call
    cancelToolCall: (state, action: PayloadAction<string>) => {
      const correlationId = action.payload;
      const toolCall = state.byCorrelationId[correlationId];

      if (toolCall) {
        const completedAt = new Date().toISOString();
        const duration = new Date(completedAt).getTime() - new Date(toolCall.startedAt).getTime();

        toolCall.status = "cancelled";
        toolCall.completedAt = completedAt;
        toolCall.duration = duration;

        state.activeCorrelationIds = state.activeCorrelationIds.filter(
          (id) => id !== correlationId
        );
        state.stats.cancelledCount += 1;
      }
    },

    // Update tool call metadata
    updateToolCallMetadata: (
      state,
      action: PayloadAction<{
        correlationId: string;
        metadata: Partial<ToolCall["metadata"]>;
      }>
    ) => {
      const { correlationId, metadata } = action.payload;
      const toolCall = state.byCorrelationId[correlationId];

      if (toolCall) {
        toolCall.metadata = { ...toolCall.metadata, ...metadata };
      }
    },

    // Remove tool call by correlationId
    removeToolCall: (state, action: PayloadAction<string>) => {
      const correlationId = action.payload;
      const toolCall = state.byCorrelationId[correlationId];

      if (toolCall) {
        // Remove from session index
        const sessionCalls = state.bySessionId[toolCall.sessionId];
        if (sessionCalls) {
          const filtered = sessionCalls.filter((id) => id !== correlationId);
          if (filtered.length === 0) {
            delete state.bySessionId[toolCall.sessionId];
          } else {
            state.bySessionId[toolCall.sessionId] = filtered;
          }
        }

        // Remove from active calls
        state.activeCorrelationIds = state.activeCorrelationIds.filter(
          (id) => id !== correlationId
        );

        // Remove from recent calls
        state.recentCorrelationIds = state.recentCorrelationIds.filter(
          (id) => id !== correlationId
        );

        // Remove from main index
        delete state.byCorrelationId[correlationId];
      }
    },

    // Clear all tool calls for a session
    clearSessionToolCalls: (state, action: PayloadAction<string>) => {
      const sessionId = action.payload;
      const correlationIds = state.bySessionId[sessionId] || [];

      correlationIds.forEach((correlationId) => {
        delete state.byCorrelationId[correlationId];
        state.activeCorrelationIds = state.activeCorrelationIds.filter(
          (id) => id !== correlationId
        );
        state.recentCorrelationIds = state.recentCorrelationIds.filter(
          (id) => id !== correlationId
        );
      });

      delete state.bySessionId[sessionId];
    },

    // Clear all tool calls
    clearAllToolCalls: (state) => {
      state.byCorrelationId = {};
      state.bySessionId = {};
      state.activeCorrelationIds = [];
      state.recentCorrelationIds = [];
    },

    // Set max recent calls limit
    setMaxRecentCalls: (state, action: PayloadAction<number>) => {
      state.maxRecentCalls = action.payload;
      if (state.recentCorrelationIds.length > action.payload) {
        state.recentCorrelationIds = state.recentCorrelationIds.slice(0, action.payload);
      }
    },

    // Reset stats
    resetToolCallStats: (state) => {
      state.stats = {
        totalCalls: 0,
        successCount: 0,
        errorCount: 0,
        cancelledCount: 0,
      };
    },

    // Loading and error
    setToolCallsLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },

    setToolCallsError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
  },
});

export const {
  setToolCall,
  startToolCall,
  completeToolCall,
  failToolCall,
  cancelToolCall,
  updateToolCallMetadata,
  removeToolCall,
  clearSessionToolCalls,
  clearAllToolCalls,
  setMaxRecentCalls,
  resetToolCallStats,
  setToolCallsLoading,
  setToolCallsError,
} = toolCallsSlice.actions;

export default toolCallsSlice.reducer;
