import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ────────────────────────────────────────────────────────
// Service Timeout Resilience Tests
//
// Validates behavior when upstream services (agent, gateway,
// database) time out or become unreachable. Tests abort
// controller patterns, error classification, and retry logic.
// ────────────────────────────────────────────────────────

describe("Service Timeout Resilience", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("AbortController cancels fetch after timeout", async () => {
    vi.useRealTimers(); // Need real timers for AbortController

    const controller = new AbortController();
    const timeoutMs = 100;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const slowFetch = new Promise((_resolve, reject) => {
      controller.signal.addEventListener("abort", () => {
        reject(new DOMException("The operation was aborted", "AbortError"));
      });
      // Never resolves -- simulates a request that hangs indefinitely
    });

    await expect(slowFetch).rejects.toThrow("The operation was aborted");
    clearTimeout(timeoutId);
  });

  it("AbortController abortReason provides context", async () => {
    vi.useRealTimers();

    const controller = new AbortController();
    const reason = new Error("Agent service timeout after 30s");
    setTimeout(() => controller.abort(reason), 50);

    const result = await new Promise<Error>((resolve) => {
      controller.signal.addEventListener("abort", () => {
        resolve(controller.signal.reason as Error);
      });
    });

    expect(result.message).toBe("Agent service timeout after 30s");
  });

  it("handles ETIMEDOUT-style network errors", () => {
    const error = new Error("connect ETIMEDOUT 10.0.0.1:8000");
    (error as NodeJS.ErrnoException).code = "ETIMEDOUT";

    expect(error.message).toContain("ETIMEDOUT");
    expect((error as NodeJS.ErrnoException).code).toBe("ETIMEDOUT");

    // Verify it can be distinguished from other network errors
    const econnError = new Error("connect ECONNREFUSED 127.0.0.1:8000");
    (econnError as NodeJS.ErrnoException).code = "ECONNREFUSED";
    expect((econnError as NodeJS.ErrnoException).code).not.toBe("ETIMEDOUT");
  });

  it("retryable errors are correctly identified", () => {
    const retryableCodes = [
      "ETIMEDOUT",
      "ECONNRESET",
      "ECONNREFUSED",
      "EPIPE",
      "EAI_AGAIN",
    ];
    const nonRetryableCodes = [
      "ENOTFOUND",
      "ERR_INVALID_URL",
      "CERT_HAS_EXPIRED",
    ];

    // Helper that mirrors what a retry utility would do
    function isRetryable(code: string): boolean {
      return retryableCodes.includes(code);
    }

    // All retryable codes should be identified
    for (const code of retryableCodes) {
      expect(isRetryable(code)).toBe(true);
    }

    // Non-retryable codes should be rejected
    for (const code of nonRetryableCodes) {
      expect(isRetryable(code)).toBe(false);
    }
  });

  it("exponential backoff produces correct delays", () => {
    // Simulates the backoff pattern used in agent-proxy retry logic
    function calculateBackoff(
      attempt: number,
      baseMs: number,
      maxMs: number,
      jitterFactor: number
    ): number {
      const exponentialDelay = baseMs * Math.pow(2, attempt);
      const capped = Math.min(exponentialDelay, maxMs);
      const jitter = capped * jitterFactor * Math.random();
      return capped + jitter;
    }

    // Attempt 0: baseMs * 2^0 = 1000
    const delay0 = calculateBackoff(0, 1000, 30000, 0);
    expect(delay0).toBe(1000);

    // Attempt 3: baseMs * 2^3 = 8000
    const delay3 = calculateBackoff(3, 1000, 30000, 0);
    expect(delay3).toBe(8000);

    // Attempt 10: should be capped at maxMs
    const delay10 = calculateBackoff(10, 1000, 30000, 0);
    expect(delay10).toBe(30000);

    // With jitter, delay should be >= base but < base + base*jitter
    const delayJittered = calculateBackoff(0, 1000, 30000, 0.5);
    expect(delayJittered).toBeGreaterThanOrEqual(1000);
    expect(delayJittered).toBeLessThanOrEqual(1500);
  });

  it("timeout wrapper rejects after specified duration", async () => {
    vi.useRealTimers();

    function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error(`Operation timed out after ${ms}ms`)),
          ms
        );
        promise.then(
          (val) => {
            clearTimeout(timer);
            resolve(val);
          },
          (err) => {
            clearTimeout(timer);
            reject(err);
          }
        );
      });
    }

    // Fast operation should succeed
    const fast = withTimeout(Promise.resolve("ok"), 1000);
    await expect(fast).resolves.toBe("ok");

    // Slow operation should timeout
    const neverResolves = new Promise(() => {});
    const slow = withTimeout(neverResolves, 50);
    await expect(slow).rejects.toThrow("Operation timed out after 50ms");
  });

  it("circuit breaker pattern prevents cascading failures", async () => {
    vi.useRealTimers();

    // Simple circuit breaker implementation for testing
    class CircuitBreaker {
      private failures = 0;
      private lastFailureTime = 0;
      private state: "closed" | "open" | "half-open" = "closed";

      constructor(
        private threshold: number,
        private resetTimeMs: number
      ) {}

      async call<T>(fn: () => Promise<T>): Promise<T> {
        if (this.state === "open") {
          if (Date.now() - this.lastFailureTime > this.resetTimeMs) {
            this.state = "half-open";
          } else {
            throw new Error("Circuit breaker is OPEN");
          }
        }

        try {
          const result = await fn();
          this.onSuccess();
          return result;
        } catch (err) {
          this.onFailure();
          throw err;
        }
      }

      private onSuccess() {
        this.failures = 0;
        this.state = "closed";
      }

      private onFailure() {
        this.failures++;
        this.lastFailureTime = Date.now();
        if (this.failures >= this.threshold) {
          this.state = "open";
        }
      }

      getState() {
        return this.state;
      }
    }

    const breaker = new CircuitBreaker(3, 100);
    const failingService = () =>
      Promise.reject(new Error("Service unavailable"));

    // First 3 calls fail but circuit stays closed
    for (let i = 0; i < 3; i++) {
      await expect(breaker.call(failingService)).rejects.toThrow(
        "Service unavailable"
      );
    }

    // Circuit is now open -- should reject immediately without calling service
    expect(breaker.getState()).toBe("open");
    await expect(breaker.call(failingService)).rejects.toThrow(
      "Circuit breaker is OPEN"
    );

    // Wait for reset time
    await new Promise((r) => setTimeout(r, 150));

    // Circuit should be half-open, next success closes it
    const successService = () => Promise.resolve("recovered");
    const result = await breaker.call(successService);
    expect(result).toBe("recovered");
    expect(breaker.getState()).toBe("closed");
  });

  it("concurrent timeout handling does not cause resource leaks", async () => {
    vi.useRealTimers();

    const activeTimers: Set<ReturnType<typeof setTimeout>> = new Set();

    function trackedTimeout(ms: number): {
      promise: Promise<void>;
      cancel: () => void;
    } {
      let timer: ReturnType<typeof setTimeout>;
      let rejectFn: (err: Error) => void;
      const promise = new Promise<void>((_resolve, reject) => {
        rejectFn = reject;
        timer = setTimeout(() => {
          activeTimers.delete(timer);
          reject(new Error("timeout"));
        }, ms);
        activeTimers.add(timer);
      });

      // Attach a no-op catch so the rejection is always handled,
      // preventing "unhandled rejection" warnings in Vitest.
      promise.catch(() => {});

      return {
        promise,
        cancel: () => {
          clearTimeout(timer!);
          activeTimers.delete(timer!);
        },
      };
    }

    // Start 10 concurrent timeouts
    const timeouts = Array.from({ length: 10 }, (_, i) =>
      trackedTimeout(50 + i * 10)
    );

    expect(activeTimers.size).toBe(10);

    // Cancel half of them
    for (let i = 0; i < 5; i++) {
      timeouts[i]!.cancel();
    }
    expect(activeTimers.size).toBe(5);

    // Wait for the remaining 5 to fire (last one at 50 + 9*10 = 140ms)
    await new Promise((r) => setTimeout(r, 200));
    expect(activeTimers.size).toBe(0);
  });
});
