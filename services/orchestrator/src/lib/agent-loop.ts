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
import { meterStep, meterTool } from "./billing-client.js";

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
  /** Project ID for project-scoped Composio entity routing */
  projectId?: string;
  abortSignal?: AbortSignal;
  /** Plan limits from billing service — used for parallel subtask caps */
  planLimits?: {
    maxParallelSubtasks: number;
    planType: string;
  };
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

// ── Context compaction (Manus parity: <compacted_history>) ───────────────
// Prevents hitting the 200K token limit on long conversations by compressing
// old tool results while keeping recent messages intact.

/** Rough token estimate: 4 chars ≈ 1 token. */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function estimateMessageTokens(messages: ModelMessage[]): number {
  let total = 0;
  for (const msg of messages) {
    if (typeof msg.content === "string") {
      total += estimateTokens(msg.content);
    } else if (Array.isArray(msg.content)) {
      for (const part of msg.content) {
        const p = part as Record<string, unknown>;
        if (p.type === "text") total += estimateTokens(p.text as string);
        else if (p.type === "image") total += 500;
        else if (p.type === "tool-result") {
          const result = p.result as unknown;
          total += estimateTokens(typeof result === "string" ? result : JSON.stringify(result ?? ""));
        }
      }
    }
  }
  return total;
}

/**
 * Compact old messages when approaching context limit.
 * Keeps the most recent `recentKeep` messages, summarizes older tool results.
 */
function compactMessages(
  messages: ModelMessage[],
  systemPromptTokens: number,
  contextLimit = 180000,
): ModelMessage[] {
  const msgTokens = estimateMessageTokens(messages);
  const threshold = contextLimit - systemPromptTokens;

  if (msgTokens < threshold) return messages;

  console.log(`[agent-loop] Context compaction: ~${msgTokens} tokens > ${threshold} threshold`);

  // Keep recent 20 messages (≈10 turns)
  const recentKeep = Math.min(20, messages.length);
  const oldMessages = messages.slice(0, messages.length - recentKeep);
  const recentMessages = messages.slice(messages.length - recentKeep);

  if (oldMessages.length === 0) return messages;

  // Build compacted history from old messages
  const summaries: string[] = [];
  for (const msg of oldMessages) {
    const content = typeof msg.content === "string"
      ? msg.content
      : JSON.stringify(msg.content);

    if (msg.role === "tool") {
      summaries.push(`[Tool result]: ${content.slice(0, 200)}${content.length > 200 ? "..." : ""}`);
    } else if (msg.role === "assistant" && content.length < 300) {
      summaries.push(`[Assistant]: ${content}`);
    } else if (msg.role === "user" && content.length < 300) {
      summaries.push(`[User]: ${content}`);
    }
  }

  const compactedMessage: ModelMessage = {
    role: "user" as const,
    content: `<compacted_history>
The following is a summary of earlier conversation turns. Refer to this for context:

${summaries.slice(0, 50).join("\n")}
${summaries.length > 50 ? `\n... (${summaries.length - 50} earlier entries omitted) ...` : ""}
</compacted_history>`,
  };

  return [compactedMessage, ...recentMessages];
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
    projectId,
    abortSignal,
    planLimits,
  } = input;

  // Error retry counter (Manus parity: terminate after 3 consecutive failures on same tool)
  let consecutiveErrors = 0;
  let lastFailedTool = "";

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
    projectId,
    db: createNoopDb(),
    sandboxId: sandboxId || "no-sandbox",
    terminalServerUrl: terminalServerUrl || "no-sandbox",
    e2bSandboxId: e2bSandboxId || sandboxId || "",
    ws: createNoopWs(),
    storage: createStorageClient(),
    searchProvider: createDefaultSearchProvider(),
    imageProvider: createDefaultImageProvider(),
    planLimits,
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
    composioSpecs = await fetchComposioTools(userId, projectId);
    if (composioSpecs.length > 0) {
      console.log(`[agent-loop] Loaded ${composioSpecs.length} Composio tools for user ${userId}`);
    }
  } catch {
    // Connector service down — continue with static tools only
  }

  // Convert specs → AI SDK tools
  const dynamicTools =
    composioSpecs.length > 0 ? createConnectorTools(toolCtx, composioSpecs) : undefined;

  // Group tool names by app for system prompt injection.
  // groupToolsByApp skips static tools (gmail, outlook etc) — but the system prompt
  // needs to know ALL connected apps. Build a complete map from ALL specs.
  const composioToolsByApp = composioSpecs.length > 0 ? groupToolsByApp(composioSpecs) : undefined;

  // Build a COMPLETE tools-by-app map including ALL tools for ALL connected apps.
  // groupToolsByApp skips tools in STATIC_TOOL_NAMES (gmail_send_email etc), so apps
  // that ONLY have static tools would be missing. We also need to add the static tool
  // names (gmail_send, outlook_send etc) so the system prompt lists them as available.
  const STATIC_TOOLS_BY_APP: Record<string, string[]> = {
    gmail: ["gmail_send", "gmail_download"],
    outlook: ["outlook_send", "outlook_download"],
  };

  const allToolsByApp: Record<string, string[]> | undefined = composioSpecs.length > 0
    ? (() => {
        const map: Record<string, string[]> = { ...(composioToolsByApp ?? {}) };
        // Add every connected app from Composio specs, even if all its tools are static
        for (const spec of composioSpecs) {
          const app = spec.appName.toLowerCase();
          if (!map[app]) map[app] = [];
          const toolName = spec.name
            .toLowerCase()
            .replace(/[^a-z0-9_]/g, "_")
            .replace(/_+/g, "_")
            .replace(/^_|_$/g, "");
          if (toolName && !map[app]!.includes(toolName)) {
            map[app]!.push(toolName);
          }
        }
        // Add static tool names for apps that have them (gmail_send, outlook_send, etc.)
        for (const [app, staticTools] of Object.entries(STATIC_TOOLS_BY_APP)) {
          if (map[app]) {
            for (const t of staticTools) {
              if (!map[app]!.includes(t)) map[app]!.push(t);
            }
          }
        }
        return map;
      })()
    : undefined;

  // Build list of ALL connected app names (for connectedApps fallback).
  const allConnectedApps = composioSpecs.length > 0
    ? [...new Set(composioSpecs.map((s) => s.appName.charAt(0).toUpperCase() + s.appName.slice(1)))]
    : undefined;

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

  // Fetch user secrets from session metadata (keys stored by settings UI)
  const userSecrets: SystemPromptContext["secrets"] = [];
  if (sessionMeta && typeof sessionMeta === "object") {
    const secrets = (sessionMeta as Record<string, unknown>).secrets;
    if (Array.isArray(secrets)) {
      for (const s of secrets) {
        const sec = s as Record<string, unknown>;
        if (typeof sec.name === "string" && Array.isArray(sec.variables)) {
          userSecrets.push({
            name: sec.name,
            variables: sec.variables as string[],
            description: (sec.description as string) || undefined,
          });
        }
      }
    }
  }

  // Fetch cross-session knowledge from session metadata or knowledge service
  const userKnowledge: SystemPromptContext["knowledge"] = [];
  if (sessionMeta && typeof sessionMeta === "object") {
    const knowledge = (sessionMeta as Record<string, unknown>).knowledge;
    if (Array.isArray(knowledge)) {
      for (const k of knowledge) {
        const item = k as Record<string, unknown>;
        if (typeof item.name === "string" && typeof item.content === "string") {
          userKnowledge.push({
            name: item.name,
            useWhen: (item.useWhen as string) || "always",
            content: item.content,
          });
        }
      }
    }
  }

  const promptCtx: SystemPromptContext = {
    userName,
    sessionId,
    sandboxId: sandboxId || undefined,
    currentDate: new Date().toISOString().split("T")[0] ?? new Date().toISOString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    activeSkills: skills,
    // Use frontend-selected connections first, fall back to auto-detected apps from Composio.
    // IMPORTANT: Use .length check, NOT `??` — empty arrays are non-null so `??` won't fall back.
    connectedApps: connections && connections.length > 0
      ? connections.map((c) => c.name || c.id)
      : allConnectedApps,
    selectedConnections: connections,
    fileContext: inputFileContext?.length ? inputFileContext : extractFileContext(messages),
    composioToolsByApp: allToolsByApp,
    enabledMcpServers,
    secrets: userSecrets.length > 0 ? userSecrets : undefined,
    knowledge: userKnowledge.length > 0 ? userKnowledge : undefined,
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

  // ── Compact messages if approaching context limit ──
  const systemPromptTokens = estimateTokens(systemPrompt);
  const compactedMessages = compactMessages(messages, systemPromptTokens);

  // Run streamText with all tools
  const result = streamText({
    model,
    system: systemPrompt,
    messages: compactedMessages,
    maxOutputTokens: 16384,
    stopWhen: stepCountIs(maxSteps),
    tools,
    abortSignal,
    // Metering hook: called when each step finishes (LLM completion + tool execution)
    onStepFinish: ({ stepType, usage, toolCalls, toolResults }) => {
      // Meter the LLM step (token usage)
      if (usage && (usage.promptTokens > 0 || usage.completionTokens > 0)) {
        meterStep({
          userId,
          sessionId,
          stepId: `step_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          inputTokens: usage.promptTokens,
          outputTokens: usage.completionTokens,
          model: anthropicModel,
        });
      }

      // Meter each tool call + track consecutive errors (Manus parity)
      if (toolCalls && toolCalls.length > 0) {
        for (const tc of toolCalls) {
          meterTool({
            userId,
            sessionId,
            toolName: tc.toolName,
          });
        }

        // Check tool results for errors (Manus: 3 consecutive failures → inject reminder)
        if (toolResults && toolResults.length > 0) {
          const lastResult = toolResults[toolResults.length - 1] as Record<string, unknown> | undefined;
          const resultValue = lastResult?.result ?? lastResult;
          const resultStr = typeof resultValue === "string"
            ? resultValue
            : JSON.stringify(resultValue ?? "");
          const isError = resultStr.includes('"status":"error"') || resultStr.includes('"error":');

          if (isError) {
            const failedTool = toolCalls[toolCalls.length - 1]?.toolName ?? "";
            if (failedTool === lastFailedTool) {
              consecutiveErrors++;
            } else {
              lastFailedTool = failedTool;
              consecutiveErrors = 1;
            }

            if (consecutiveErrors >= 3) {
              console.log(`[agent-loop] Tool ${lastFailedTool} failed 3 times. Agent should try different approach.`);
              consecutiveErrors = 0;
              lastFailedTool = "";
              // The error message in the tool result will guide the agent.
              // AI SDK doesn't support injecting messages mid-stream, but the
              // repeated failure pattern itself signals the agent to change approach.
            }
          } else {
            consecutiveErrors = 0;
            lastFailedTool = "";
          }
        }
      }
    },
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

// ── Default search provider ──
// Manus uses Tavily/Serper/Brave — configure via env vars.
// Priority: Brave > Serper > Tavily > Bing HTML fallback (with ensearch=1 for English).

function createDefaultSearchProvider(): ToolContext["searchProvider"] {
  const braveKey = process.env.BRAVE_SEARCH_API_KEY;
  const serperKey = process.env.SERPER_API_KEY;
  const tavilyKey = process.env.TAVILY_API_KEY;

  return {
    search: async (params) => {
      type SearchResult = { title: string; url: string; snippet: string };

      // ── Brave Search API (free tier: 2000 queries/month) ──
      if (braveKey) {
        try {
          const resp = await fetch(
            `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(params.query)}&count=10`,
            {
              headers: {
                "Accept": "application/json",
                "Accept-Encoding": "gzip",
                "X-Subscription-Token": braveKey,
              },
              signal: AbortSignal.timeout(10000),
            }
          );
          if (resp.ok) {
            const data = (await resp.json()) as { web?: { results?: Array<{ title: string; url: string; description: string }> } };
            const results: SearchResult[] = (data.web?.results ?? []).slice(0, 10).map((r) => ({
              title: r.title, url: r.url, snippet: r.description,
            }));
            if (results.length > 0) {
              console.log(`[search] Brave query="${params.query}" results=${results.length}`);
              return results;
            }
          }
        } catch (err) {
          console.error("[search] Brave error, falling through:", err);
        }
      }

      // ── Serper API (Google results, free tier: 2500 queries) ──
      if (serperKey) {
        try {
          const resp = await fetch("https://google.serper.dev/search", {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-API-KEY": serperKey },
            body: JSON.stringify({ q: params.query, num: 10, gl: "us", hl: "en" }),
            signal: AbortSignal.timeout(10000),
          });
          if (resp.ok) {
            const data = (await resp.json()) as { organic?: Array<{ title: string; link: string; snippet: string }> };
            const results: SearchResult[] = (data.organic ?? []).slice(0, 10).map((r) => ({
              title: r.title, url: r.link, snippet: r.snippet,
            }));
            if (results.length > 0) {
              console.log(`[search] Serper query="${params.query}" results=${results.length}`);
              return results;
            }
          }
        } catch (err) {
          console.error("[search] Serper error, falling through:", err);
        }
      }

      // ── Tavily API (search-optimized, free tier: 1000 queries/month) ──
      if (tavilyKey) {
        try {
          const resp = await fetch("https://api.tavily.com/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ api_key: tavilyKey, query: params.query, max_results: 10, search_depth: "basic" }),
            signal: AbortSignal.timeout(10000),
          });
          if (resp.ok) {
            const data = (await resp.json()) as { results?: Array<{ title: string; url: string; content: string }> };
            const results: SearchResult[] = (data.results ?? []).slice(0, 10).map((r) => ({
              title: r.title, url: r.url, snippet: r.content?.slice(0, 300) ?? "",
            }));
            if (results.length > 0) {
              console.log(`[search] Tavily query="${params.query}" results=${results.length}`);
              return results;
            }
          }
        } catch (err) {
          console.error("[search] Tavily error, falling through:", err);
        }
      }

      // ── DuckDuckGo HTML fallback (more reliable than Bing scraping) ──
      try {
        const ddgResponse = await fetch(
          `https://html.duckduckgo.com/html/?q=${encodeURIComponent(params.query)}`,
          {
            method: "POST",
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
              "Accept": "text/html",
              "Accept-Language": "en-US,en;q=0.9",
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: `q=${encodeURIComponent(params.query)}`,
            signal: AbortSignal.timeout(12000),
          }
        );

        if (ddgResponse.ok) {
          const ddgHtml = await ddgResponse.text();
          const ddgResults: SearchResult[] = [];

          // DuckDuckGo HTML results are in <div class="result results_links results_links_deep web-result">
          // with <a class="result__a"> for title/URL and <a class="result__snippet"> for snippet
          const resultBlocks = ddgHtml.split(/class="result\s+results_links/).slice(1);

          for (const block of resultBlocks) {
            // Extract URL from result__a href
            const urlMatch = block.match(/<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/i);
            if (!urlMatch) continue;

            let url = (urlMatch[1] ?? "").trim();
            const title = (urlMatch[2] ?? "").replace(/<[^>]*>/g, "").trim();

            // DuckDuckGo wraps URLs through a redirect — extract actual URL
            if (url.includes("uddg=")) {
              const uddgMatch = url.match(/uddg=([^&]+)/);
              if (uddgMatch && uddgMatch[1]) {
                url = decodeURIComponent(uddgMatch[1]);
              }
            }
            if (!url.startsWith("http")) continue;

            const snippetMatch = block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/(?:a|div|span)>/i);
            const snippet = snippetMatch
              ? (snippetMatch[1] ?? "").replace(/<[^>]*>/g, "").trim()
              : "";

            if (url && title) ddgResults.push({ title, url, snippet });
            if (ddgResults.length >= 10) break;
          }

          if (ddgResults.length > 0) {
            console.log(`[search] DuckDuckGo fallback query="${params.query}" results=${ddgResults.length}`);
            return ddgResults;
          }
        }
      } catch (err) {
        console.error("[search] DuckDuckGo error, falling through to Bing:", err);
      }

      // ── Bing HTML fallback (last resort) ──
      try {
        const response = await fetch(
          `https://www.bing.com/search?q=${encodeURIComponent(params.query)}&count=10&ensearch=1&setlang=en&mkt=en-US&cc=US`,
          {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
              "Accept": "text/html,application/xhtml+xml",
              "Accept-Language": "en-US,en;q=0.9",
              "Cookie": "SRCHHPGUSR=SRCHLANG=en;ENSEARCH=BENVER=1;",
            },
            signal: AbortSignal.timeout(12000),
          }
        );

        if (!response.ok) return [];
        const html = await response.text();

        const items = html.split(/<li[^>]*class="b_algo"[^>]*>/i).slice(1);
        const results: SearchResult[] = [];

        for (const item of items) {
          // Extract URL from the <a href="..."> inside <h2>
          const linkMatch = item.match(/<h2[^>]*>[\s\S]*?<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/i);
          if (!linkMatch) continue;
          const url = (linkMatch[1] ?? "").trim();
          const title = (linkMatch[2] ?? "").replace(/<[^>]*>/g, "").trim();

          if (!url || !url.startsWith("http")) continue;

          const snippetMatch =
            item.match(/<p[^>]*>([\s\S]*?)<\/p>/i) ??
            item.match(/<span[^>]*class="[^"]*b_(?:lineclamp|paractl|descript)[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
          const snippet = snippetMatch
            ? (snippetMatch[1] ?? "").replace(/<[^>]*>/g, "").trim()
            : "";

          if (url && title) results.push({ title, url, snippet });
          if (results.length >= 10) break;
        }

        console.log(`[search] Bing fallback query="${params.query}" results=${results.length}`);
        return results;
      } catch (err) {
        console.error("[search] Bing error:", err);
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
