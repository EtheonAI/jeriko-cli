/**
 * E2B Sandbox lifecycle manager.
 * Creates, caches, and cleans up sandbox instances per session.
 *
 * Follows the Manus pattern exactly:
 * - Each sandbox gets a unique proxy token with sk- prefix (mimics OpenAI key format)
 * - Token is set as OPENAI_API_KEY inside the sandbox
 * - OPENAI_BASE_URL points to our LLM proxy (never directly to OpenAI)
 * - The real OPENAI_API_KEY NEVER enters the sandbox
 * - Token is also written to ~/.secrets/sandbox_api_token
 * - The LLM proxy validates the token and forwards to OpenAI with the server-side real key
 */

import crypto from "node:crypto";

const SANDBOX_SERVICE_URL = process.env.SANDBOX_SERVICE_URL || 'http://localhost:4012';

// LLM proxy URL — injected into sandboxes as OPENAI_BASE_URL.
// Must be reachable from inside E2B sandboxes.
// In prod: https://api.rubic.ai/api/llm-proxy/v1
// In dev: expose orchestrator via tunnel (ngrok, cloudflare tunnel, etc.)
const LLM_PROXY_URL = process.env.LLM_PROXY_URL || '';

// Code-server domain for port proxy URLs (Manus pattern: us2.manus.computer)
const CODE_SERVER_DOMAIN = process.env.CODE_SERVER_DOMAIN || '';

// Forge API for webdev projects (separate from LLM proxy)
const FORGE_API_URL = process.env.FORGE_API_URL || '';
const FORGE_API_KEY = process.env.FORGE_API_KEY || '';
const FORGE_FRONTEND_API_KEY = process.env.FORGE_FRONTEND_API_KEY || '';

interface SandboxInfo {
  sandboxId: string;
  e2bSandboxId: string | null;
  nekoUrl: string | null;
  proxyToken: string | null;
  codeServerPassword: string | null;
  databaseName: string | null;
  createdAt: number;
  lastUsedAt: number;
}

// In-memory sandbox cache keyed by sessionId
const sandboxCache = new Map<string, SandboxInfo>();

// Proxy token → sandbox info map for LLM proxy validation
const proxyTokenMap = new Map<string, { sandboxId: string; userId: string; sessionId: string; createdAt: number }>();

// Sandbox idle timeout: 15 minutes
const IDLE_TIMEOUT_MS = 15 * 60 * 1000;

export interface SandboxResult {
  sandboxId: string;
  e2bSandboxId: string | null;
  nekoUrl: string | null;
}

/**
 * Generate a unique per-sandbox proxy token.
 * Uses sk- prefix to mimic OpenAI API key format (Manus pattern).
 * This ensures seamless compatibility with OpenAI SDK — the SDK
 * reads OPENAI_API_KEY from env and passes it in Authorization header.
 */
function generateProxyToken(): string {
  return `sk-rubic-${crypto.randomBytes(20).toString("base64url")}`;
}

/**
 * Validate a proxy token from the LLM proxy endpoint.
 * Returns sandbox/user info or null if invalid.
 */
export function validateProxyToken(token: string): { sandboxId: string; userId: string; sessionId: string } | null {
  const info = proxyTokenMap.get(token);
  if (!info) return null;
  return { sandboxId: info.sandboxId, userId: info.userId, sessionId: info.sessionId };
}

/**
 * Get or create a sandbox for a session.
 * Returns the sandbox ID and Neko WebRTC stream URL (if desktop template).
 *
 * Proxy token flow:
 * - Generates a unique proxy token per sandbox
 * - Passes it as OPENAI_API_KEY in config.env to sandbox service
 * - Sets OPENAI_BASE_URL to our LLM proxy (or OpenAI directly in dev)
 * - Stores token for validation by the LLM proxy endpoint
 */
export async function getOrCreateSandbox(
  sessionId: string,
  userId: string,
): Promise<SandboxResult> {
  const cached = sandboxCache.get(sessionId);
  if (cached) {
    cached.lastUsedAt = Date.now();
    return {
      sandboxId: cached.sandboxId,
      e2bSandboxId: cached.e2bSandboxId,
      nekoUrl: cached.nekoUrl
    };
  }

  // Generate proxy token for this sandbox (Manus pattern: sk- prefix)
  // The real OPENAI_API_KEY NEVER enters the sandbox.
  const proxyToken = generateProxyToken();

  // Build env vars to inject into sandbox — exactly like Manus Layer 4
  const env: Record<string, string> = {};
  env.OPENAI_API_KEY = proxyToken;
  if (LLM_PROXY_URL) {
    env.OPENAI_BASE_URL = LLM_PROXY_URL;
    env.OPENAI_API_BASE = LLM_PROXY_URL; // Legacy compat (OpenAI Python SDK v0.x)
    // Derive upload URL from LLM proxy URL (same host, /api/upload/presign path)
    const uploadUrl = LLM_PROXY_URL.replace(/\/llm-proxy\/v1$/, '/upload/presign');
    env.RUBIC_UPLOAD_URL = uploadUrl;
  }

  // Code-server password — generated per sandbox (Manus pattern: random per session)
  const codeServerPassword = crypto.randomBytes(8).toString("hex");
  env.CODE_SERVER_PASSWORD = codeServerPassword;
  env.CODE_SERVER_PORT = "8329";
  if (CODE_SERVER_DOMAIN) {
    env.CODE_SERVER_DOMAIN = CODE_SERVER_DOMAIN;
  }

  // Forge API keys for webdev projects (separate from sandbox LLM proxy)
  if (FORGE_API_KEY) {
    env.BUILT_IN_FORGE_API_KEY = FORGE_API_KEY;
    env.BUILT_IN_FORGE_API_URL = FORGE_API_URL || LLM_PROXY_URL.replace(/\/llm-proxy\/v1$/, '/forge');
  }
  if (FORGE_FRONTEND_API_KEY) {
    env.VITE_FRONTEND_FORGE_API_KEY = FORGE_FRONTEND_API_KEY;
    env.VITE_FRONTEND_FORGE_API_URL = FORGE_API_URL || LLM_PROXY_URL.replace(/\/llm-proxy\/v1$/, '/forge');
  }

  // Create via sandbox service — defaults to 'desktop' template (Neko WebRTC)
  const resp = await fetch(`${SANDBOX_SERVICE_URL}/sandboxes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': userId,
    },
    body: JSON.stringify({
      sessionId,
      template: process.env.E2B_TEMPLATE || 'desktop',
      config: { env },
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!resp.ok) {
    const detail = await resp.text();
    throw new Error(`Failed to create sandbox: ${resp.status} ${detail}`);
  }

  const data = (await resp.json()) as {
    data?: { sandboxId?: string; id?: string; e2bSandboxId?: string; nekoUrl?: string; vncUrl?: string };
  };
  const sandboxId = data.data?.sandboxId || data.data?.id;
  const e2bSandboxId = data.data?.e2bSandboxId || null;
  const nekoUrl = data.data?.nekoUrl || null;

  if (!sandboxId) {
    throw new Error('Sandbox service returned no sandbox ID');
  }

  // Register proxy token for LLM proxy validation
  proxyTokenMap.set(proxyToken, {
    sandboxId,
    userId,
    sessionId,
    createdAt: Date.now(),
  });

  sandboxCache.set(sessionId, {
    sandboxId,
    e2bSandboxId,
    nekoUrl,
    proxyToken,
    codeServerPassword,
    databaseName: null,
    createdAt: Date.now(),
    lastUsedAt: Date.now(),
  });

  return { sandboxId, e2bSandboxId, nekoUrl };
}

/**
 * Get sandbox info for a session if one exists.
 */
export function getSandboxInfo(sessionId: string): SandboxResult | undefined {
  const cached = sandboxCache.get(sessionId);
  if (!cached) return undefined;
  return { sandboxId: cached.sandboxId, e2bSandboxId: cached.e2bSandboxId, nekoUrl: cached.nekoUrl };
}

/**
 * Get full sandbox details including code-server password.
 * Used by code-server pre-auth endpoint.
 */
export function getSandboxDetails(sessionId: string): {
  sandboxId: string;
  nekoUrl: string | null;
  proxyToken: string | null;
  codeServerPassword: string | null;
} | undefined {
  const cached = sandboxCache.get(sessionId);
  if (!cached) return undefined;
  return {
    sandboxId: cached.sandboxId,
    nekoUrl: cached.nekoUrl,
    proxyToken: cached.proxyToken,
    codeServerPassword: cached.codeServerPassword,
  };
}

/**
 * Set the per-project database name for a sandbox session.
 */
export function setSandboxDatabaseName(sessionId: string, dbName: string): void {
  const cached = sandboxCache.get(sessionId);
  if (cached) cached.databaseName = dbName;
}

/**
 * Get the per-project database name for a sandbox session.
 */
export function getSandboxDatabaseName(sessionId: string): string | null {
  return sandboxCache.get(sessionId)?.databaseName ?? null;
}

/**
 * Reverse lookup: find session ID by sandbox ID.
 * Used by webdev init to associate database name with session.
 */
export function getSessionIdBySandboxId(sandboxId: string): string | null {
  for (const [sessionId, info] of sandboxCache) {
    if (info.sandboxId === sandboxId) return sessionId;
  }
  return null;
}

// Database cleanup callback — registered by webdev.ts to avoid circular imports
let dbCleanupFn: ((dbName: string) => Promise<void>) | null = null;

export function registerDatabaseCleanup(fn: (dbName: string) => Promise<void>): void {
  dbCleanupFn = fn;
}

/**
 * Destroy a sandbox for a session.
 * Cleans up the proxy token from the validation map.
 * If a per-project database was created, drops it via the registered cleanup callback.
 */
export async function destroySandbox(sessionId: string): Promise<void> {
  const cached = sandboxCache.get(sessionId);
  if (!cached) return;

  // Clean up proxy token
  if (cached.proxyToken) {
    proxyTokenMap.delete(cached.proxyToken);
  }

  // Clean up per-project database
  if (cached.databaseName && dbCleanupFn) {
    await dbCleanupFn(cached.databaseName).catch(() => {});
  }

  sandboxCache.delete(sessionId);

  try {
    await fetch(`${SANDBOX_SERVICE_URL}/sandboxes/${cached.sandboxId}`, {
      method: 'DELETE',
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    // Best-effort cleanup
  }
}

/**
 * Clean up idle sandboxes. Call periodically.
 */
export async function cleanupIdleSandboxes(): Promise<number> {
  const now = Date.now();
  let cleaned = 0;

  for (const [sessionId, info] of sandboxCache) {
    if (now - info.lastUsedAt > IDLE_TIMEOUT_MS) {
      await destroySandbox(sessionId);
      cleaned++;
    }
  }

  return cleaned;
}

/**
 * Start periodic cleanup (every 5 minutes)
 */
let cleanupInterval: ReturnType<typeof setInterval> | null = null;

export function startCleanupLoop(): void {
  if (cleanupInterval) return;
  cleanupInterval = setInterval(() => {
    cleanupIdleSandboxes().catch(() => {});
  }, 5 * 60 * 1000);
}

export function stopCleanupLoop(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}

/**
 * Get active sandbox count (for health checks)
 */
export function getActiveSandboxCount(): number {
  return sandboxCache.size;
}

/**
 * Register a proxy token for testing purposes.
 * Only use in tests — in production, tokens are generated by getOrCreateSandbox().
 */
export function registerTestProxyToken(
  token: string,
  info: { sandboxId: string; userId: string; sessionId: string },
): void {
  proxyTokenMap.set(token, { ...info, createdAt: Date.now() });
}
