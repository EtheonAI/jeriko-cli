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

interface ParallelTask {
  task_id: string;
  prompt: string;
}

interface ParallelTaskResult {
  task_id: string;
  status: 'success' | 'error';
  result?: string;
  error?: string;
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

async function executeOneTask(
  ctx: ToolContext,
  baseUrl: string,
  task: ParallelTask,
): Promise<ParallelTaskResult> {
  try {
    // Call OpenAI directly (server-side, real key) for sub-agent completions
    const llmProxyUrl = process.env.OPENAI_API_BASE || 'https://api.openai.com/v1';
    const apiKey = process.env.OPENAI_API_KEY || '';

    if (!apiKey) {
      return {
        task_id: task.task_id,
        status: 'error',
        error: 'No OpenAI API key configured for sub-agent',
      };
    }

    const response = await fetch(`${llmProxyUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
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
      };
    }

    const data = (await response.json()) as Record<string, unknown>;
    const choices = data.choices as Array<{ message: { content: string } }>;
    const content = choices?.[0]?.message?.content || '';

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
