import type { ShadowMetrics } from "../types/index.js";

export class ShadowMetricsCollector {
  private metrics: ShadowMetrics = {
    planToolCalls: 0,
    scheduleToolCalls: 0,
    contextSize: 0,
    skillsLoaded: 0,
    timestamp: new Date().toISOString(),
  };

  getMetrics(): ShadowMetrics {
    return { ...this.metrics };
  }

  incrementPlanToolCalls(): void {
    this.metrics.planToolCalls++;
    this.updateTimestamp();
  }

  incrementScheduleToolCalls(): void {
    this.metrics.scheduleToolCalls++;
    this.updateTimestamp();
  }

  setContextSize(size: number): void {
    this.metrics.contextSize = size;
    this.updateTimestamp();
  }

  setSkillsLoaded(count: number): void {
    this.metrics.skillsLoaded = count;
    this.updateTimestamp();
  }

  increment(metric: keyof Omit<ShadowMetrics, "timestamp">): void {
    if (typeof this.metrics[metric] === "number") {
      (this.metrics[metric] as number)++;
      this.updateTimestamp();
    }
  }

  set(metric: keyof Omit<ShadowMetrics, "timestamp">, value: number): void {
    this.metrics[metric] = value;
    this.updateTimestamp();
  }

  private updateTimestamp(): void {
    this.metrics.timestamp = new Date().toISOString();
  }

  reset(): void {
    this.metrics = {
      planToolCalls: 0,
      scheduleToolCalls: 0,
      contextSize: 0,
      skillsLoaded: 0,
      timestamp: new Date().toISOString(),
    };
  }

  toJSON(): string {
    return JSON.stringify(this.metrics, null, 2);
  }

  static fromMetrics(metrics: Partial<ShadowMetrics>): ShadowMetricsCollector {
    const collector = new ShadowMetricsCollector();
    Object.assign(collector.metrics, metrics);
    collector.updateTimestamp();
    return collector;
  }
}
