import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Provider, useDispatch, useSelector } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import scheduledTasksReducer from "@/lib/store/slices/scheduledTasks.slice";
import type { ScheduledTask } from "@/lib/store/slices/scheduledTasks.slice";
import { apiSlice } from "@/lib/store/api/api.slice";

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

// vi.hoisted runs before vi.mock hoisting — safe to reference in mock factories
const { mockTasksResponseRef, mockTrpc } = vi.hoisted(() => {
  const ref = { current: [] as ScheduledTask[] };
  const factory = () => ({
    scheduledTasks: {
      list: { query: () => Promise.resolve(ref.current) },
      create: { mutate: () => Promise.resolve({}) },
      update: { mutate: () => Promise.resolve({}) },
      delete: { mutate: () => Promise.resolve({}) },
      pause: { mutate: () => Promise.resolve({}) },
      resume: { mutate: () => Promise.resolve({}) },
      runNow: { mutate: () => Promise.resolve({}) },
      getExecutions: { query: () => Promise.resolve([]) },
      listTriggerTypes: { query: () => Promise.resolve({ triggers: [] }) },
      getTriggerTypeConfig: { query: () => Promise.resolve({}) },
    },
  });
  return { mockTasksResponseRef: ref, mockTrpc: factory };
});

vi.mock("@/lib/trpc/vanilla", () => ({
  getTrpcClient: mockTrpc,
  getRawTrpcClient: mockTrpc,
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

function createStore() {
  return configureStore({
    reducer: {
      scheduledTasks: scheduledTasksReducer,
      [apiSlice.reducerPath]: apiSlice.reducer,
    },
    middleware: (getDefault) => getDefault().concat(apiSlice.middleware),
  });
}

// Import after mocks are set up
const { AutomationsPageClient } = await import("../automations-page-client");

describe("AutomationsPageClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTasksResponseRef.current = [];
  });

  it("should render the page title and create button", async () => {
    mockTasksResponseRef.current = [makeTask()];
    const store = createStore();

    render(
      <Provider store={store}>
        <AutomationsPageClient />
      </Provider>
    );

    expect(screen.getByText("Automations")).toBeDefined();
    await waitFor(() => {
      expect(screen.getAllByText("Create Automation").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("should render tab buttons", async () => {
    mockTasksResponseRef.current = [makeTask()];
    const store = createStore();

    render(
      <Provider store={store}>
        <AutomationsPageClient />
      </Provider>
    );

    await waitFor(() => {
      expect(screen.getByText("All")).toBeDefined();
      expect(screen.getByText("Triggers")).toBeDefined();
      expect(screen.getByText("Schedules")).toBeDefined();
      expect(screen.getByText("One-time")).toBeDefined();
    });
  });

  it("should show empty state when no tasks", async () => {
    mockTasksResponseRef.current = [];
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

  it("should render task cards when tasks exist", async () => {
    mockTasksResponseRef.current = [
      makeTask({ id: "t1", name: "Daily Report" }),
      makeTask({
        id: "t2",
        name: "Gmail Trigger",
        scheduleType: "trigger",
        triggerAppName: "gmail",
        triggerEventSlug: "GMAIL_NEW_MESSAGE",
      }),
    ];
    const store = createStore();

    render(
      <Provider store={store}>
        <AutomationsPageClient />
      </Provider>
    );

    await waitFor(() => {
      expect(screen.getByText("Daily Report")).toBeDefined();
      expect(screen.getByText("Gmail Trigger")).toBeDefined();
    });
  });

  it("should filter tasks by search query", async () => {
    mockTasksResponseRef.current = [
      makeTask({ id: "t1", name: "Daily Report" }),
      makeTask({ id: "t2", name: "Gmail Notification" }),
    ];
    const store = createStore();

    render(
      <Provider store={store}>
        <AutomationsPageClient />
      </Provider>
    );

    // Wait for RTK-Query to resolve and tasks to render
    await waitFor(() => {
      expect(screen.getByText("Daily Report")).toBeDefined();
    });

    const searchInput = screen.getByPlaceholderText("Search automations...");
    fireEvent.change(searchInput, { target: { value: "Gmail" } });

    expect(screen.queryByText("Daily Report")).toBeNull();
    expect(screen.getByText("Gmail Notification")).toBeDefined();
  });

  it("should open create dialog on button click", async () => {
    mockTasksResponseRef.current = [makeTask()];
    const store = createStore();

    render(
      <Provider store={store}>
        <AutomationsPageClient />
      </Provider>
    );

    await waitFor(() => {
      expect(screen.getAllByText("Create Automation").length).toBeGreaterThanOrEqual(1);
    });

    const createButtons = screen.getAllByText("Create Automation");
    fireEvent.click(createButtons[0]!);

    await waitFor(() => {
      expect(screen.getByText("Choose how your automation will be triggered.")).toBeDefined();
    });
  });
});
