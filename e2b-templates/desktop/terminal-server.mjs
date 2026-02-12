#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// Rubic Terminal Server — Manus-style Stateful PTY Management
//
// Runs INSIDE the E2B sandbox on port 8330.
// Provides HTTP API for creating and managing persistent bash sessions.
// The orchestrator / sandbox service communicates with this server
// via HTTP instead of using the E2B SDK's commands.run().
//
// Architecture (matching Manus):
//   LLM → Orchestrator → Sandbox Service → Terminal Server → PTY → bash
//
// Endpoints:
//   GET  /health                  → { ok, terminals }
//   POST /terminals               → { id }
//   POST /terminals/:id/exec      → { stdout, stderr, exitCode }
//   POST /terminals/:id/write     → { ok }
//   GET  /terminals/:id/view      → { stdout, stderr, busy, alive }
//   DELETE /terminals/:id          → { ok }
//
// Port: 8330 (matches Manus sandbox runtime API)
// ═══════════════════════════════════════════════════════════════════════════

import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";

const PORT = parseInt(process.env.TERMINAL_SERVER_PORT || "8330", 10);

/** @type {Map<string, Terminal>} */
const terminals = new Map();

// ─── Terminal Class ─────────────────────────────────────────────────────────

class Terminal {
  constructor(cwd = "/home/user") {
    this.id = randomUUID();
    this.cwd = cwd;
    this.alive = true;
    this.busy = false;
    this.stdoutBuffer = "";
    this.stderrBuffer = "";
    this.createdAt = Date.now();

    // Spawn a non-interactive bash process with no rc files
    // (we source env explicitly for clean control)
    this.process = spawn("bash", ["--norc", "--noprofile"], {
      cwd,
      env: {
        ...process.env,
        TERM: "xterm-256color",
        HOME: "/home/user",
        USER: "user",
        SHELL: "/bin/bash",
        PATH: process.env.PATH,
      },
      stdio: ["pipe", "pipe", "pipe"],
    });

    this.process.stdout.on("data", (chunk) => {
      this.stdoutBuffer += chunk.toString();
    });

    this.process.stderr.on("data", (chunk) => {
      this.stderrBuffer += chunk.toString();
    });

    this.process.on("exit", (code) => {
      this.alive = false;
      this.busy = false;
      console.log(`Terminal ${this.id} exited with code ${code}`);
    });

    this.process.on("error", (err) => {
      this.alive = false;
      this.busy = false;
      console.error(`Terminal ${this.id} error:`, err.message);
    });

    // ─── Initialization: source env files and wait for ready ────────────
    const readyMarker = `__READY_${Date.now()}_${Math.random().toString(36).slice(2)}__`;
    this.process.stdin.write(
      [
        // Source environment files (Layer 1 + Layer 2)
        "source /home/user/.env 2>/dev/null",
        "source /home/user/.user_env 2>/dev/null",
        // Set cwd
        `cd ${this._escapeShell(cwd)} 2>/dev/null`,
        // Signal ready
        `echo "${readyMarker}"`,
        "",
      ].join("\n")
    );

    this.ready = new Promise((resolve) => {
      const check = setInterval(() => {
        if (this.stdoutBuffer.includes(readyMarker)) {
          clearInterval(check);
          // Clear init output
          this.stdoutBuffer = "";
          this.stderrBuffer = "";
          resolve();
        }
      }, 30);

      // Safety timeout: resolve after 5s even if marker not found
      setTimeout(() => {
        clearInterval(check);
        this.stdoutBuffer = "";
        this.stderrBuffer = "";
        resolve();
      }, 5000);
    });
  }

  /**
   * Execute a command synchronously: write → wait for sentinel → return result.
   * Only one command can run at a time per terminal.
   */
  async exec(command, timeoutMs = 30000) {
    await this.ready;

    if (!this.alive) {
      throw Object.assign(new Error("Terminal process is dead"), { code: 410 });
    }
    if (this.busy) {
      throw Object.assign(new Error("Terminal is busy with another command"), {
        code: 409,
      });
    }

    this.busy = true;
    const marker = `__RUBIC_${Date.now()}_${Math.random().toString(36).slice(2)}__`;

    // Clear buffers
    this.stdoutBuffer = "";
    this.stderrBuffer = "";

    // Write command + sentinel
    // The sentinel echo goes to stdout, allowing us to detect completion
    // and extract the exit code of the command
    this.process.stdin.write(`${command}\necho "${marker}_EXIT_$?"\n`);

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.busy = false;
        reject(
          Object.assign(
            new Error(`Command timed out after ${timeoutMs}ms`),
            { code: 408 }
          )
        );
      }, timeoutMs);

      const check = setInterval(() => {
        // Check if process died during execution
        if (!this.alive) {
          clearTimeout(timer);
          clearInterval(check);
          this.busy = false;
          resolve({
            stdout: this.stdoutBuffer.trimEnd(),
            stderr: this.stderrBuffer.trimEnd(),
            exitCode: 137, // SIGKILL
          });
          return;
        }

        const idx = this.stdoutBuffer.indexOf(`${marker}_EXIT_`);
        if (idx !== -1) {
          clearTimeout(timer);
          clearInterval(check);
          this.busy = false;

          // Extract stdout (everything before the sentinel)
          const stdout = this.stdoutBuffer.substring(0, idx).trimEnd();

          // Extract exit code from sentinel line
          const exitMatch = this.stdoutBuffer.match(
            new RegExp(`${marker}_EXIT_(\\d+)`)
          );
          const exitCode = exitMatch ? parseInt(exitMatch[1], 10) : 0;

          // Stderr is everything captured during this command
          const stderr = this.stderrBuffer.trimEnd();

          resolve({ stdout, stderr, exitCode });
        }
      }, 30); // Poll every 30ms for fast response
    });
  }

  /**
   * Write raw input to terminal stdin (async, no waiting for completion).
   * Use for interactive commands or sending signals.
   */
  write(input) {
    if (!this.alive) {
      throw Object.assign(new Error("Terminal process is dead"), { code: 410 });
    }
    this.process.stdin.write(input);
  }

  /**
   * View current terminal output buffers without waiting.
   */
  view() {
    return {
      stdout: this.stdoutBuffer,
      stderr: this.stderrBuffer,
      busy: this.busy,
      alive: this.alive,
    };
  }

  /**
   * Kill the terminal process.
   */
  kill() {
    try {
      this.process.kill("SIGTERM");
      // Force kill after 2s if still alive
      setTimeout(() => {
        try {
          this.process.kill("SIGKILL");
        } catch {}
      }, 2000);
    } catch {}
    this.alive = false;
    this.busy = false;
  }

  _escapeShell(s) {
    return "'" + s.replace(/'/g, "'\\''") + "'";
  }
}

// ─── HTTP Helpers ───────────────────────────────────────────────────────────

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => {
      try {
        resolve(JSON.parse(data || "{}"));
      } catch {
        resolve({});
      }
    });
    req.on("error", reject);
  });
}

function json(res, data, status = 200) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(JSON.stringify(data));
}

// ─── HTTP Server ────────────────────────────────────────────────────────────

const server = createServer(async (req, res) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    });
    return res.end();
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const method = req.method;

  try {
    // GET /health
    if (method === "GET" && url.pathname === "/health") {
      return json(res, {
        ok: true,
        terminals: terminals.size,
        uptime: process.uptime(),
      });
    }

    // POST /terminals — create new terminal
    if (method === "POST" && url.pathname === "/terminals") {
      const body = await readBody(req);
      const terminal = new Terminal(body.cwd || "/home/user");
      terminals.set(terminal.id, terminal);

      // Wait for terminal to be ready (env sourced)
      await terminal.ready;

      console.log(`Terminal created: ${terminal.id} (cwd: ${body.cwd || "/home/user"})`);
      return json(res, { id: terminal.id });
    }

    // Match /terminals/:id and /terminals/:id/action
    const match = url.pathname.match(/^\/terminals\/([^/]+)(?:\/(.+))?$/);
    if (!match) {
      return json(res, { error: "Not found" }, 404);
    }

    const [, termId, action] = match;
    const terminal = terminals.get(termId);

    if (!terminal) {
      return json(res, { error: "Terminal not found" }, 404);
    }

    // POST /terminals/:id/exec — synchronous command execution
    if (method === "POST" && action === "exec") {
      const body = await readBody(req);
      if (!body.command) {
        return json(res, { error: "command is required" }, 400);
      }
      const result = await terminal.exec(
        body.command,
        body.timeout || 30000
      );
      return json(res, result);
    }

    // POST /terminals/:id/write — async write to stdin
    if (method === "POST" && action === "write") {
      const body = await readBody(req);
      terminal.write(body.input || body.command || "");
      return json(res, { ok: true });
    }

    // GET /terminals/:id/view — read current output
    if (method === "GET" && action === "view") {
      return json(res, terminal.view());
    }

    // DELETE /terminals/:id — kill terminal
    if (method === "DELETE" && !action) {
      terminal.kill();
      terminals.delete(termId);
      console.log(`Terminal killed: ${termId}`);
      return json(res, { ok: true });
    }

    // GET /terminals/:id — terminal info
    if (method === "GET" && !action) {
      return json(res, {
        id: terminal.id,
        alive: terminal.alive,
        busy: terminal.busy,
        cwd: terminal.cwd,
        createdAt: terminal.createdAt,
      });
    }

    return json(res, { error: "Not found" }, 404);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    const status = err?.code || (message.includes("timed out") ? 408 : 500);
    console.error(`Error: ${message}`);
    return json(res, { error: message }, status);
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Rubic Terminal Server listening on port ${PORT}`);
  console.log(`  PID: ${process.pid}`);
  console.log(`  Endpoints: POST /terminals, POST /terminals/:id/exec, GET /terminals/:id/view`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("Terminal server shutting down...");
  for (const [id, terminal] of terminals) {
    terminal.kill();
    terminals.delete(id);
  }
  server.close(() => process.exit(0));
});

process.on("SIGINT", () => {
  process.emit("SIGTERM");
});
