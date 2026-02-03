/**
 * @repo/ai - Parallel Runner
 *
 * High-performance parallel task execution with advanced concurrency control,
 * batching, rate limiting, and result aggregation.
 */

import type { Agent, AgentGenerateResult, TokenUsage } from '../agents/types';
import type { UIMessage } from '../types/ui-message';
import { generateId } from '../streaming';

// ============================================================================
// Parallel Runner Types
// ============================================================================

export interface ParallelTask {
  /** Task identifier */
  id: string;

  /** Task input (messages or text) */
  input: UIMessage[] | string;

  /** Optional agent override */
  agent?: Agent;

  /** Task priority (higher = executed first) */
  priority?: number;

  /** Task group for batching */
  group?: string;

  /** Task metadata */
  metadata?: Record<string, unknown>;
}

export interface ParallelResult {
  /** Task ID */
  taskId: string;

  /** Success status */
  success: boolean;

  /** Result if successful */
  result?: AgentGenerateResult;

  /** Error if failed */
  error?: Error;

  /** Execution duration */
  duration: number;

  /** Task metadata */
  metadata?: Record<string, unknown>;
}

export interface BatchResult {
  /** Batch ID */
  batchId: string;

  /** Individual results */
  results: ParallelResult[];

  /** Total duration */
  duration: number;

  /** Aggregate token usage */
  totalUsage: TokenUsage;

  /** Success rate */
  successRate: number;
}

export interface RunnerProgress {
  /** Progress type */
  type: 'task-start' | 'task-complete' | 'task-error' | 'batch-complete';

  /** Task ID (if applicable) */
  taskId?: string;

  /** Batch ID (if applicable) */
  batchId?: string;

  /** Total tasks */
  total: number;

  /** Completed tasks */
  completed: number;

  /** Failed tasks */
  failed: number;

  /** Progress percentage */
  percentage: number;
}

// ============================================================================
// Parallel Runner Configuration
// ============================================================================

export interface ParallelRunnerConfig {
  /** Default agent for tasks */
  defaultAgent: Agent;

  /** Maximum concurrent tasks */
  maxConcurrency?: number;

  /** Rate limit (tasks per second) */
  rateLimit?: number;

  /** Batch size for grouping */
  batchSize?: number;

  /** Timeout per task (ms) */
  taskTimeout?: number;

  /** Retry failed tasks */
  retryCount?: number;

  /** Retry delay (ms) */
  retryDelay?: number;

  /** Result aggregation strategy */
  aggregation?: 'collect' | 'merge' | 'first-success' | 'majority';

  /** Progress callback */
  onProgress?: (progress: RunnerProgress) => void;

  /** Continue on individual task failure */
  continueOnError?: boolean;

  /** Shuffle task order */
  shuffle?: boolean;
}

// ============================================================================
// Parallel Runner Implementation
// ============================================================================

export class ParallelRunner {
  private config: Required<ParallelRunnerConfig>;
  private taskQueue: ParallelTask[] = [];
  private activeCount = 0;
  private lastExecutionTime = 0;

  constructor(config: ParallelRunnerConfig) {
    this.config = {
      maxConcurrency: config.maxConcurrency ?? 5,
      rateLimit: config.rateLimit ?? 0, // 0 = no limit
      batchSize: config.batchSize ?? 10,
      taskTimeout: config.taskTimeout ?? 60000,
      retryCount: config.retryCount ?? 0,
      retryDelay: config.retryDelay ?? 1000,
      aggregation: config.aggregation ?? 'collect',
      onProgress: config.onProgress ?? (() => {}),
      continueOnError: config.continueOnError ?? true,
      shuffle: config.shuffle ?? false,
      defaultAgent: config.defaultAgent,
    };
  }

  // ========================================
  // Execution Methods
  // ========================================

  async run(tasks: ParallelTask[], abortSignal?: AbortSignal): Promise<BatchResult> {
    const startTime = Date.now();
    const batchId = generateId('batch');

    // Prepare tasks
    let preparedTasks = this.prepareTasks(tasks);

    // Shuffle if configured
    if (this.config.shuffle) {
      preparedTasks = this.shuffleArray(preparedTasks);
    }

    // Sort by priority
    preparedTasks.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

    // Execute
    const results = await this.executeTasks(preparedTasks, batchId, abortSignal);

    // Calculate aggregate stats
    const successCount = results.filter((r) => r.success).length;
    const totalUsage = this.aggregateUsage(results);

    return {
      batchId,
      results,
      duration: Date.now() - startTime,
      totalUsage,
      successRate: results.length > 0 ? successCount / results.length : 0,
    };
  }

  async runInBatches(
    tasks: ParallelTask[],
    abortSignal?: AbortSignal
  ): Promise<BatchResult[]> {
    const batches = this.createBatches(tasks);
    const results: BatchResult[] = [];

    for (const batch of batches) {
      if (abortSignal?.aborted) break;

      const batchResult = await this.run(batch, abortSignal);
      results.push(batchResult);
    }

    return results;
  }

  async map<T>(
    items: T[],
    mapper: (item: T, index: number) => ParallelTask,
    abortSignal?: AbortSignal
  ): Promise<ParallelResult[]> {
    const tasks = items.map(mapper);
    const result = await this.run(tasks, abortSignal);
    return result.results;
  }

  // ========================================
  // Task Execution
  // ========================================

  private async executeTasks(
    tasks: ParallelTask[],
    batchId: string,
    abortSignal?: AbortSignal
  ): Promise<ParallelResult[]> {
    const results: ParallelResult[] = [];
    const total = tasks.length;
    let completed = 0;
    let failed = 0;

    // Create a pool of workers
    const workers: Promise<void>[] = [];
    let taskIndex = 0;

    const processNextTask = async (): Promise<void> => {
      while (taskIndex < tasks.length) {
        if (abortSignal?.aborted) return;

        const task = tasks[taskIndex++];
        if (!task) return;

        // Rate limiting
        await this.waitForRateLimit();

        // Emit start progress
        this.config.onProgress({
          type: 'task-start',
          taskId: task.id,
          batchId,
          total,
          completed,
          failed,
          percentage: Math.round((completed / total) * 100),
        });

        // Execute task
        const result = await this.executeTask(task, abortSignal);
        results.push(result);

        if (result.success) {
          completed++;
          this.config.onProgress({
            type: 'task-complete',
            taskId: task.id,
            batchId,
            total,
            completed,
            failed,
            percentage: Math.round((completed / total) * 100),
          });
        } else {
          failed++;
          this.config.onProgress({
            type: 'task-error',
            taskId: task.id,
            batchId,
            total,
            completed,
            failed,
            percentage: Math.round((completed / total) * 100),
          });

          if (!this.config.continueOnError) {
            throw result.error;
          }
        }
      }
    };

    // Start worker pool
    const workerCount = Math.min(this.config.maxConcurrency, tasks.length);
    for (let i = 0; i < workerCount; i++) {
      workers.push(processNextTask());
    }

    // Wait for all workers
    await Promise.all(workers);

    // Emit batch complete
    this.config.onProgress({
      type: 'batch-complete',
      batchId,
      total,
      completed,
      failed,
      percentage: 100,
    });

    return results;
  }

  private async executeTask(
    task: ParallelTask,
    abortSignal?: AbortSignal
  ): Promise<ParallelResult> {
    const startTime = Date.now();
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.config.retryCount; attempt++) {
      try {
        const result = await this.executeTaskOnce(task, abortSignal);
        return {
          taskId: task.id,
          success: true,
          result,
          duration: Date.now() - startTime,
          metadata: task.metadata,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < this.config.retryCount) {
          await new Promise((resolve) => setTimeout(resolve, this.config.retryDelay));
        }
      }
    }

    return {
      taskId: task.id,
      success: false,
      error: lastError,
      duration: Date.now() - startTime,
      metadata: task.metadata,
    };
  }

  private async executeTaskOnce(
    task: ParallelTask,
    abortSignal?: AbortSignal
  ): Promise<AgentGenerateResult> {
    const agent = task.agent ?? this.config.defaultAgent;

    // Convert input to messages
    const messages: UIMessage[] = typeof task.input === 'string'
      ? [{
          id: generateId('msg'),
          role: 'user',
          parts: [{ type: 'text', text: task.input }],
          createdAt: new Date(),
        }]
      : task.input;

    // Execute with timeout
    const result = await Promise.race([
      agent.generate({ messages, abortSignal }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Task ${task.id} timed out`)), this.config.taskTimeout)
      ),
    ]);

    return result;
  }

  // ========================================
  // Rate Limiting
  // ========================================

  private async waitForRateLimit(): Promise<void> {
    if (this.config.rateLimit <= 0) return;

    const minInterval = 1000 / this.config.rateLimit;
    const elapsed = Date.now() - this.lastExecutionTime;
    const waitTime = minInterval - elapsed;

    if (waitTime > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    this.lastExecutionTime = Date.now();
  }

  // ========================================
  // Batching
  // ========================================

  private createBatches(tasks: ParallelTask[]): ParallelTask[][] {
    const batches: ParallelTask[][] = [];
    const batchSize = this.config.batchSize;

    for (let i = 0; i < tasks.length; i += batchSize) {
      batches.push(tasks.slice(i, i + batchSize));
    }

    return batches;
  }

  // ========================================
  // Aggregation
  // ========================================

  aggregateResults(results: ParallelResult[]): string {
    const successfulResults = results.filter((r) => r.success && r.result);

    switch (this.config.aggregation) {
      case 'merge':
        return successfulResults
          .map((r) => this.extractText(r.result!))
          .join('\n\n---\n\n');

      case 'first-success':
        return successfulResults.length > 0
          ? this.extractText(successfulResults[0].result!)
          : '';

      case 'majority':
        // Find most common response (simple version)
        const texts = successfulResults.map((r) => this.extractText(r.result!));
        const counts = new Map<string, number>();
        for (const text of texts) {
          counts.set(text, (counts.get(text) ?? 0) + 1);
        }
        let maxCount = 0;
        let majorityText = '';
        for (const [text, count] of counts) {
          if (count > maxCount) {
            maxCount = count;
            majorityText = text;
          }
        }
        return majorityText;

      case 'collect':
      default:
        return JSON.stringify(
          successfulResults.map((r) => ({
            taskId: r.taskId,
            text: this.extractText(r.result!),
          })),
          null,
          2
        );
    }
  }

  private aggregateUsage(results: ParallelResult[]): TokenUsage {
    return results.reduce(
      (acc, r) => {
        if (!r.success || !r.result?.usage) return acc;
        return {
          promptTokens: acc.promptTokens + r.result.usage.promptTokens,
          completionTokens: acc.completionTokens + r.result.usage.completionTokens,
          totalTokens: acc.totalTokens + r.result.usage.totalTokens,
        };
      },
      { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
    );
  }

  // ========================================
  // Helpers
  // ========================================

  private prepareTasks(tasks: ParallelTask[]): ParallelTask[] {
    return tasks.map((task, index) => ({
      ...task,
      id: task.id || `task_${index}`,
    }));
  }

  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  private extractText(result: AgentGenerateResult): string {
    return result.message.parts
      .filter((p) => p.type === 'text')
      .map((p) => (p as { text: string }).text)
      .join('\n');
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

export function createParallelRunner(config: ParallelRunnerConfig): ParallelRunner {
  return new ParallelRunner(config);
}

// ============================================================================
// Convenience Functions
// ============================================================================

export async function runParallel(
  tasks: Array<{ input: string; id?: string }>,
  agent: Agent,
  options: Partial<ParallelRunnerConfig> = {}
): Promise<BatchResult> {
  const runner = new ParallelRunner({ defaultAgent: agent, ...options });

  const parallelTasks: ParallelTask[] = tasks.map((t, i) => ({
    id: t.id ?? `task_${i}`,
    input: t.input,
  }));

  return runner.run(parallelTasks);
}

export async function mapParallel<T>(
  items: T[],
  mapper: (item: T) => string,
  agent: Agent,
  options: Partial<ParallelRunnerConfig> = {}
): Promise<ParallelResult[]> {
  const runner = new ParallelRunner({ defaultAgent: agent, ...options });

  return runner.map(items, (item, index) => ({
    id: `item_${index}`,
    input: mapper(item),
  }));
}
