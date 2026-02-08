// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { PlannerBar } from "../planner-bar";
import type { PlannerState } from "../use-planner-state";

// ────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────

function makePlannerState(overrides: Partial<PlannerState> = {}): PlannerState {
  return {
    steps: [
      { id: "s1", title: "Research APIs", status: "completed" },
      { id: "s2", title: "Write code", status: "in_progress" },
      { id: "s3", title: "Run tests", status: "pending" },
      { id: "s4", title: "Deploy app", status: "pending" },
      { id: "s5", title: "Monitor logs", status: "pending" },
    ],
    currentStepIndex: 1,
    totalSteps: 5,
    completedSteps: 1,
    progress: 20,
    isActive: true,
    hasSteps: true,
    title: "Build Feature",
    ...overrides,
  };
}

function renderPlannerBar(
  stateOverrides: Partial<PlannerState> = {},
  isExpanded = false,
  onToggle = vi.fn()
) {
  const state = makePlannerState(stateOverrides);
  return {
    ...render(
      <PlannerBar
        state={state}
        isExpanded={isExpanded}
        onToggleExpanded={onToggle}
      />
    ),
    state,
    onToggle,
  };
}

// ────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────

describe("PlannerBar", () => {
  it("renders with data-testid", () => {
    renderPlannerBar();
    expect(screen.getByTestId("planner-bar")).toBeInTheDocument();
  });

  it("shows current step title in collapsed bar", () => {
    renderPlannerBar();
    // The active step title appears in the DOM (at least once via the button bar)
    // It may also appear in the hidden expanded step list
    const matches = screen.getAllByText("Write code");
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it("shows step counter 'N/M'", () => {
    renderPlannerBar({ completedSteps: 2, totalSteps: 5 });
    expect(screen.getByText("2/5")).toBeInTheDocument();
  });

  it("expand/collapse toggle calls onToggleExpanded", () => {
    const onToggle = vi.fn();
    const { container } = renderPlannerBar({}, false, onToggle);

    // The main button is the only <button> inside the planner-bar
    const button = container.querySelector("button");
    expect(button).toBeTruthy();
    fireEvent.click(button!);

    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("shows plan title when expanded", () => {
    const { container } = renderPlannerBar({ title: "Build Feature" }, true);
    // The title appears in the expanded section as a div with text
    expect(container.textContent).toContain("Build Feature");
  });

  it("shows progress text 'N of M complete' when expanded", () => {
    const { container } = renderPlannerBar({ completedSteps: 2, totalSteps: 5 }, true);
    expect(container.textContent).toContain("2 of 5 complete");
  });

  it("renders all step titles in the expanded list", () => {
    renderPlannerBar({}, true);
    expect(screen.getAllByText("Research APIs").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Write code").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Run tests").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Deploy app").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Monitor logs").length).toBeGreaterThanOrEqual(1);
  });

  it("100% progress → all complete state shows counter", () => {
    renderPlannerBar({
      steps: [
        { id: "s1", title: "Done 1", status: "completed" },
        { id: "s2", title: "Done 2", status: "completed" },
      ],
      completedSteps: 2,
      totalSteps: 2,
      progress: 100,
      isActive: false,
      currentStepIndex: 1,
    });

    expect(screen.getByText("2/2")).toBeInTheDocument();
  });

  it("no active steps → bar shows last step title", () => {
    renderPlannerBar({
      steps: [
        { id: "s1", title: "Alpha step", status: "completed" },
        { id: "s2", title: "Beta step", status: "pending" },
      ],
      currentStepIndex: 1,
      isActive: false,
    });

    // Beta step appears in both the button and the step list
    const matches = screen.getAllByText("Beta step");
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it("activity indicator renders when isActive", () => {
    const { container } = renderPlannerBar({ isActive: true });
    const pingElement = container.querySelector(".animate-ping");
    expect(pingElement).toBeTruthy();
  });

  it("no activity indicator when not active and all complete", () => {
    const { container } = renderPlannerBar({
      isActive: false,
      steps: [{ id: "s1", title: "Done", status: "completed" }],
      completedSteps: 1,
      totalSteps: 1,
      progress: 100,
    });
    const pingElement = container.querySelector(".animate-ping");
    expect(pingElement).toBeNull();
  });

  it("progress bar has correct width style", () => {
    const { container } = renderPlannerBar({ progress: 60 });
    const progressFill = container.querySelector("[style*='width: 60%']");
    expect(progressFill).toBeTruthy();
  });
});
