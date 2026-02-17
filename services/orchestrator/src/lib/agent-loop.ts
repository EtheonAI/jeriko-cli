/**
 * Streaming agent loop — uses AI SDK streamText with all tools.
 * Returns a ReadableStream of SSE events following the UIMessage stream protocol.
 */

import { streamText, stepCountIs, type ModelMessage, type LanguageModel } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import {
  createAllTools,
  fetchComposioTools,
  createConnectorTools,
  groupToolsByApp,
  type ToolContext,
  type ComposioToolSpec,
} from "./tools/index.js";
import { buildManusSystemPrompt, type SystemPromptContext } from "./system-prompt.js";
import { getOrCreateSandbox } from "./e2b-manager.js";
import { getRsaHeaders } from "./rsa-auth.js";

export interface AgentLoopInput {
  sessionId: string;
  userId: string;
  userName?: string;
  messages: ModelMessage[];
  maxSteps?: number;
  skills?: string[];
  connections?: { id: string; type?: string; name?: string }[];
  fileContext?: { name: string; type: string; url?: string }[];
  /** Session metadata from DB — used for sandbox recovery (contains sandboxId from previous runs) */
  sessionMeta?: Record<string, unknown>;
  abortSignal?: AbortSignal;
}

export interface AgentLoopResult {
  stream: ReadableStream<Uint8Array>;
  sandboxId: string | null;
}

/** Extract file references from user messages for system prompt context. */
function extractFileContext(messages: ModelMessage[]): { name: string; type: string }[] {
  const files: { name: string; type: string }[] = [];
  for (const msg of messages) {
    if (msg.role !== "user" || typeof msg.content === "string") continue;
    if (!Array.isArray(msg.content)) continue;
    for (const part of msg.content) {
      const p = part as unknown as Record<string, unknown>;
      if (p.type === "file" || p.type === "image") {
        files.push({
          name: (p.filename as string) || (p.url as string)?.split("/").pop() || "unnamed",
          type: (p.mediaType as string) || (p.mimeType as string) || "application/octet-stream",
        });
      }
    }
  }
  return files;
}

const encoder = new TextEncoder();

function sseEvent(data: Record<string, unknown>): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
}

/**
 * Run the streaming agent loop.
 * Returns a ReadableStream that emits SSE events compatible with UIMessage stream protocol.
 */
export async function runStreamingAgentLoop(input: AgentLoopInput): Promise<AgentLoopResult> {
  const {
    sessionId,
    userId,
    userName,
    messages,
    maxSteps = 25,
    skills,
    connections,
    fileContext: inputFileContext,
    sessionMeta,
    abortSignal,
  } = input;

  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  const openaiApiKey = process.env.OPENAI_API_KEY;
  const anthropicModel = process.env.ORCHESTRATOR_MODEL || "claude-sonnet-4-5-20250929";
  const openaiModel = process.env.OPENAI_MODEL || "gpt-4o";
  const anthropicBaseUrl = process.env.ANTHROPIC_BASE_URL;

  // Create sandbox (lazy — won't block if sandbox service is down)
  // Passes sessionMeta so e2b-manager can try to resume an existing sandbox
  // from DB-stored sandboxId (Manus: hibernate/wake pattern).
  let sandboxId: string | null = null;
  let e2bSandboxId: string | null = null;
  let nekoUrl: string | null = null;
  try {
    const sandbox = await getOrCreateSandbox(sessionId, userId, sessionMeta);
    sandboxId = sandbox.sandboxId;
    e2bSandboxId = sandbox.e2bSandboxId;
    nekoUrl = sandbox.nekoUrl;
  } catch {
    // Sandbox not available — tools requiring sandbox will fail gracefully
  }

  // Build tool context
  // terminalServerUrl uses the e2b sandbox ID for E2B port proxying
  // Format: https://{port}-{e2b_sandbox_id}.e2b.dev
  // LOCAL_SANDBOX_URL override: use local Docker container for testing
  const localSandboxUrl = process.env.LOCAL_SANDBOX_URL || "";
  const sandboxIdForUrl = e2bSandboxId || sandboxId;
  const terminalServerUrl = localSandboxUrl
    ? localSandboxUrl
    : sandboxIdForUrl
      ? `https://8330-${sandboxIdForUrl}.${process.env.SANDBOX_DOMAIN || "e2b.dev"}`
      : "";

  const toolCtx: ToolContext = {
    sessionId,
    userId,
    userName,
    db: createNoopDb(),
    sandboxId: sandboxId || "no-sandbox",
    terminalServerUrl: terminalServerUrl || "no-sandbox",
    e2bSandboxId: e2bSandboxId || sandboxId || "",
    ws: createNoopWs(),
    storage: createStorageClient(),
    searchProvider: createDefaultSearchProvider(),
    imageProvider: createDefaultImageProvider(),
  };

  // ── Download uploaded files to sandbox ~/upload/ ───────────────────────
  // If the user attached files and a sandbox is available, download them
  // so the agent can read them with file_read.
  // Uses terminal server's /terminal/{id}/write API with RSA headers.
  const filesToDownload = inputFileContext?.filter((f) => f.url) ?? [];
  if (filesToDownload.length > 0 && terminalServerUrl && terminalServerUrl !== "no-sandbox") {
    // Ensure "upload" terminal exists
    try {
      const createBody = JSON.stringify({ id: "upload" });
      const createHeaders = getRsaHeaders(createBody);
      await fetch(`${terminalServerUrl}/terminal/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...createHeaders },
        body: createBody,
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      // Terminal may already exist — not fatal
    }

    await Promise.allSettled(
      filesToDownload.map(async (f) => {
        const safeName = (f.name || "file").replace(/[^a-zA-Z0-9._-]/g, "_");
        try {
          const cmd = `mkdir -p ~/upload && curl -sL -o ~/upload/${safeName} "${f.url}"\n`;
          const writeBody = JSON.stringify({ text: cmd });
          const writeHeaders = getRsaHeaders(writeBody);
          await fetch(`${terminalServerUrl}/terminal/upload/write`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...writeHeaders },
            body: writeBody,
            signal: AbortSignal.timeout(35_000),
          });
          // Wait for download to complete
          await new Promise((r) => setTimeout(r, 3000));
        } catch {
          // Non-critical — agent can still access files via URL
        }
      })
    );
  }

  // ── Auto-sync skills to sandbox ──────────────────────────────────────
  // If skills are active and sandbox is available, sync skill files
  // so the agent can read skill definitions from ~/skills/.
  if (skills && skills.length > 0 && terminalServerUrl && terminalServerUrl !== "no-sandbox") {
    try {
      const skillsBody = JSON.stringify({ skill_ids: skills, user_id: userId, session_id: sessionId });
      const skillsHeaders = getRsaHeaders(skillsBody);
      await fetch(`${terminalServerUrl}/skills/sync-skills`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...skillsHeaders },
        body: skillsBody,
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      // Non-critical — built-in skill definitions still injected via system prompt
    }
  }

  // ── Dynamic Composio tools ──────────────────────────────────────────────
  // Fetch user's connected Composio tools from connector service.
  // Runs in parallel with sandbox creation — gracefully returns [] if unavailable.
  let composioSpecs: ComposioToolSpec[] = [];
  try {
    composioSpecs = await fetchComposioTools(userId);
    if (composioSpecs.length > 0) {
      console.log(`[agent-loop] Loaded ${composioSpecs.length} Composio tools for user ${userId}`);
    }
  } catch {
    // Connector service down — continue with static tools only
  }

  // Convert specs → AI SDK tools
  const dynamicTools =
    composioSpecs.length > 0 ? createConnectorTools(toolCtx, composioSpecs) : undefined;

  // Group tool names by app for system prompt injection
  const composioToolsByApp = composioSpecs.length > 0 ? groupToolsByApp(composioSpecs) : undefined;

  // ── Manus-parity: Inject MCP config into sandbox ──────────────────────
  // Write builtin_tools.json + set ENABLED_MCP_SERVERS so rubic-mcp-cli
  // and sandbox code can discover and use connected tools.
  if (composioSpecs.length > 0 && terminalServerUrl && terminalServerUrl !== "no-sandbox") {
    const enabledApps = [...new Set(composioSpecs.map((s) => s.appName.toLowerCase()))];
    const builtinTools = {
      generated_at: new Date().toISOString(),
      tool_names: composioSpecs.map((s) => (s.name || "").toLowerCase()),
      servers: Object.entries(composioToolsByApp ?? {}).map(([app, _toolNames]) => ({
        name: app,
        description: `${app.charAt(0).toUpperCase() + app.slice(1)} tools.`,
        tools: composioSpecs
          .filter((s) => s.appName.toLowerCase() === app)
          .map((s) => ({
            name: (s.name || "").toLowerCase(),
            description: s.description || "",
            parameters: s.parameters || {},
          })),
      })),
    };

    // Fire-and-forget: write builtin_tools.json + set env vars in sandbox
    // Both calls need RSA signing for the rubic-desktop sandbox runtime.
    const fileBody = JSON.stringify({
      path: "/tmp/rubic-mcp/builtin_tools.json",
      content: JSON.stringify(builtinTools, null, 2),
    });
    const envBody = JSON.stringify({
      enabledBuiltInMCP: enabledApps,
    });

    Promise.allSettled([
      // Write builtin_tools.json via /file/write endpoint (Manus pattern)
      fetch(`${terminalServerUrl}/file/write`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getRsaHeaders(fileBody) },
        body: fileBody,
        signal: AbortSignal.timeout(12_000),
      }),
      // Set ENABLED_MCP_SERVERS env var (Manus pattern)
      fetch(`${terminalServerUrl}/config/set-env`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getRsaHeaders(envBody) },
        body: envBody,
        signal: AbortSignal.timeout(10_000),
      }),
    ]).catch(() => {
      // Non-critical — first-class AI SDK tools still work
    });
  }

  // Build system prompt — thread skills, connections, and dynamic tool names
  const enabledMcpServers = composioSpecs.length > 0
    ? [...new Set(composioSpecs.map((s) => s.appName.toLowerCase()))]
    : undefined;

  const promptCtx: SystemPromptContext = {
    userName,
    sessionId,
    sandboxId: sandboxId || undefined,
    currentDate: new Date().toISOString().split("T")[0] ?? new Date().toISOString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    activeSkills: skills,
    connectedApps: connections?.map((c) => c.name || c.id),
    selectedConnections: connections,
    fileContext: inputFileContext?.length ? inputFileContext : extractFileContext(messages),
    composioToolsByApp,
    enabledMcpServers,
  };

  // Create all tools — webdev mode + dynamic Composio tools
  const tools = createAllTools(toolCtx, "webdev", dynamicTools);

  // If no API key at all, return a fallback stream
  if (!anthropicApiKey && !openaiApiKey) {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const id = `text-${Date.now()}`;
        controller.enqueue(sseEvent({ type: "start" }));
        controller.enqueue(sseEvent({ type: "text-start", id }));
        controller.enqueue(
          sseEvent({
            type: "text-delta",
            id,
            delta:
              "No LLM API key configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY in the orchestrator environment.",
          })
        );
        controller.enqueue(sseEvent({ type: "text-end", id }));
        controller.enqueue(sseEvent({ type: "finish", finishReason: "stop" }));
        controller.close();
      },
    });
    return { stream, sandboxId };
  }

  // Build model — controlled by LLM_PROVIDER env var, defaults to auto-detect
  const provider = process.env.LLM_PROVIDER || "auto";
  let model: LanguageModel;

  if (provider === "openai" || (provider === "auto" && !anthropicApiKey && openaiApiKey)) {
    const openai = createOpenAI({ apiKey: openaiApiKey! });
    model = openai(openaiModel);
  } else {
    const anthropic = createAnthropic({
      apiKey: anthropicApiKey!,
      ...(anthropicBaseUrl ? { baseURL: anthropicBaseUrl } : {}),
    });
    model = anthropic(anthropicModel);
  }

  let systemPrompt: string;
  try {
    systemPrompt = buildManusSystemPrompt(promptCtx);
  } catch {
    systemPrompt =
      "You are Rubic, a helpful AI assistant with access to tools for file operations, shell commands, browser control, code execution, web search, and deployment.";
  }

  // Run streamText with all tools
  const result = streamText({
    model,
    system: systemPrompt,
    messages,
    maxOutputTokens: 16384,
    stopWhen: stepCountIs(maxSteps),
    tools,
    abortSignal,
  });

  // Build sandbox metadata for message-metadata events
  // nekoUrl is included so the frontend can offer "Take Control" → Neko WebRTC iframe.
  // The BrowserView only shows the iframe when user explicitly clicks Take Control
  // (not automatically), so the Neko readiness race condition is avoided.
  const sandboxMeta = sandboxId ? { sandboxId, ...(nekoUrl ? { nekoUrl } : {}) } : undefined;

  // Get the UIMessage stream response using the proper messageMetadata callback
  // AI SDK v6 sends metadata via protocol-compliant message-metadata events
  const response = result.toUIMessageStreamResponse({
    headers: {
      "x-vercel-ai-ui-message-stream": "v1",
    },
    ...(sandboxMeta
      ? {
          messageMetadata: ({ part }: { part: { type: string } }) => {
            // Send sandbox metadata at stream start so client gets it immediately
            if (part.type === "start") {
              return sandboxMeta;
            }
            return undefined;
          },
        }
      : {}),
  });

  const uiStream = response.body;
  if (!uiStream) {
    throw new Error("Failed to create UI message stream");
  }

  return { stream: uiStream, sandboxId };
}

// ── Noop implementations for services not yet connected ──

function createNoopDb(): ToolContext["db"] {
  return {
    insertMessage: async () => ({
      id: `msg_${Date.now()}`,
      sessionId: "",
      role: "assistant",
      content: "",
      createdAt: new Date(),
    }),
    insertManusPage: async () => ({
      id: `page_${Date.now()}`,
      userId: "",
      title: "",
      content: "",
      isPublic: false,
      createdAt: new Date(),
    }),
    query: {},
  };
}

function createNoopWs(): ToolContext["ws"] {
  return {
    emit: async () => {},
  };
}

function createStorageClient(): ToolContext["storage"] {
  // If S3 is configured, use real upload. Otherwise gracefully return original URL.
  const hasS3 = !!process.env.AWS_ACCESS_KEY_ID || !!process.env.S3_ENDPOINT;

  return {
    uploadFromUrl: async (url: string, userId: string) => {
      if (!hasS3) return url;
      try {
        // Download the file then upload to S3
        const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
        if (!response.ok) return url;
        const buffer = Buffer.from(await response.arrayBuffer());
        const ext = url.split(".").pop()?.split("?")[0] || "bin";
        const key = `uploads/${userId}/images/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const contentType = response.headers.get("content-type") || "application/octet-stream";

        const { uploadFile, getPresignedUrl } = await import("@repo/storage");
        await uploadFile(key, buffer, contentType);
        return await getPresignedUrl(key, 86400, true);
      } catch (error) {
        console.error("Storage uploadFromUrl failed, returning original URL:", error);
        return url;
      }
    },
    uploadFromSandbox: async (sandboxId: string, path: string, userId: string) => {
      if (!hasS3) return path;
      try {
        // Download file from sandbox, upload to S3
        const domain = process.env.SANDBOX_DOMAIN || "e2b.dev";
        const fileUrl = `https://8330-${sandboxId}.${domain}/file/read`;
        const body = JSON.stringify({ path });
        const rsaHeaders = getRsaHeaders(body);
        const response = await fetch(fileUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...rsaHeaders },
          body,
          signal: AbortSignal.timeout(30000),
        });
        if (!response.ok) return path;
        const data = (await response.json()) as Record<string, unknown>;
        const content = data.content as string;
        if (!content) return path;

        // Sandbox /file/read returns encoding: "base64" for binary files,
        // no encoding field (or "utf-8") for text files.
        const encoding = data.encoding as string | undefined;
        const buffer = encoding === "base64"
          ? Buffer.from(content, "base64")
          : Buffer.from(content, "utf-8");

        const fileName = path.split("/").pop() || "file";
        const ext = fileName.slice(fileName.lastIndexOf(".")).toLowerCase();
        const mimeMap: Record<string, string> = {
          ".pdf": "application/pdf", ".png": "image/png", ".jpg": "image/jpeg",
          ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp",
          ".svg": "image/svg+xml", ".mp4": "video/mp4", ".mp3": "audio/mpeg",
          ".zip": "application/zip", ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        };
        const contentType = mimeMap[ext] || "application/octet-stream";
        const key = `uploads/${userId}/sandbox/${Date.now()}_${fileName}`;

        const { uploadFile, getPresignedUrl } = await import("@repo/storage");
        await uploadFile(key, buffer, contentType);
        return await getPresignedUrl(key, 86400, true);
      } catch (error) {
        console.error("Storage uploadFromSandbox failed, returning path:", error);
        return path;
      }
    },
  };
}

// ── Default search provider (Bing HTML scraping) ──
// DuckDuckGo blocks server-side requests with CAPTCHA (HTTP 202) as of Feb 2026.
// Bing is used as the fallback — returns real results without bot detection.

function createDefaultSearchProvider(): ToolContext["searchProvider"] {
  return {
    search: async (params) => {
      try {
        const response = await fetch(
          `https://www.bing.com/search?q=${encodeURIComponent(params.query)}&count=10`,
          {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
              "Accept": "text/html,application/xhtml+xml",
              "Accept-Language": "en-US,en;q=0.9",
            },
            signal: AbortSignal.timeout(12000),
          }
        );

        if (!response.ok) return [];
        const html = await response.text();

        // Bing organic results: <li class="b_algo">
        //   <h2><a href="...">Title</a></h2>
        //   <cite>display-url</cite>
        //   <p>Snippet</p>
        const items = html.split(/<li[^>]*class="b_algo"[^>]*>/i).slice(1);
        const results: Array<{ title: string; url: string; snippet: string }> = [];

        for (const item of items) {
          // Title from <h2><a>
          const titleMatch = item.match(/<h2[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i);
          if (!titleMatch) continue;
          const title = (titleMatch[1] ?? "").replace(/<[^>]*>/g, "").trim();

          // URL from <cite> — Bing shows display URLs like "site.com › path"
          const citeMatch = item.match(/<cite[^>]*>([\s\S]*?)<\/cite>/i);
          let url = "";
          if (citeMatch) {
            url = (citeMatch[1] ?? "").replace(/<[^>]*>/g, "").trim();
            // Convert Bing display format: "site.com › path › sub" → "site.com/path/sub"
            url = url.replace(/\s*›\s*/g, "/");
            if (url && !url.startsWith("http")) url = "https://" + url;
          }

          // Snippet from paragraph or description span
          const snippetMatch =
            item.match(/<p[^>]*>([\s\S]*?)<\/p>/i) ??
            item.match(/<span[^>]*class="[^"]*b_(?:lineclamp|paractl|descript)[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
          const snippet = snippetMatch
            ? (snippetMatch[1] ?? "").replace(/<[^>]*>/g, "").trim()
            : "";

          if (url && title) {
            results.push({ title, url, snippet });
          }
          if (results.length >= 10) break;
        }

        console.log(`[search] Bing query="${params.query}" status=${response.status} results=${results.length}`);
        return results;
      } catch (err) {
        console.error("[search] Error:", err);
        return [];
      }
    },
  };
}

// ── Default image provider (OpenAI DALL-E) ──

function createDefaultImageProvider(): ToolContext["imageProvider"] {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) return undefined;

  return {
    generate: async (params) => {
      const response = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: "dall-e-3",
          prompt: params.prompt,
          size: params.size || "1024x1024",
          n: 1,
        }),
        signal: AbortSignal.timeout(60000),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(`Image generation failed (${response.status}): ${text}`);
      }

      const data = (await response.json()) as { data: Array<{ url: string }> };
      return { url: data.data[0]?.url ?? "" };
    },
  };
}
