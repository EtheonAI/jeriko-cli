/**
 * Streaming agent loop — uses AI SDK streamText with all tools.
 * Returns a ReadableStream of SSE events following the UIMessage stream protocol.
 */

import { streamText, stepCountIs, type ModelMessage, type LanguageModel } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createAllTools, type ToolContext } from "./tools/index.js";
import { buildManusSystemPrompt, type SystemPromptContext } from "./system-prompt.js";
import { getOrCreateSandbox } from "./e2b-manager.js";

export interface AgentLoopInput {
  sessionId: string;
  userId: string;
  userName?: string;
  messages: ModelMessage[];
  maxSteps?: number;
  abortSignal?: AbortSignal;
}

export interface AgentLoopResult {
  stream: ReadableStream<Uint8Array>;
  sandboxId: string | null;
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
  const { sessionId, userId, userName, messages, maxSteps = 25, abortSignal } = input;

  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  const openaiApiKey = process.env.OPENAI_API_KEY;
  const anthropicModel = process.env.ORCHESTRATOR_MODEL || "claude-sonnet-4-5-20250929";
  const openaiModel = process.env.OPENAI_MODEL || "gpt-4o";
  const anthropicBaseUrl = process.env.ANTHROPIC_BASE_URL;

  // Create sandbox (lazy — won't block if sandbox service is down)
  let sandboxId: string | null = null;
  let e2bSandboxId: string | null = null;
  let nekoUrl: string | null = null;
  try {
    const sandbox = await getOrCreateSandbox(sessionId, userId);
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

  // Build system prompt
  const promptCtx: SystemPromptContext = {
    userName,
    sessionId,
    sandboxId: sandboxId || undefined,
    currentDate: new Date().toISOString().split("T")[0] ?? new Date().toISOString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };

  // Create all tools
  const tools = createAllTools(toolCtx);

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

  // Get the UIMessage stream response and extract its body
  const response = result.toUIMessageStreamResponse({
    headers: {
      "x-vercel-ai-ui-message-stream": "v1",
    },
  });

  const uiStream = response.body;
  if (!uiStream) {
    throw new Error("Failed to create UI message stream");
  }

  // Wrap stream to inject sandbox_info metadata at the start
  if (sandboxId) {
    const wrappedStream = new ReadableStream<Uint8Array>({
      async start(controller) {
        // Send sandbox info as first metadata event
        controller.enqueue(
          sseEvent({
            type: "message-metadata",
            sandboxId,
            ...(nekoUrl ? { nekoUrl } : {}),
          })
        );

        const reader = uiStream.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            controller.enqueue(value);
          }
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : "Stream error";
          controller.enqueue(sseEvent({ type: "error", error: errMsg }));
        } finally {
          controller.close();
        }
      },
    });

    return { stream: wrappedStream, sandboxId };
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
        const response = await fetch(fileUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path }),
          signal: AbortSignal.timeout(30000),
        });
        if (!response.ok) return path;
        const data = (await response.json()) as Record<string, unknown>;
        const content = data.content as string;
        if (!content) return path;

        const fileName = path.split("/").pop() || "file";
        const key = `uploads/${userId}/sandbox/${Date.now()}_${fileName}`;

        const { uploadFile, getPresignedUrl } = await import("@repo/storage");
        await uploadFile(key, Buffer.from(content, "utf-8"));
        return await getPresignedUrl(key, 86400, true);
      } catch (error) {
        console.error("Storage uploadFromSandbox failed, returning path:", error);
        return path;
      }
    },
  };
}

// ── Default search provider (DuckDuckGo HTML scraping) ──

function createDefaultSearchProvider(): ToolContext["searchProvider"] {
  return {
    search: async (params) => {
      try {
        const query = encodeURIComponent(params.query);
        const response = await fetch(`https://html.duckduckgo.com/html/?q=${query}`, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; RubicBot/1.0)" },
          signal: AbortSignal.timeout(10000),
        });
        const html = await response.text();

        // Extract search results from DuckDuckGo HTML
        const results: Array<{ title: string; url: string; snippet: string }> = [];
        const resultRegex = /<a[^>]+class="result__a"[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/gi;
        const snippetRegex = /<a[^>]+class="result__snippet"[^>]*>([^<]*)<\/a>/gi;

        let match;
        while ((match = resultRegex.exec(html)) !== null) {
          const url =
            decodeURIComponent(match[1] ?? "")
              .replace(/^\/\/duckduckgo\.com\/l\/\?uddg=/, "")
              .split("&")[0] ?? "";
          const title = match[2] ?? "";
          const snippetMatch = snippetRegex.exec(html);
          results.push({
            title,
            url,
            snippet: snippetMatch?.[1] ?? "",
          });
          if (results.length >= 10) break;
        }

        return results;
      } catch {
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
