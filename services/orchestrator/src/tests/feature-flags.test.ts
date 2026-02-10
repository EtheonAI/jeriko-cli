import { describe, it, expect, beforeEach } from "vitest";
import { FeatureFlagManager } from "../lib/feature-flags.js";

describe("FeatureFlagManager", () => {
  let manager: FeatureFlagManager;

  beforeEach(() => {
    manager = new FeatureFlagManager();
  });

  it("should start with all flags disabled", () => {
    const flags = manager.getFlags();

    expect(flags.pythonExecutor).toBe(false);
    expect(flags.nodeExecutor).toBe(false);
    expect(flags.shadowMode).toBe(false);
  });

  it("should enable a flag", () => {
    manager.enable("pythonExecutor");

    expect(manager.isEnabled("pythonExecutor")).toBe(true);
  });

  it("should disable a flag", () => {
    manager.enable("pythonExecutor");
    manager.disable("pythonExecutor");

    expect(manager.isEnabled("pythonExecutor")).toBe(false);
  });

  it("should set flag value", () => {
    manager.setFlag("nodeExecutor", true);

    expect(manager.isNodeExecutorEnabled()).toBe(true);
  });

  it("should set multiple flags", () => {
    manager.setFlags({
      pythonExecutor: true,
      shadowMode: true,
    });

    expect(manager.isPythonExecutorEnabled()).toBe(true);
    expect(manager.isShadowModeEnabled()).toBe(true);
    expect(manager.isNodeExecutorEnabled()).toBe(false);
  });

  it("should reset flags", () => {
    manager.setFlags({
      pythonExecutor: true,
      nodeExecutor: true,
      shadowMode: true,
    });

    manager.reset();

    const flags = manager.getFlags();
    expect(flags.pythonExecutor).toBe(false);
    expect(flags.nodeExecutor).toBe(false);
    expect(flags.shadowMode).toBe(false);
  });

  it("should create with defaults", () => {
    const defaultManager = FeatureFlagManager.createWithDefaults();

    expect(defaultManager.isPythonExecutorEnabled()).toBe(true);
    expect(defaultManager.isNodeExecutorEnabled()).toBe(true);
    expect(defaultManager.isShadowModeEnabled()).toBe(false);
  });
});
