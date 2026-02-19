import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

/**
 * Meeting Slice — Manus Parity
 * Manages meeting feature introduction flag.
 * Manus state: { shouldShowMeetingIntro: boolean }
 */

export interface MeetingState {
  shouldShowMeetingIntro: boolean;
}

const initialState: MeetingState = {
  shouldShowMeetingIntro: false,
};

export const meetingSlice = createSlice({
  name: "meeting",
  initialState,
  reducers: {
    setShouldShowMeetingIntro: (state, action: PayloadAction<boolean>) => {
      state.shouldShowMeetingIntro = action.payload;
    },
    resetMeeting: (state) => {
      Object.assign(state, initialState);
    },
  },
});

export const { setShouldShowMeetingIntro, resetMeeting } = meetingSlice.actions;

export default meetingSlice.reducer;
