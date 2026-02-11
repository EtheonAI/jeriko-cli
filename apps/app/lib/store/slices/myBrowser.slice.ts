import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

/**
 * My Browser Slice
 * Manages browser extension settings and state
 */

export interface BrowserSettings {
  // Extension settings
  extensionEnabled: boolean;
  autoCapture: boolean;
  captureMode: "selection" | "page" | "viewport";
  captureFormat: "png" | "jpeg" | "webp";
  captureQuality: number;

  // Integration settings
  syncEnabled: boolean;
  syncInterval: number; // seconds
  autoSaveToLibrary: boolean;

  // Keyboard shortcuts
  shortcuts: {
    capture: string;
    togglePanel: string;
    sendToAgent: string;
  };

  // Privacy settings
  excludedDomains: string[];
  excludeIncognito: boolean;

  // UI preferences
  panelPosition: "right" | "left" | "bottom";
  panelWidth: number;
  darkMode: "auto" | "light" | "dark";
}

// P6.9: Frame metadata for browser extension iframe/window management
export interface BrowserFrameMetadata {
  frameId: string;
  tabId: string;
  url: string;
  title: string;
  frameType: "main_frame" | "sub_frame" | "popup" | "devtools";
  isActive: boolean;
  lastActiveAt: string;
  // Viewport information
  viewport?: {
    width: number;
    height: number;
    devicePixelRatio: number;
  };
  // Performance metrics
  performance?: {
    loadTime?: number; // milliseconds
    domContentLoadedTime?: number;
    firstContentfulPaint?: number;
  };
  // Custom metadata
  metadata?: Record<string, unknown>;
}

export interface MyBrowserState {
  // Browser settings
  browserSettings: BrowserSettings | null;

  // Installation state
  allowInstall: boolean;
  isInstalled: boolean;
  extensionVersion: string | null;

  // Connection state
  isConnected: boolean;
  lastConnectedAt: string | null;
  connectionError: string | null;

  // Capture state
  isCapturing: boolean;
  lastCaptureUrl: string | null;
  lastCaptureTimestamp: string | null;

  // Recent captures
  recentCaptures: Array<{
    id: string;
    url: string;
    title: string;
    thumbnailUrl: string;
    capturedAt: string;
  }>;

  // P6.9: Frame metadata tracking
  frames: Record<string, BrowserFrameMetadata>; // frameId -> metadata
  activeFrameId: string | null;
  frameCount: number;

  // Loading
  isLoading: boolean;
  isSaving: boolean;

  // Error
  error: string | null;
}

const initialState: MyBrowserState = {
  browserSettings: null,
  allowInstall: true,
  isInstalled: false,
  extensionVersion: null,
  isConnected: false,
  lastConnectedAt: null,
  connectionError: null,
  isCapturing: false,
  lastCaptureUrl: null,
  lastCaptureTimestamp: null,
  recentCaptures: [],
  frames: {},
  activeFrameId: null,
  frameCount: 0,
  isLoading: false,
  isSaving: false,
  error: null,
};

const defaultBrowserSettings: BrowserSettings = {
  extensionEnabled: true,
  autoCapture: false,
  captureMode: "viewport",
  captureFormat: "png",
  captureQuality: 90,
  syncEnabled: true,
  syncInterval: 300,
  autoSaveToLibrary: true,
  shortcuts: {
    capture: "Ctrl+Shift+S",
    togglePanel: "Ctrl+Shift+M",
    sendToAgent: "Ctrl+Shift+A",
  },
  excludedDomains: [],
  excludeIncognito: true,
  panelPosition: "right",
  panelWidth: 400,
  darkMode: "auto",
};

export const myBrowserSlice = createSlice({
  name: "myBrowser",
  initialState,
  reducers: {
    // Browser settings
    setBrowserSettings: (state, action: PayloadAction<BrowserSettings | null>) => {
      state.browserSettings = action.payload;
      state.isLoading = false;
    },

    updateBrowserSettings: (state, action: PayloadAction<Partial<BrowserSettings>>) => {
      if (state.browserSettings) {
        state.browserSettings = { ...state.browserSettings, ...action.payload };
      } else {
        state.browserSettings = { ...defaultBrowserSettings, ...action.payload };
      }
    },

    initializeBrowserSettings: (state) => {
      if (!state.browserSettings) {
        state.browserSettings = defaultBrowserSettings;
      }
    },

    // Installation
    setAllowInstall: (state, action: PayloadAction<boolean>) => {
      state.allowInstall = action.payload;
    },

    setIsInstalled: (state, action: PayloadAction<boolean>) => {
      state.isInstalled = action.payload;
    },

    setExtensionVersion: (state, action: PayloadAction<string | null>) => {
      state.extensionVersion = action.payload;
    },

    // Connection
    setIsConnected: (state, action: PayloadAction<boolean>) => {
      state.isConnected = action.payload;
      if (action.payload) {
        state.lastConnectedAt = new Date().toISOString();
        state.connectionError = null;
      }
    },

    setConnectionError: (state, action: PayloadAction<string | null>) => {
      state.connectionError = action.payload;
      if (action.payload) {
        state.isConnected = false;
      }
    },

    // Capture
    startCapturing: (state) => {
      state.isCapturing = true;
    },

    completeCapture: (
      state,
      action: PayloadAction<{ url: string; thumbnailUrl: string; title: string }>
    ) => {
      state.isCapturing = false;
      state.lastCaptureUrl = action.payload.url;
      state.lastCaptureTimestamp = new Date().toISOString();

      // Add to recent captures
      state.recentCaptures.unshift({
        id: `capture_${Date.now()}`,
        url: action.payload.url,
        title: action.payload.title,
        thumbnailUrl: action.payload.thumbnailUrl,
        capturedAt: new Date().toISOString(),
      });

      // Keep only last 20
      state.recentCaptures = state.recentCaptures.slice(0, 20);
    },

    failCapture: (state, action: PayloadAction<string>) => {
      state.isCapturing = false;
      state.error = action.payload;
    },

    // Recent captures
    clearRecentCaptures: (state) => {
      state.recentCaptures = [];
    },

    removeRecentCapture: (state, action: PayloadAction<string>) => {
      state.recentCaptures = state.recentCaptures.filter((c) => c.id !== action.payload);
    },

    // Shortcuts
    updateShortcut: (
      state,
      action: PayloadAction<{
        key: keyof BrowserSettings["shortcuts"];
        value: string;
      }>
    ) => {
      if (state.browserSettings) {
        state.browserSettings.shortcuts[action.payload.key] = action.payload.value;
      }
    },

    // Excluded domains
    addExcludedDomain: (state, action: PayloadAction<string>) => {
      if (
        state.browserSettings &&
        !state.browserSettings.excludedDomains.includes(action.payload)
      ) {
        state.browserSettings.excludedDomains.push(action.payload);
      }
    },

    removeExcludedDomain: (state, action: PayloadAction<string>) => {
      if (state.browserSettings) {
        state.browserSettings.excludedDomains = state.browserSettings.excludedDomains.filter(
          (d) => d !== action.payload
        );
      }
    },

    // Loading
    setIsLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },

    setIsSaving: (state, action: PayloadAction<boolean>) => {
      state.isSaving = action.payload;
    },

    // P6.9: Frame metadata management
    setFrameMetadata: (state, action: PayloadAction<BrowserFrameMetadata>) => {
      const { frameId } = action.payload;
      state.frames[frameId] = action.payload;
      state.frameCount = Object.keys(state.frames).length;

      // Update active frame if this frame is active
      if (action.payload.isActive) {
        state.activeFrameId = frameId;
        // Mark other frames as inactive
        Object.keys(state.frames).forEach((fid) => {
          if (fid !== frameId && state.frames[fid]) {
            state.frames[fid].isActive = false;
          }
        });
      }
    },

    updateFrameMetadata: (
      state,
      action: PayloadAction<{
        frameId: string;
        updates: Partial<BrowserFrameMetadata>;
      }>
    ) => {
      const { frameId, updates } = action.payload;
      const frame = state.frames[frameId];
      if (frame) {
        state.frames[frameId] = { ...frame, ...updates };

        // Update active frame if changed
        if (updates.isActive && !frame.isActive) {
          state.activeFrameId = frameId;
          // Mark other frames as inactive
          Object.keys(state.frames).forEach((fid) => {
            if (fid !== frameId && state.frames[fid]) {
              state.frames[fid].isActive = false;
            }
          });
        }
      }
    },

    removeFrame: (state, action: PayloadAction<string>) => {
      const frameId = action.payload;
      if (state.frames[frameId]) {
        delete state.frames[frameId];
        state.frameCount = Object.keys(state.frames).length;

        // Clear active frame if it was removed
        if (state.activeFrameId === frameId) {
          state.activeFrameId = null;
        }
      }
    },

    setActiveFrame: (state, action: PayloadAction<string>) => {
      const frameId = action.payload;
      if (state.frames[frameId]) {
        state.activeFrameId = frameId;
        // Update all frame active states
        Object.keys(state.frames).forEach((fid) => {
          if (state.frames[fid]) {
            state.frames[fid].isActive = fid === frameId;
            if (fid === frameId) {
              state.frames[fid].lastActiveAt = new Date().toISOString();
            }
          }
        });
      }
    },

    clearAllFrames: (state) => {
      state.frames = {};
      state.activeFrameId = null;
      state.frameCount = 0;
    },

    // Error
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
      state.isLoading = false;
      state.isSaving = false;
    },

    // Reset
    resetMyBrowser: (state) => {
      Object.assign(state, initialState);
    },
  },
});

export const {
  setBrowserSettings,
  updateBrowserSettings,
  initializeBrowserSettings,
  setAllowInstall,
  setIsInstalled,
  setExtensionVersion,
  setIsConnected,
  setConnectionError,
  startCapturing,
  completeCapture,
  failCapture,
  clearRecentCaptures,
  removeRecentCapture,
  updateShortcut,
  addExcludedDomain,
  removeExcludedDomain,
  // P6.9: Frame metadata actions
  setFrameMetadata,
  updateFrameMetadata,
  removeFrame,
  setActiveFrame,
  clearAllFrames,
  setIsLoading,
  setIsSaving,
  setError,
  resetMyBrowser,
} = myBrowserSlice.actions;

export default myBrowserSlice.reducer;
