import { describe, it, expect, beforeEach } from "vitest";
import { ModeManager } from "../lib/mode-manager.js";

describe("ModeManager", () => {
  let manager: ModeManager;

  beforeEach(() => {
    manager = new ModeManager();
  });

  it("should start in normal mode", () => {
    expect(manager.getCurrentMode()).toBe("normal");
    expect(manager.isNormalMode()).toBe(true);
  });

  it("should enter plan mode", () => {
    manager.enterPlanMode();

    expect(manager.getCurrentMode()).toBe("plan");
    expect(manager.isPlanMode()).toBe(true);
  });

  it("should enter execute mode", () => {
    manager.enterExecuteMode();

    expect(manager.getCurrentMode()).toBe("execute");
    expect(manager.isExecuteMode()).toBe(true);
  });

  it("should track previous mode", () => {
    manager.enterPlanMode();
    manager.enterExecuteMode();

    const state = manager.getState();
    expect(state.current).toBe("execute");
    expect(state.previousMode).toBe("plan");
  });

  it("should reset to normal mode", () => {
    manager.enterPlanMode();
    manager.reset();

    expect(manager.getCurrentMode()).toBe("normal");
  });
});
