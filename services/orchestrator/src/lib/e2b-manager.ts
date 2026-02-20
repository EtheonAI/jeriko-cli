/**
 * E2B Sandbox lifecycle manager.
 * Creates, caches, and cleans up sandbox instances per session.
 *
 * Follows the Manus pattern:
 * - One sandbox per task (session). Sandbox hibernates on inactivity, wakes on demand.
 * - Retention: Free users = 7 days, Pro users = 21 days (Manus parity).
 * - On sandbox death/recycle, a new sandbox is created and files restored from S3 / message history.
 * - Each sandbox gets a unique proxy token with sk- prefix (mimics OpenAI key format)
 * - Token is set as OPENAI_API_KEY inside the sandbox
 * - OPENAI_BASE_URL points to our LLM proxy (never directly to OpenAI)
 * - The real OPENAI_API_KEY NEVER enters the sandbox
 * - Token is also written to ~/.secrets/sandbox_api_token
 * - The LLM proxy validates the token and forwards to OpenAI with the server-side real key
 *
 * Recovery flow (Manus parity):
 * 1. Check in-memory cache → if healthy, return
 * 2. Check session metadata for stored sandboxId → try resume via sandbox service
 * 3. If resume succeeds (sandbox still alive at E2B), cache and return (filesystem intact)
 * 4. If resume fails (sandbox recycled), create new sandbox → file restore handled by agent-loop
 */

import crypto from "node:crypto";
import { getRsaHeaders } from "./rsa-auth.js";
import { meterVmTime } from "./billing-client.js";

const SANDBOX_SERVICE_URL = process.env.SANDBOX_SERVICE_URL || "http://localhost:4012";

// LOCAL_SANDBOX_URL — override for local testing against a Docker sandbox.
// When set, skips E2B sandbox creation and routes all tool calls to this URL.
// Example: LOCAL_SANDBOX_URL=http://localhost:8330
const LOCAL_SANDBOX_URL = process.env.LOCAL_SANDBOX_URL || "";

// LLM proxy URL — injected into sandboxes as OPENAI_BASE_URL.
// Must be reachable from inside E2B sandboxes.
// In prod: https://api.rubic.ai/api/llm-proxy/v1
// In dev: expose orchestrator via tunnel (ngrok, cloudflare tunnel, etc.)
const LLM_PROXY_URL = process.env.LLM_PROXY_URL || "";

// Code-server domain for port proxy URLs (Manus pattern: us2.manus.computer)
const CODE_SERVER_DOMAIN = process.env.CODE_SERVER_DOMAIN || "";

// Orchestrator URL — injected into sandboxes so they can call back for apiproxy, upload, etc.
// Must be reachable from inside E2B sandboxes.
// In prod: https://api.rubic.ai (or orchestrator.rubic.ai)
// In dev: expose via tunnel or use host.docker.internal
const ORCHESTRATOR_URL = process.env.ORCHESTRATOR_URL || "";

// Forge API for webdev projects (separate from LLM proxy)
const FORGE_API_URL = process.env.FORGE_API_URL || "";
const FORGE_API_KEY = process.env.FORGE_API_KEY || "";
const FORGE_FRONTEND_API_KEY = process.env.FORGE_FRONTEND_API_KEY || "";

interface SandboxInfo {
  sandboxId: string;
  e2bSandboxId: string | null;
  nekoUrl: string | null;
  proxyToken: string | null;
  codeServerPassword: string | null;
  databaseName: string | null;
  projectPath: string | null;
  userId: string;
  createdAt: number;
  lastUsedAt: number;
}

// In-memory sandbox cache keyed by sessionId
const sandboxCache = new Map<string, SandboxInfo>();

// Proxy token → sandbox info map for LLM proxy validation
const proxyTokenMap = new Map<
  string,
  { sandboxId: string; userId: string; sessionId: string; createdAt: number }
>();

// Sandbox idle timeout for orchestrator cache eviction (15 minutes).
// NOTE: The E2B sandbox itself lives longer (SANDBOX_TIMEOUT_MS) — it auto-hibernates
// and can be resumed via the sandbox service's /resume endpoint.
const IDLE_TIMEOUT_MS = 15 * 60 * 1000;

// Health check interval: only ping /healthz if sandbox hasn't been used in >2 min
const HEALTH_CHECK_INTERVAL_MS = 2 * 60 * 1000;

// E2B sandbox timeout (Manus: hibernation-based, survives for days).
// Default 1 hour of active compute. E2B auto-hibernates on inactivity and
// can be resumed later if within the retention window.
// Free users: 7 days retention. Pro users: 21 days retention.
const SANDBOX_TIMEOUT_MS = parseInt(
  process.env.SANDBOX_TIMEOUT_MS || String(60 * 60 * 1000),
  10
);

// Retention periods (Manus parity: Free=7d, Pro=21d)
// These control how long session sandbox data persists for recovery.
export const SANDBOX_RETENTION = {
  free: 7 * 24 * 60 * 60 * 1000,  // 7 days
  pro: 21 * 24 * 60 * 60 * 1000,  // 21 days
};

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
export function validateProxyToken(
  token: string
): { sandboxId: string; userId: string; sessionId: string } | null {
  const info = proxyTokenMap.get(token);
  if (!info) return null;
  return { sandboxId: info.sandboxId, userId: info.userId, sessionId: info.sessionId };
}

/**
 * Get or create a sandbox for a session.
 * Returns the sandbox ID and Neko WebRTC stream URL (if desktop template).
 *
 * Recovery flow (Manus parity):
 * 1. Check in-memory cache → if healthy, return
 * 2. If cache miss + sessionMeta has sandboxId → try resume via sandbox service
 * 3. If resume succeeds, filesystem intact (E2B hibernate/wake). Cache and return.
 * 4. If resume fails, create new sandbox. File restore handled by agent-loop (fileContext).
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
  sessionMeta?: Record<string, unknown>
): Promise<SandboxResult> {
  const cached = sandboxCache.get(sessionId);
  if (cached) {
    // Health check for sandboxes that haven't been used recently.
    // Detects dead E2B sandboxes (timeout, crash) and evicts so a new one is created.
    const timeSinceLastUse = Date.now() - cached.lastUsedAt;
    if (timeSinceLastUse > HEALTH_CHECK_INTERVAL_MS && cached.e2bSandboxId) {
      const healthUrl = `${buildTerminalServerUrl(cached.e2bSandboxId)}/healthz`;
      try {
        const resp = await fetch(healthUrl, { signal: AbortSignal.timeout(3000) });
        if (!resp.ok) throw new Error("unhealthy");
      } catch {
        // Sandbox is dead — evict from cache and fall through to resume/create
        console.log(
          `[e2b-manager] Dead sandbox detected for session=${sessionId} (sandbox=${cached.sandboxId}), will try resume/recreate`
        );
        if (cached.proxyToken) proxyTokenMap.delete(cached.proxyToken);
        sandboxCache.delete(sessionId);
      }
    }

    // Re-check cache (may have been evicted by health check)
    const stillCached = sandboxCache.get(sessionId);
    if (stillCached) {
      stillCached.lastUsedAt = Date.now();
      return {
        sandboxId: stillCached.sandboxId,
        e2bSandboxId: stillCached.e2bSandboxId,
        nekoUrl: stillCached.nekoUrl,
      };
    }
  }

  // LOCAL_SANDBOX_URL shortcut — skip E2B entirely, use local Docker container.
  // Used for testing the full agent loop against a local sandbox runtime.
  if (LOCAL_SANDBOX_URL) {
    const localId = `local-${sessionId}`;
    const proxyToken = generateProxyToken();
    proxyTokenMap.set(proxyToken, { sandboxId: localId, userId, sessionId, createdAt: Date.now() });
    sandboxCache.set(sessionId, {
      sandboxId: localId,
      e2bSandboxId: null,
      nekoUrl: null,
      proxyToken,
      codeServerPassword: null,
      databaseName: null,
      projectPath: null,
      userId,
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
    });
    console.log(
      `[e2b-manager] Using LOCAL_SANDBOX_URL=${LOCAL_SANDBOX_URL} for session=${sessionId}`
    );
    return { sandboxId: localId, e2bSandboxId: null, nekoUrl: null };
  }

  // ── Step 2: Try to resume existing sandbox from session metadata ──
  // When the orchestrator restarts or the cache is evicted, the sandboxId
  // is still stored in agentSessions.metadata. Try to reconnect to the
  // E2B sandbox — if it's still alive (hibernated), the filesystem is intact.
  const storedSandboxId = sessionMeta?.sandboxId as string | undefined;
  if (storedSandboxId) {
    try {
      const resumeResp = await fetch(`${SANDBOX_SERVICE_URL}/sandboxes/${storedSandboxId}/resume`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(15000),
      });

      if (resumeResp.ok) {
        const resumeData = (await resumeResp.json()) as {
          data?: {
            id?: string;
            sandboxId?: string;
            e2bSandboxId?: string;
            nekoUrl?: string;
            status?: string;
          };
        };

        const resumedId = resumeData.data?.sandboxId || resumeData.data?.id || storedSandboxId;
        const resumedE2bId = resumeData.data?.e2bSandboxId || null;
        const resumedNekoUrl = resumeData.data?.nekoUrl || null;

        // Generate new proxy token for resumed sandbox
        const proxyToken = generateProxyToken();
        proxyTokenMap.set(proxyToken, { sandboxId: resumedId, userId, sessionId, createdAt: Date.now() });

        sandboxCache.set(sessionId, {
          sandboxId: resumedId,
          e2bSandboxId: resumedE2bId,
          nekoUrl: resumedNekoUrl,
          proxyToken,
          codeServerPassword: null,
          databaseName: null,
          projectPath: null,
          userId,
          createdAt: Date.now(),
          lastUsedAt: Date.now(),
        });

        console.log(
          `[e2b-manager] Resumed existing sandbox for session=${sessionId} (sandbox=${resumedId})`
        );

        // Re-initialize with new proxy token
        if (resumedE2bId) {
          const env = await buildSandboxEnv(proxyToken, userId);
          initializeSandbox(resumedE2bId, sessionId, userId, proxyToken, env).catch((err) =>
            console.warn("[e2b-manager] reinit after resume failed:", err)
          );
        }

        return { sandboxId: resumedId, e2bSandboxId: resumedE2bId, nekoUrl: resumedNekoUrl };
      }
      // Resume failed (410 terminated, 404 not found, etc.) — fall through to create new
      console.log(
        `[e2b-manager] Resume failed for sandbox=${storedSandboxId} (${resumeResp.status}), creating new`
      );
    } catch {
      // Resume failed — sandbox service unreachable or sandbox gone
      console.log(`[e2b-manager] Resume request failed for sandbox=${storedSandboxId}, creating new`);
    }
  }

  // ── Step 3: Create new sandbox ──
  const proxyToken = generateProxyToken();
  const env = await buildSandboxEnv(proxyToken, userId);

  // Create via sandbox service — defaults to 'desktop' template (Neko WebRTC)
  const resp = await fetch(`${SANDBOX_SERVICE_URL}/sandboxes`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-user-id": userId,
    },
    body: JSON.stringify({
      sessionId,
      template: process.env.E2B_TEMPLATE || "desktop",
      config: { env, timeout: SANDBOX_TIMEOUT_MS },
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!resp.ok) {
    const detail = await resp.text();
    throw new Error(`Failed to create sandbox: ${resp.status} ${detail}`);
  }

  const data = (await resp.json()) as {
    data?: {
      sandboxId?: string;
      id?: string;
      e2bSandboxId?: string;
      nekoUrl?: string;
      vncUrl?: string;
    };
  };
  const sandboxId = data.data?.sandboxId || data.data?.id;
  const e2bSandboxId = data.data?.e2bSandboxId || null;

  // Build nekoUrl — serve autoconnect.html from our webrtc-media service (S3 proxy),
  // passing the direct sandbox Neko URL as ?server= param. The autoconnect.html handles
  // pre-auth, login, and loading the Neko Vue client inside an iframe.
  // Also pass ?session= so autoconnect.html can use our proxy for auth + TURN when available.
  const MEDIA_SERVICE_URL = process.env.MEDIA_SERVICE_URL || "http://localhost:4016";
  const NEKO_CLIENT_BASE = process.env.NEKO_CLIENT_URL || `${MEDIA_SERVICE_URL}/neko-client`;
  const nekoUrl = e2bSandboxId
    ? `${NEKO_CLIENT_BASE}/autoconnect.html?server=${encodeURIComponent(buildNekoUrl(e2bSandboxId))}&session=${encodeURIComponent(sessionId)}`
    : (data.data?.nekoUrl || null);

  if (!sandboxId) {
    throw new Error("Sandbox service returned no sandbox ID");
  }

  // Register proxy token for LLM proxy validation
  proxyTokenMap.set(proxyToken, {
    sandboxId,
    userId,
    sessionId,
    createdAt: Date.now(),
  });

  const codeServerPassword = env.CODE_SERVER_PASSWORD || crypto.randomBytes(8).toString("hex");

  sandboxCache.set(sessionId, {
    sandboxId,
    e2bSandboxId,
    nekoUrl,
    proxyToken,
    codeServerPassword,
    databaseName: null,
    projectPath: null,
    userId,
    createdAt: Date.now(),
    lastUsedAt: Date.now(),
  });

  // Initialize the sandbox runtime — writes secrets, sets env vars.
  // This MUST happen before any apiproxy/upload calls from inside the sandbox.
  if (e2bSandboxId) {
    initializeSandbox(e2bSandboxId, sessionId, userId, proxyToken, env).catch((err) =>
      console.warn("[e2b-manager] initializeSandbox failed:", err)
    );
  }

  // Register media session with webrtc-media service (fire-and-forget)
  fetch(`${MEDIA_SERVICE_URL}/v1/media/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId,
      sandboxId,
      e2bSandboxId,
      userId,
      nekoHost: e2bSandboxId ? `8333-${e2bSandboxId}.${SANDBOX_DOMAIN}` : null,
    }),
  }).catch((err) => console.warn("[e2b-manager] Media session registration failed:", err));

  return { sandboxId, e2bSandboxId, nekoUrl };
}

/**
 * Build sandbox env vars (Manus Layer 4 pattern).
 * Extracted to a function so it can be reused for both create and resume flows.
 *
 * Now async — fetches user secrets from DB and merges them into the env.
 * User secrets are injected FIRST so platform vars can override if needed.
 */
async function buildSandboxEnv(proxyToken: string, userId?: string): Promise<Record<string, string>> {
  const env: Record<string, string> = {};

  // ── Layer 2: User secrets from Settings → Secrets (Manus .user_env pattern) ──
  if (userId) {
    try {
      const { getUserSecrets } = await import("./user-secrets.js");
      const secrets = await getUserSecrets(userId);
      // User secrets go first — platform vars below can override
      Object.assign(env, secrets);
    } catch (err) {
      console.warn("[e2b-manager] Failed to load user secrets:", err);
    }
  }

  // ── Layer 4: Platform env vars (override user secrets) ──
  env.OPENAI_API_KEY = proxyToken;
  if (LLM_PROXY_URL) {
    env.OPENAI_BASE_URL = LLM_PROXY_URL;
    env.OPENAI_API_BASE = LLM_PROXY_URL;
    const uploadUrl = LLM_PROXY_URL.replace(/\/llm-proxy\/v1$/, "/upload/presign");
    env.RUBIC_UPLOAD_URL = uploadUrl;
  }
  if (ORCHESTRATOR_URL) {
    env.ORCHESTRATOR_URL = ORCHESTRATOR_URL;
  }

  // S3 credentials for in-sandbox presign (rubic-upload-file).
  // When ORCHESTRATOR_URL is unreachable from E2B sandboxes (e.g. local dev),
  // the sandbox runtime handles presign locally using these credentials.
  const s3Vars = ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_REGION", "S3_BUCKET", "S3_ENDPOINT"];
  for (const v of s3Vars) {
    if (process.env[v]) env[v] = process.env[v]!;
  }
  env.SANDBOX_API_TOKEN = proxyToken;

  const codeServerPassword = crypto.randomBytes(8).toString("hex");
  env.CODE_SERVER_PASSWORD = codeServerPassword;
  env.CODE_SERVER_PORT = "8329";
  if (CODE_SERVER_DOMAIN) {
    env.CODE_SERVER_DOMAIN = CODE_SERVER_DOMAIN;
  }

  if (FORGE_API_KEY) {
    env.BUILT_IN_FORGE_API_KEY = FORGE_API_KEY;
    env.BUILT_IN_FORGE_API_URL =
      FORGE_API_URL || LLM_PROXY_URL.replace(/\/llm-proxy\/v1$/, "/forge");
  }
  if (FORGE_FRONTEND_API_KEY) {
    env.VITE_FRONTEND_FORGE_API_KEY = FORGE_FRONTEND_API_KEY;
    env.VITE_FRONTEND_FORGE_API_URL =
      FORGE_API_URL || LLM_PROXY_URL.replace(/\/llm-proxy\/v1$/, "/forge");
  }

  return env;
}

/**
 * Get sandbox info for a session if one exists.
 */
export function getSandboxInfo(sessionId: string): SandboxResult | undefined {
  const cached = sandboxCache.get(sessionId);
  if (!cached) return undefined;
  return {
    sandboxId: cached.sandboxId,
    e2bSandboxId: cached.e2bSandboxId,
    nekoUrl: cached.nekoUrl,
  };
}

/**
 * Get full sandbox details including code-server password.
 * Used by code-server pre-auth endpoint.
 */
export function getSandboxDetails(sessionId: string):
  | {
      sandboxId: string;
      nekoUrl: string | null;
      proxyToken: string | null;
      codeServerPassword: string | null;
    }
  | undefined {
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
 * Set the project path for a sandbox session.
 */
export function setSandboxProjectPath(sessionId: string, projectPath: string): void {
  const cached = sandboxCache.get(sessionId);
  if (cached) cached.projectPath = projectPath;
}

/**
 * Get the project path for a sandbox, looking up by sandboxId.
 */
export function getProjectPathBySandboxId(sandboxId: string): string | null {
  for (const [, info] of sandboxCache) {
    if (info.sandboxId === sandboxId) return info.projectPath;
  }
  return null;
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

/**
 * Get the terminal server URL for a sandbox (by sandboxId).
 * Used by webdev routes to call the terminal server directly instead of
 * going through the sandbox service (which uses different API endpoints).
 */
export function getTerminalServerUrlBySandboxId(sandboxId: string): string | null {
  for (const [, info] of sandboxCache) {
    if (info.sandboxId === sandboxId && info.e2bSandboxId) {
      return buildTerminalServerUrl(info.e2bSandboxId);
    }
  }
  return null;
}

/**
 * Get the E2B sandbox ID for a given orchestrator sandbox ID.
 * Used by webdev tools to construct preview URLs.
 */
export function getE2bSandboxIdBySandboxId(sandboxId: string): string | null {
  for (const [, info] of sandboxCache) {
    if (info.sandboxId === sandboxId) return info.e2bSandboxId;
  }
  return null;
}

/**
 * Get the per-project database name by sandboxId (not sessionId).
 * Used by the database endpoint when databaseName is not in the request body.
 */
export function getDatabaseNameBySandboxId(sandboxId: string): string | null {
  for (const [, info] of sandboxCache) {
    if (info.sandboxId === sandboxId) return info.databaseName;
  }
  return null;
}

// ── Centralized URL builders (Manus domain parity) ─────────────────────
// All sandbox URL construction goes through these helpers.
// Manus uses manus.computer for dev, manus.space for production.
// Rubic uses SANDBOX_DOMAIN for dev, DEPLOY_DOMAIN for production.

const SANDBOX_DOMAIN = process.env.SANDBOX_DOMAIN || "e2b.dev";
const DEPLOY_DOMAIN = process.env.DEPLOY_DOMAIN || "";

/**
 * Build a URL for an E2B sandbox port.
 * Pattern: https://{port}-{e2bSandboxId}.{domain}
 *
 * Manus equivalent: https://{port}-{sandbox-id}.us2.manus.computer
 */
export function buildSandboxPortUrl(e2bSandboxId: string, port: number): string {
  const domain = CODE_SERVER_DOMAIN || SANDBOX_DOMAIN;
  return `https://${port}-${e2bSandboxId}.${domain}`;
}

/**
 * Build a preview URL for a webdev project.
 * Priority: PROXY_DOMAIN → SANDBOX_PROXY_URL → direct E2B
 *
 * Used by webdev.ts and deploy.ts for consistent URL generation.
 */
export function buildPreviewUrl(e2bSandboxId: string | null, port = 3000): string | undefined {
  if (!e2bSandboxId) return undefined;
  const proxyDomain = process.env.PROXY_DOMAIN || "";
  const sandboxProxyUrl = process.env.SANDBOX_PROXY_URL || "";

  if (proxyDomain) {
    return `https://${port}-${e2bSandboxId}.${proxyDomain}`;
  }
  if (sandboxProxyUrl) {
    return `${sandboxProxyUrl}/proxy/${e2bSandboxId}/${port}`;
  }
  return `https://${port}-${e2bSandboxId}.${SANDBOX_DOMAIN}`;
}

/**
 * Build a terminal server URL for a sandbox.
 * Terminal server runs on port 8330.
 */
export function buildTerminalServerUrl(e2bSandboxId: string): string {
  return buildSandboxPortUrl(e2bSandboxId, 8330);
}

/**
 * Build a Neko WebRTC server URL.
 * Neko runs on port 8333.
 */
export function buildNekoUrl(e2bSandboxId: string): string {
  return buildSandboxPortUrl(e2bSandboxId, 8333);
}

/**
 * Get the deployment domain (for production-deployed sites).
 * Returns empty string if not configured.
 */
export function getDeployDomain(): string {
  return DEPLOY_DOMAIN;
}

/**
 * Get the sandbox domain (for dev preview URLs).
 */
export function getSandboxDomain(): string {
  return SANDBOX_DOMAIN;
}

// Database cleanup callback — registered by webdev.ts to avoid circular imports
let dbCleanupFn: ((dbName: string) => Promise<void>) | null = null;

export function registerDatabaseCleanup(fn: (dbName: string) => Promise<void>): void {
  dbCleanupFn = fn;
}

/**
 * Initialize the sandbox runtime after creation.
 * Polls /healthz until the sandbox is ready, then calls POST /init-sandbox
 * to write the sandbox token and set env vars (ORCHESTRATOR_URL, etc.).
 *
 * Without this call, apiproxy and upload presign requests from inside
 * the sandbox will fail because ORCHESTRATOR_URL won't be set.
 */
async function initializeSandbox(
  e2bSandboxId: string,
  sessionId: string,
  userId: string,
  proxyToken: string,
  env: Record<string, string>
): Promise<void> {
  const baseUrl = buildTerminalServerUrl(e2bSandboxId);

  // Poll /healthz until sandbox runtime is ready (max 60s)
  const maxRetries = 30;
  let ready = false;
  for (let i = 0; i < maxRetries; i++) {
    try {
      const resp = await fetch(`${baseUrl}/healthz`, {
        signal: AbortSignal.timeout(5000),
      });
      if (resp.ok) {
        ready = true;
        break;
      }
    } catch {
      // Not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  if (!ready) {
    console.warn(
      `[e2b-manager] Sandbox runtime not ready after ${maxRetries * 2}s — skipping init`
    );
    return;
  }

  // Call POST /init-sandbox with RSA signing
  const body = JSON.stringify({
    session_id: sessionId,
    user_id: userId,
    sandbox_token: proxyToken,
    env_vars: env,
  });

  const rsaHeaders = getRsaHeaders(body);

  try {
    const resp = await fetch(`${baseUrl}/init-sandbox`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...rsaHeaders,
      },
      body,
      signal: AbortSignal.timeout(10000),
    });

    if (resp.ok) {
      console.log(`[e2b-manager] Sandbox initialized: session=${sessionId}`);
    } else {
      const text = await resp.text().catch(() => resp.statusText);
      console.warn(`[e2b-manager] init-sandbox failed (${resp.status}): ${text}`);
    }
  } catch (error) {
    console.warn("[e2b-manager] init-sandbox request failed:", error);
  }
}

/**
 * Destroy a sandbox for a session.
 * Meters VM time (2 credits/minute), cleans up proxy token, and deletes sandbox.
 * If a per-project database was created, drops it via the registered cleanup callback.
 */
export async function destroySandbox(sessionId: string): Promise<void> {
  const cached = sandboxCache.get(sessionId);
  if (!cached) return;

  // ── Meter sandbox VM time before cleanup ──
  // Calculate active duration: from creation to last use (not now, since idle time shouldn't count)
  const durationMs = cached.lastUsedAt - cached.createdAt;
  const durationMinutes = durationMs / (60 * 1000);

  if (durationMinutes > 0 && cached.userId) {
    meterVmTime({
      userId: cached.userId,
      sessionId,
      sandboxId: cached.sandboxId,
      durationMinutes,
      metadata: {
        e2bSandboxId: cached.e2bSandboxId,
        createdAt: cached.createdAt,
        lastUsedAt: cached.lastUsedAt,
      },
    });
    console.log(
      `[e2b-manager] Metered VM time: session=${sessionId} duration=${durationMinutes.toFixed(1)}min ` +
      `(${Math.ceil(durationMinutes) * 2} credits)`
    );
  }

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
      method: "DELETE",
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
  cleanupInterval = setInterval(
    () => {
      cleanupIdleSandboxes().catch(() => {});
    },
    5 * 60 * 1000
  );
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
  info: { sandboxId: string; userId: string; sessionId: string }
): void {
  proxyTokenMap.set(token, { ...info, createdAt: Date.now() });
}
