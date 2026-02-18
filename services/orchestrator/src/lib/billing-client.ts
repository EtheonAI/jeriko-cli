/**
 * Billing Service Client — used by orchestrator to check credits and meter usage.
 *
 * Calls the billing service REST API. Graceful degradation: if billing service
 * is down, operations proceed (allow by default) to avoid blocking the user.
 *
 * Metering calls use retry (2 attempts) instead of pure fire-and-forget.
 */

const BILLING_SERVICE_URL = process.env.BILLING_SERVICE_URL || "http://localhost:4008";
const BILLING_TIMEOUT = 5000; // 5s timeout for billing calls
const METER_RETRY_DELAY = 1000; // 1s delay between retry attempts

export interface CreditCheckResult {
  hasCredits: boolean;
  currentBalance: number;
  required: number;
  state: "ok" | "warning" | "soft_block" | "hard_block";
  dailyAvailable: number;
  monthlyAvailable: number;
  purchasedAvailable: number;
  starterAvailable: number;
}

export interface PlanLimits {
  maxConcurrentSessions: number;
  maxParallelSubtasks: number;
  maxScheduledTasks: number;
  maxStepsPerSession: number;
  dailyRefreshCredits: number;
  planType: string;
  planName: string;
}

/**
 * Retry helper — attempts a fetch up to `maxAttempts` times with delay between retries.
 * Used for metering calls that should not silently fail.
 */
async function withRetry(
  fn: () => Promise<Response>,
  maxAttempts: number = 2,
  delayMs: number = METER_RETRY_DELAY
): Promise<Response | null> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fn();
      if (response.ok) return response;
      // Non-retryable status codes (client error)
      if (response.status >= 400 && response.status < 500) {
        console.warn(`[billing-client] Non-retryable error: ${response.status}`);
        return response;
      }
    } catch (error) {
      if (attempt === maxAttempts) {
        console.warn(
          `[billing-client] All ${maxAttempts} attempts failed:`,
          error instanceof Error ? error.message : "unknown"
        );
        return null;
      }
    }
    if (attempt < maxAttempts) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  return null;
}

/**
 * Check if user has sufficient credits before starting a completion.
 * Returns null on billing service failure (graceful degradation — allow by default).
 */
export async function checkUserCredits(userId: string, required: number = 10): Promise<CreditCheckResult | null> {
  try {
    const response = await fetch(`${BILLING_SERVICE_URL}/credits/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, required }),
      signal: AbortSignal.timeout(BILLING_TIMEOUT),
    });

    if (!response.ok) {
      console.warn(`[billing-client] Credit check failed: ${response.status}`);
      return null;
    }

    const data = (await response.json()) as { data: CreditCheckResult };
    return data.data;
  } catch (error) {
    console.warn("[billing-client] Credit check unavailable:", error instanceof Error ? error.message : "unknown");
    return null; // Allow by default
  }
}

/**
 * Get user's plan limits (concurrent sessions, parallel subtasks, etc.).
 * Returns default free-tier limits on failure.
 */
export async function getUserLimits(userId: string): Promise<PlanLimits> {
  const defaults: PlanLimits = {
    maxConcurrentSessions: 1,
    maxParallelSubtasks: 5,
    maxScheduledTasks: 1,
    maxStepsPerSession: 15,
    dailyRefreshCredits: 300,
    planType: "free",
    planName: "Rubic Light",
  };

  try {
    const response = await fetch(`${BILLING_SERVICE_URL}/users/${userId}/plan-limits`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(BILLING_TIMEOUT),
    });

    if (!response.ok) return defaults;

    const data = (await response.json()) as { data: PlanLimits };
    return data.data;
  } catch {
    return defaults;
  }
}

/**
 * Meter a step finish (LLM completion with token usage).
 * Uses retry to ensure metering data is not lost.
 */
export function meterStep(params: {
  userId: string;
  sessionId: string;
  stepId: string;
  inputTokens?: number;
  outputTokens?: number;
  model?: string;
  metadata?: Record<string, unknown>;
}): void {
  withRetry(() =>
    fetch(`${BILLING_SERVICE_URL}/metering/step`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(BILLING_TIMEOUT),
    })
  ).catch((error) => {
    console.warn("[billing-client] Step metering failed:", error instanceof Error ? error.message : "unknown");
  });
}

/**
 * Meter a tool call.
 * Uses retry to ensure metering data is not lost.
 */
export function meterTool(params: {
  userId: string;
  sessionId: string;
  toolName: string;
  metadata?: Record<string, unknown>;
}): void {
  withRetry(() =>
    fetch(`${BILLING_SERVICE_URL}/metering/tool`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(BILLING_TIMEOUT),
    })
  ).catch((error) => {
    console.warn("[billing-client] Tool metering failed:", error instanceof Error ? error.message : "unknown");
  });
}

/**
 * Meter sandbox VM time.
 * Called when a sandbox is destroyed or cleaned up.
 * Charges 2 credits per minute of active sandbox time.
 */
export function meterVmTime(params: {
  userId: string;
  sessionId: string;
  sandboxId: string;
  durationMinutes: number;
  metadata?: Record<string, unknown>;
}): void {
  withRetry(() =>
    fetch(`${BILLING_SERVICE_URL}/metering/vm-time`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(BILLING_TIMEOUT),
    })
  ).catch((error) => {
    console.warn("[billing-client] VM time metering failed:", error instanceof Error ? error.message : "unknown");
  });
}

/**
 * Initialize credits for a new user (on first login).
 * Uses retry.
 */
export function initializeCredits(userId: string): void {
  withRetry(() =>
    fetch(`${BILLING_SERVICE_URL}/credits/initialize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
      signal: AbortSignal.timeout(BILLING_TIMEOUT),
    })
  ).catch((error) => {
    console.warn("[billing-client] Credit initialization failed:", error instanceof Error ? error.message : "unknown");
  });
}
