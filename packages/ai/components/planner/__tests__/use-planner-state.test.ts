// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { usePlannerState } from "../use-planner-state";
import type { PlannerState } from "../use-planner-state";
import type { UIMessage } from "../../lib/types/ui-message";

// ────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────

function makeAssistantMessage(
  parts: Array<Record<string, unknown>>,
  id = "msg-1"
): UIMessage {
  return {
    id,
    role: "assistant",
    parts: parts as UIMessage["parts"],
    createdAt: new Date(),
  };
}

function makeShowPlanPart(
  planData: Record<string, unknown>,
  opts: {
    state?: string;
    toolCallId?: string;
  } = {}
) {
  const state = opts.state ?? "output-available";
  const toolCallId = opts.toolCallId ?? `plan_${Date.now()}`;

  if (state === "output-available") {
    return {
      type: "tool-show_plan",
      toolCallId,
      state: "output-available",
      input: { title: "Plan" },
      output: planData,
    };
  }

  // For streaming state — data is in input
  return {
    type: "tool-show_plan",
    toolCallId,
    state: "input-streaming",
    input: planData,
  };
}

// ────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────

describe("usePlannerState", () => {
  it("no messages → EMPTY_STATE (hasSteps: false)", () => {
    const { result } = renderHook(() => usePlannerState([]));
    expect(result.current.hasSteps).toBe(false);
    expect(result.current.steps).toEqual([]);
    expect(result.current.progress).toBe(0);
    expect(result.current.totalSteps).toBe(0);
  });

  it("messages without show_plan → EMPTY_STATE", () => {
    const messages: UIMessage[] = [
      {
        id: "msg-1",
        role: "user",
        parts: [{ type: "text", text: "Hello" }],
      },
      makeAssistantMessage([
        { type: "text", text: "Hi there!" },
        {
          type: "tool-web_search",
          toolCallId: "ws_1",
          state: "output-available",
          input: { query: "test" },
          output: { results: [] },
        },
      ]),
    ];

    const { result } = renderHook(() => usePlannerState(messages));
    expect(result.current.hasSteps).toBe(false);
  });

  it("single show_plan with 3 todos → correct steps/progress", () => {
    const messages: UIMessage[] = [
      makeAssistantMessage([
        makeShowPlanPart({
          title: "Build React App",
          todos: [
            { id: "s1", label: "Research frameworks", status: "completed" },
            { id: "s2", label: "Write components", status: "in_progress" },
            { id: "s3", label: "Add tests", status: "pending" },
          ],
        }),
      ]),
    ];

    const { result } = renderHook(() => usePlannerState(messages));

    expect(result.current.hasSteps).toBe(true);
    expect(result.current.steps).toHaveLength(3);
    expect(result.current.totalSteps).toBe(3);
    expect(result.current.completedSteps).toBe(1);
    expect(result.current.progress).toBeCloseTo(33.33, 0);
    expect(result.current.isActive).toBe(true);
    expect(result.current.title).toBe("Build React App");

    // Steps should be mapped correctly
    expect(result.current.steps[0]).toMatchObject({
      id: "s1",
      title: "Research frameworks",
      status: "completed",
    });
    expect(result.current.steps[1]).toMatchObject({
      id: "s2",
      title: "Write components",
      status: "in_progress",
    });
    expect(result.current.steps[2]).toMatchObject({
      id: "s3",
      title: "Add tests",
      status: "pending",
    });
  });

  it("multiple show_plan calls → uses LATEST one", () => {
    const messages: UIMessage[] = [
      makeAssistantMessage([
        makeShowPlanPart(
          {
            title: "Old Plan",
            todos: [
              { id: "s1", label: "Step 1", status: "completed" },
            ],
          },
          { toolCallId: "plan_1" }
        ),
      ], "msg-1"),
      makeAssistantMessage([
        makeShowPlanPart(
          {
            title: "Updated Plan",
            todos: [
              { id: "s1", label: "Step 1", status: "completed" },
              { id: "s2", label: "Step 2", status: "in_progress" },
              { id: "s3", label: "Step 3", status: "pending" },
            ],
          },
          { toolCallId: "plan_2" }
        ),
      ], "msg-2"),
    ];

    const { result } = renderHook(() => usePlannerState(messages));

    expect(result.current.title).toBe("Updated Plan");
    expect(result.current.totalSteps).toBe(3);
  });

  it("show_plan in output-available → reads output", () => {
    const messages: UIMessage[] = [
      makeAssistantMessage([
        {
          type: "tool-show_plan",
          toolCallId: "plan_out",
          state: "output-available",
          input: {
            title: "Input Title",
            todos: [{ id: "s1", label: "Input Step", status: "pending" }],
          },
          output: {
            title: "Output Title",
            todos: [
              { id: "s1", label: "Output Step", status: "completed" },
              { id: "s2", label: "Extra Step", status: "pending" },
            ],
          },
        },
      ]),
    ];

    const { result } = renderHook(() => usePlannerState(messages));

    // Should prefer output over input
    expect(result.current.title).toBe("Output Title");
    expect(result.current.totalSteps).toBe(2);
    expect(result.current.steps[0].title).toBe("Output Step");
  });

  it("show_plan in input-streaming → reads input as fallback", () => {
    const messages: UIMessage[] = [
      makeAssistantMessage([
        makeShowPlanPart(
          {
            title: "Streaming Plan",
            todos: [
              { id: "s1", label: "Step A", status: "in_progress" },
            ],
          },
          { state: "input-streaming" }
        ),
      ]),
    ];

    const { result } = renderHook(() => usePlannerState(messages));

    expect(result.current.hasSteps).toBe(true);
    expect(result.current.title).toBe("Streaming Plan");
    expect(result.current.steps[0].title).toBe("Step A");
  });

  // ────────────────────────────────────────────────────────
  // Status normalization
  // ────────────────────────────────────────────────────────

  it('status "completed" / "done" / "complete" → "completed"', () => {
    const statuses = ["completed", "done", "complete"];
    for (const status of statuses) {
      const messages: UIMessage[] = [
        makeAssistantMessage([
          makeShowPlanPart({
            todos: [{ id: "s1", label: "Step", status }],
          }),
        ]),
      ];
      const { result } = renderHook(() => usePlannerState(messages));
      expect(result.current.steps[0].status).toBe("completed");
    }
  });

  it('status "in_progress" / "doing" / "running" → "in_progress"', () => {
    const statuses = ["in_progress", "doing", "running"];
    for (const status of statuses) {
      const messages: UIMessage[] = [
        makeAssistantMessage([
          makeShowPlanPart({
            todos: [{ id: "s1", label: "Step", status }],
          }),
        ]),
      ];
      const { result } = renderHook(() => usePlannerState(messages));
      expect(result.current.steps[0].status).toBe("in_progress");
    }
  });

  it('status "error" / "failed" / "cancelled" → "error"', () => {
    const statuses = ["error", "failed", "cancelled"];
    for (const status of statuses) {
      const messages: UIMessage[] = [
        makeAssistantMessage([
          makeShowPlanPart({
            todos: [{ id: "s1", label: "Step", status }],
          }),
        ]),
      ];
      const { result } = renderHook(() => usePlannerState(messages));
      expect(result.current.steps[0].status).toBe("error");
    }
  });

  it('unknown status → "pending"', () => {
    const messages: UIMessage[] = [
      makeAssistantMessage([
        makeShowPlanPart({
          todos: [{ id: "s1", label: "Step", status: "unknown_status" }],
        }),
      ]),
    ];
    const { result } = renderHook(() => usePlannerState(messages));
    expect(result.current.steps[0].status).toBe("pending");
  });

  it('undefined status → "pending"', () => {
    const messages: UIMessage[] = [
      makeAssistantMessage([
        makeShowPlanPart({
          todos: [{ id: "s1", label: "Step" }],
        }),
      ]),
    ];
    const { result } = renderHook(() => usePlannerState(messages));
    expect(result.current.steps[0].status).toBe("pending");
  });

  // ────────────────────────────────────────────────────────
  // Edge cases
  // ────────────────────────────────────────────────────────

  it("empty todos array → EMPTY_STATE", () => {
    const messages: UIMessage[] = [
      makeAssistantMessage([
        makeShowPlanPart({ title: "Empty Plan", todos: [] }),
      ]),
    ];

    const { result } = renderHook(() => usePlannerState(messages));
    expect(result.current.hasSteps).toBe(false);
  });

  it('plan with "steps" field (not "todos") → works', () => {
    const messages: UIMessage[] = [
      makeAssistantMessage([
        makeShowPlanPart({
          title: "Steps Plan",
          steps: [
            { id: "s1", label: "Alpha", status: "completed" },
            { id: "s2", label: "Beta", status: "pending" },
          ],
        }),
      ]),
    ];

    const { result } = renderHook(() => usePlannerState(messages));
    expect(result.current.hasSteps).toBe(true);
    expect(result.current.totalSteps).toBe(2);
    expect(result.current.steps[0].title).toBe("Alpha");
  });

  it('plan with "phases" field → works', () => {
    const messages: UIMessage[] = [
      makeAssistantMessage([
        makeShowPlanPart({
          title: "Phased Plan",
          phases: [
            { id: "p1", label: "Phase 1", status: "completed" },
            { id: "p2", label: "Phase 2", status: "in_progress" },
          ],
        }),
      ]),
    ];

    const { result } = renderHook(() => usePlannerState(messages));
    expect(result.current.hasSteps).toBe(true);
    expect(result.current.totalSteps).toBe(2);
  });

  it("progress calculation: 2/5 completed → 40%", () => {
    const messages: UIMessage[] = [
      makeAssistantMessage([
        makeShowPlanPart({
          todos: [
            { id: "s1", label: "A", status: "completed" },
            { id: "s2", label: "B", status: "completed" },
            { id: "s3", label: "C", status: "in_progress" },
            { id: "s4", label: "D", status: "pending" },
            { id: "s5", label: "E", status: "pending" },
          ],
        }),
      ]),
    ];

    const { result } = renderHook(() => usePlannerState(messages));
    expect(result.current.progress).toBe(40);
    expect(result.current.completedSteps).toBe(2);
    expect(result.current.totalSteps).toBe(5);
  });

  it("all completed → progress 100%, isActive false", () => {
    const messages: UIMessage[] = [
      makeAssistantMessage([
        makeShowPlanPart({
          todos: [
            { id: "s1", label: "A", status: "completed" },
            { id: "s2", label: "B", status: "done" },
            { id: "s3", label: "C", status: "complete" },
          ],
        }),
      ]),
    ];

    const { result } = renderHook(() => usePlannerState(messages));
    expect(result.current.progress).toBe(100);
    expect(result.current.isActive).toBe(false);
  });

  it("currentStepIndex points to in_progress step", () => {
    const messages: UIMessage[] = [
      makeAssistantMessage([
        makeShowPlanPart({
          todos: [
            { id: "s1", label: "A", status: "completed" },
            { id: "s2", label: "B", status: "in_progress" },
            { id: "s3", label: "C", status: "pending" },
          ],
        }),
      ]),
    ];

    const { result } = renderHook(() => usePlannerState(messages));
    expect(result.current.currentStepIndex).toBe(1);
  });

  it("no in_progress step → currentStepIndex is last step", () => {
    const messages: UIMessage[] = [
      makeAssistantMessage([
        makeShowPlanPart({
          todos: [
            { id: "s1", label: "A", status: "completed" },
            { id: "s2", label: "B", status: "pending" },
          ],
        }),
      ]),
    ];

    const { result } = renderHook(() => usePlannerState(messages));
    // When no in_progress, findIndex returns -1, so fallback is steps.length - 1
    expect(result.current.currentStepIndex).toBe(1);
  });

  it("title uses 'goal' field as fallback", () => {
    const messages: UIMessage[] = [
      makeAssistantMessage([
        makeShowPlanPart({
          goal: "Build something amazing",
          todos: [{ id: "s1", label: "Start", status: "pending" }],
        }),
      ]),
    ];

    const { result } = renderHook(() => usePlannerState(messages));
    expect(result.current.title).toBe("Build something amazing");
  });

  it("todo with 'title' field instead of 'label' → uses title", () => {
    const messages: UIMessage[] = [
      makeAssistantMessage([
        makeShowPlanPart({
          todos: [{ id: "s1", title: "Step Title", status: "pending" }],
        }),
      ]),
    ];

    const { result } = renderHook(() => usePlannerState(messages));
    expect(result.current.steps[0].title).toBe("Step Title");
  });

  it("todo without id → generates fallback id", () => {
    const messages: UIMessage[] = [
      makeAssistantMessage([
        makeShowPlanPart({
          todos: [{ label: "No ID Step", status: "pending" }],
        }),
      ]),
    ];

    const { result } = renderHook(() => usePlannerState(messages));
    expect(result.current.steps[0].id).toBe("step-1");
  });

  it("skips user messages", () => {
    const messages: UIMessage[] = [
      {
        id: "user-1",
        role: "user",
        parts: [
          {
            type: "tool-show_plan" as any,
            toolCallId: "tc_1",
            state: "output-available",
            input: {},
            output: {
              todos: [{ id: "s1", label: "Should be ignored", status: "done" }],
            },
          } as any,
        ],
      },
    ];

    const { result } = renderHook(() => usePlannerState(messages));
    expect(result.current.hasSteps).toBe(false);
  });
});
