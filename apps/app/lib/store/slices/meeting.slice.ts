import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

/**
 * Meeting Slice
 * Manages meeting-related state (Manus-aligned)
 */

export interface MeetingState {
  [key: string]: unknown;
}

const initialState: MeetingState = {};

const meetingSlice = createSlice({
  name: "meeting",
  initialState,
  reducers: {
    setMeetingData: (state, action: PayloadAction<Record<string, unknown>>) => {
      return { ...state, ...action.payload };
    },
    clearMeetingState: () => {
      return {};
    },
  },
});

export const { setMeetingData, clearMeetingState } = meetingSlice.actions;

export default meetingSlice.reducer;
