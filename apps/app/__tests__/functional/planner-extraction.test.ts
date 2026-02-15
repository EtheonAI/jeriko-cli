import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// Planner State Extraction Logic
// ---------------------------------------------------------------------------
//
// usePlannerState is a React hook (useMemo-based), but the core extraction
// logic is pure. We replicate it here for unit testing without React or jsdom
// rendering overhead.
//
// This mirrors the logic in packages/ai/components/planner/use-planner-state.ts
// ---------------------------------------------------------------------------

// Types (mirroring the hook)
type PlanStepStatus = "pending" | "in_progress" | "completed" | "error";

interface PlanStep {
  id: string;
  title: string;
  status: PlanStepStatus;
}

interface PlannerState {
  steps: PlanStep[];
  currentStepIndex: number;
  totalSteps: number;
  completedSteps: number;
  progress: number;
  isActive: boolean;
  hasSteps: boolean;
  title?: string;
}

interface RawPlanTodo {
  id?: string;
  label?: string;
  title?: string;
  status?: string;
}

interface RawPlanData {
  title?: string;
  todos?: RawPlanTodo[];
  steps?: RawPlanTodo[];
  goal?: string;
  phases?: RawPlanTodo[];
}

// Minimal part/message types for testing
interface ToolPart {
  type: string;
  toolCallId: string;
  toolName?: string;
  state: string;
  input: unknown;
  output?: unknown;
}

interface TestMessage {
  id: string;
  role: "user" | "assistant";
  parts: Array<{ type: string } & Record<string, unknown>>;
}

const EMPTY_STATE: PlannerState = {
  steps: [],
  currentStepIndex: -1,
  totalSteps: 0,
  completedSteps: 0,
  progress: 0,
  isActive: false,
  hasSteps: false,
};

const PLAN_TOOL_NAMES = new Set(["show_plan"]);

// ---------------------------------------------------------------------------
// Extracted pure logic from usePlannerState
// ---------------------------------------------------------------------------

function mapStatus(status: string | undefined): PlanStepStatus {
  if (!status) return "pending";
  const s = status.toLowerCase().replace(/-/g, "_");
  switch (s) {
    case "completed":
    case "done":
    case "complete":
      return "completed";
    case "in_progress":
    case "doing":
    case "running":
      return "in_progress";
    case "error":
    case "failed":
    case "cancelled":
      return "error";
    default:
      return "pending";
  }
}

function isToolUIPart(part: { type: string } & Record<string, unknown>): boolean {
  return (
    (typeof part.type === "string" && part.type.startsWith("tool-")) ||
    part.type === "dynamic-tool"
  );
}

function getToolName(part: { type: string } & Record<string, unknown>): string {
  if (part.type === "dynamic-tool") {
    return (part as unknown as { toolName: string }).toolName;
  }
  return part.type.slice(5); // Remove "tool-" prefix
}

/**
 * Pure function that extracts PlannerState from messages.
 * This is the core logic from usePlannerState without React hooks.
 */
function extractPlannerState(
  messages: TestMessage[],
  isStreaming = false
): PlannerState {
  let latestPlan: RawPlanData | null = null;

  // Scan all assistant messages for the LATEST show_plan tool call
  for (const message of messages) {
    if (message.role !== "assistant" || !message.parts) continue;

    for (const part of message.parts) {
      if (!part || !isToolUIPart(part)) continue;

      const toolName = getToolName(part);
      if (!PLAN_TOOL_NAMES.has(toolName)) continue;

      // Use output if available, otherwise input (for streaming state)
      const planSource =
        part.state === "output-available" && part.output
          ? part.output
          : part.input;

      if (planSource && typeof planSource === "object") {
        latestPlan = planSource as RawPlanData;
      }
    }
  }

  // No plan tool was called
  if (!latestPlan) return EMPTY_STATE;

  // Extract todos from various possible field names
  const rawTodos =
    latestPlan.todos ?? latestPlan.steps ?? latestPlan.phases ?? [];
  if (rawTodos.length === 0) return EMPTY_STATE;

  // Build steps
  const steps: PlanStep[] = rawTodos.map((todo, i) => ({
    id: todo.id || `step-${i + 1}`,
    title: todo.label || todo.title || `Step ${i + 1}`,
    status: mapStatus(todo.status),
  }));

  // Auto-complete when not streaming
  if (!isStreaming) {
    for (const step of steps) {
      if (step.status === "in_progress" || step.status === "pending") {
        step.status = "completed";
      }
    }
  }

  const completedSteps = steps.filter((s) => s.status === "completed").length;
  const inProgressIndex = steps.findIndex((s) => s.status === "in_progress");
  const firstPendingIndex = steps.findIndex((s) => s.status === "pending");
  const progress =
    steps.length > 0 ? (completedSteps / steps.length) * 100 : 0;

  const currentIndex =
    inProgressIndex !== -1
      ? inProgressIndex
      : firstPendingIndex !== -1
        ? firstPendingIndex
        : steps.length - 1;

  return {
    steps,
    currentStepIndex: currentIndex,
    totalSteps: steps.length,
    completedSteps,
    progress,
    isActive: steps.some((s) => s.status === "in_progress"),
    hasSteps: true,
    title: latestPlan.title || latestPlan.goal,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeShowPlanPart(
  input: RawPlanData,
  state: "input-available" | "output-available" = "input-available",
  output?: RawPlanData
): ToolPart {
  return {
    type: "tool-show_plan",
    toolCallId: `tc_plan_${Date.now()}_${Math.random()}`,
    state,
    input,
    output,
  };
}

function makeAssistantMessage(parts: Array<{ type: string } & Record<string, unknown>>): TestMessage {
  return {
    id: `msg_${Date.now()}_${Math.random()}`,
    role: "assistant",
    parts,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Planner State Extraction", () => {
  // -----------------------------------------------------------------------
  // 1. Returns null/empty when no show_plan tool parts exist
  // -----------------------------------------------------------------------
  it("returns empty state when no show_plan tool parts exist", () => {
    const messages: TestMessage[] = [
      {
        id: "msg_1",
        role: "user",
        parts: [{ type: "text", text: "Hello" }],
      },
      {
        id: "msg_2",
        role: "assistant",
        parts: [{ type: "text", text: "Hi there!" }],
      },
    ];

    const state = extractPlannerState(messages);

    expect(state).toEqual(EMPTY_STATE);
    expect(state.hasSteps).toBe(false);
    expect(state.steps).toHaveLength(0);
    expect(state.currentStepIndex).toBe(-1);
  });

  // -----------------------------------------------------------------------
  // 2. Extracts plan from latest show_plan tool part
  // -----------------------------------------------------------------------
  it("extracts plan from the latest show_plan tool part", () => {
    const oldPlan = makeShowPlanPart({
      title: "Old Plan",
      todos: [
        { id: "s1", label: "Old step 1", status: "completed" },
      ],
    });

    const newPlan = makeShowPlanPart({
      title: "Current Plan",
      todos: [
        { id: "s1", label: "Step A", status: "completed" },
        { id: "s2", label: "Step B", status: "in_progress" },
      ],
    });

    const messages: TestMessage[] = [
      makeAssistantMessage([oldPlan as unknown as { type: string } & Record<string, unknown>]),
      makeAssistantMessage([newPlan as unknown as { type: string } & Record<string, unknown>]),
    ];

    // isStreaming=true so steps keep their original status
    const state = extractPlannerState(messages, true);

    expect(state.hasSteps).toBe(true);
    expect(state.title).toBe("Current Plan");
    expect(state.totalSteps).toBe(2);
    expect(state.steps[0]!.title).toBe("Step A");
    expect(state.steps[1]!.title).toBe("Step B");
  });

  // -----------------------------------------------------------------------
  // 3. Handles plan with multiple steps
  // -----------------------------------------------------------------------
  it("handles plan with multiple steps and correct progress", () => {
    const plan = makeShowPlanPart({
      title: "Build Website",
      todos: [
        { id: "s1", label: "Set up project", status: "completed" },
        { id: "s2", label: "Create components", status: "completed" },
        { id: "s3", label: "Add styling", status: "in_progress" },
        { id: "s4", label: "Write tests", status: "pending" },
        { id: "s5", label: "Deploy", status: "pending" },
      ],
    });

    const messages: TestMessage[] = [
      makeAssistantMessage([plan as unknown as { type: string } & Record<string, unknown>]),
    ];

    const state = extractPlannerState(messages, true);

    expect(state.hasSteps).toBe(true);
    expect(state.totalSteps).toBe(5);
    expect(state.completedSteps).toBe(2);
    expect(state.progress).toBe(40); // 2/5 = 40%
    expect(state.isActive).toBe(true);
    expect(state.currentStepIndex).toBe(2); // index of "in_progress" step
    expect(state.title).toBe("Build Website");
  });

  // -----------------------------------------------------------------------
  // 4. Handles step status transitions (pending -> in_progress -> completed)
  // -----------------------------------------------------------------------
  it("handles step status transitions across plan updates", () => {
    // First plan update: all pending
    const plan1 = makeShowPlanPart({
      title: "Deployment",
      todos: [
        { id: "s1", label: "Build image", status: "pending" },
        { id: "s2", label: "Push to registry", status: "pending" },
        { id: "s3", label: "Deploy to prod", status: "pending" },
      ],
    });

    const messages1: TestMessage[] = [
      makeAssistantMessage([plan1 as unknown as { type: string } & Record<string, unknown>]),
    ];

    const state1 = extractPlannerState(messages1, true);
    expect(state1.completedSteps).toBe(0);
    expect(state1.isActive).toBe(false);
    expect(state1.currentStepIndex).toBe(0); // first pending

    // Second plan update: first step in_progress
    const plan2 = makeShowPlanPart({
      title: "Deployment",
      todos: [
        { id: "s1", label: "Build image", status: "in_progress" },
        { id: "s2", label: "Push to registry", status: "pending" },
        { id: "s3", label: "Deploy to prod", status: "pending" },
      ],
    });

    const messages2: TestMessage[] = [
      makeAssistantMessage([plan1 as unknown as { type: string } & Record<string, unknown>]),
      makeAssistantMessage([plan2 as unknown as { type: string } & Record<string, unknown>]),
    ];

    const state2 = extractPlannerState(messages2, true);
    expect(state2.completedSteps).toBe(0);
    expect(state2.isActive).toBe(true);
    expect(state2.currentStepIndex).toBe(0); // in_progress step

    // Third plan update: first completed, second in_progress
    const plan3 = makeShowPlanPart({
      title: "Deployment",
      todos: [
        { id: "s1", label: "Build image", status: "completed" },
        { id: "s2", label: "Push to registry", status: "in_progress" },
        { id: "s3", label: "Deploy to prod", status: "pending" },
      ],
    });

    const messages3: TestMessage[] = [
      makeAssistantMessage([plan1 as unknown as { type: string } & Record<string, unknown>]),
      makeAssistantMessage([plan2 as unknown as { type: string } & Record<string, unknown>]),
      makeAssistantMessage([plan3 as unknown as { type: string } & Record<string, unknown>]),
    ];

    const state3 = extractPlannerState(messages3, true);
    expect(state3.completedSteps).toBe(1);
    expect(state3.progress).toBeCloseTo(33.33, 0);
    expect(state3.isActive).toBe(true);
    expect(state3.currentStepIndex).toBe(1);

    // Final: all completed
    const plan4 = makeShowPlanPart({
      title: "Deployment",
      todos: [
        { id: "s1", label: "Build image", status: "completed" },
        { id: "s2", label: "Push to registry", status: "completed" },
        { id: "s3", label: "Deploy to prod", status: "completed" },
      ],
    });

    const messages4: TestMessage[] = [
      makeAssistantMessage([plan1 as unknown as { type: string } & Record<string, unknown>]),
      makeAssistantMessage([plan2 as unknown as { type: string } & Record<string, unknown>]),
      makeAssistantMessage([plan3 as unknown as { type: string } & Record<string, unknown>]),
      makeAssistantMessage([plan4 as unknown as { type: string } & Record<string, unknown>]),
    ];

    const state4 = extractPlannerState(messages4, true);
    expect(state4.completedSteps).toBe(3);
    expect(state4.progress).toBe(100);
    expect(state4.isActive).toBe(false);
    expect(state4.currentStepIndex).toBe(2); // last step (all complete)
  });

  // -----------------------------------------------------------------------
  // 5. Auto-completes steps when not streaming
  // -----------------------------------------------------------------------
  it("auto-completes pending/in_progress steps when not streaming", () => {
    const plan = makeShowPlanPart({
      title: "Task",
      todos: [
        { id: "s1", label: "Step 1", status: "completed" },
        { id: "s2", label: "Step 2", status: "in_progress" },
        { id: "s3", label: "Step 3", status: "pending" },
      ],
    });

    const messages: TestMessage[] = [
      makeAssistantMessage([plan as unknown as { type: string } & Record<string, unknown>]),
    ];

    // isStreaming = false -> auto-complete
    const state = extractPlannerState(messages, false);

    expect(state.steps[0]!.status).toBe("completed");
    expect(state.steps[1]!.status).toBe("completed"); // was in_progress
    expect(state.steps[2]!.status).toBe("completed"); // was pending
    expect(state.completedSteps).toBe(3);
    expect(state.progress).toBe(100);
  });

  // -----------------------------------------------------------------------
  // 6. Preserves error status even when not streaming
  // -----------------------------------------------------------------------
  it("preserves error status when auto-completing", () => {
    const plan = makeShowPlanPart({
      title: "Task",
      todos: [
        { id: "s1", label: "Step 1", status: "completed" },
        { id: "s2", label: "Step 2", status: "failed" },
        { id: "s3", label: "Step 3", status: "pending" },
      ],
    });

    const messages: TestMessage[] = [
      makeAssistantMessage([plan as unknown as { type: string } & Record<string, unknown>]),
    ];

    const state = extractPlannerState(messages, false);

    expect(state.steps[0]!.status).toBe("completed");
    expect(state.steps[1]!.status).toBe("error"); // error is preserved, not auto-completed
    expect(state.steps[2]!.status).toBe("completed"); // pending -> completed
  });

  // -----------------------------------------------------------------------
  // 7. Handles alternative status strings
  // -----------------------------------------------------------------------
  it("maps alternative status strings correctly", () => {
    const plan = makeShowPlanPart({
      title: "Task",
      todos: [
        { id: "s1", label: "Step 1", status: "done" },
        { id: "s2", label: "Step 2", status: "doing" },
        { id: "s3", label: "Step 3", status: "running" },
        { id: "s4", label: "Step 4", status: "cancelled" },
      ],
    });

    const messages: TestMessage[] = [
      makeAssistantMessage([plan as unknown as { type: string } & Record<string, unknown>]),
    ];

    const state = extractPlannerState(messages, true);

    expect(state.steps[0]!.status).toBe("completed"); // done -> completed
    expect(state.steps[1]!.status).toBe("in_progress"); // doing -> in_progress
    expect(state.steps[2]!.status).toBe("in_progress"); // running -> in_progress
    expect(state.steps[3]!.status).toBe("error"); // cancelled -> error
  });

  // -----------------------------------------------------------------------
  // 8. Uses "goal" as title fallback
  // -----------------------------------------------------------------------
  it("uses goal as title fallback when title is not provided", () => {
    const plan = makeShowPlanPart({
      goal: "Build a website",
      todos: [
        { id: "s1", label: "Step 1", status: "pending" },
      ],
    });

    const messages: TestMessage[] = [
      makeAssistantMessage([plan as unknown as { type: string } & Record<string, unknown>]),
    ];

    const state = extractPlannerState(messages, true);
    expect(state.title).toBe("Build a website");
  });

  // -----------------------------------------------------------------------
  // 9. Uses output over input when state is output-available
  // -----------------------------------------------------------------------
  it("uses output over input when tool state is output-available", () => {
    const part: ToolPart = {
      type: "tool-show_plan",
      toolCallId: "tc_1",
      state: "output-available",
      input: {
        title: "Input Plan",
        todos: [{ id: "s1", label: "Input step", status: "pending" }],
      },
      output: {
        title: "Output Plan",
        todos: [
          { id: "s1", label: "Output step 1", status: "completed" },
          { id: "s2", label: "Output step 2", status: "in_progress" },
        ],
      },
    };

    const messages: TestMessage[] = [
      makeAssistantMessage([part as unknown as { type: string } & Record<string, unknown>]),
    ];

    const state = extractPlannerState(messages, true);

    expect(state.title).toBe("Output Plan");
    expect(state.totalSteps).toBe(2);
    expect(state.steps[0]!.title).toBe("Output step 1");
  });

  // -----------------------------------------------------------------------
  // 10. Generates default step IDs and titles when missing
  // -----------------------------------------------------------------------
  it("generates default step IDs and titles when not provided", () => {
    const plan = makeShowPlanPart({
      title: "Task",
      todos: [
        { status: "pending" },
        { status: "pending" },
      ],
    });

    const messages: TestMessage[] = [
      makeAssistantMessage([plan as unknown as { type: string } & Record<string, unknown>]),
    ];

    const state = extractPlannerState(messages, true);

    expect(state.steps[0]!.id).toBe("step-1");
    expect(state.steps[0]!.title).toBe("Step 1");
    expect(state.steps[1]!.id).toBe("step-2");
    expect(state.steps[1]!.title).toBe("Step 2");
  });

  // -----------------------------------------------------------------------
  // 11. Skips user messages entirely
  // -----------------------------------------------------------------------
  it("ignores user messages even if they somehow contain tool parts", () => {
    const messages: TestMessage[] = [
      {
        id: "msg_user",
        role: "user",
        parts: [
          {
            type: "tool-show_plan",
            toolCallId: "tc_fake",
            state: "input-available",
            input: { title: "Fake", todos: [{ id: "s1", label: "Fake step" }] },
          } as unknown as { type: string } & Record<string, unknown>,
        ],
      },
    ];

    const state = extractPlannerState(messages);
    expect(state).toEqual(EMPTY_STATE);
  });

  // -----------------------------------------------------------------------
  // 12. Returns empty state for plan with empty todos array
  // -----------------------------------------------------------------------
  it("returns empty state when plan has empty todos array", () => {
    const plan = makeShowPlanPart({
      title: "Empty Plan",
      todos: [],
    });

    const messages: TestMessage[] = [
      makeAssistantMessage([plan as unknown as { type: string } & Record<string, unknown>]),
    ];

    const state = extractPlannerState(messages);
    expect(state).toEqual(EMPTY_STATE);
  });
});
