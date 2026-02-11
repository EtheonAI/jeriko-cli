import { buildSystemPrompt } from "./prompt-builder.js";
import { compactHistory, type CompactMessage } from "./context-compactor.js";
import { getBaseTools } from "./tool-registry.js";
import { z } from "zod";

type AiGenerateText = typeof import("ai").generateText;
type AiTool = typeof import("ai").tool;
type AnthropicFactory = typeof import("@ai-sdk/anthropic").createAnthropic;

export interface AgentLoopInput {
  messages: CompactMessage[];
  skills: string[];
  relatedKnowledge: string[];
  maxSteps?: number;
}

export interface AgentLoopEvent {
  type: string;
  timestamp: string;
  [key: string]: unknown;
}

function nowIso() {
  return new Date().toISOString();
}

export async function runAgentLoop(input: AgentLoopInput) {
  const { kept, compactedHistory } = compactHistory(input.messages);
  const prompt = buildSystemPrompt({
    skills: input.skills,
    relatedKnowledge: input.relatedKnowledge,
  });
  const timestamp = nowIso();

  const lastUserMessage = [...kept].reverse().find((m) => m.role === "user")?.content ?? "";
  let assistantText = `Processed request: ${lastUserMessage}`.trim();
  const events: AgentLoopEvent[] = [];

  events.push({ type: "start", timestamp, sessionId: "runtime", messageId: `msg_${Date.now()}` });

  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  const anthropicBaseUrl = process.env.ANTHROPIC_BASE_URL;
  const anthropicModel = process.env.ORCHESTRATOR_MODEL || "claude-sonnet-4-5-20250929";

  if (anthropicApiKey) {
    try {
      const { generateText, tool } = (await import("ai")) as {
        generateText: AiGenerateText;
        tool: AiTool;
      };
      const { createAnthropic } = (await import("@ai-sdk/anthropic")) as {
        createAnthropic: AnthropicFactory;
      };

      const anthropic = createAnthropic({
        apiKey: anthropicApiKey,
        ...(anthropicBaseUrl ? { baseURL: anthropicBaseUrl } : {}),
      });

      const result = await generateText({
        model: anthropic(anthropicModel),
        system: `${prompt}\n\nYou MUST call the plan tool before final answer when useful.`,
        messages: [{ role: "user", content: lastUserMessage || "Continue the task." }],
        maxSteps: input.maxSteps ?? 8,
        tools: {
          plan: tool({
            description: "Create or update a short execution plan for the task.",
            inputSchema: z.object({
              action: z.enum(["create", "update"]).default("create"),
              steps: z.array(z.string()).default([]),
            }),
            execute: async (args: { action: "create" | "update"; steps: string[] }) => {
              const toolCallId = `tc_${Date.now()}_plan`;
              events.push({
                type: "tool_call.start",
                timestamp: nowIso(),
                toolCallId,
                toolName: "plan",
                args,
              });
              const output = {
                ok: true,
                plan: {
                  action: args.action,
                  steps: args.steps.length
                    ? args.steps
                    : ["Understand request", "Execute", "Return result"],
                },
              };
              events.push({
                type: "tool_call.result",
                timestamp: nowIso(),
                toolCallId,
                result: output,
              });
              return output;
            },
          }),
          message: tool({
            description: "Emit a progress/info/result message.",
            inputSchema: z.object({
              type: z.enum(["info", "ask", "result"]).default("info"),
              content: z.string(),
            }),
            execute: async (args: { type: "info" | "ask" | "result"; content: string }) => {
              const toolCallId = `tc_${Date.now()}_message`;
              events.push({
                type: "tool_call.start",
                timestamp: nowIso(),
                toolCallId,
                toolName: "message",
                args,
              });
              const output = { ok: true };
              events.push({
                type: "tool_call.result",
                timestamp: nowIso(),
                toolCallId,
                result: output,
              });
              events.push({
                type: "message.tool",
                timestamp: nowIso(),
                messageType: args.type,
                content: args.content,
              });
              return output;
            },
          }),
        },
      });

      assistantText = (result.text || assistantText).trim();
    } catch (error) {
      events.push({
        type: "orchestrator.warning",
        timestamp: nowIso(),
        message: "AI SDK loop failed, using fallback response",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  } else {
    events.push({
      type: "orchestrator.warning",
      timestamp: nowIso(),
      message: "ANTHROPIC_API_KEY not configured; using fallback loop",
    });
  }

  events.push({ type: "text-start", timestamp: nowIso() });
  events.push({ type: "text-delta", timestamp: nowIso(), delta: assistantText });
  events.push({ type: "text-end", timestamp: nowIso() });
  events.push({ type: "message.complete", timestamp: nowIso(), content: assistantText });
  events.push({ type: "finish", timestamp: nowIso(), finishReason: "stop" });

  return {
    ok: true,
    systemPrompt: prompt,
    compactedHistory,
    events,
    assistantMessage: assistantText,
    availableTools: getBaseTools().map((t) => t.name),
    stepsBudget: input.maxSteps ?? 12,
    messageCount: kept.length,
  };
}
