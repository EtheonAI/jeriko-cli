/**
 * Shared Sandbox Helpers
 *
 * Common functions for interacting with E2B sandboxes:
 *   - sandboxExec: Execute shell commands via sandbox service
 *   - sandboxWriteFile: Write files via sandbox service
 *   - sandboxReadFile: Read files via sandbox service
 *   - getTerminalServerUrl: Build terminal server URL for a sandbox
 *   - terminalServerPost: POST JSON to terminal server inside sandbox
 *   - terminalServerGet: GET JSON from terminal server inside sandbox
 *
 * Previously copy-pasted across 8+ route files (sandbox-runtime, webdev,
 * code-server, deploy, skills, slides, image-ops, file-ops, text-editor).
 * Now centralized here for single-source-of-truth maintenance.
 */

import { getE2bSandboxIdBySandboxId } from "./e2b-manager.js";
import { getRsaHeaders } from "./rsa-auth.js";

const SANDBOX_SERVICE_URL =
  process.env.SANDBOX_SERVICE_URL || "http://localhost:4012";
const SANDBOX_DOMAIN = process.env.SANDBOX_DOMAIN || "e2b.dev";

/**
 * Get the E2B port proxy URL for a sandbox at a specific port.
 * Tries e2b-manager cache first (fast), falls back to sandbox service.
 */
async function getPortProxyUrl(
  sandboxId: string,
  userId: string,
  port: number,
): Promise<string | null> {
  // Try e2b-manager cache first (avoids sandbox service roundtrip)
  const cachedE2bId = getE2bSandboxIdBySandboxId(sandboxId);
  if (cachedE2bId) {
    return `https://${port}-${cachedE2bId}.${SANDBOX_DOMAIN}`;
  }

  // Fall back to sandbox service
  try {
    const resp = await fetch(`${SANDBOX_SERVICE_URL}/sandboxes/${sandboxId}`, {
      headers: { "x-user-id": userId },
      signal: AbortSignal.timeout(5000),
    });

    if (!resp.ok) return null;

    const data = (await resp.json()) as {
      data?: { e2bSandboxId?: string };
    };
    const e2bId = data.data?.e2bSandboxId;
    if (!e2bId) return null;

    return `https://${port}-${e2bId}.${SANDBOX_DOMAIN}`;
  } catch {
    return null;
  }
}

/**
 * Build terminal server URL for a given sandbox.
 * The terminal server runs inside the E2B sandbox on port 8330.
 */
export async function getTerminalServerUrl(
  sandboxId: string,
  userId: string,
): Promise<string | null> {
  return getPortProxyUrl(sandboxId, userId, 8330);
}

/**
 * POST JSON to terminal server (inside sandbox).
 * Includes RSA signature headers for terminal server auth.
 */
export async function terminalServerPost(
  sandboxId: string,
  path: string,
  body: Record<string, unknown>,
  timeoutMs = 30000,
  userId = "system",
): Promise<Record<string, unknown>> {
  const baseUrl = await getTerminalServerUrl(sandboxId, userId);
  if (!baseUrl) {
    throw new Error("Could not resolve terminal server URL");
  }
  const url = `${baseUrl}${path}`;
  const bodyStr = JSON.stringify(body);
  const rsaHeaders = getRsaHeaders(bodyStr);
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...rsaHeaders },
    body: bodyStr,
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!resp.ok) {
    const detail = await resp.text().catch(() => resp.statusText);
    throw new Error(
      `Terminal server ${path} failed: ${resp.status} ${detail}`,
    );
  }
  return (await resp.json()) as Record<string, unknown>;
}

/**
 * GET JSON from terminal server (inside sandbox).
 * Includes RSA signature headers for terminal server auth.
 */
export async function terminalServerGet(
  sandboxId: string,
  path: string,
  timeoutMs = 15000,
  userId = "system",
): Promise<Record<string, unknown>> {
  const baseUrl = await getTerminalServerUrl(sandboxId, userId);
  if (!baseUrl) {
    throw new Error("Could not resolve terminal server URL");
  }
  const url = `${baseUrl}${path}`;
  const rsaHeaders = getRsaHeaders("");
  const resp = await fetch(url, {
    headers: rsaHeaders,
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!resp.ok) {
    const detail = await resp.text().catch(() => resp.statusText);
    throw new Error(
      `Terminal server ${path} failed: ${resp.status} ${detail}`,
    );
  }
  return (await resp.json()) as Record<string, unknown>;
}

/**
 * Execute a shell command in a sandbox via the sandbox service.
 */
export async function sandboxExec(
  sandboxId: string,
  command: string,
  userId: string,
  timeout = 30000,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const resp = await fetch(
    `${SANDBOX_SERVICE_URL}/sandboxes/${sandboxId}/shell`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-user-id": userId },
      body: JSON.stringify({ command, timeout }),
      signal: AbortSignal.timeout(timeout + 5000),
    },
  );
  if (!resp.ok) {
    const detail = await resp.text();
    throw new Error(`Sandbox exec failed: ${resp.status} ${detail}`);
  }
  const data = (await resp.json()) as {
    data?: { stdout?: string; stderr?: string; exitCode?: number };
  };
  return {
    stdout: data.data?.stdout || "",
    stderr: data.data?.stderr || "",
    exitCode: data.data?.exitCode ?? 1,
  };
}

/**
 * Write a file to a sandbox via the sandbox service.
 */
export async function sandboxWriteFile(
  sandboxId: string,
  filePath: string,
  content: string,
  userId: string,
): Promise<void> {
  const resp = await fetch(
    `${SANDBOX_SERVICE_URL}/sandboxes/${sandboxId}/files`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-user-id": userId },
      body: JSON.stringify({ path: filePath, content }),
      signal: AbortSignal.timeout(10000),
    },
  );
  if (!resp.ok) {
    const detail = await resp.text();
    throw new Error(`File write failed: ${resp.status} ${detail}`);
  }
}

/**
 * Read a file from a sandbox via the sandbox service.
 */
export async function sandboxReadFile(
  sandboxId: string,
  filePath: string,
  userId: string,
): Promise<string> {
  const resp = await fetch(
    `${SANDBOX_SERVICE_URL}/sandboxes/${sandboxId}/files?path=${encodeURIComponent(filePath)}`,
    {
      headers: { "x-user-id": userId },
      signal: AbortSignal.timeout(10000),
    },
  );
  if (!resp.ok) {
    const detail = await resp.text();
    throw new Error(`File read failed: ${resp.status} ${detail}`);
  }
  const data = (await resp.json()) as { data?: { content?: string } };
  return data.data?.content || "";
}
