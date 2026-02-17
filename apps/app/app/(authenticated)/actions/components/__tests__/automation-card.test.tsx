import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { Provider, useDispatch, useSelector } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import scheduledTasksReducer from "@/lib/store/slices/scheduledTasks.slice";
import type { ScheduledTask } from "@/lib/store/slices/scheduledTasks.slice";
import { AutomationCard } from "../automation-card";

// Mock store hooks to avoid @repo/auth/client import chain
vi.mock("@/lib/store/hooks", () => ({
  useAppDispatch: () => useDispatch(),
  useAppSelector: (selector: any) => useSelector(selector),
}));

// Mock tRPC
vi.mock("@/lib/trpc/vanilla", () => ({
  getTrpcClient: () => ({
    scheduledTasks: {
      runNow: { mutate: vi.fn().mockResolvedValue({ executionId: "exec-1" }) },
      pause: {
        mutate: vi.fn().mockResolvedValue({ id: "task-1", status: "paused", isEnabled: false }),
      },
      resume: {
        mutate: vi.fn().mockResolvedValue({ id: "task-1", status: "pending", isEnabled: true }),
      },
      delete: { mutate: vi.fn().mockResolvedValue({ success: true }) },
    },
  }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

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
    runCount: 3,
    recurrencePattern: "daily",
    recurrenceTime: "09:00",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function createStore() {
  return configureStore({
    reducer: { scheduledTasks: scheduledTasksReducer },
  });
}

describe("AutomationCard", () => {
  const onEdit = vi.fn();
  const onViewHistory = vi.fn();
  const onRefetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render task name and badges", () => {
    const task = makeTask();
    const store = createStore();

    render(
      <Provider store={store}>
        <AutomationCard
          task={task}
          onEdit={onEdit}
          onViewHistory={onViewHistory}
          onRefetch={onRefetch}
        />
      </Provider>
    );

    expect(screen.getByText("Test Task")).toBeDefined();
    expect(screen.getByText("Recurring")).toBeDefined();
    expect(screen.getByText("Active")).toBeDefined();
    expect(screen.getByText("AI Agent")).toBeDefined();
  });

  it("should show trigger badge for trigger tasks", () => {
    const task = makeTask({
      scheduleType: "trigger",
      triggerAppName: "gmail",
      triggerEventSlug: "GMAIL_NEW_MESSAGE",
    });
    const store = createStore();

    render(
      <Provider store={store}>
        <AutomationCard
          task={task}
          onEdit={onEdit}
          onViewHistory={onViewHistory}
          onRefetch={onRefetch}
        />
      </Provider>
    );

    expect(screen.getByText("Trigger")).toBeDefined();
  });

  it("should show schedule description for recurring tasks", () => {
    const task = makeTask({
      scheduleType: "recurring",
      recurrencePattern: "daily",
      recurrenceTime: "09:00",
    });
    const store = createStore();

    render(
      <Provider store={store}>
        <AutomationCard
          task={task}
          onEdit={onEdit}
          onViewHistory={onViewHistory}
          onRefetch={onRefetch}
        />
      </Provider>
    );

    expect(screen.getByText(/Daily at 09:00/)).toBeDefined();
  });

  it("should show trigger description for trigger tasks", () => {
    const task = makeTask({
      scheduleType: "trigger",
      triggerAppName: "gmail",
      triggerEventSlug: "GMAIL_NEW_GMAIL_MESSAGE",
    });
    const store = createStore();

    render(
      <Provider store={store}>
        <AutomationCard
          task={task}
          onEdit={onEdit}
          onViewHistory={onViewHistory}
          onRefetch={onRefetch}
        />
      </Provider>
    );

    expect(screen.getByText(/Gmail — GMAIL_NEW_GMAIL_MESSAGE/)).toBeDefined();
  });

  it("should show cron expression for cron tasks", () => {
    const task = makeTask({
      scheduleType: "cron",
      cronExpression: "0 9 * * 1-5",
    });
    const store = createStore();

    render(
      <Provider store={store}>
        <AutomationCard
          task={task}
          onEdit={onEdit}
          onViewHistory={onViewHistory}
          onRefetch={onRefetch}
        />
      </Provider>
    );

    expect(screen.getByText(/Cron: 0 9 \* \* 1-5/)).toBeDefined();
  });

  it("should show run count", () => {
    const task = makeTask({ runCount: 42 });
    const store = createStore();

    render(
      <Provider store={store}>
        <AutomationCard
          task={task}
          onEdit={onEdit}
          onViewHistory={onViewHistory}
          onRefetch={onRefetch}
        />
      </Provider>
    );

    expect(screen.getByText("42 runs")).toBeDefined();
  });

  it("should show 'Never run' when no lastRunAt", () => {
    const task = makeTask({ lastRunAt: null });
    const store = createStore();

    render(
      <Provider store={store}>
        <AutomationCard
          task={task}
          onEdit={onEdit}
          onViewHistory={onViewHistory}
          onRefetch={onRefetch}
        />
      </Provider>
    );

    expect(screen.getByText("Never run")).toBeDefined();
  });

  it("should not show run button when task is running", () => {
    const task = makeTask({ status: "running" });
    const store = createStore();

    render(
      <Provider store={store}>
        <AutomationCard
          task={task}
          onEdit={onEdit}
          onViewHistory={onViewHistory}
          onRefetch={onRefetch}
        />
      </Provider>
    );

    expect(screen.getByText("Running")).toBeDefined();
    const runButtons = screen.queryAllByTitle("Run now");
    expect(runButtons).toHaveLength(0);
  });

  it("should show skill badges when task has skillIds in payload", () => {
    const task = makeTask({
      payload: { prompt: "do stuff", skillIds: ["web-search", "browser"] } as any,
    });
    const store = createStore();

    render(
      <Provider store={store}>
        <AutomationCard
          task={task}
          onEdit={onEdit}
          onViewHistory={onViewHistory}
          onRefetch={onRefetch}
        />
      </Provider>
    );

    expect(screen.getByText("web-search")).toBeDefined();
    expect(screen.getByText("browser")).toBeDefined();
  });

  it("should not show skill badges when task has no skillIds", () => {
    const task = makeTask({ payload: { prompt: "simple task" } as any });
    const store = createStore();

    render(
      <Provider store={store}>
        <AutomationCard
          task={task}
          onEdit={onEdit}
          onViewHistory={onViewHistory}
          onRefetch={onRefetch}
        />
      </Provider>
    );

    expect(screen.queryByText("web-search")).toBeNull();
    expect(screen.queryByText("browser")).toBeNull();
  });
});
