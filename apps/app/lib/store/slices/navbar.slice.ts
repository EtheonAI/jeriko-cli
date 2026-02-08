import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

/**
 * Navbar Slice
 * Controls the left navigation sidebar:
 * - Active tab tracking
 * - Minimal/expanded mode
 * - Hover state with lock
 */

export type NavTabKey =
  | "task"
  | "newTask"
  | "chat"
  | "sessions"
  | "projects"
  | "files"
  | "devices"
  | "applications"
  | "scheduled"
  | "settings";

export interface NavbarState {
  // Active tab
  tabKey: NavTabKey;

  // Navigation mode
  isNavBarMinimal: boolean;

  // Hover state
  isNavbarHovering: boolean;
  isNavBarHoveringLocked: boolean;

  // Tasks section (collapsed/expanded)
  navTasksFolded: boolean;
}

const initialState: NavbarState = {
  tabKey: "task",
  isNavBarMinimal: false,
  isNavbarHovering: false,
  isNavBarHoveringLocked: false,
  navTasksFolded: false,
};

const navbarSlice = createSlice({
  name: "navbar",
  initialState,
  reducers: {
    // Active tab
    setTabKey: (state, action: PayloadAction<NavTabKey>) => {
      state.tabKey = action.payload;
    },

    // Navigation mode
    setIsNavBarMinimal: (state, action: PayloadAction<boolean>) => {
      state.isNavBarMinimal = action.payload;
    },

    toggleNavBarMinimal: (state) => {
      state.isNavBarMinimal = !state.isNavBarMinimal;
    },

    // Hover state
    setIsNavbarHovering: (state, action: PayloadAction<boolean>) => {
      state.isNavbarHovering = action.payload;
    },

    setIsNavBarHoveringLocked: (state, action: PayloadAction<boolean>) => {
      state.isNavBarHoveringLocked = action.payload;
    },

    toggleNavBarHoveringLocked: (state) => {
      state.isNavBarHoveringLocked = !state.isNavBarHoveringLocked;
    },

    // Tasks section
    setNavTasksFolded: (state, action: PayloadAction<boolean>) => {
      state.navTasksFolded = action.payload;
    },

    toggleNavTasksFolded: (state) => {
      state.navTasksFolded = !state.navTasksFolded;
    },
  },
});

export const {
  setTabKey,
  setIsNavBarMinimal,
  toggleNavBarMinimal,
  setIsNavbarHovering,
  setIsNavBarHoveringLocked,
  toggleNavBarHoveringLocked,
  setNavTasksFolded,
  toggleNavTasksFolded,
} = navbarSlice.actions;

export default navbarSlice.reducer;
