import { createLogger } from "../logger/index.js";
import { env } from "../env.js";

const logger = createLogger({ service: "service-client" });

export interface ServiceClientConfig {
  /** Base URL of the target service */
  baseUrl: string;
  /** Default timeout in ms (default: 10000) */
  timeout?: number;
  /** Maximum retry attempts (default: 2) */
  maxRetries?: number;
  /** Gateway secret for internal auth */
  gatewaySecret?: string;
}

/**
 * Creates an HTTP client for inter-service communication with:
 * - Automatic correlation ID propagation (x-request-id)
 * - Gateway secret authentication
 * - Configurable timeouts
 * - Retry with exponential backoff
 */
export function createServiceClient(config: ServiceClientConfig) {
  const {
    baseUrl,
    timeout = 10_000,
    maxRetries = 2,
    gatewaySecret = env.GATEWAY_SECRET,
  } = config;

  async function request<T = unknown>(
    path: string,
    options: {
      method?: string;
      body?: unknown;
      headers?: Record<string, string>;
      timeout?: number;
      requestId?: string;
      userId?: string;
    } = {},
  ): Promise<{ status: number; data: T }> {
    const {
      method = "GET",
      body,
      headers = {},
      timeout: reqTimeout = timeout,
      requestId = crypto.randomUUID(),
      userId,
    } = options;

    const url = `${baseUrl}${path}`;

    const outgoingHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      "x-request-id": requestId,
      ...headers,
    };

    if (gatewaySecret) {
      outgoingHeaders["x-gateway-secret"] = gatewaySecret;
    }

    if (userId) {
      outgoingHeaders["x-user-id"] = userId;
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          method,
          headers: outgoingHeaders,
          body: body ? JSON.stringify(body) : undefined,
          signal: AbortSignal.timeout(reqTimeout),
        });

        const data = await response.json().catch(() => null) as T;

        // Don't retry client errors (4xx)
        if (response.status >= 400 && response.status < 500) {
          return { status: response.status, data };
        }

        // Don't retry successful responses
        if (response.ok) {
          return { status: response.status, data };
        }

        // Retry server errors (5xx)
        lastError = new Error(`HTTP ${response.status}: ${url}`);
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
      }

      // Exponential backoff before retry
      if (attempt < maxRetries) {
        const delay = Math.min(100 * Math.pow(2, attempt), 2000);
        await new Promise((resolve) => setTimeout(resolve, delay));
        logger.debug({ url, attempt: attempt + 1, maxRetries }, "Retrying request");
      }
    }

    throw lastError || new Error(`Request failed: ${url}`);
  }

  return {
    get: <T = unknown>(path: string, opts?: Parameters<typeof request>[1]) =>
      request<T>(path, { ...opts, method: "GET" }),

    post: <T = unknown>(path: string, body?: unknown, opts?: Parameters<typeof request>[1]) =>
      request<T>(path, { ...opts, method: "POST", body }),

    put: <T = unknown>(path: string, body?: unknown, opts?: Parameters<typeof request>[1]) =>
      request<T>(path, { ...opts, method: "PUT", body }),

    patch: <T = unknown>(path: string, body?: unknown, opts?: Parameters<typeof request>[1]) =>
      request<T>(path, { ...opts, method: "PATCH", body }),

    delete: <T = unknown>(path: string, opts?: Parameters<typeof request>[1]) =>
      request<T>(path, { ...opts, method: "DELETE" }),
  };
}

export type ServiceClient = ReturnType<typeof createServiceClient>;
