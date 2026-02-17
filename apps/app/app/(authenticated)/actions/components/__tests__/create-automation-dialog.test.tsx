import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Provider, useDispatch, useSelector } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import scheduledTasksReducer from "@/lib/store/slices/scheduledTasks.slice";
import { CreateAutomationDialog } from "../create-automation-dialog";

// Mock store hooks to avoid @repo/auth/client import chain
vi.mock("@/lib/store/hooks", () => ({
  useAppDispatch: () => useDispatch(),
  useAppSelector: (selector: any) => useSelector(selector),
}));

const mockCreate = vi.fn().mockResolvedValue({
  id: "new-1",
  userId: "user-1",
  name: "New Automation",
  scheduleType: "recurring",
  taskType: "agent_run",
  status: "pending",
  isEnabled: true,
  runCount: 0,
  timezone: "UTC",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

vi.mock("@/lib/trpc/vanilla", () => ({
  getTrpcClient: () => ({
    scheduledTasks: {
      create: { mutate: mockCreate },
      listTriggerTypes: {
        query: vi.fn().mockResolvedValue({
          triggers: [
            {
              slug: "GMAIL_NEW_GMAIL_MESSAGE",
              appName: "gmail",
              description: "Triggers when a new email is received",
            },
            {
              slug: "GITHUB_NEW_ISSUE",
              appName: "github",
              description: "Triggers when a new issue is created",
            },
          ],
        }),
      },
      getTriggerTypeConfig: {
        query: vi.fn().mockResolvedValue({
          slug: "GMAIL_NEW_GMAIL_MESSAGE",
          appName: "gmail",
          description: "New email trigger",
          configSchema: {
            properties: {
              label: { type: "string", description: "Gmail label to watch" },
            },
            required: ["label"],
          },
          payloadSchema: {},
        }),
      },
    },
    connectors: {
      list: {
        query: vi.fn().mockResolvedValue([
          {
            connector: { id: "uc-1", connectorDefinitionId: "cd-1", status: "connected" },
            definition: { id: "cd-1", type: "gmail", name: "Gmail", icon: null },
          },
          {
            connector: { id: "uc-2", connectorDefinitionId: "cd-2", status: "connected" },
            definition: { id: "cd-2", type: "slack", name: "Slack", icon: null },
          },
          {
            connector: { id: "uc-3", connectorDefinitionId: "cd-3", status: "disconnected" },
            definition: { id: "cd-3", type: "github", name: "GitHub", icon: null },
          },
        ]),
      },
    },
  }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

function createStore() {
  return configureStore({
    reducer: { scheduledTasks: scheduledTasksReducer },
  });
}

describe("CreateAutomationDialog", () => {
  const onOpenChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should show type selection on open", () => {
    const store = createStore();

    render(
      <Provider store={store}>
        <CreateAutomationDialog open={true} onOpenChange={onOpenChange} />
      </Provider>
    );

    expect(screen.getByText("Create Automation")).toBeDefined();
    expect(screen.getByText("Trigger")).toBeDefined();
    expect(screen.getByText("Recurring")).toBeDefined();
    expect(screen.getByText("One-time")).toBeDefined();
    expect(screen.getByText("Cron")).toBeDefined();
  });

  it("should show type descriptions", () => {
    const store = createStore();

    render(
      <Provider store={store}>
        <CreateAutomationDialog open={true} onOpenChange={onOpenChange} />
      </Provider>
    );

    expect(screen.getByText("Runs when an event occurs in a connected app")).toBeDefined();
    expect(screen.getByText("Runs on a repeating schedule")).toBeDefined();
  });

  it("should navigate to config step when type is selected", () => {
    const store = createStore();

    render(
      <Provider store={store}>
        <CreateAutomationDialog open={true} onOpenChange={onOpenChange} />
      </Provider>
    );

    // Click "Recurring" type card
    const recurringButton = screen.getByText("Recurring").closest("button")!;
    fireEvent.click(recurringButton);

    // Should show config form
    expect(screen.getByText("Configure Automation")).toBeDefined();
    expect(screen.getByLabelText("Name")).toBeDefined();
    expect(screen.getByText("Frequency")).toBeDefined();
  });

  it("should show trigger selector when trigger type is selected", async () => {
    const store = createStore();

    render(
      <Provider store={store}>
        <CreateAutomationDialog open={true} onOpenChange={onOpenChange} />
      </Provider>
    );

    // Click "Trigger" type card
    const triggerButton = screen
      .getByText("Runs when an event occurs in a connected app")
      .closest("button")!;
    fireEvent.click(triggerButton);

    // Should show the trigger selector (which loads from API)
    await waitFor(() => {
      expect(screen.getByText("App")).toBeDefined();
    });
  });

  it("should show 'Change type' back button in config step", () => {
    const store = createStore();

    render(
      <Provider store={store}>
        <CreateAutomationDialog open={true} onOpenChange={onOpenChange} />
      </Provider>
    );

    // Navigate to config step
    const recurringButton = screen.getByText("Recurring").closest("button")!;
    fireEvent.click(recurringButton);

    expect(screen.getByText("Change type")).toBeDefined();
  });

  it("should validate required name field", async () => {
    const store = createStore();

    render(
      <Provider store={store}>
        <CreateAutomationDialog open={true} onOpenChange={onOpenChange} />
      </Provider>
    );

    // Navigate to config
    fireEvent.click(screen.getByText("Recurring").closest("button")!);

    // Submit without name
    const submitButton = screen.getByText("Create Automation");
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText("Name is required")).toBeDefined();
    });

    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("should show cron input for cron type", () => {
    const store = createStore();

    render(
      <Provider store={store}>
        <CreateAutomationDialog open={true} onOpenChange={onOpenChange} />
      </Provider>
    );

    // Click Cron type
    fireEvent.click(screen.getByText("Cron").closest("button")!);

    expect(screen.getByLabelText("Cron Expression")).toBeDefined();
    expect(screen.getByPlaceholderText("0 9 * * 1-5")).toBeDefined();
  });

  it("should show datetime input for one-time type", () => {
    const store = createStore();

    render(
      <Provider store={store}>
        <CreateAutomationDialog open={true} onOpenChange={onOpenChange} />
      </Provider>
    );

    // Click One-time type
    fireEvent.click(screen.getByText("One-time").closest("button")!);

    expect(screen.getByLabelText("Run at")).toBeDefined();
  });

  it("should show skills picker in config step", () => {
    const store = createStore();

    render(
      <Provider store={store}>
        <CreateAutomationDialog open={true} onOpenChange={onOpenChange} />
      </Provider>
    );

    // Navigate to config
    fireEvent.click(screen.getByText("Recurring").closest("button")!);

    // Skills picker should be present (collapsed by default)
    expect(screen.getByText("Skills (optional)")).toBeDefined();
  });

  it("should include skillIds in submit payload when skills selected", async () => {
    const store = createStore();

    render(
      <Provider store={store}>
        <CreateAutomationDialog open={true} onOpenChange={onOpenChange} />
      </Provider>
    );

    // Navigate to config
    fireEvent.click(screen.getByText("Recurring").closest("button")!);

    // Fill name
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Test Automation" } });

    // Expand skills picker
    fireEvent.click(screen.getByText("Skills (optional)"));

    // Select a skill
    fireEvent.click(screen.getByText("Web Search"));

    // Submit
    fireEvent.click(screen.getByText("Create Automation"));

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalled();
    });

    const callArg = mockCreate.mock.calls[0]![0];
    expect(callArg.payload).toBeDefined();
    expect(callArg.payload.skillIds).toEqual(["web-search"]);
  });

  it("should show connector picker in config step", () => {
    const store = createStore();

    render(
      <Provider store={store}>
        <CreateAutomationDialog open={true} onOpenChange={onOpenChange} />
      </Provider>
    );

    // Navigate to config
    fireEvent.click(screen.getByText("Recurring").closest("button")!);

    // Connector picker should be present (collapsed by default)
    expect(screen.getByText("Connectors (optional)")).toBeDefined();
  });

  it("should show only connected apps when connector picker is expanded", async () => {
    const store = createStore();

    render(
      <Provider store={store}>
        <CreateAutomationDialog open={true} onOpenChange={onOpenChange} />
      </Provider>
    );

    // Navigate to config
    fireEvent.click(screen.getByText("Recurring").closest("button")!);

    // Expand connector picker
    fireEvent.click(screen.getByText("Connectors (optional)"));

    // Should show connected apps (Gmail, Slack) but NOT disconnected (GitHub)
    await waitFor(() => {
      expect(screen.getByText("Gmail")).toBeDefined();
      expect(screen.getByText("Slack")).toBeDefined();
    });

    expect(screen.queryByText("GitHub")).toBeNull();
  });

  it("should include connectionIds in submit payload when connectors selected", async () => {
    const store = createStore();

    render(
      <Provider store={store}>
        <CreateAutomationDialog open={true} onOpenChange={onOpenChange} />
      </Provider>
    );

    // Navigate to config
    fireEvent.click(screen.getByText("Recurring").closest("button")!);

    // Fill name
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Test Connectors" } });

    // Expand connector picker
    fireEvent.click(screen.getByText("Connectors (optional)"));

    // Wait for connectors to load and select Gmail
    await waitFor(() => {
      expect(screen.getByText("Gmail")).toBeDefined();
    });
    fireEvent.click(screen.getByText("Gmail"));

    // Submit
    fireEvent.click(screen.getByText("Create Automation"));

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalled();
    });

    const callArg = mockCreate.mock.calls[0]![0];
    expect(callArg.payload).toBeDefined();
    expect(callArg.payload.connectionIds).toEqual(["gmail"]);
  });
});
