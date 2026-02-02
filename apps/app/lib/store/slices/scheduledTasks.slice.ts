import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type ScheduleFrequency =
  | "once"
  | "hourly"
  | "daily"
  | "weekly"
  | "monthly"
  | "custom";

export type ScheduledTaskStatus =
  | "active"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled";

export type ExecutionStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "skipped";

export interface ScheduleConfig {
  frequency: ScheduleFrequency;
  // For custom schedules
  cronExpression?: string;
  // For specific time scheduling
  scheduledAt?: string;
  // For recurring schedules
  hour?: number;
  minute?: number;
  dayOfWeek?: number[]; // 0-6, Sunday = 0
  dayOfMonth?: number[];
  // Timezone
  timezone: string;
  // Repeat settings
  repeatCount?: number; // null = infinite
  endDate?: string;
}

export interface ScheduledTaskExecution {
  id: string;
  scheduledTaskId: string;
  status: ExecutionStatus;
  scheduledAt: string;
  startedAt?: string;
  completedAt?: string;
  // Result
  sessionId?: string; // Created session for this execution
  result?: {
    success: boolean;
    output?: string;
    error?: string;
  };
  // Metadata
  retryCount: number;
  metadata?: Record<string, unknown>;
}

export interface ScheduledTask {
  id: string;
  userId: string;
  // Task definition
  title: string;
  description?: string;
  prompt: string; // The AI prompt to execute
  // Schedule configuration
  schedule: ScheduleConfig;
  // Status
  status: ScheduledTaskStatus;
  // Execution tracking
  lastExecutionId?: string;
  lastExecutedAt?: string;
  nextExecutionAt?: string;
  executionCount: number;
  successCount: number;
  failureCount: number;
  // Configuration
  connectorIds?: string[]; // Connectors to use
  agentType?: string; // Specific agent type to use
  maxExecutionTime?: number; // In seconds
  retryOnFailure: boolean;
  maxRetries: number;
  notifyOnComplete: boolean;
  notifyOnFailure: boolean;
  // Metadata
  tags?: string[];
  metadata?: Record<string, unknown>;
  // Timestamps
  createdAt: string;
  updatedAt: string;
}

export interface ScheduledTasksState {
  // All scheduled tasks
  tasks: ScheduledTask[];
  // Executions by task ID
  executions: Record<string, ScheduledTaskExecution[]>;
  // Current chat's scheduled task IDs (for filtering)
  chatScheduledTaskIds: string[];
  // Selected task for details view
  selectedTaskId: string | null;
  // Creation/edit flow
  editingTask: Partial<ScheduledTask> | null;
  isCreating: boolean;
  // Loading states
  isLoading: boolean;
  isLoadingExecutions: boolean;
  // Error state
  error: string | null;
}

const initialState: ScheduledTasksState = {
  tasks: [],
  executions: {},
  chatScheduledTaskIds: [],
  selectedTaskId: null,
  editingTask: null,
  isCreating: false,
  isLoading: false,
  isLoadingExecutions: false,
  error: null,
};

export const scheduledTasksSlice = createSlice({
  name: "scheduledTasks",
  initialState,
  reducers: {
    // Set all scheduled tasks
    setScheduledTasks: (state, action: PayloadAction<ScheduledTask[]>) => {
      state.tasks = action.payload;
      state.isLoading = false;
    },

    // Add a new scheduled task
    addScheduledTask: (state, action: PayloadAction<ScheduledTask>) => {
      state.tasks.unshift(action.payload);
      state.isCreating = false;
      state.editingTask = null;
    },

    // Update a scheduled task
    updateScheduledTask: (
      state,
      action: PayloadAction<{ id: string; updates: Partial<ScheduledTask> }>
    ) => {
      const index = state.tasks.findIndex((t) => t.id === action.payload.id);
      if (index !== -1) {
        state.tasks[index] = {
          ...state.tasks[index],
          ...action.payload.updates,
          updatedAt: new Date().toISOString(),
        };
      }
    },

    // Delete a scheduled task
    deleteScheduledTask: (state, action: PayloadAction<string>) => {
      state.tasks = state.tasks.filter((t) => t.id !== action.payload);
      delete state.executions[action.payload];
      if (state.selectedTaskId === action.payload) {
        state.selectedTaskId = null;
      }
    },

    // Toggle task status (pause/resume)
    toggleTaskStatus: (state, action: PayloadAction<string>) => {
      const task = state.tasks.find((t) => t.id === action.payload);
      if (task) {
        task.status = task.status === "active" ? "paused" : "active";
        task.updatedAt = new Date().toISOString();
      }
    },

    // Set executions for a task
    setTaskExecutions: (
      state,
      action: PayloadAction<{
        taskId: string;
        executions: ScheduledTaskExecution[];
      }>
    ) => {
      state.executions[action.payload.taskId] = action.payload.executions;
      state.isLoadingExecutions = false;
    },

    // Add a new execution
    addExecution: (state, action: PayloadAction<ScheduledTaskExecution>) => {
      const { scheduledTaskId } = action.payload;
      if (!state.executions[scheduledTaskId]) {
        state.executions[scheduledTaskId] = [];
      }
      state.executions[scheduledTaskId].unshift(action.payload);

      // Update task execution count
      const task = state.tasks.find((t) => t.id === scheduledTaskId);
      if (task) {
        task.executionCount += 1;
        task.lastExecutionId = action.payload.id;
        if (action.payload.startedAt) {
          task.lastExecutedAt = action.payload.startedAt;
        }
      }
    },

    // Update execution status
    updateExecution: (
      state,
      action: PayloadAction<{
        taskId: string;
        executionId: string;
        updates: Partial<ScheduledTaskExecution>;
      }>
    ) => {
      const executions = state.executions[action.payload.taskId];
      if (executions) {
        const index = executions.findIndex(
          (e) => e.id === action.payload.executionId
        );
        if (index !== -1) {
          executions[index] = { ...executions[index], ...action.payload.updates };

          // Update task success/failure counts
          const task = state.tasks.find((t) => t.id === action.payload.taskId);
          if (task && action.payload.updates.status === "completed") {
            task.successCount += 1;
          } else if (task && action.payload.updates.status === "failed") {
            task.failureCount += 1;
          }
        }
      }
    },

    // Set chat's scheduled task IDs
    setChatScheduledTaskIds: (state, action: PayloadAction<string[]>) => {
      state.chatScheduledTaskIds = action.payload;
    },

    // Selection
    setSelectedTask: (state, action: PayloadAction<string | null>) => {
      state.selectedTaskId = action.payload;
    },

    // Editing flow
    startCreating: (state) => {
      state.isCreating = true;
      state.editingTask = {
        schedule: {
          frequency: "daily",
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        retryOnFailure: true,
        maxRetries: 3,
        notifyOnComplete: true,
        notifyOnFailure: true,
      };
    },

    startEditing: (state, action: PayloadAction<string>) => {
      const task = state.tasks.find((t) => t.id === action.payload);
      if (task) {
        state.editingTask = { ...task };
      }
    },

    updateEditingTask: (
      state,
      action: PayloadAction<Partial<ScheduledTask>>
    ) => {
      if (state.editingTask) {
        state.editingTask = { ...state.editingTask, ...action.payload };
      }
    },

    cancelEditing: (state) => {
      state.editingTask = null;
      state.isCreating = false;
    },

    // Loading states
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },

    setLoadingExecutions: (state, action: PayloadAction<boolean>) => {
      state.isLoadingExecutions = action.payload;
    },

    // Error handling
    setScheduledTasksError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
      state.isLoading = false;
      state.isLoadingExecutions = false;
      state.isCreating = false;
    },
  },
});

export const {
  setScheduledTasks,
  addScheduledTask,
  updateScheduledTask,
  deleteScheduledTask,
  toggleTaskStatus,
  setTaskExecutions,
  addExecution,
  updateExecution,
  setChatScheduledTaskIds,
  setSelectedTask,
  startCreating,
  startEditing,
  updateEditingTask,
  cancelEditing,
  setLoading,
  setLoadingExecutions,
  setScheduledTasksError,
} = scheduledTasksSlice.actions;

export default scheduledTasksSlice.reducer;
