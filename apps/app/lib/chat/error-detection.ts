// ============================================================
// Quota / Auth Error Detection
// ============================================================

const QUOTA_ERROR_CODES = new Set([
  "insufficient_quota",
  "rate_limit_exceeded",
  "billing_hard_limit_reached",
  "exceeded_current_quota_please_check_your_plan",
  "overloaded_error",
]);

const QUOTA_ERROR_PATTERNS = [
  "exceeded your current quota",
  "rate limit",
  "billing hard limit",
  "insufficient_quota",
  "overloaded",
  "credit balance is too low",
  "exceeded.*quota",
];

/** Check if a raw SSE data string contains a provider quota/auth error */
export function detectQuotaError(rawData: string): boolean {
  const lower = rawData.toLowerCase();
  for (const pattern of QUOTA_ERROR_PATTERNS) {
    if (new RegExp(pattern, "i").test(lower)) return true;
  }
  return false;
}

/** Check if an error thrown by AI SDK is a provider quota error */
export function isQuotaError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  if (detectQuotaError(msg)) return true;
  // Check for status code 429 (rate limit) or 402 (payment required)
  if (typeof err === "object" && err !== null) {
    const status = (err as Record<string, unknown>).status ?? (err as Record<string, unknown>).statusCode;
    if (status === 429 || status === 402) return true;
  }
  return false;
}

/** Extract a human-readable message from an error that may be a string or nested object */
export function extractErrorMessage(err: unknown): string {
  if (typeof err === "string") return err;
  if (typeof err === "object" && err !== null) {
    const obj = err as Record<string, unknown>;
    // { message: "..." }
    if (typeof obj.message === "string") return obj.message;
    // { error: "..." }
    if (typeof obj.error === "string") return obj.error;
    // { error: { message: "..." } }
    if (typeof obj.error === "object" && obj.error !== null) {
      const inner = obj.error as Record<string, unknown>;
      if (typeof inner.message === "string") return inner.message;
    }
    return JSON.stringify(err);
  }
  return "Unknown error";
}
