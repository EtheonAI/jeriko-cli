/**
 * Parallel task execution tool — spawns N concurrent GPT-4.1-mini agent loops.
 *
 * Results stored on sandbox via /file/store_parallel_tasks_result.
 * Matches Manus parallel_tasks module.
 */

import { tool } from 'ai';
import { z } from 'zod';
import type { ToolContext } from './types.js';
import { getRsaHeaders } from '../rsa-auth.js';

/**
 * Task types for model routing — Manus pattern:
 *   - text/research/code → gpt-4.1-mini (cheap, fast)
 *   - image_generation   → DALL-E 3 (via images API)
 *   - image_analysis     → gpt-4o (has vision capability)
 */
type TaskType = 'text' | 'image_generation' | 'image_analysis' | 'code';

interface ParallelTask {
  task_id: string;
  prompt: string;
  task_type?: TaskType;
}

interface ParallelTaskResult {
  task_id: string;
  status: 'success' | 'error';
  result?: string;
  error?: string;
  model_used?: string;
}

const MAX_CONCURRENT_WORKERS = 4;

/**
 * Execute multiple tasks in parallel using sub-agent LLM (GPT-4.1-mini).
 */
async function executeParallelTasks(
  ctx: ToolContext,
  tasks: ParallelTask[],
): Promise<ParallelTaskResult[]> {
  const baseUrl = ctx.terminalServerUrl;
  if (!baseUrl || baseUrl === 'no-sandbox') {
    return tasks.map((t) => ({
      task_id: t.task_id,
      status: 'error' as const,
      error: 'No sandbox available',
    }));
  }

  // Process in waves of MAX_CONCURRENT_WORKERS
  const results: ParallelTaskResult[] = [];

  for (let i = 0; i < tasks.length; i += MAX_CONCURRENT_WORKERS) {
    const wave = tasks.slice(i, i + MAX_CONCURRENT_WORKERS);
    const waveResults = await Promise.all(
      wave.map((task) => executeOneTask(ctx, baseUrl, task)),
    );
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

  // Image generation keywords
  if (
    lower.includes('generate image') ||
    lower.includes('create image') ||
    lower.includes('draw') ||
    lower.includes('illustration') ||
    lower.includes('generate a picture') ||
    lower.includes('create a picture') ||
    lower.includes('make an image') ||
    lower.includes('design a logo') ||
    lower.includes('dall-e') ||
    lower.includes('dalle')
  ) {
    return 'image_generation';
  }

  // Image analysis keywords (vision tasks)
  if (
    lower.includes('analyze image') ||
    lower.includes('describe image') ||
    lower.includes('what is in this image') ||
    lower.includes('look at this image') ||
    lower.includes('screenshot') ||
    lower.includes('image shows') ||
    lower.includes('ocr') ||
    lower.includes('read the text in')
  ) {
    return 'image_analysis';
  }

  return 'text';
}

/**
 * Get the model to use for a given task type.
 */
function getModelForTaskType(taskType: TaskType): string {
  switch (taskType) {
    case 'image_analysis':
      return 'gpt-4o'; // Has vision capability
    case 'code':
      return 'gpt-4.1-mini'; // Good at code, cheap
    case 'text':
    default:
      return 'gpt-4.1-mini'; // Fast, cheap for research
  }
}

async function executeOneTask(
  ctx: ToolContext,
  baseUrl: string,
  task: ParallelTask,
): Promise<ParallelTaskResult> {
  try {
    const apiKey = process.env.OPENAI_API_KEY || '';
    if (!apiKey) {
      return {
        task_id: task.task_id,
        status: 'error',
        error: 'No OpenAI API key configured for sub-agent',
      };
    }

    const taskType = detectTaskType(task);
    let content: string;
    let modelUsed: string;

    if (taskType === 'image_generation') {
      // Route to DALL-E 3 via images API
      modelUsed = 'dall-e-3';
      const response = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'dall-e-3',
          prompt: task.prompt,
          size: '1024x1024',
          n: 1,
        }),
        signal: AbortSignal.timeout(60000),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        return {
          task_id: task.task_id,
          status: 'error',
          error: `DALL-E error (${response.status}): ${text}`,
          model_used: modelUsed,
        };
      }

      const data = (await response.json()) as { data: Array<{ url: string; revised_prompt?: string }> };
      const imageUrl = data.data[0]?.url ?? '';
      const revisedPrompt = data.data[0]?.revised_prompt ?? '';
      content = JSON.stringify({ image_url: imageUrl, revised_prompt: revisedPrompt });
    } else {
      // Route to chat completions (gpt-4.1-mini or gpt-4o)
      const llmProxyUrl = process.env.OPENAI_API_BASE || 'https://api.openai.com/v1';
      modelUsed = getModelForTaskType(taskType);

      const response = await fetch(`${llmProxyUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: modelUsed,
          messages: [{ role: 'user', content: task.prompt }],
          max_tokens: 4096,
        }),
        signal: AbortSignal.timeout(60000),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        return {
          task_id: task.task_id,
          status: 'error',
          error: `LLM error (${response.status}): ${text}`,
          model_used: modelUsed,
        };
      }

      const data = (await response.json()) as Record<string, unknown>;
      const choices = data.choices as Array<{ message: { content: string } }>;
      content = choices?.[0]?.message?.content || '';
    }

    // Store result on sandbox
    try {
      const storeBody = JSON.stringify({ task_id: task.task_id, result: content });
      const rsaHeaders = getRsaHeaders(storeBody);

      await fetch(`${baseUrl}/file/store_parallel_tasks_result`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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
      status: 'success',
      result: content,
      model_used: modelUsed,
    };
  } catch (error) {
    return {
      task_id: task.task_id,
      status: 'error',
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
        'Execute multiple independent tasks in parallel using sub-agent LLMs (GPT-4.1-mini). ' +
        'Each task gets its own independent completion. Max 4 concurrent workers per wave. ' +
        'Use this for genuinely parallelizable work like researching multiple topics simultaneously.',
      inputSchema: z.object({
        tasks: z.array(
          z.object({
            task_id: z.string().describe('Unique task identifier'),
            prompt: z.string().describe('The task prompt for the sub-agent'),
            task_type: z
              .enum(['text', 'image_generation', 'image_analysis', 'code'])
              .optional()
              .describe('Task type for model routing. text/code→GPT-4.1-mini, image_generation→DALL-E 3, image_analysis→GPT-4o. Auto-detected if omitted.'),
          }),
        ).describe('Array of tasks to execute in parallel'),
      }),
      execute: async (args) => {
        const results = await executeParallelTasks(ctx, args.tasks);
        return {
          status: 'success' as const,
          results,
          totalTasks: args.tasks.length,
          completedTasks: results.filter((r) => r.status === 'success').length,
        };
      },
    }),
  };
}
