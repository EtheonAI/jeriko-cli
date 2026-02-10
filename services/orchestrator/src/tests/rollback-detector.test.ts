import { describe, expect, it } from "vitest";
import { RollbackDetector, type RollbackMetrics } from "../lib/rollback-detector.js";

describe("RollbackDetector", () => {
  const detector = new RollbackDetector();

  it("does not rollback when metrics are within thresholds", () => {
    const metrics: RollbackMetrics = {
      toolErrorRate: 0.02,
      wsReconnectFailureRate: 0.001,
      timelineGapRate: 0.0005,
      creditsMiscalculations: 0,
      p95Latency: 2500,
    };

    const result = detector.evaluateMetrics(metrics);
    expect(result.shouldRollback).toBe(false);
    expect(result.reason).toContain("within acceptable thresholds");
  });

  it("rolls back on tool error threshold breach", () => {
    const result = detector.evaluateMetrics({
      toolErrorRate: 0.08,
      wsReconnectFailureRate: 0.001,
      timelineGapRate: 0.0005,
      creditsMiscalculations: 0,
      p95Latency: 2500,
    });
    expect(result.shouldRollback).toBe(true);
    expect(result.reason).toContain("Tool error rate");
  });

  it("rolls back on websocket reconnect threshold breach", () => {
    const result = detector.evaluateMetrics({
      toolErrorRate: 0.02,
      wsReconnectFailureRate: 0.06,
      timelineGapRate: 0.0005,
      creditsMiscalculations: 0,
      p95Latency: 2500,
    });
    expect(result.shouldRollback).toBe(true);
    expect(result.reason).toContain("WS reconnect failures");
  });

  it("rolls back on timeline gap threshold breach", () => {
    const result = detector.evaluateMetrics({
      toolErrorRate: 0.02,
      wsReconnectFailureRate: 0.001,
      timelineGapRate: 0.003,
      creditsMiscalculations: 0,
      p95Latency: 2500,
    });
    expect(result.shouldRollback).toBe(true);
    expect(result.reason).toContain("Timeline event gap rate");
  });

  it("rolls back on any credit miscalculation", () => {
    const result = detector.evaluateMetrics({
      toolErrorRate: 0.02,
      wsReconnectFailureRate: 0.001,
      timelineGapRate: 0.0005,
      creditsMiscalculations: 1,
      p95Latency: 2500,
    });
    expect(result.shouldRollback).toBe(true);
    expect(result.reason).toContain("Credits miscalculation");
  });

  it("rolls back on p95 latency threshold breach", () => {
    const result = detector.evaluateMetrics({
      toolErrorRate: 0.02,
      wsReconnectFailureRate: 0.001,
      timelineGapRate: 0.0005,
      creditsMiscalculations: 0,
      p95Latency: 5000,
    });
    expect(result.shouldRollback).toBe(true);
    expect(result.reason).toContain("p95 latency");
  });

  it("uses gate priority order (tool errors before later gates)", () => {
    const result = detector.evaluateMetrics({
      toolErrorRate: 0.08,
      wsReconnectFailureRate: 0.06,
      timelineGapRate: 0.003,
      creditsMiscalculations: 5,
      p95Latency: 5000,
    });
    expect(result.shouldRollback).toBe(true);
    expect(result.reason).toContain("Tool error rate");
  });

  it("exposes baseline thresholds", () => {
    const thresholds = detector.getBaselineThresholds();
    expect(thresholds.TOOL_ERROR_RATE).toBe(0.038);
    expect(thresholds.WS_RECONNECT_FAILURE_RATE).toBe(0.003);
    expect(thresholds.TIMELINE_GAP_RATE).toBe(0.001);
    expect(thresholds.CREDITS_MISCALCULATIONS).toBe(0);
    expect(thresholds.P95_LATENCY_MS).toBe(3100);
  });
});
