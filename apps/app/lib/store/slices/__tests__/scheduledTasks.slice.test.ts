import { describe, it, expect } from "vitest";
import scheduledTasksReducer, {
  setScheduledTasks,
  addScheduledTask,
  updateScheduledTask,
  deleteScheduledTask,
  toggleTaskStatus,
  setTaskExecutions,
  addExecution,
  setSelectedTask,
  startCreating,
  cancelEditing,
  setLoading,
  setScheduledTasksError,
  type ScheduledTasksState,
  type ScheduledTask,
  type ScheduledTaskExecution,
} from "../scheduledTasks.slice";

function makeTask(overrides: Partial<ScheduledTask> = {}): ScheduledTask {
  return {
    id: "task-1",
    userId: "user-1",
    name: "Test Task",
    taskType: "agent_run",
    scheduleType: "recurring",
    timezone: "UTC",
    status: "pending",
    isEnabled: true,
    runCount: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeTriggerTask(overrides: Partial<ScheduledTask> = {}): ScheduledTask {
  return makeTask({
    id: "trigger-1",
    name: "Gmail Trigger",
    scheduleType: "trigger",
    triggerEnabled: true,
    triggerAppName: "gmail",
    triggerEventSlug: "GMAIL_NEW_GMAIL_MESSAGE",
    triggerConfig: { label: "inbox" },
    composioTriggerId: "ti_abc123",
    lastTriggerAt: "2026-02-15T10:00:00.000Z",
    lastTriggerEventId: "evt_xyz",
    ...overrides,
  });
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

describe("scheduledTasks.slice", () => {
  it("should have correct initial state", () => {
    const state = scheduledTasksReducer(undefined, { type: "@@INIT" });
    expect(state).toEqual(initialState);
  });

  describe("setScheduledTasks", () => {
    it("should set tasks and clear loading/error", () => {
      const prev = { ...initialState, isLoading: true, error: "old error" };
      const tasks = [makeTask(), makeTriggerTask()];
      const state = scheduledTasksReducer(prev, setScheduledTasks(tasks));

      expect(state.tasks).toHaveLength(2);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe("addScheduledTask", () => {
    it("should prepend a new task", () => {
      const existing = makeTask({ id: "existing" });
      const prev = { ...initialState, tasks: [existing], isCreating: true };
      const newTask = makeTriggerTask();

      const state = scheduledTasksReducer(prev, addScheduledTask(newTask));

      expect(state.tasks).toHaveLength(2);
      expect(state.tasks[0]!.id).toBe("trigger-1");
      expect(state.isCreating).toBe(false);
    });

    it("should handle trigger task fields", () => {
      const task = makeTriggerTask();
      const state = scheduledTasksReducer(initialState, addScheduledTask(task));

      expect(state.tasks[0]!.scheduleType).toBe("trigger");
      expect(state.tasks[0]!.triggerEnabled).toBe(true);
      expect(state.tasks[0]!.triggerAppName).toBe("gmail");
      expect(state.tasks[0]!.triggerEventSlug).toBe("GMAIL_NEW_GMAIL_MESSAGE");
      expect(state.tasks[0]!.triggerConfig).toEqual({ label: "inbox" });
      expect(state.tasks[0]!.composioTriggerId).toBe("ti_abc123");
      expect(state.tasks[0]!.lastTriggerAt).toBe("2026-02-15T10:00:00.000Z");
    });
  });

  describe("updateScheduledTask", () => {
    it("should update trigger fields on existing task", () => {
      const task = makeTriggerTask();
      const prev = { ...initialState, tasks: [task] };

      const state = scheduledTasksReducer(
        prev,
        updateScheduledTask({
          id: "trigger-1",
          updates: {
            triggerConfig: { label: "important" },
            lastTriggerAt: "2026-02-16T12:00:00.000Z",
          },
        })
      );

      expect(state.tasks[0]!.triggerConfig).toEqual({ label: "important" });
      expect(state.tasks[0]!.lastTriggerAt).toBe("2026-02-16T12:00:00.000Z");
    });

    it("should not modify other tasks", () => {
      const task1 = makeTask({ id: "t1" });
      const task2 = makeTriggerTask({ id: "t2" });
      const prev = { ...initialState, tasks: [task1, task2] };

      const state = scheduledTasksReducer(
        prev,
        updateScheduledTask({ id: "t2", updates: { name: "Updated" } })
      );

      expect(state.tasks[0]!.name).toBe("Test Task");
      expect(state.tasks[1]!.name).toBe("Updated");
    });
  });

  describe("deleteScheduledTask", () => {
    it("should remove task and its executions", () => {
      const task = makeTriggerTask();
      const prev = {
        ...initialState,
        tasks: [task],
        executions: { "trigger-1": [] },
        selectedTaskId: "trigger-1",
      };

      const state = scheduledTasksReducer(prev, deleteScheduledTask("trigger-1"));

      expect(state.tasks).toHaveLength(0);
      expect(state.executions["trigger-1"]).toBeUndefined();
      expect(state.selectedTaskId).toBeNull();
    });
  });

  describe("toggleTaskStatus", () => {
    it("should pause an active task", () => {
      const task = makeTask({ status: "pending", isEnabled: true });
      const prev = { ...initialState, tasks: [task] };

      const state = scheduledTasksReducer(prev, toggleTaskStatus("task-1"));

      expect(state.tasks[0]!.status).toBe("paused");
      expect(state.tasks[0]!.isEnabled).toBe(false);
    });

    it("should resume a paused task", () => {
      const task = makeTask({ status: "paused", isEnabled: false });
      const prev = { ...initialState, tasks: [task] };

      const state = scheduledTasksReducer(prev, toggleTaskStatus("task-1"));

      expect(state.tasks[0]!.status).toBe("pending");
      expect(state.tasks[0]!.isEnabled).toBe(true);
    });
  });

  describe("setTaskExecutions", () => {
    it("should set executions for a task", () => {
      const executions: ScheduledTaskExecution[] = [
        {
          id: "exec-1",
          scheduledTaskId: "task-1",
          status: "success",
          startedAt: "2026-01-01T00:00:00.000Z",
          completedAt: "2026-01-01T00:01:00.000Z",
          durationMs: 60000,
          retryNumber: 0,
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ];

      const state = scheduledTasksReducer(
        { ...initialState, isLoadingExecutions: true },
        setTaskExecutions({ taskId: "task-1", executions })
      );

      expect(state.executions["task-1"]).toHaveLength(1);
      expect(state.isLoadingExecutions).toBe(false);
    });
  });

  describe("addExecution", () => {
    it("should increment runCount and update lastRunAt", () => {
      const task = makeTask({ runCount: 5 });
      const prev = { ...initialState, tasks: [task] };

      const execution: ScheduledTaskExecution = {
        id: "exec-new",
        scheduledTaskId: "task-1",
        status: "success",
        startedAt: "2026-02-15T10:00:00.000Z",
        completedAt: null,
        durationMs: null,
        retryNumber: 0,
        createdAt: "2026-02-15T10:00:00.000Z",
      };

      const state = scheduledTasksReducer(prev, addExecution(execution));

      expect(state.tasks[0]!.runCount).toBe(6);
      expect(state.tasks[0]!.lastRunAt).toBe("2026-02-15T10:00:00.000Z");
      expect(state.tasks[0]!.lastRunStatus).toBe("success");
      expect(state.executions["task-1"]).toHaveLength(1);
    });
  });

  describe("startCreating", () => {
    it("should set isCreating and default editingTask", () => {
      const state = scheduledTasksReducer(initialState, startCreating());

      expect(state.isCreating).toBe(true);
      expect(state.editingTask).toBeDefined();
      expect(state.editingTask!.scheduleType).toBe("recurring");
    });
  });

  describe("cancelEditing", () => {
    it("should clear editingTask and isCreating", () => {
      const prev = { ...initialState, isCreating: true, editingTask: { name: "test" } };
      const state = scheduledTasksReducer(prev, cancelEditing());

      expect(state.editingTask).toBeNull();
      expect(state.isCreating).toBe(false);
    });
  });

  describe("setLoading", () => {
    it("should set loading state", () => {
      const state = scheduledTasksReducer(initialState, setLoading(true));
      expect(state.isLoading).toBe(true);
    });
  });

  describe("setScheduledTasksError", () => {
    it("should set error and reset loading states", () => {
      const prev = { ...initialState, isLoading: true, isCreating: true };
      const state = scheduledTasksReducer(prev, setScheduledTasksError("Something failed"));

      expect(state.error).toBe("Something failed");
      expect(state.isLoading).toBe(false);
      expect(state.isCreating).toBe(false);
    });
  });

  describe("trigger type in TaskScheduleType", () => {
    it("should accept 'trigger' as a valid scheduleType", () => {
      const task = makeTask({ scheduleType: "trigger" });
      const state = scheduledTasksReducer(initialState, addScheduledTask(task));
      expect(state.tasks[0]!.scheduleType).toBe("trigger");
    });

    it("should store all trigger-related fields", () => {
      const task = makeTriggerTask();
      const state = scheduledTasksReducer(initialState, addScheduledTask(task));
      const stored = state.tasks[0]!;

      expect(stored.triggerEnabled).toBe(true);
      expect(stored.triggerAppName).toBe("gmail");
      expect(stored.triggerEventSlug).toBe("GMAIL_NEW_GMAIL_MESSAGE");
      expect(stored.triggerConfig).toEqual({ label: "inbox" });
      expect(stored.composioTriggerId).toBe("ti_abc123");
      expect(stored.lastTriggerAt).toBe("2026-02-15T10:00:00.000Z");
      expect(stored.lastTriggerEventId).toBe("evt_xyz");
    });
  });

  describe("setSelectedTask", () => {
    it("should set selected task ID", () => {
      const state = scheduledTasksReducer(initialState, setSelectedTask("task-1"));
      expect(state.selectedTaskId).toBe("task-1");
    });

    it("should accept null", () => {
      const prev = { ...initialState, selectedTaskId: "task-1" };
      const state = scheduledTasksReducer(prev, setSelectedTask(null));
      expect(state.selectedTaskId).toBeNull();
    });
  });
});
