import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

/**
 * Navbar Slice
 * Manages the navigation bar state
 */

export type NavbarTab =
  | "newTask"
  | "sessions"
  | "projects"
  | "library"
  | "settings"
  | "help";

export interface NavbarState {
  tabKey: NavbarTab;
  isNavbarHovering: boolean;
  isNavBarMinimal: boolean;
  isNavBarHoveringLocked: boolean;
  // Tasks folded in sidebar
  navTasksFolded: boolean;
}

const initialState: NavbarState = {
  tabKey: "newTask",
  isNavbarHovering: false,
  isNavBarMinimal: false,
  isNavBarHoveringLocked: false,
  navTasksFolded: true,
};

export const navbarSlice = createSlice({
  name: "navbar",
  initialState,
  reducers: {
    setTabKey: (state, action: PayloadAction<NavbarTab>) => {
      state.tabKey = action.payload;
    },

    setNavbarHovering: (state, action: PayloadAction<boolean>) => {
      state.isNavbarHovering = action.payload;
    },

    setNavBarMinimal: (state, action: PayloadAction<boolean>) => {
      state.isNavBarMinimal = action.payload;
    },

    toggleNavBarMinimal: (state) => {
      state.isNavBarMinimal = !state.isNavBarMinimal;
    },

    setNavBarHoveringLocked: (state, action: PayloadAction<boolean>) => {
      state.isNavBarHoveringLocked = action.payload;
    },

    toggleNavBarHoveringLocked: (state) => {
      state.isNavBarHoveringLocked = !state.isNavBarHoveringLocked;
    },

    setNavTasksFolded: (state, action: PayloadAction<boolean>) => {
      state.navTasksFolded = action.payload;
    },

    toggleNavTasksFolded: (state) => {
      state.navTasksFolded = !state.navTasksFolded;
    },

    resetNavbar: (state) => {
      Object.assign(state, initialState);
    },
  },
});

export const {
  setTabKey,
  setNavbarHovering,
  setNavBarMinimal,
  toggleNavBarMinimal,
  setNavBarHoveringLocked,
  toggleNavBarHoveringLocked,
  setNavTasksFolded,
  toggleNavTasksFolded,
  resetNavbar,
} = navbarSlice.actions;

export default navbarSlice.reducer;
