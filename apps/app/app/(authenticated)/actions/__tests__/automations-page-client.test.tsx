import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { useDispatch, useSelector } from "react-redux";
import scheduledTasksReducer from "@/lib/store/slices/scheduledTasks.slice";
import type { ScheduledTask } from "@/lib/store/slices/scheduledTasks.slice";

// Mock store hooks to avoid @repo/auth/client import chain
// Must return stable hook references — re-export the real hooks
vi.mock("@/lib/store/hooks", async () => {
  const { useDispatch: realDispatch, useSelector: realSelector } = await vi.importActual<
    typeof import("react-redux")
  >("react-redux");
  return {
    useAppDispatch: realDispatch,
    useAppSelector: realSelector,
  };
});

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/actions",
  useSearchParams: () => new URLSearchParams(),
}));

// Mock tRPC client — resolves synchronously to avoid async state updates
vi.mock("@/lib/trpc/vanilla", () => ({
  getTrpcClient: () => ({
    scheduledTasks: {
      list: { query: vi.fn().mockResolvedValue([]) },
      create: { mutate: vi.fn() },
      update: { mutate: vi.fn() },
      delete: { mutate: vi.fn() },
      pause: { mutate: vi.fn() },
      resume: { mutate: vi.fn() },
      runNow: { mutate: vi.fn() },
      getExecutions: { query: vi.fn().mockResolvedValue([]) },
      listTriggerTypes: { query: vi.fn().mockResolvedValue({ triggers: [] }) },
      getTriggerTypeConfig: { query: vi.fn().mockResolvedValue({}) },
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
    runCount: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function createStore(tasks: ScheduledTask[] = []) {
  return configureStore({
    reducer: { scheduledTasks: scheduledTasksReducer },
    preloadedState: {
      scheduledTasks: {
        tasks,
        executions: {},
        chatScheduledTaskIds: [],
        selectedTaskId: null,
        editingTask: null,
        isCreating: false,
        isLoading: false,
        isLoadingExecutions: false,
        error: null,
      },
    },
  });
}

// Import after mocks are set up
const { AutomationsPageClient } = await import("../automations-page-client");

describe("AutomationsPageClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render the page title and create button", () => {
    const store = createStore([makeTask()]);

    render(
      <Provider store={store}>
        <AutomationsPageClient />
      </Provider>
    );

    expect(screen.getByText("Automations")).toBeDefined();
    expect(screen.getAllByText("Create Automation").length).toBeGreaterThanOrEqual(1);
  });

  it("should render tab buttons", () => {
    const store = createStore([makeTask()]);

    render(
      <Provider store={store}>
        <AutomationsPageClient />
      </Provider>
    );

    expect(screen.getByText("All")).toBeDefined();
    expect(screen.getByText("Triggers")).toBeDefined();
    expect(screen.getByText("Schedules")).toBeDefined();
    expect(screen.getByText("One-time")).toBeDefined();
  });

  it("should show empty state when no tasks", async () => {
    const store = createStore();

    render(
      <Provider store={store}>
        <AutomationsPageClient />
      </Provider>
    );

    await waitFor(() => {
      expect(screen.getByText("No automations yet")).toBeDefined();
    });
  });

  it("should render task cards when tasks exist", () => {
    const store = createStore([
      makeTask({ id: "t1", name: "Daily Report" }),
      makeTask({
        id: "t2",
        name: "Gmail Trigger",
        scheduleType: "trigger",
        triggerAppName: "gmail",
        triggerEventSlug: "GMAIL_NEW_MESSAGE",
      }),
    ]);

    render(
      <Provider store={store}>
        <AutomationsPageClient />
      </Provider>
    );

    expect(screen.getByText("Daily Report")).toBeDefined();
    expect(screen.getByText("Gmail Trigger")).toBeDefined();
  });

  it("should filter tasks by search query", () => {
    const store = createStore([
      makeTask({ id: "t1", name: "Daily Report" }),
      makeTask({ id: "t2", name: "Gmail Notification" }),
    ]);

    render(
      <Provider store={store}>
        <AutomationsPageClient />
      </Provider>
    );

    const searchInput = screen.getByPlaceholderText("Search automations...");
    fireEvent.change(searchInput, { target: { value: "Gmail" } });

    expect(screen.queryByText("Daily Report")).toBeNull();
    expect(screen.getByText("Gmail Notification")).toBeDefined();
  });

  it("should open create dialog on button click", async () => {
    const store = createStore([makeTask()]);

    render(
      <Provider store={store}>
        <AutomationsPageClient />
      </Provider>
    );

    const createButtons = screen.getAllByText("Create Automation");
    fireEvent.click(createButtons[0]!);

    await waitFor(() => {
      expect(screen.getByText("Choose how your automation will be triggered.")).toBeDefined();
    });
  });
});
