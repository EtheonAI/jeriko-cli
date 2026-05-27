/**
 * WebSocket client to sandbox runtime — push-based terminal output.
 *
 * Connects to the sandbox runtime's /ws endpoint after sandbox init.
 * Receives terminal.output push events and forwards them to registered handlers.
 * Falls back gracefully to HTTP polling if WebSocket is unavailable.
 *
 * Protocol (matches sandbox_runtime/app/ws.py):
 *   Send: terminal.create, terminal.write, terminal.kill, terminal.resize
 *   Recv: terminal.output, terminal.created, terminal.killed, error
 */

import WebSocket from "ws";
import { getRsaHeaders } from "./rsa-auth.js";

export type TerminalOutputHandler = (terminalId: string, data: string) => void;

export interface SandboxWsClient {
  /** Whether the WebSocket is currently connected */
  readonly connected: boolean;
  /** Send a JSON command to the sandbox */
  send(msg: Record<string, unknown>): void;
  /** Register a handler for terminal output */
  onTerminalOutput(handler: TerminalOutputHandler): void;
  /** Remove a terminal output handler */
  offTerminalOutput(handler: TerminalOutputHandler): void;
  /** Close the connection */
  close(): void;
}

// Cache: sandboxId → client
const wsClients = new Map<string, SandboxWsClient>();

/**
 * Get or create a WebSocket client for a sandbox.
 * Fetches a one-time token via GET /ws/token, then connects to /ws?token=<otp>.
 *
 * @param baseUrl - Terminal server base URL (e.g. https://8330-xxx.e2b.dev)
 * @param sandboxId - Sandbox ID for caching
 */
export async function getOrCreateWsClient(
  baseUrl: string,
  sandboxId: string,
): Promise<SandboxWsClient> {
  const existing = wsClients.get(sandboxId);
  if (existing?.connected) return existing;

  // Clean up old disconnected client
  if (existing) {
    existing.close();
    wsClients.delete(sandboxId);
  }

  // Get OTP token via RSA-signed request
  const tokenBody = "";
  const rsaHeaders = getRsaHeaders(tokenBody);
  const tokenResp = await fetch(`${baseUrl}/ws/token`, {
    headers: { ...rsaHeaders },
    signal: AbortSignal.timeout(5000),
  });

  if (!tokenResp.ok) {
    throw new Error(`Failed to get WS token: ${tokenResp.status}`);
  }

  const { token } = (await tokenResp.json()) as { token: string };

  // Convert https:// → wss:// (or http:// → ws://)
  const wsUrl = baseUrl.replace(/^http/, "ws") + `/ws?token=${token}`;

  const client = createWsClient(wsUrl, sandboxId);
  wsClients.set(sandboxId, client);

  return client;
}

/**
 * Get an existing WS client (if any). Does not create a new one.
 */
export function getWsClient(sandboxId: string): SandboxWsClient | undefined {
  const client = wsClients.get(sandboxId);
  if (client?.connected) return client;
  return undefined;
}

function createWsClient(url: string, sandboxId: string): SandboxWsClient {
  const handlers = new Set<TerminalOutputHandler>();
  let ws: WebSocket | null = null;
  let isConnected = false;

  try {
    ws = new WebSocket(url);
  } catch {
    console.error(`[sandbox-ws] Failed to create WebSocket for sandbox=${sandboxId}`);
    return createDisconnectedClient();
  }

  ws.on("open", () => {
    isConnected = true;
    console.log(`[sandbox-ws] Connected to sandbox ${sandboxId}`);
  });

  ws.on("message", (raw: WebSocket.Data) => {
    try {
      const msg = JSON.parse(raw.toString()) as Record<string, unknown>;
      if (msg.type === "terminal.output") {
        const terminalId = msg.id as string;
        const data = msg.data as string;
        for (const handler of handlers) {
          try {
            handler(terminalId, data);
          } catch {
            // Handler error — don't break others
          }
        }
      }
    } catch {
      // Malformed message — ignore
    }
  });

  ws.on("close", () => {
    isConnected = false;
    console.log(`[sandbox-ws] Disconnected from sandbox ${sandboxId}`);
  });

  ws.on("error", (err) => {
    isConnected = false;
    console.error(`[sandbox-ws] Error for sandbox ${sandboxId}:`, err.message);
  });

  return {
    get connected() {
      return isConnected;
    },
    send(msg) {
      if (ws && isConnected) {
        ws.send(JSON.stringify(msg));
      }
    },
    onTerminalOutput(handler) {
      handlers.add(handler);
    },
    offTerminalOutput(handler) {
      handlers.delete(handler);
    },
    close() {
      isConnected = false;
      handlers.clear();
      if (ws) {
        try {
          ws.close();
        } catch {
          // Already closed
        }
        ws = null;
      }
      wsClients.delete(sandboxId);
    },
  };
}

function createDisconnectedClient(): SandboxWsClient {
  return {
    get connected() {
      return false;
    },
    send() {},
    onTerminalOutput() {},
    offTerminalOutput() {},
    close() {},
  };
}
