import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

/**
 * Timeline Slice
 * Manages timeline/history view for sessions and events
 */

export interface TimelineEvent {
  id: string;
  type: "message" | "action" | "file" | "agent" | "system";
  title: string;
  description?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
  isHighlighted?: boolean;
}

export interface TimelineSegment {
  id: string;
  startTime: string;
  endTime: string;
  events: TimelineEvent[];
  label?: string;
}

export interface TimelineState {
  // Segment events map (segmentId -> events)
  segmentEventsMap: Record<string, TimelineEvent[]>;

  // Loading state per segment
  segmentEventsLoadingMap: Record<string, boolean>;

  // Playback
  percentage: number;
  isPlaying: boolean;
  playbackSpeed: number;
  currentEventId: string | null;

  // View
  zoomLevel: number;
  scrollPosition: number;
  selectedSegmentId: string | null;

  // Filters
  filterTypes: string[];
  searchQuery: string;

  // Time range
  startTime: string | null;
  endTime: string | null;

  // UI State
  isExpanded: boolean;
  showMinimap: boolean;

  // Error
  error: string | null;
}

const initialState: TimelineState = {
  segmentEventsMap: {},
  segmentEventsLoadingMap: {},
  percentage: 100,
  isPlaying: false,
  playbackSpeed: 1,
  currentEventId: null,
  zoomLevel: 1,
  scrollPosition: 0,
  selectedSegmentId: null,
  filterTypes: [],
  searchQuery: "",
  startTime: null,
  endTime: null,
  isExpanded: false,
  showMinimap: true,
  error: null,
};

export const timelineSlice = createSlice({
  name: "timeline",
  initialState,
  reducers: {
    // Segment events
    setSegmentEvents: (
      state,
      action: PayloadAction<{ segmentId: string; events: TimelineEvent[] }>
    ) => {
      state.segmentEventsMap[action.payload.segmentId] = action.payload.events;
      state.segmentEventsLoadingMap[action.payload.segmentId] = false;
    },

    addEventToSegment: (
      state,
      action: PayloadAction<{ segmentId: string; event: TimelineEvent }>
    ) => {
      if (!state.segmentEventsMap[action.payload.segmentId]) {
        state.segmentEventsMap[action.payload.segmentId] = [];
      }
      state.segmentEventsMap[action.payload.segmentId].push(action.payload.event);
    },

    removeEventFromSegment: (
      state,
      action: PayloadAction<{ segmentId: string; eventId: string }>
    ) => {
      if (state.segmentEventsMap[action.payload.segmentId]) {
        state.segmentEventsMap[action.payload.segmentId] = state.segmentEventsMap[
          action.payload.segmentId
        ].filter((e) => e.id !== action.payload.eventId);
      }
    },

    clearSegmentEvents: (state, action: PayloadAction<string>) => {
      delete state.segmentEventsMap[action.payload];
      delete state.segmentEventsLoadingMap[action.payload];
    },

    // Loading
    setSegmentLoading: (
      state,
      action: PayloadAction<{ segmentId: string; loading: boolean }>
    ) => {
      state.segmentEventsLoadingMap[action.payload.segmentId] = action.payload.loading;
    },

    // Playback
    setPercentage: (state, action: PayloadAction<number>) => {
      state.percentage = Math.min(100, Math.max(0, action.payload));
    },

    setIsPlaying: (state, action: PayloadAction<boolean>) => {
      state.isPlaying = action.payload;
    },

    play: (state) => {
      state.isPlaying = true;
    },

    pause: (state) => {
      state.isPlaying = false;
    },

    togglePlay: (state) => {
      state.isPlaying = !state.isPlaying;
    },

    setPlaybackSpeed: (state, action: PayloadAction<number>) => {
      state.playbackSpeed = action.payload;
    },

    setCurrentEventId: (state, action: PayloadAction<string | null>) => {
      state.currentEventId = action.payload;
    },

    // View
    setZoomLevel: (state, action: PayloadAction<number>) => {
      state.zoomLevel = Math.min(5, Math.max(0.5, action.payload));
    },

    zoomIn: (state) => {
      state.zoomLevel = Math.min(5, state.zoomLevel + 0.25);
    },

    zoomOut: (state) => {
      state.zoomLevel = Math.max(0.5, state.zoomLevel - 0.25);
    },

    resetZoom: (state) => {
      state.zoomLevel = 1;
    },

    setScrollPosition: (state, action: PayloadAction<number>) => {
      state.scrollPosition = action.payload;
    },

    setSelectedSegmentId: (state, action: PayloadAction<string | null>) => {
      state.selectedSegmentId = action.payload;
    },

    // Filters
    setFilterTypes: (state, action: PayloadAction<string[]>) => {
      state.filterTypes = action.payload;
    },

    toggleFilterType: (state, action: PayloadAction<string>) => {
      const index = state.filterTypes.indexOf(action.payload);
      if (index === -1) {
        state.filterTypes.push(action.payload);
      } else {
        state.filterTypes.splice(index, 1);
      }
    },

    clearFilterTypes: (state) => {
      state.filterTypes = [];
    },

    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload;
    },

    // Time range
    setTimeRange: (
      state,
      action: PayloadAction<{ startTime: string | null; endTime: string | null }>
    ) => {
      state.startTime = action.payload.startTime;
      state.endTime = action.payload.endTime;
    },

    clearTimeRange: (state) => {
      state.startTime = null;
      state.endTime = null;
    },

    // UI State
    setIsExpanded: (state, action: PayloadAction<boolean>) => {
      state.isExpanded = action.payload;
    },

    toggleExpanded: (state) => {
      state.isExpanded = !state.isExpanded;
    },

    setShowMinimap: (state, action: PayloadAction<boolean>) => {
      state.showMinimap = action.payload;
    },

    toggleMinimap: (state) => {
      state.showMinimap = !state.showMinimap;
    },

    // Highlight event
    highlightEvent: (
      state,
      action: PayloadAction<{ segmentId: string; eventId: string }>
    ) => {
      const events = state.segmentEventsMap[action.payload.segmentId];
      if (events) {
        const event = events.find((e) => e.id === action.payload.eventId);
        if (event) {
          event.isHighlighted = true;
        }
      }
    },

    unhighlightEvent: (
      state,
      action: PayloadAction<{ segmentId: string; eventId: string }>
    ) => {
      const events = state.segmentEventsMap[action.payload.segmentId];
      if (events) {
        const event = events.find((e) => e.id === action.payload.eventId);
        if (event) {
          event.isHighlighted = false;
        }
      }
    },

    clearHighlights: (state) => {
      Object.values(state.segmentEventsMap).forEach((events) => {
        events.forEach((event) => {
          event.isHighlighted = false;
        });
      });
    },

    // Error
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },

    // Reset
    resetTimeline: (state) => {
      Object.assign(state, initialState);
    },
  },
});

export const {
  setSegmentEvents,
  addEventToSegment,
  removeEventFromSegment,
  clearSegmentEvents,
  setSegmentLoading,
  setPercentage,
  setIsPlaying,
  play,
  pause,
  togglePlay,
  setPlaybackSpeed,
  setCurrentEventId,
  setZoomLevel,
  zoomIn,
  zoomOut,
  resetZoom,
  setScrollPosition,
  setSelectedSegmentId,
  setFilterTypes,
  toggleFilterType,
  clearFilterTypes,
  setSearchQuery,
  setTimeRange,
  clearTimeRange,
  setIsExpanded,
  toggleExpanded,
  setShowMinimap,
  toggleMinimap,
  highlightEvent,
  unhighlightEvent,
  clearHighlights,
  setError,
  resetTimeline,
} = timelineSlice.actions;

export default timelineSlice.reducer;
