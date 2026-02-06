import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type TaskScheduleType = "once" | "recurring" | "cron";
export type TaskStatus = "pending" | "running" | "completed" | "failed" | "cancelled" | "paused";
export type RecurrencePattern = "daily" | "weekly" | "biweekly" | "monthly" | "yearly" | "custom";

export interface ScheduledTaskExecution {
  id: string;
  scheduledTaskId: string;
  status: "pending" | "running" | "success" | "failed" | "cancelled";
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  output?: Record<string, unknown> | null;
  error?: string | null;
  errorStack?: string | null;
  retryNumber: number | null;
  sessionId?: string | null;
  createdAt: string;
}

export interface ScheduledTask {
  id: string;
  userId: string;
  organizationId?: string | null;
  name: string;
  description?: string | null;
  taskType: "agent_run" | "report" | "sync" | "backup" | "custom";
  scheduleType: TaskScheduleType;
  scheduledAt?: string | null;
  recurrencePattern?: RecurrencePattern | null;
  recurrenceInterval?: number | null;
  recurrenceDaysOfWeek?: number[] | null;
  recurrenceDayOfMonth?: number | null;
  recurrenceTime?: string | null;
  cronExpression?: string | null;
  timezone: string;
  status: TaskStatus;
  isEnabled: boolean;
  lastRunAt?: string | null;
  lastRunStatus?: "success" | "failed" | "partial" | null;
  lastRunError?: string | null;
  nextRunAt?: string | null;
  runCount: number;
  maxRetries?: number | null;
  retryDelaySeconds?: number | null;
  currentRetryCount?: number | null;
  payload?: Record<string, unknown> | null;
  endDate?: string | null;
  maxRuns?: number | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduledTasksState {
  tasks: ScheduledTask[];
  executions: Record<string, ScheduledTaskExecution[]>;
  chatScheduledTaskIds: string[];
  selectedTaskId: string | null;
  editingTask: Partial<ScheduledTask> | null;
  isCreating: boolean;
  isLoading: boolean;
  isLoadingExecutions: boolean;
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
    setScheduledTasks: (state, action: PayloadAction<ScheduledTask[]>) => {
      state.tasks = action.payload;
      state.isLoading = false;
      state.error = null;
    },

    addScheduledTask: (state, action: PayloadAction<ScheduledTask>) => {
      state.tasks.unshift(action.payload);
      state.isCreating = false;
      state.editingTask = null;
    },

    updateScheduledTask: (
      state,
      action: PayloadAction<{ id: string; updates: Partial<ScheduledTask> }>
    ) => {
      const index = state.tasks.findIndex((t) => t.id === action.payload.id);
      if (index !== -1) {
        const updates = action.payload.updates;
        state.tasks[index] = {
          ...state.tasks[index],
          ...updates,
          updatedAt: updates.updatedAt ?? new Date().toISOString(),
        };
      }
    },

    deleteScheduledTask: (state, action: PayloadAction<string>) => {
      state.tasks = state.tasks.filter((t) => t.id !== action.payload);
      delete state.executions[action.payload];
      if (state.selectedTaskId === action.payload) {
        state.selectedTaskId = null;
      }
    },

    toggleTaskStatus: (state, action: PayloadAction<string>) => {
      const task = state.tasks.find((t) => t.id === action.payload);
      if (task) {
        const nextStatus = task.status === "paused" ? "pending" : "paused";
        task.status = nextStatus;
        task.isEnabled = nextStatus !== "paused";
        task.updatedAt = new Date().toISOString();
      }
    },

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

    addExecution: (state, action: PayloadAction<ScheduledTaskExecution>) => {
      const { scheduledTaskId } = action.payload;
      if (!state.executions[scheduledTaskId]) {
        state.executions[scheduledTaskId] = [];
      }
      state.executions[scheduledTaskId].unshift(action.payload);

      const task = state.tasks.find((t) => t.id === scheduledTaskId);
      if (task) {
        task.runCount = (task.runCount ?? 0) + 1;
        if (action.payload.startedAt) {
          task.lastRunAt = action.payload.startedAt;
        }
        if (action.payload.status === "success") {
          task.lastRunStatus = "success";
        } else if (action.payload.status === "failed") {
          task.lastRunStatus = "failed";
        }
      }
    },

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
        const index = executions.findIndex((e) => e.id === action.payload.executionId);
        if (index !== -1) {
          executions[index] = { ...executions[index], ...action.payload.updates };

          const task = state.tasks.find((t) => t.id === action.payload.taskId);
          if (task && action.payload.updates.status === "success") {
            task.lastRunStatus = "success";
          } else if (task && action.payload.updates.status === "failed") {
            task.lastRunStatus = "failed";
          }
        }
      }
    },

    setChatScheduledTaskIds: (state, action: PayloadAction<string[]>) => {
      state.chatScheduledTaskIds = action.payload;
    },

    setSelectedTask: (state, action: PayloadAction<string | null>) => {
      state.selectedTaskId = action.payload;
    },

    startCreating: (state) => {
      state.isCreating = true;
      state.editingTask = {
        scheduleType: "recurring",
        recurrencePattern: "daily",
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        taskType: "agent_run",
        isEnabled: true,
        status: "pending",
      };
    },

    startEditing: (state, action: PayloadAction<string>) => {
      const task = state.tasks.find((t) => t.id === action.payload);
      if (task) {
        state.editingTask = { ...task };
      }
    },

    updateEditingTask: (state, action: PayloadAction<Partial<ScheduledTask>>) => {
      if (state.editingTask) {
        state.editingTask = { ...state.editingTask, ...action.payload };
      }
    },

    cancelEditing: (state) => {
      state.editingTask = null;
      state.isCreating = false;
    },

    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },

    setLoadingExecutions: (state, action: PayloadAction<boolean>) => {
      state.isLoadingExecutions = action.payload;
    },

    setScheduledTasksError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
      state.isLoading = false;
      state.isLoadingExecutions = false;
      state.isCreating = false;
    },
  },
  extraReducers: (builder) => {
    builder.addCase("scheduledTask/addSchedule", (state, action: PayloadAction<ScheduledTask>) => {
      state.tasks.unshift(action.payload);
      state.isCreating = false;
      state.editingTask = null;
    });
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
