export interface RollbackMetrics {
  toolErrorRate: number;
  wsReconnectFailureRate: number;
  timelineGapRate: number;
  creditsMiscalculations: number;
  p95Latency: number;
}

export interface RollbackDecision {
  shouldRollback: boolean;
  reason: string;
  metrics?: RollbackMetrics;
}

const BASELINE_THRESHOLDS = {
  TOOL_ERROR_RATE: 0.038,
  WS_RECONNECT_FAILURE_RATE: 0.003,
  TIMELINE_GAP_RATE: 0.001,
  CREDITS_MISCALCULATIONS: 0,
  P95_LATENCY_MS: 3100,
} as const;

const ROLLBACK_MULTIPLIERS = {
  TOOL_ERROR_MULTIPLIER: 2,
  WS_RECONNECT_MULTIPLIER: 16.67,
  TIMELINE_GAP_MULTIPLIER: 2,
  P95_LATENCY_MULTIPLIER: 1.5,
} as const;

export class RollbackDetector {
  evaluateMetrics(metrics: RollbackMetrics): RollbackDecision {
    const toolErrorThreshold =
      BASELINE_THRESHOLDS.TOOL_ERROR_RATE * ROLLBACK_MULTIPLIERS.TOOL_ERROR_MULTIPLIER;
    if (metrics.toolErrorRate > toolErrorThreshold) {
      return {
        shouldRollback: true,
        reason: `Tool error rate (${(metrics.toolErrorRate * 100).toFixed(2)}%) > 2x baseline (${(toolErrorThreshold * 100).toFixed(2)}%)`,
        metrics,
      };
    }

    const wsReconnectThreshold =
      BASELINE_THRESHOLDS.WS_RECONNECT_FAILURE_RATE * ROLLBACK_MULTIPLIERS.WS_RECONNECT_MULTIPLIER;
    if (metrics.wsReconnectFailureRate > wsReconnectThreshold) {
      return {
        shouldRollback: true,
        reason: `WS reconnect failures (${(metrics.wsReconnectFailureRate * 100).toFixed(2)}%) > ${(wsReconnectThreshold * 100).toFixed(2)}%`,
        metrics,
      };
    }

    const timelineGapThreshold =
      BASELINE_THRESHOLDS.TIMELINE_GAP_RATE * ROLLBACK_MULTIPLIERS.TIMELINE_GAP_MULTIPLIER;
    if (metrics.timelineGapRate > timelineGapThreshold) {
      return {
        shouldRollback: true,
        reason: `Timeline event gap rate (${(metrics.timelineGapRate * 100).toFixed(3)}%) > ${(timelineGapThreshold * 100).toFixed(3)}%`,
        metrics,
      };
    }

    if (metrics.creditsMiscalculations > BASELINE_THRESHOLDS.CREDITS_MISCALCULATIONS) {
      return {
        shouldRollback: true,
        reason: `Credits miscalculation detected: ${metrics.creditsMiscalculations} instances`,
        metrics,
      };
    }

    const p95LatencyThreshold =
      BASELINE_THRESHOLDS.P95_LATENCY_MS * ROLLBACK_MULTIPLIERS.P95_LATENCY_MULTIPLIER;
    if (metrics.p95Latency > p95LatencyThreshold) {
      return {
        shouldRollback: true,
        reason: `p95 latency (${metrics.p95Latency}ms) > ${p95LatencyThreshold}ms (${ROLLBACK_MULTIPLIERS.P95_LATENCY_MULTIPLIER}x baseline)`,
        metrics,
      };
    }

    return {
      shouldRollback: false,
      reason: "All metrics within acceptable thresholds",
      metrics,
    };
  }

  getBaselineThresholds() {
    return BASELINE_THRESHOLDS;
  }
}
