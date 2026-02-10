type Mode = "plan" | "execute" | "normal";

interface ModeState {
  current: Mode;
  previousMode?: Mode;
  transitionedAt: string;
}

export class ModeManager {
  private state: ModeState = {
    current: "normal",
    transitionedAt: new Date().toISOString(),
  };

  getCurrentMode(): Mode {
    return this.state.current;
  }

  setMode(mode: Mode): void {
    this.state.previousMode = this.state.current;
    this.state.current = mode;
    this.state.transitionedAt = new Date().toISOString();
  }

  isPlanMode(): boolean {
    return this.state.current === "plan";
  }

  isExecuteMode(): boolean {
    return this.state.current === "execute";
  }

  isNormalMode(): boolean {
    return this.state.current === "normal";
  }

  enterPlanMode(): void {
    this.setMode("plan");
  }

  enterExecuteMode(): void {
    this.setMode("execute");
  }

  enterNormalMode(): void {
    this.setMode("normal");
  }

  getState(): ModeState {
    return { ...this.state };
  }

  reset(): void {
    this.state = {
      current: "normal",
      transitionedAt: new Date().toISOString(),
    };
  }
}
