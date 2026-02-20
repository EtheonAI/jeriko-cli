/**
 * Sandbox Proxy Service — Rubic's equivalent of manus.computer
 *
 * Routes browser requests to E2B sandbox ports. Supports:
 *   - HTTP proxying (dev server, code-server, etc.)
 *   - WebSocket upgrades (Vite HMR, live reload)
 *   - Path-based routing (local dev): /proxy/{sandboxId}/{port}/...
 *   - Subdomain routing (production): {port}-{sandboxId}.{PROXY_DOMAIN}/...
 *
 * Port: 4017 (configurable via PROXY_PORT)
 *
 * Manus equivalent:
 *   https://3000-{id}.us2.manus.computer → sandbox:3000
 *   https://8329-{id}.us2.manus.computer → sandbox:8329 (code-server)
 *
 * Rubic local:
 *   http://localhost:4017/proxy/{sandboxId}/3000/... → https://3000-{e2bId}.e2b.dev/...
 *
 * Rubic production (with *.rubic.computer):
 *   https://3000-{sandboxId}.rubic.computer/... → https://3000-{e2bId}.e2b.dev/...
 */

import { createServer, IncomingMessage, ServerResponse } from "http";
import httpProxy from "http-proxy";

// ============================================================================
// Configuration
// ============================================================================

const PORT = parseInt(process.env.PROXY_PORT || "4017", 10);
const SANDBOX_DOMAIN = process.env.SANDBOX_DOMAIN || "e2b.dev";
const PROXY_DOMAIN = process.env.PROXY_DOMAIN || ""; // e.g., "rubic.computer" for production
const E2B_PROTOCOL = process.env.E2B_PROTOCOL || "https";
const LOG_REQUESTS = process.env.LOG_REQUESTS !== "false";

// ============================================================================
// URL Parsing
// ============================================================================

interface ProxyTarget {
  sandboxId: string;
  port: number;
  path: string;
}

/**
 * Parse proxy target from subdomain.
 * Pattern: {port}-{sandboxId}.{PROXY_DOMAIN}
 * Example: 3000-abc123def456.rubic.computer → { sandboxId: "abc123def456", port: 3000, path: "/" }
 */
function parseSubdomain(host: string): ProxyTarget | null {
  if (!PROXY_DOMAIN || !host) return null;

  // Strip port from host
  const hostname = host.split(":")[0]!;

  // Check if it matches *.PROXY_DOMAIN
  if (!hostname.endsWith(`.${PROXY_DOMAIN}`)) return null;

  // Extract subdomain: "3000-abc123def456"
  const subdomain = hostname.slice(0, -(PROXY_DOMAIN.length + 1));
  const dashIdx = subdomain.indexOf("-");
  if (dashIdx < 1) return null;

  const port = parseInt(subdomain.slice(0, dashIdx), 10);
  const sandboxId = subdomain.slice(dashIdx + 1);

  if (isNaN(port) || port < 1 || port > 65535 || !sandboxId) return null;

  return { sandboxId, port, path: "/" };
}

/**
 * Parse proxy target from path.
 * Pattern: /proxy/{sandboxId}/{port}/...
 * Example: /proxy/abc123def456/3000/index.html → { sandboxId: "abc123def456", port: 3000, path: "/index.html" }
 */
function parsePath(url: string): ProxyTarget | null {
  const match = url.match(/^\/proxy\/([a-zA-Z0-9_-]+)\/(\d+)(\/.*)?$/);
  if (!match) return null;

  const sandboxId = match[1]!;
  const port = parseInt(match[2]!, 10);
  const path = match[3] || "/";

  if (isNaN(port) || port < 1 || port > 65535) return null;

  return { sandboxId, port, path };
}

/**
 * Resolve the proxy target from a request.
 * Tries subdomain first (production), then path (local dev).
 */
function resolveTarget(req: IncomingMessage): ProxyTarget | null {
  const host = req.headers.host || "";
  const url = req.url || "/";

  // Try subdomain routing first (production with PROXY_DOMAIN set)
  const subdomainTarget = parseSubdomain(host);
  if (subdomainTarget) {
    subdomainTarget.path = url;
    return subdomainTarget;
  }

  // Fall back to path-based routing (local dev)
  return parsePath(url);
}

/**
 * Build the upstream E2B URL for a proxy target.
 */
function buildUpstreamUrl(target: ProxyTarget): string {
  return `${E2B_PROTOCOL}://${target.port}-${target.sandboxId}.${SANDBOX_DOMAIN}`;
}

// ============================================================================
// CORS Headers
// ============================================================================

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, Accept, Origin, Cache-Control, Pragma",
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Max-Age": "86400",
  "Cross-Origin-Resource-Policy": "cross-origin",
  "Cross-Origin-Embedder-Policy": "credentialless",
};

function addCorsHeaders(res: ServerResponse): void {
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    res.setHeader(key, value);
  }
}

// ============================================================================
// Proxy Server
// ============================================================================

const proxy = httpProxy.createProxyServer({
  changeOrigin: true,
  ws: true,
  secure: true, // verify SSL certs on upstream
  xfwd: true, // add X-Forwarded-For headers
  followRedirects: false,
  timeout: 120_000, // 2 min timeout for slow dev servers
  proxyTimeout: 120_000,
});

// Handle proxy errors
proxy.on("error", (err: Error, req: IncomingMessage, res: ServerResponse | import("net").Socket) => {
  if (LOG_REQUESTS) {
    console.error(`[proxy] Error: ${err.message} — ${req.method} ${req.url}`);
  }
  if (res instanceof ServerResponse && !res.headersSent) {
    addCorsHeaders(res);
    res.writeHead(502, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      error: "Bad Gateway",
      message: `Failed to proxy to sandbox: ${err.message}`,
    }));
  }
});

// Add CORS to proxy responses
proxy.on("proxyRes", (_proxyRes: IncomingMessage, _req: IncomingMessage, res: ServerResponse) => {
  if (res instanceof ServerResponse) {
    addCorsHeaders(res);
  }
});

// ============================================================================
// HTTP Server
// ============================================================================

const server = createServer((req: IncomingMessage, res: ServerResponse) => {
  const url = req.url || "/";

  // Health check
  if (url === "/healthz" || url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", service: "sandbox-proxy", port: PORT }));
    return;
  }

  // Service info
  if (url === "/") {
    addCorsHeaders(res);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      service: "sandbox-proxy",
      version: "0.0.1",
      description: "Rubic sandbox reverse proxy (manus.computer equivalent)",
      routes: {
        local: "/proxy/{sandboxId}/{port}/{...path}",
        production: "{port}-{sandboxId}.{PROXY_DOMAIN}/{...path}",
      },
      config: {
        PROXY_DOMAIN: PROXY_DOMAIN || "(not set — path mode only)",
        SANDBOX_DOMAIN,
        E2B_PROTOCOL,
        PORT,
      },
    }));
    return;
  }

  // CORS preflight
  if (req.method === "OPTIONS") {
    addCorsHeaders(res);
    res.writeHead(204);
    res.end();
    return;
  }

  // Resolve proxy target
  const target = resolveTarget(req);
  if (!target) {
    addCorsHeaders(res);
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      error: "Not Found",
      message: "Use /proxy/{sandboxId}/{port}/{path} or configure PROXY_DOMAIN for subdomain routing",
    }));
    return;
  }

  const upstream = buildUpstreamUrl(target);

  if (LOG_REQUESTS) {
    console.log(`[proxy] ${req.method} ${req.url} → ${upstream}${target.path}`);
  }

  // Rewrite the URL to the path portion only (strip /proxy/{id}/{port} prefix)
  req.url = target.path;

  // Proxy the request
  proxy.web(req, res, { target: upstream });
});

// ============================================================================
// WebSocket Upgrades (Vite HMR, live reload, etc.)
// ============================================================================

server.on("upgrade", (req: IncomingMessage, socket, head) => {
  const target = resolveTarget(req);
  if (!target) {
    socket.destroy();
    return;
  }

  const upstream = buildUpstreamUrl(target);

  if (LOG_REQUESTS) {
    console.log(`[proxy] WS upgrade ${req.url} → ${upstream}${target.path}`);
  }

  // Rewrite URL for upstream
  req.url = target.path;

  proxy.ws(req, socket, head, { target: upstream });
});

// ============================================================================
// Start
// ============================================================================

server.listen(PORT, () => {
  console.log(`[sandbox-proxy] Listening on http://0.0.0.0:${PORT}`);
  console.log(`[sandbox-proxy] Mode: ${PROXY_DOMAIN ? `subdomain (*.${PROXY_DOMAIN})` : "path (/proxy/{id}/{port}/...)"}`);
  console.log(`[sandbox-proxy] Upstream: ${E2B_PROTOCOL}://{port}-{id}.${SANDBOX_DOMAIN}`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("[sandbox-proxy] Shutting down...");
  server.close(() => process.exit(0));
});

process.on("SIGINT", () => {
  console.log("[sandbox-proxy] Shutting down...");
  server.close(() => process.exit(0));
});
