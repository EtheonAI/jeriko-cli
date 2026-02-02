import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

/**
 * Map Reduce Slice
 * Manages map-reduce operations UI state
 */

export type MapReduceStatus =
  | "idle"
  | "mapping"
  | "reducing"
  | "completed"
  | "failed";

export interface MapReduceTask {
  id: string;
  name: string;
  status: MapReduceStatus;
  progress: number;
  totalItems: number;
  processedItems: number;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

export interface MapReduceState {
  // Loading state
  startLoading: boolean;

  // Fullscreen mode
  isFullscreen: boolean;

  // Current task
  currentTask: MapReduceTask | null;

  // Task history
  taskHistory: MapReduceTask[];

  // Progress tracking
  overallProgress: number;
  currentPhase: "idle" | "map" | "reduce" | "complete";

  // Results
  results: Array<{
    id: string;
    key: string;
    value: unknown;
  }>;

  // Configuration
  config: {
    batchSize: number;
    maxConcurrency: number;
    retryOnFailure: boolean;
    maxRetries: number;
  };

  // Error
  error: string | null;
}

const initialState: MapReduceState = {
  startLoading: false,
  isFullscreen: false,
  currentTask: null,
  taskHistory: [],
  overallProgress: 0,
  currentPhase: "idle",
  results: [],
  config: {
    batchSize: 100,
    maxConcurrency: 5,
    retryOnFailure: true,
    maxRetries: 3,
  },
  error: null,
};

export const mapReduceSlice = createSlice({
  name: "mapReduce",
  initialState,
  reducers: {
    // Loading
    setStartLoading: (state, action: PayloadAction<boolean>) => {
      state.startLoading = action.payload;
    },

    // Fullscreen
    setIsFullscreen: (state, action: PayloadAction<boolean>) => {
      state.isFullscreen = action.payload;
    },

    toggleFullscreen: (state) => {
      state.isFullscreen = !state.isFullscreen;
    },

    // Task management
    setCurrentTask: (state, action: PayloadAction<MapReduceTask | null>) => {
      state.currentTask = action.payload;
      if (action.payload) {
        state.startLoading = false;
      }
    },

    updateCurrentTask: (
      state,
      action: PayloadAction<Partial<MapReduceTask>>
    ) => {
      if (state.currentTask) {
        state.currentTask = { ...state.currentTask, ...action.payload };
      }
    },

    startTask: (
      state,
      action: PayloadAction<{ id: string; name: string; totalItems: number }>
    ) => {
      state.currentTask = {
        id: action.payload.id,
        name: action.payload.name,
        status: "mapping",
        progress: 0,
        totalItems: action.payload.totalItems,
        processedItems: 0,
        startedAt: new Date().toISOString(),
      };
      state.currentPhase = "map";
      state.overallProgress = 0;
      state.results = [];
      state.error = null;
    },

    updateProgress: (
      state,
      action: PayloadAction<{ processedItems: number; progress: number }>
    ) => {
      if (state.currentTask) {
        state.currentTask.processedItems = action.payload.processedItems;
        state.currentTask.progress = action.payload.progress;
        state.overallProgress = action.payload.progress;
      }
    },

    transitionToReduce: (state) => {
      if (state.currentTask) {
        state.currentTask.status = "reducing";
        state.currentPhase = "reduce";
      }
    },

    completeTask: (state) => {
      if (state.currentTask) {
        state.currentTask.status = "completed";
        state.currentTask.progress = 100;
        state.currentTask.completedAt = new Date().toISOString();
        state.taskHistory.unshift(state.currentTask);
        state.currentPhase = "complete";
        state.overallProgress = 100;
      }
    },

    failTask: (state, action: PayloadAction<string>) => {
      if (state.currentTask) {
        state.currentTask.status = "failed";
        state.currentTask.error = action.payload;
        state.currentTask.completedAt = new Date().toISOString();
        state.taskHistory.unshift(state.currentTask);
        state.currentPhase = "idle";
        state.error = action.payload;
      }
    },

    cancelTask: (state) => {
      if (state.currentTask) {
        state.currentTask.status = "failed";
        state.currentTask.error = "Cancelled by user";
        state.currentTask.completedAt = new Date().toISOString();
        state.taskHistory.unshift(state.currentTask);
      }
      state.currentTask = null;
      state.currentPhase = "idle";
      state.overallProgress = 0;
    },

    // Results
    addResult: (
      state,
      action: PayloadAction<{ id: string; key: string; value: unknown }>
    ) => {
      state.results.push(action.payload);
    },

    setResults: (
      state,
      action: PayloadAction<MapReduceState["results"]>
    ) => {
      state.results = action.payload;
    },

    clearResults: (state) => {
      state.results = [];
    },

    // Configuration
    setConfig: (
      state,
      action: PayloadAction<Partial<MapReduceState["config"]>>
    ) => {
      state.config = { ...state.config, ...action.payload };
    },

    // Task history
    clearTaskHistory: (state) => {
      state.taskHistory = [];
    },

    removeFromHistory: (state, action: PayloadAction<string>) => {
      state.taskHistory = state.taskHistory.filter(
        (t) => t.id !== action.payload
      );
    },

    // Error
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },

    // Reset
    resetMapReduce: (state) => {
      Object.assign(state, initialState);
    },
  },
});

export const {
  setStartLoading,
  setIsFullscreen,
  toggleFullscreen,
  setCurrentTask,
  updateCurrentTask,
  startTask,
  updateProgress,
  transitionToReduce,
  completeTask,
  failTask,
  cancelTask,
  addResult,
  setResults,
  clearResults,
  setConfig,
  clearTaskHistory,
  removeFromHistory,
  setError,
  resetMapReduce,
} = mapReduceSlice.actions;

export default mapReduceSlice.reducer;
