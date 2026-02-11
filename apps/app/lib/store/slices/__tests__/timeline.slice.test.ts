import { describe, it, expect } from "vitest";
import timelineReducer, {
  setSegmentPage,
  setSegmentPageSize,
  setSegmentPagination,
  nextSegmentPage,
  prevSegmentPage,
  type TimelineState,
} from "../timeline.slice";

describe("timeline.slice - P6.3 segment pagination", () => {
  const initialState: TimelineState = {
    percentage: 100,
    isPlaying: false,
    playbackSpeed: 1,
    segments: [],
    segmentEventsMap: {},
    segmentEventsLoadingMap: {},
    segmentPagination: {
      page: 1,
      pageSize: 20,
      total: 0,
      hasMore: false,
    },
    sessionId: null,
    selectedEventId: null,
    isLoading: false,
    error: null,
  };

  describe("setSegmentPage", () => {
    it("should set the segment page", () => {
      const state = timelineReducer(initialState, setSegmentPage(3));
      expect(state.segmentPagination.page).toBe(3);
    });
  });

  describe("setSegmentPageSize", () => {
    it("should set the segment page size", () => {
      const state = timelineReducer(initialState, setSegmentPageSize(50));
      expect(state.segmentPagination.pageSize).toBe(50);
    });
  });

  describe("setSegmentPagination", () => {
    it("should update multiple pagination fields at once", () => {
      const state = timelineReducer(
        initialState,
        setSegmentPagination({
          page: 2,
          pageSize: 30,
          total: 100,
          hasMore: true,
        })
      );
      expect(state.segmentPagination.page).toBe(2);
      expect(state.segmentPagination.pageSize).toBe(30);
      expect(state.segmentPagination.total).toBe(100);
      expect(state.segmentPagination.hasMore).toBe(true);
    });

    it("should update only specified fields", () => {
      const state = timelineReducer(initialState, setSegmentPagination({ page: 5 }));
      expect(state.segmentPagination.page).toBe(5);
      expect(state.segmentPagination.pageSize).toBe(20); // unchanged
    });
  });

  describe("nextSegmentPage", () => {
    it("should increment page when hasMore is true", () => {
      const stateWithMore: TimelineState = {
        ...initialState,
        segmentPagination: { ...initialState.segmentPagination, page: 1, hasMore: true },
      };
      const state = timelineReducer(stateWithMore, nextSegmentPage());
      expect(state.segmentPagination.page).toBe(2);
    });

    it("should not increment page when hasMore is false", () => {
      const stateWithoutMore: TimelineState = {
        ...initialState,
        segmentPagination: { ...initialState.segmentPagination, page: 1, hasMore: false },
      };
      const state = timelineReducer(stateWithoutMore, nextSegmentPage());
      expect(state.segmentPagination.page).toBe(1);
    });
  });

  describe("prevSegmentPage", () => {
    it("should decrement page when page > 1", () => {
      const stateWithPage3: TimelineState = {
        ...initialState,
        segmentPagination: { ...initialState.segmentPagination, page: 3 },
      };
      const state = timelineReducer(stateWithPage3, prevSegmentPage());
      expect(state.segmentPagination.page).toBe(2);
    });

    it("should not decrement page when page is 1", () => {
      const state = timelineReducer(initialState, prevSegmentPage());
      expect(state.segmentPagination.page).toBe(1);
    });
  });
});
