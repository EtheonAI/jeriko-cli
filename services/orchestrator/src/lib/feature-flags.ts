import type { FeatureFlags } from "../types/index.js";

export function getOrchestratorVersion(env: NodeJS.ProcessEnv = process.env): "python" | "node" | "shadow" {
  const value = (env.ORCHESTRATOR_VERSION ?? "node").toLowerCase();
  if (value === "python" || value === "shadow") return value;
  return "node";
}

export function isShadowMode(env: NodeJS.ProcessEnv = process.env): boolean {
  return getOrchestratorVersion(env) === "shadow";
}

export class FeatureFlagManager {
  private flags: FeatureFlags = {
    pythonExecutor: false,
    nodeExecutor: false,
    shadowMode: false,
  };

  getFlags(): FeatureFlags {
    return { ...this.flags };
  }

  isEnabled(flag: keyof FeatureFlags): boolean {
    return this.flags[flag];
  }

  enable(flag: keyof FeatureFlags): void {
    this.flags[flag] = true;
  }

  disable(flag: keyof FeatureFlags): void {
    this.flags[flag] = false;
  }

  setFlag(flag: keyof FeatureFlags, value: boolean): void {
    this.flags[flag] = value;
  }

  setFlags(flags: Partial<FeatureFlags>): void {
    Object.assign(this.flags, flags);
  }

  isPythonExecutorEnabled(): boolean {
    return this.flags.pythonExecutor;
  }

  isNodeExecutorEnabled(): boolean {
    return this.flags.nodeExecutor;
  }

  isShadowModeEnabled(): boolean {
    return this.flags.shadowMode;
  }

  reset(): void {
    this.flags = {
      pythonExecutor: false,
      nodeExecutor: false,
      shadowMode: false,
    };
  }

  static fromEnv(): FeatureFlagManager {
    const manager = new FeatureFlagManager();

    manager.setFlags({
      pythonExecutor: process.env.FEATURE_PYTHON_EXECUTOR === "true",
      nodeExecutor: process.env.FEATURE_NODE_EXECUTOR === "true",
      shadowMode: process.env.FEATURE_SHADOW_MODE === "true",
    });

    return manager;
  }

  static createWithDefaults(): FeatureFlagManager {
    const manager = new FeatureFlagManager();

    manager.setFlags({
      pythonExecutor: true,
      nodeExecutor: true,
      shadowMode: false,
    });

    return manager;
  }
}
