/**
 * Parallel task execution tool — spawns N concurrent GPT-4.1-mini agent loops.
 *
 * Results stored on sandbox via /file/store_parallel_tasks_result.
 * Matches Manus parallel_tasks module.
 */

import { tool } from "ai";
import { z } from "zod";
import type { ToolContext } from "./types.js";
import { getRsaHeaders } from "../rsa-auth.js";
import { meterStep, meterTool } from "../billing-client.js";

/**
 * Task types for model routing — Manus pattern:
 *   - text/research/code → gpt-4.1-mini (cheap, fast)
 *   - image_generation   → DALL-E 3 (via images API)
 *   - gemini_image       → Gemini 2.5 Flash (via generateContent API)
 *   - image_analysis     → gpt-4o (has vision capability)
 */
type TaskType =
  | "text"
  | "image_generation"
  | "gemini_image"
  | "image_analysis"
  | "code"
  | "quick"
  | "research";

interface ParallelTask {
  task_id: string;
  prompt: string;
  task_type?: TaskType;
}

interface ParallelTaskResult {
  task_id: string;
  status: "success" | "error";
  result?: string;
  error?: string;
  model_used?: string;
}

const MAX_CONCURRENT_WORKERS = 4;

/**
 * Plan-based task limits (Manus parity):
 *   - Jeriko Light (free): max 5 parallel subtasks
 *   - Jeriko Pro ($39):    max 10 parallel subtasks
 *   - Jeriko Max ($199):   max 20 parallel subtasks
 */
const PLAN_SUBTASK_LIMITS: Record<string, number> = {
  free: 5,
  pro: 10,
  max: 20,
  enterprise: 50,
};

/**
 * Execute multiple tasks in parallel using sub-agent LLM (GPT-4.1-mini).
 * Enforces plan-based limits on number of subtasks.
 */
async function executeParallelTasks(
  ctx: ToolContext,
  tasks: ParallelTask[]
): Promise<ParallelTaskResult[]> {
  const baseUrl = ctx.terminalServerUrl;
  if (!baseUrl || baseUrl === "no-sandbox") {
    return tasks.map((t) => ({
      task_id: t.task_id,
      status: "error" as const,
      error: "No sandbox available",
    }));
  }

  // ── Plan-based subtask limit enforcement ───────────────────────────
  const planType = ctx.planLimits?.planType || "free";
  const maxSubtasks = ctx.planLimits?.maxParallelSubtasks
    ?? PLAN_SUBTASK_LIMITS[planType]
    ?? PLAN_SUBTASK_LIMITS.free!;

  if (tasks.length > maxSubtasks) {
    // Truncate to plan limit and warn
    const truncated = tasks.slice(0, maxSubtasks);
    const skipped = tasks.slice(maxSubtasks);

    console.log(
      `[parallel-tasks] Plan "${planType}" allows max ${maxSubtasks} subtasks. ` +
      `Requested ${tasks.length}, executing ${truncated.length}, skipping ${skipped.length}.`
    );

    const results: ParallelTaskResult[] = [];

    // Execute allowed tasks
    for (let i = 0; i < truncated.length; i += MAX_CONCURRENT_WORKERS) {
      const wave = truncated.slice(i, i + MAX_CONCURRENT_WORKERS);
      const waveResults = await Promise.all(wave.map((task) => executeOneTask(ctx, baseUrl, task)));
      results.push(...waveResults);
    }

    // Return errors for skipped tasks
    for (const task of skipped) {
      results.push({
        task_id: task.task_id,
        status: "error",
        error: `Skipped: your ${planType} plan allows max ${maxSubtasks} parallel subtasks. Upgrade to increase this limit.`,
      });
    }

    return results;
  }

  // Process in waves of MAX_CONCURRENT_WORKERS
  const results: ParallelTaskResult[] = [];

  for (let i = 0; i < tasks.length; i += MAX_CONCURRENT_WORKERS) {
    const wave = tasks.slice(i, i + MAX_CONCURRENT_WORKERS);
    const waveResults = await Promise.all(wave.map((task) => executeOneTask(ctx, baseUrl, task)));
    results.push(...waveResults);
  }

  return results;
}

/**
 * Detect the task type from prompt content for model routing.
 * Manus uses different models for different task types.
 */
function detectTaskType(task: ParallelTask): TaskType {
  // Explicit task_type takes priority
  if (task.task_type) return task.task_type;

  const lower = task.prompt.toLowerCase();

  // Gemini image generation keywords
  if (
    lower.includes("gemini") &&
    (lower.includes("image") || lower.includes("draw") || lower.includes("picture"))
  ) {
    return "gemini_image";
  }

  // Image generation keywords (defaults to DALL-E)
  if (
    lower.includes("generate image") ||
    lower.includes("create image") ||
    lower.includes("draw") ||
    lower.includes("illustration") ||
    lower.includes("generate a picture") ||
    lower.includes("create a picture") ||
    lower.includes("make an image") ||
    lower.includes("design a logo") ||
    lower.includes("dall-e") ||
    lower.includes("dalle")
  ) {
    return "image_generation";
  }

  // Image analysis keywords (vision tasks)
  if (
    lower.includes("analyze image") ||
    lower.includes("describe image") ||
    lower.includes("what is in this image") ||
    lower.includes("look at this image") ||
    lower.includes("screenshot") ||
    lower.includes("image shows") ||
    lower.includes("ocr") ||
    lower.includes("read the text in")
  ) {
    return "image_analysis";
  }

  return "text";
}

/**
 * Get the model to use for a given task type.
 */
function getModelForTaskType(taskType: TaskType): string {
  switch (taskType) {
    case "image_analysis":
      return "gpt-4o"; // Has vision capability
    case "code":
      return "gpt-4.1-mini"; // Good at code, cheap
    case "research":
      return "gpt-4.1-mini"; // Deeper research tasks
    case "quick":
      return "gpt-4.1-nano"; // Ultra-fast, ultra-cheap for simple lookups
    case "text":
    default:
      return "gpt-4.1-mini"; // Fast, cheap for general tasks
  }
}

async function executeOneTask(
  ctx: ToolContext,
  baseUrl: string,
  task: ParallelTask
): Promise<ParallelTaskResult> {
  try {
    const taskType = detectTaskType(task);

    // Gemini tasks need GOOGLE_API_KEY, everything else needs OPENAI_API_KEY
    const apiKey = process.env.OPENAI_API_KEY || "";
    if (taskType !== "gemini_image" && !apiKey) {
      return {
        task_id: task.task_id,
        status: "error",
        error: "No OpenAI API key configured for sub-agent",
      };
    }
    let content: string;
    let modelUsed: string;

    if (taskType === "gemini_image") {
      // Route to Gemini image generation via generateContent API
      const googleApiKey = process.env.GOOGLE_API_KEY || "";
      if (!googleApiKey) {
        return {
          task_id: task.task_id,
          status: "error",
          error: "No GOOGLE_API_KEY configured for Gemini image generation",
        };
      }

      modelUsed = "gemini-2.5-flash-image";
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelUsed}:generateContent`;

      const response = await fetch(geminiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": googleApiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: task.prompt }] }],
          generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
        }),
        signal: AbortSignal.timeout(90000),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        return {
          task_id: task.task_id,
          status: "error",
          error: `Gemini image error (${response.status}): ${text}`,
          model_used: modelUsed,
        };
      }

      const data = (await response.json()) as {
        candidates?: Array<{
          content?: {
            parts?: Array<{
              text?: string;
              inlineData?: { mimeType: string; data: string };
            }>;
          };
        }>;
        usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
      };

      const parts = data.candidates?.[0]?.content?.parts || [];
      const imagePart = parts.find((p) => p.inlineData);
      const textPart = parts.find((p) => p.text);

      if (imagePart?.inlineData) {
        content = JSON.stringify({
          image_base64: imagePart.inlineData.data,
          mime_type: imagePart.inlineData.mimeType,
          description: textPart?.text || "",
        });
      } else {
        content = textPart?.text || "No image generated";
      }

      // ── Meter: Gemini image generation ──
      meterTool({
        userId: ctx.userId,
        sessionId: ctx.sessionId,
        toolName: "image_generation",
        metadata: { subtaskId: task.task_id, model: modelUsed, source: "parallel_tasks" },
      });
      // Meter token usage if available from Gemini response
      if (data.usageMetadata) {
        meterStep({
          userId: ctx.userId,
          sessionId: ctx.sessionId,
          stepId: `subtask_${task.task_id}`,
          inputTokens: data.usageMetadata.promptTokenCount,
          outputTokens: data.usageMetadata.candidatesTokenCount,
          model: modelUsed,
          metadata: { source: "parallel_tasks" },
        });
      }
    } else if (taskType === "image_generation") {
      // Route to DALL-E 3 via images API
      modelUsed = "dall-e-3";
      const response = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "dall-e-3",
          prompt: task.prompt,
          size: "1024x1024",
          n: 1,
        }),
        signal: AbortSignal.timeout(60000),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        return {
          task_id: task.task_id,
          status: "error",
          error: `DALL-E error (${response.status}): ${text}`,
          model_used: modelUsed,
        };
      }

      const data = (await response.json()) as {
        data: Array<{ url: string; revised_prompt?: string }>;
      };
      const imageUrl = data.data[0]?.url ?? "";
      const revisedPrompt = data.data[0]?.revised_prompt ?? "";
      content = JSON.stringify({ image_url: imageUrl, revised_prompt: revisedPrompt });

      // ── Meter: DALL-E image generation (10 credits) ──
      meterTool({
        userId: ctx.userId,
        sessionId: ctx.sessionId,
        toolName: "image_generation",
        metadata: { subtaskId: task.task_id, model: modelUsed, source: "parallel_tasks" },
      });
    } else {
      // Route to chat completions (gpt-4.1-mini or gpt-4o)
      const llmProxyUrl = process.env.OPENAI_API_BASE || "https://api.openai.com/v1";
      modelUsed = getModelForTaskType(taskType);

      const response = await fetch(`${llmProxyUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: modelUsed,
          messages: [{ role: "user", content: task.prompt }],
          max_tokens: 4096,
        }),
        signal: AbortSignal.timeout(60000),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        return {
          task_id: task.task_id,
          status: "error",
          error: `LLM error (${response.status}): ${text}`,
          model_used: modelUsed,
        };
      }

      const data = (await response.json()) as Record<string, unknown>;
      const choices = data.choices as Array<{ message: { content: string } }>;
      content = choices?.[0]?.message?.content || "";

      // ── Meter: subtask LLM token usage ──
      const usage = data.usage as { prompt_tokens?: number; completion_tokens?: number } | undefined;
      if (usage) {
        meterStep({
          userId: ctx.userId,
          sessionId: ctx.sessionId,
          stepId: `subtask_${task.task_id}`,
          inputTokens: usage.prompt_tokens,
          outputTokens: usage.completion_tokens,
          model: modelUsed,
          metadata: { source: "parallel_tasks" },
        });
      }
    }

    // Store result on sandbox
    try {
      const storeBody = JSON.stringify({ task_id: task.task_id, result: content });
      const rsaHeaders = getRsaHeaders(storeBody);

      await fetch(`${baseUrl}/file/store_parallel_tasks_result`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...rsaHeaders,
        },
        body: storeBody,
        signal: AbortSignal.timeout(10000),
      });
    } catch {
      // Non-fatal — result still returned
    }

    return {
      task_id: task.task_id,
      status: "success",
      result: content,
      model_used: modelUsed,
    };
  } catch (error) {
    return {
      task_id: task.task_id,
      status: "error",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Create the parallel_tasks tool definition for AI SDK.
 * Uses proper AI SDK tool() wrapper with Zod inputSchema.
 */
export function createParallelTasksTool(ctx: ToolContext) {
  return {
    parallel_tasks: tool({
      description:
        "Execute multiple independent tasks in parallel using sub-agent LLMs. " +
        "Each sub-task gets its own independent LLM completion (GPT-4.1-mini for text/code/research, " +
        "GPT-4.1-nano for quick tasks, DALL-E 3 for image generation, Gemini 2.5 Flash for image gen, " +
        "GPT-4o for image analysis). Max 4 concurrent workers per wave. " +
        "IMPORTANT: Sub-tasks are limited to text generation and cannot use sandbox tools " +
        "(file_read, shell_exec, browser_navigate, etc.). For tasks that require tool access, " +
        "execute them sequentially in the main agent loop instead.",
      inputSchema: z.object({
        tasks: z
          .array(
            z.object({
              task_id: z.string().describe("Unique task identifier"),
              prompt: z.string().describe("The task prompt for the sub-agent"),
              task_type: z
                .enum([
                  "text",
                  "image_generation",
                  "gemini_image",
                  "image_analysis",
                  "code",
                  "quick",
                  "research",
                ])
                .optional()
                .describe(
                  "Task type for model routing. text/code/research→GPT-4.1-mini, quick→GPT-4.1-nano, image_generation→DALL-E 3, gemini_image→Gemini 2.5 Flash, image_analysis→GPT-4o. Auto-detected if omitted."
                ),
            })
          )
          .describe("Array of tasks to execute in parallel"),
      }),
      execute: async (args) => {
        const results = await executeParallelTasks(ctx, args.tasks);
        return {
          status: "success" as const,
          results,
          totalTasks: args.tasks.length,
          completedTasks: results.filter((r) => r.status === "success").length,
        };
      },
    }),
  };
}
