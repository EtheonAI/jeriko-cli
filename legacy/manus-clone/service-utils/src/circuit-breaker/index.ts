import { ServiceUnavailableError } from "../errors/index.js";

type CircuitState = "closed" | "open" | "half-open";

export interface CircuitBreakerConfig {
  /** Number of failures before opening the circuit (default: 5) */
  failureThreshold?: number;
  /** Time in ms to wait before allowing a probe request (default: 30000) */
  resetTimeoutMs?: number;
  /** Window in ms to count failures (default: 60000) */
  failureWindowMs?: number;
  /** Called when circuit state changes */
  onStateChange?: (from: CircuitState, to: CircuitState, serviceName: string) => void;
}

/**
 * Circuit breaker for protecting upstream service calls.
 *
 * Uses a sliding window counter (not an array of timestamps) to avoid
 * unbounded memory growth under high traffic.
 *
 * States:
 * - CLOSED: requests flow normally, failures are counted
 * - OPEN: requests immediately fail with 503, no upstream calls
 * - HALF-OPEN: one probe request allowed; if it succeeds → CLOSED, if it fails → OPEN
 */
export class CircuitBreaker {
  private state: CircuitState = "closed";
  private failureCount = 0;
  private windowStart = Date.now();
  private lastFailureTime = 0;
  private halfOpenInFlight = false;

  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;
  private readonly failureWindowMs: number;
  private readonly onStateChange?: CircuitBreakerConfig["onStateChange"];
  public readonly serviceName: string;

  // Metrics
  private totalRequests = 0;
  private totalFailures = 0;
  private totalRejected = 0;

  constructor(serviceName: string, config: CircuitBreakerConfig = {}) {
    this.serviceName = serviceName;
    this.failureThreshold = config.failureThreshold ?? 5;
    this.resetTimeoutMs = config.resetTimeoutMs ?? 30_000;
    this.failureWindowMs = config.failureWindowMs ?? 60_000;
    this.onStateChange = config.onStateChange;
  }

  /**
   * Execute a function through the circuit breaker.
   * Throws ServiceUnavailableError if the circuit is open.
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.totalRequests++;

    if (this.state === "open") {
      // Check if reset timeout has elapsed → transition to half-open
      if (Date.now() - this.lastFailureTime >= this.resetTimeoutMs) {
        this.transition("half-open");
      } else {
        this.totalRejected++;
        throw new ServiceUnavailableError(
          `Service '${this.serviceName}' is temporarily unavailable (circuit open)`
        );
      }
    }

    // In half-open state, only allow one probe request at a time
    if (this.state === "half-open") {
      if (this.halfOpenInFlight) {
        this.totalRejected++;
        throw new ServiceUnavailableError(
          `Service '${this.serviceName}' is recovering (circuit half-open, probe in flight)`
        );
      }
      this.halfOpenInFlight = true;
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.halfOpenInFlight = false;
    if (this.state !== "closed") {
      this.transition("closed");
    }
    this.failureCount = 0;
    this.windowStart = Date.now();
  }

  private onFailure(): void {
    this.halfOpenInFlight = false;
    this.totalFailures++;
    const now = Date.now();
    this.lastFailureTime = now;

    // If the current window has expired, start a new one
    if (now - this.windowStart >= this.failureWindowMs) {
      this.failureCount = 1;
      this.windowStart = now;
    } else {
      this.failureCount++;
    }

    // Open circuit if threshold exceeded
    if (this.failureCount >= this.failureThreshold || this.state === "half-open") {
      this.transition("open");
    }
  }

  private transition(to: CircuitState): void {
    if (this.state === to) return;
    const from = this.state;
    this.state = to;
    this.onStateChange?.(from, to, this.serviceName);
  }

  /** Current circuit state */
  getState(): CircuitState {
    return this.state;
  }

  /** Get circuit breaker stats */
  getStats() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      totalRequests: this.totalRequests,
      totalFailures: this.totalFailures,
      totalRejected: this.totalRejected,
      lastFailureTime: this.lastFailureTime || null,
    };
  }

  /** Reset the circuit breaker */
  reset(): void {
    this.state = "closed";
    this.failureCount = 0;
    this.windowStart = Date.now();
    this.lastFailureTime = 0;
    this.halfOpenInFlight = false;
  }
}
