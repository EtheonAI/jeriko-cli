// ============================================================
// Model Name Resolution — Agent Service Handles All API Calls
// ============================================================
//
// The @repo/ai package does NOT call LLM providers directly.
// All AI completions go through the agent service (Python FastAPI)
// which manages its own Anthropic/OpenAI/Google clients.
//
// This file provides model name constants and resolution helpers
// for passing model preferences to the agent service.
// ============================================================

/** Default model used by the agent service */
export const DEFAULT_MODEL = "claude-sonnet-4-5-20250929";

/** Model aliases the agent service understands */
export const MODEL_ALIASES: Record<string, string> = {
  fast: "claude-haiku-4-5-20251001",
  balanced: "claude-sonnet-4-5-20250929",
  powerful: "claude-opus-4-5-20251101",
  "claude-sonnet": "claude-sonnet-4-5-20250929",
  "claude-haiku": "claude-haiku-4-5-20251001",
  "claude-opus": "claude-opus-4-5-20251101",
};

/** Resolve a user-facing model alias to the canonical model ID */
export function resolveModelName(modelId?: string): string {
  if (!modelId) return DEFAULT_MODEL;
  return MODEL_ALIASES[modelId] ?? modelId;
}
