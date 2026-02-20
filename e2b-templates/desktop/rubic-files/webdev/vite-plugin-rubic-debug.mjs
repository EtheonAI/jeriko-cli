/**
 * vite-plugin-rubic-debug — Manus's vitePluginManusDebugCollector equivalent
 *
 * Injected into every webdev project's vite.config.ts by the orchestrator.
 *
 * Features:
 *   1. Handles POST /__rubic__/logs — stores debug data from the browser
 *   2. Handles GET /__rubic__/logs  — returns stored debug data for the agent
 *   3. Injects <script src="/__rubic__/debug-collector.js"> into HTML head
 *   4. Serves debug-collector.js from the public dir (Vite already does this via public/)
 *
 * Debug data stored at /tmp/rubic-debug-logs.json (rotated at 1MB).
 * The agent reads this via the terminal server's GET /debug-logs endpoint.
 */

import { readFileSync, writeFileSync, existsSync, statSync } from "fs";

const LOGS_FILE = "/tmp/rubic-debug-logs.json";
const MAX_FILE_SIZE = 1024 * 1024; // 1MB rotation threshold
const MAX_ENTRIES = 500; // Max log entries per category

/**
 * Read current stored logs (or empty).
 */
function readLogs() {
  try {
    if (existsSync(LOGS_FILE)) {
      return JSON.parse(readFileSync(LOGS_FILE, "utf-8"));
    }
  } catch {
    // Corrupt file — reset
  }
  return { consoleLogs: [], networkRequests: [], uiEvents: [], lastUpdated: null };
}

/**
 * Write logs with rotation.
 */
function writeLogs(data) {
  try {
    // Trim arrays to max entries
    if (data.consoleLogs?.length > MAX_ENTRIES) {
      data.consoleLogs = data.consoleLogs.slice(-MAX_ENTRIES);
    }
    if (data.networkRequests?.length > MAX_ENTRIES) {
      data.networkRequests = data.networkRequests.slice(-MAX_ENTRIES);
    }
    if (data.uiEvents?.length > MAX_ENTRIES) {
      data.uiEvents = data.uiEvents.slice(-MAX_ENTRIES);
    }
    data.lastUpdated = new Date().toISOString();

    const content = JSON.stringify(data, null, 2);
    writeFileSync(LOGS_FILE, content, "utf-8");

    // Rotate if too large
    if (statSync(LOGS_FILE).size > MAX_FILE_SIZE) {
      const trimmed = {
        consoleLogs: data.consoleLogs.slice(-100),
        networkRequests: data.networkRequests.slice(-50),
        uiEvents: data.uiEvents.slice(-100),
        lastUpdated: data.lastUpdated,
        rotatedAt: new Date().toISOString(),
      };
      writeFileSync(LOGS_FILE, JSON.stringify(trimmed, null, 2), "utf-8");
    }
  } catch (err) {
    console.error("[rubic-debug] Failed to write logs:", err.message);
  }
}

/**
 * Parse POST body from an IncomingMessage.
 */
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 512 * 1024) {
        reject(new Error("Body too large"));
      }
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(body));
      } catch {
        resolve(null);
      }
    });
    req.on("error", reject);
  });
}

/**
 * The Vite plugin.
 */
export default function rubicDebugPlugin() {
  return {
    name: "vite-plugin-rubic-debug",
    enforce: "pre",

    configureServer(server) {
      // Handle /__rubic__/logs (POST = receive, GET = read)
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/__rubic__/logs")) {
          return next();
        }

        // CORS headers
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");

        if (req.method === "OPTIONS") {
          res.statusCode = 204;
          res.end();
          return;
        }

        if (req.method === "POST") {
          // Receive debug data from the browser
          try {
            const incoming = await parseBody(req);
            if (!incoming) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: "Invalid JSON" }));
              return;
            }

            const stored = readLogs();

            // Merge incoming arrays
            if (Array.isArray(incoming.consoleLogs)) {
              stored.consoleLogs.push(...incoming.consoleLogs);
            }
            if (Array.isArray(incoming.networkRequests)) {
              stored.networkRequests.push(...incoming.networkRequests);
            }
            if (Array.isArray(incoming.uiEvents)) {
              stored.uiEvents.push(...incoming.uiEvents);
            }
            // sessionEvents are UI events mirrored for replay
            if (Array.isArray(incoming.sessionEvents)) {
              stored.uiEvents.push(...incoming.sessionEvents);
            }

            writeLogs(stored);

            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ ok: true }));
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
          }
          return;
        }

        if (req.method === "GET") {
          // Return stored debug data for the agent
          const stored = readLogs();
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(stored));
          return;
        }

        res.statusCode = 405;
        res.end(JSON.stringify({ error: "Method not allowed" }));
      });
    },

    // Inject debug-collector script into HTML pages
    transformIndexHtml(html) {
      // Inject the script tag right after <head>
      const scriptTag = '<script src="/__rubic__/debug-collector.js" defer></script>';
      if (html.includes("</head>")) {
        return html.replace("</head>", `  ${scriptTag}\n</head>`);
      }
      // Fallback: prepend
      return scriptTag + "\n" + html;
    },
  };
}
