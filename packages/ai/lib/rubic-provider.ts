// ============================================================
// RubicAI — Custom AI provider that routes all completions
// through the Rubic agent microservice.
// ============================================================
//
// This is THE way to communicate with the AI backend.
// No direct OpenAI/Anthropic/Google API calls — everything
// goes through the agent service which handles:
// - Model routing (Anthropic, OpenAI, Google)
// - Tool execution (32+ tools)
// - Sandbox management (E2B)
// - Caching (3-point strategy)
// - Session context & history
// - Planning & multi-step agent loop
// ============================================================

export interface RubicAIConfig {
  /** Agent service base URL (default: AGENT_SERVICE_URL env or http://localhost:8000) */
  baseUrl?: string;
  /** Default model to use (default: claude-sonnet-4-5-20250929) */
  defaultModel?: string;
  /** Default timeout in ms (default: 600000 = 10 min) */
  timeout?: number;
  /** API key for authentication (rk_live_...) */
  apiKey?: string;
}

export interface RubicCompletionOptions {
  /** User prompt text */
  prompt?: string;
  /** Raw messages array (alternative to prompt) */
  messages?: Array<{ role: string; content: string }>;
  /** Model to use (overrides default) */
  model?: string;
  /** Enable streaming (default: true) */
  stream?: boolean;
  /** Session ID for conversation continuity */
  sessionId?: string;
  /** User ID for auth/billing */
  userId?: string;
  /** User display name */
  userName?: string;
  /** Active skills to filter available tools */
  skills?: string[];
  /** Connected app integrations */
  connections?: Array<{ id: string; name: string; type: string }>;
  /** Max tokens to generate */
  maxTokens?: number;
  /** Temperature (0-2) */
  temperature?: number;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
  /** Per-request API key (overrides client default) */
  apiKey?: string;
}

export interface RubicCompletionResult {
  content: string;
  model: string;
  usage: {
    input_tokens?: number;
    output_tokens?: number;
    cache_read_tokens?: number;
  };
  tool_calls?: Array<{
    name: string;
    input: unknown;
    result: unknown;
    is_error: boolean;
  }>;
  iterations: number;
}

export interface RubicHealthResult {
  status: string;
  service: string;
}

/**
 * RubicAI — Client for the Rubic agent microservice.
 *
 * @example
 * ```ts
 * import { createRubicAI } from "@repo/ai";
 *
 * const rubic = createRubicAI();
 *
 * // Streaming completion (returns SSE Response)
 * const response = await rubic.stream({
 *   prompt: "Build me a landing page",
 *   userId: "user-123",
 *   sessionId: "session-abc",
 * });
 *
 * // Non-streaming completion (returns parsed result)
 * const result = await rubic.complete({
 *   prompt: "What is TypeScript?",
 *   userId: "user-123",
 * });
 * console.log(result.content);
 * ```
 */
export class RubicAI {
  readonly baseUrl: string;
  readonly defaultModel: string;
  readonly timeout: number;
  readonly apiKey: string | undefined;

  constructor(config: RubicAIConfig = {}) {
    this.baseUrl = config.baseUrl
      || (typeof process !== "undefined" ? process.env?.AGENT_SERVICE_URL : undefined)
      || "http://localhost:8000";
    this.defaultModel = config.defaultModel || "claude-sonnet-4-5-20250929";
    this.timeout = config.timeout || 600_000;
    this.apiKey = config.apiKey;
  }

  /**
   * Send a streaming completion request to the agent service.
   * Returns the raw Response with SSE body for piping to the client.
   */
  async stream(options: Omit<RubicCompletionOptions, "stream">): Promise<Response> {
    return this._fetch({ ...options, stream: true });
  }

  /**
   * Send a non-streaming completion request.
   * Returns the parsed completion result.
   */
  async complete(options: Omit<RubicCompletionOptions, "stream">): Promise<RubicCompletionResult> {
    const response = await this._fetch({ ...options, stream: false });

    if (!response.ok) {
      const text = await response.text().catch(() => "Unknown error");
      throw new Error(`Agent service error (${response.status}): ${text}`);
    }

    return response.json() as Promise<RubicCompletionResult>;
  }

  /** Check agent service health */
  async health(): Promise<RubicHealthResult> {
    const resp = await fetch(`${this.baseUrl}/health`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (!resp.ok) {
      throw new Error(`Agent service unhealthy: ${resp.status}`);
    }
    return resp.json() as Promise<RubicHealthResult>;
  }

  /** Check if agent service is reachable */
  async isAvailable(): Promise<boolean> {
    try {
      await this.health();
      return true;
    } catch {
      return false;
    }
  }

  // ── Internal ──

  private async _fetch(options: RubicCompletionOptions): Promise<Response> {
    const {
      prompt,
      messages,
      model,
      stream = true,
      sessionId,
      userId = "anonymous",
      userName,
      skills,
      connections,
      maxTokens,
      temperature,
      signal,
      apiKey: requestApiKey,
    } = options;

    const effectiveApiKey = requestApiKey || this.apiKey;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-user-id": userId,
      "x-session-id": sessionId || "default",
    };
    if (effectiveApiKey) {
      headers["x-api-key"] = effectiveApiKey;
    }
    if (userName) {
      headers["x-user-name"] = userName;
    }

    return fetch(`${this.baseUrl}/v1/complete`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        prompt,
        messages,
        model: model || this.defaultModel,
        stream,
        session_id: sessionId,
        ...(skills?.length ? { skills } : {}),
        ...(connections?.length ? { connections } : {}),
        ...(maxTokens != null ? { max_tokens: maxTokens } : {}),
        ...(temperature != null ? { temperature } : {}),
      }),
      signal: signal || AbortSignal.timeout(this.timeout),
    });
  }
}

// ============================================================
// Factory Functions
// ============================================================

/** Singleton instance (lazy-created) */
let _defaultClient: RubicAI | null = null;

/**
 * Get the default RubicAI instance (singleton).
 * Pass config to create a new instance with custom settings.
 */
export function getRubicAI(config?: RubicAIConfig): RubicAI {
  if (config) {
    _defaultClient = new RubicAI(config);
  }
  if (!_defaultClient) {
    _defaultClient = new RubicAI();
  }
  return _defaultClient;
}

/**
 * Create a new RubicAI instance (always fresh).
 */
export function createRubicAI(config?: RubicAIConfig): RubicAI {
  return new RubicAI(config);
}
