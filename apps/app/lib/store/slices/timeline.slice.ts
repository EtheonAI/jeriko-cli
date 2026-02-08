import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

/**
 * Timeline Slice
 * Session timeline / replay of agent actions:
 * - Playback scrubber
 * - Segment-based event grouping
 * - Event types tracking
 */

export type TimelineEventType =
  | "message"
  | "tool_call"
  | "tool_result"
  | "file_create"
  | "file_edit"
  | "file_delete"
  | "browser_navigate"
  | "browser_click"
  | "browser_input"
  | "shell_exec"
  | "deploy"
  | "error"
  | "status_change";

export interface TimelineEvent {
  id: string;
  sessionId: string;
  segmentId: string;
  type: TimelineEventType;
  title: string;
  description?: string;
  data?: Record<string, unknown>;
  timestamp: string;
  durationMs?: number;
}

export interface TimelineSegment {
  id: string;
  sessionId: string;
  label: string;
  startTime: string;
  endTime?: string;
  eventCount: number;
}

export interface TimelineState {
  // Playback
  percentage: number;
  isPlaying: boolean;
  playbackSpeed: number;

  // Segments
  segments: TimelineSegment[];

  // Events by segment
  segmentEventsMap: Record<string, TimelineEvent[]>;
  segmentEventsLoadingMap: Record<string, boolean>;

  // Current session
  sessionId: string | null;

  // Selected event
  selectedEventId: string | null;

  // Loading
  isLoading: boolean;
  error: string | null;
}

const initialState: TimelineState = {
  percentage: 100,
  isPlaying: false,
  playbackSpeed: 1,

  segments: [],

  segmentEventsMap: {},
  segmentEventsLoadingMap: {},

  sessionId: null,
  selectedEventId: null,

  isLoading: false,
  error: null,
};

const timelineSlice = createSlice({
  name: "timeline",
  initialState,
  reducers: {
    // Playback
    setPercentage: (state, action: PayloadAction<number>) => {
      state.percentage = Math.max(0, Math.min(100, action.payload));
    },

    setIsPlaying: (state, action: PayloadAction<boolean>) => {
      state.isPlaying = action.payload;
    },

    togglePlayback: (state) => {
      state.isPlaying = !state.isPlaying;
    },

    setPlaybackSpeed: (state, action: PayloadAction<number>) => {
      state.playbackSpeed = action.payload;
    },

    // Segments
    setSegments: (state, action: PayloadAction<TimelineSegment[]>) => {
      state.segments = action.payload;
      state.isLoading = false;
    },

    addSegment: (state, action: PayloadAction<TimelineSegment>) => {
      state.segments.push(action.payload);
    },

    // Segment events
    setSegmentEvents: (
      state,
      action: PayloadAction<{ segmentId: string; events: TimelineEvent[] }>
    ) => {
      state.segmentEventsMap[action.payload.segmentId] = action.payload.events;
      state.segmentEventsLoadingMap[action.payload.segmentId] = false;
    },

    addSegmentEvent: (
      state,
      action: PayloadAction<{ segmentId: string; event: TimelineEvent }>
    ) => {
      const { segmentId, event } = action.payload;
      if (!state.segmentEventsMap[segmentId]) {
        state.segmentEventsMap[segmentId] = [];
      }
      state.segmentEventsMap[segmentId].push(event);
    },

    setSegmentEventsLoading: (
      state,
      action: PayloadAction<{ segmentId: string; loading: boolean }>
    ) => {
      state.segmentEventsLoadingMap[action.payload.segmentId] = action.payload.loading;
    },

    // Session
    setTimelineSessionId: (state, action: PayloadAction<string | null>) => {
      state.sessionId = action.payload;
    },

    // Selection
    setSelectedEventId: (state, action: PayloadAction<string | null>) => {
      state.selectedEventId = action.payload;
    },

    // Loading
    setTimelineLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },

    // Error
    setTimelineError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
      state.isLoading = false;
    },

    // Reset
    resetTimeline: (state) => {
      Object.assign(state, initialState);
    },
  },
});

export const {
  setPercentage,
  setIsPlaying,
  togglePlayback,
  setPlaybackSpeed,
  setSegments,
  addSegment,
  setSegmentEvents,
  addSegmentEvent,
  setSegmentEventsLoading,
  setTimelineSessionId,
  setSelectedEventId,
  setTimelineLoading,
  setTimelineError,
  resetTimeline,
} = timelineSlice.actions;

export default timelineSlice.reducer;
