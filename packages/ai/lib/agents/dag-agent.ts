/**
 * @repo/ai - DAG Agent
 *
 * Directed Acyclic Graph agent for parallel task execution.
 * Decomposes complex tasks into subtasks, executes independent
 * branches in parallel, and aggregates results.
 */

import type {
  Agent,
  AgentConfig,
  AgentGenerateOptions,
  AgentGenerateResult,
  AgentStreamOptions,
  AgentStreamResult,
  AgentStep,
  AgentStreamChunk,
  TokenUsage,
} from './types';
import { RubicToolLoopAgent, type ToolLoopAgentConfig } from './tool-loop-agent';
import type { UIMessage, FinishReason } from '../types/ui-message';
import { generateId } from '../streaming';

// ============================================================================
// DAG Types
// ============================================================================

export interface DAGNode {
  /** Unique node identifier */
  id: string;

  /** Task description for this node */
  task: string;

  /** IDs of nodes that must complete before this node can start */
  dependencies: string[];

  /** Agent configuration for this node */
  agentConfig?: Partial<ToolLoopAgentConfig>;

  /** Node status */
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

  /** Node result after completion */
  result?: DAGNodeResult;

  /** Error if failed */
  error?: Error;
}

export interface DAGNodeResult {
  /** Generated output text */
  text: string;

  /** Tokens used */
  usage?: TokenUsage;

  /** Duration in ms */
  duration: number;

  /** Any structured data produced */
  data?: unknown;
}

export interface DAG {
  /** DAG identifier */
  id: string;

  /** Original task that generated this DAG */
  originalTask: string;

  /** All nodes in the DAG */
  nodes: Map<string, DAGNode>;

  /** Metadata */
  metadata: {
    createdAt: Date;
    completedAt?: Date;
    totalDuration?: number;
  };
}

// ============================================================================
// DAG Agent Configuration
// ============================================================================

export interface DAGAgentConfig extends AgentConfig {
  /** Agent name */
  name?: string;

  /** Agent ID */
  id?: string;

  /** Maximum parallel executions */
  maxConcurrency?: number;

  /** Timeout per node in ms */
  nodeTimeout?: number;

  /** Custom task planner (returns DAG from task) */
  taskPlanner?: (task: string, context: TaskPlannerContext) => Promise<DAG>;

  /** Custom result aggregator */
  resultAggregator?: (results: DAGNodeResult[], task: string) => Promise<string>;

  /** Called when a node starts */
  onNodeStart?: (node: DAGNode) => void;

  /** Called when a node completes */
  onNodeComplete?: (node: DAGNode, result: DAGNodeResult) => void;

  /** Called when a node fails */
  onNodeError?: (node: DAGNode, error: Error) => void;
}

export interface TaskPlannerContext {
  messages: UIMessage[];
  tools: AgentConfig['tools'];
}

// ============================================================================
// DAG Agent Implementation
// ============================================================================

/**
 * DAGAgent - Parallel task execution with dependency management
 *
 * @example
 * ```ts
 * const dagAgent = new DAGAgent({
 *   model: 'anthropic/claude-sonnet-4-5-20250929',
 *   instructions: 'You are a research coordinator.',
 *   maxConcurrency: 3,
 *   tools: { search: webSearchTool },
 * });
 *
 * const result = await dagAgent.generate({
 *   messages: [{ role: 'user', parts: [{ type: 'text', text: 'Research the top 3 AI companies' }] }]
 * });
 * ```
 */
export class DAGAgent implements Agent {
  readonly id: string;
  readonly name: string;
  readonly config: DAGAgentConfig;

  private currentDAG: DAG | null = null;

  constructor(config: DAGAgentConfig) {
    this.id = config.id ?? generateId('dag-agent');
    this.name = config.name ?? 'DAGAgent';
    this.config = {
      maxConcurrency: 3,
      nodeTimeout: 60000,
      maxSteps: 20,
      ...config,
    };
  }

  // ========================================
  // Generate
  // ========================================

  async generate(options: AgentGenerateOptions): Promise<AgentGenerateResult> {
    const startTime = Date.now();
    const steps: AgentStep[] = [];

    // Extract task from messages
    const lastUserMessage = [...options.messages].reverse().find((m) => m.role === 'user');
    const task = this.extractTaskFromMessage(lastUserMessage);

    if (!task) {
      return this.createErrorResult('No task found in messages', startTime);
    }

    // Step 1: Plan the DAG
    const planStep: AgentStep = {
      stepNumber: 1,
      type: 'generation',
      text: 'Planning task decomposition...',
      duration: 0,
    };

    const planStartTime = Date.now();
    let dag: DAG;

    try {
      dag = await this.planDAG(task, {
        messages: options.messages,
        tools: this.config.tools,
      });
      planStep.duration = Date.now() - planStartTime;
      planStep.text = `Decomposed into ${dag.nodes.size} subtasks`;
      planStep.metadata = {
        nodeCount: dag.nodes.size,
        nodes: Array.from(dag.nodes.values()).map((n) => ({
          id: n.id,
          task: n.task,
          dependencies: n.dependencies,
        })),
      };
    } catch (error) {
      planStep.duration = Date.now() - planStartTime;
      return this.createErrorResult(
        `Failed to plan task: ${error instanceof Error ? error.message : String(error)}`,
        startTime
      );
    }

    steps.push(planStep);
    this.currentDAG = dag;

    // Step 2: Execute DAG
    const execStep: AgentStep = {
      stepNumber: 2,
      type: 'tool-execution',
      text: 'Executing subtasks...',
      duration: 0,
    };

    const execStartTime = Date.now();

    try {
      await this.executeDAG(dag, options.abortSignal);
      execStep.duration = Date.now() - execStartTime;
      execStep.text = `Completed ${this.countCompletedNodes(dag)} subtasks`;
    } catch (error) {
      execStep.duration = Date.now() - execStartTime;
      execStep.text = `Execution partially failed: ${error instanceof Error ? error.message : String(error)}`;
    }

    steps.push(execStep);

    // Step 3: Aggregate results
    const aggStep: AgentStep = {
      stepNumber: 3,
      type: 'aggregation',
      text: 'Aggregating results...',
      duration: 0,
    };

    const aggStartTime = Date.now();
    let finalText: string;

    try {
      const completedResults = this.getCompletedResults(dag);
      finalText = await this.aggregateResults(completedResults, task);
      aggStep.duration = Date.now() - aggStartTime;
      aggStep.text = finalText.slice(0, 100) + (finalText.length > 100 ? '...' : '');
    } catch (error) {
      aggStep.duration = Date.now() - aggStartTime;
      finalText = `Failed to aggregate results: ${error instanceof Error ? error.message : String(error)}`;
    }

    steps.push(aggStep);

    // Build response
    const responseMessage: UIMessage = {
      id: generateId('msg'),
      role: 'assistant',
      parts: [{ type: 'text', text: finalText }],
      metadata: {
        dagId: dag.id,
        nodeCount: dag.nodes.size,
        completedNodes: this.countCompletedNodes(dag),
      },
      createdAt: new Date(),
    };

    // Calculate total usage
    const totalUsage = this.calculateTotalUsage(dag);

    return {
      message: responseMessage,
      messages: [...options.messages, responseMessage],
      finishReason: this.hasFailedNodes(dag) ? 'error' : 'stop',
      usage: totalUsage,
      steps,
      duration: Date.now() - startTime,
    };
  }

  // ========================================
  // Stream
  // ========================================

  async stream(options: AgentStreamOptions): Promise<AgentStreamResult> {
    const chunks: AgentStreamChunk[] = [];
    let resultResolver!: (result: AgentGenerateResult) => void;
    const resultPromise = new Promise<AgentGenerateResult>((resolve) => {
      resultResolver = resolve;
    });

    // Create a TransformStream to emit chunks
    const { readable, writable } = new TransformStream<AgentStreamChunk>();
    const writer = writable.getWriter();

    // Run generation in background
    (async () => {
      const startTime = Date.now();

      // Emit planning start
      const planChunk: AgentStreamChunk = { type: 'step-start', stepNumber: 1 };
      await writer.write(planChunk);
      options.onChunk?.(planChunk);

      try {
        // Get task
        const lastUserMessage = [...options.messages].reverse().find((m) => m.role === 'user');
        const task = this.extractTaskFromMessage(lastUserMessage);

        if (!task) {
          throw new Error('No task found');
        }

        // Plan
        const dag = await this.planDAG(task, {
          messages: options.messages,
          tools: this.config.tools,
        });

        const planText: AgentStreamChunk = {
          type: 'text-delta',
          delta: `Decomposed into ${dag.nodes.size} subtasks:\n`,
        };
        await writer.write(planText);
        options.onChunk?.(planText);

        // List nodes
        for (const node of dag.nodes.values()) {
          const nodeText: AgentStreamChunk = {
            type: 'text-delta',
            delta: `- ${node.task}\n`,
          };
          await writer.write(nodeText);
          options.onChunk?.(nodeText);
        }

        // Step end
        const planEnd: AgentStreamChunk = { type: 'step-end', stepNumber: 1 };
        await writer.write(planEnd);
        options.onChunk?.(planEnd);

        // Execute
        const execStart: AgentStreamChunk = { type: 'step-start', stepNumber: 2 };
        await writer.write(execStart);
        options.onChunk?.(execStart);

        await this.executeDAGWithProgress(dag, options.abortSignal, async (progress) => {
          const progressChunk: AgentStreamChunk = {
            type: 'data',
            dataType: 'dag-progress',
            data: progress,
          };
          await writer.write(progressChunk);
          options.onChunk?.(progressChunk);
        });

        const execEnd: AgentStreamChunk = { type: 'step-end', stepNumber: 2 };
        await writer.write(execEnd);
        options.onChunk?.(execEnd);

        // Aggregate
        const aggStart: AgentStreamChunk = { type: 'step-start', stepNumber: 3 };
        await writer.write(aggStart);
        options.onChunk?.(aggStart);

        const results = this.getCompletedResults(dag);
        const finalText = await this.aggregateResults(results, task);

        // Stream final text
        const words = finalText.split(' ');
        for (const word of words) {
          const wordChunk: AgentStreamChunk = {
            type: 'text-delta',
            delta: word + ' ',
          };
          await writer.write(wordChunk);
          options.onChunk?.(wordChunk);
        }

        // Finish
        const finishChunk: AgentStreamChunk = {
          type: 'finish',
          finishReason: 'stop',
          usage: this.calculateTotalUsage(dag),
        };
        await writer.write(finishChunk);
        options.onChunk?.(finishChunk);

        // Resolve result
        resultResolver({
          message: {
            id: generateId('msg'),
            role: 'assistant',
            parts: [{ type: 'text', text: finalText }],
            createdAt: new Date(),
          },
          messages: options.messages,
          finishReason: 'stop',
          usage: this.calculateTotalUsage(dag),
          steps: [],
          duration: Date.now() - startTime,
        });
      } catch (error) {
        const errorChunk: AgentStreamChunk = {
          type: 'error',
          error: error instanceof Error ? error.message : String(error),
        };
        await writer.write(errorChunk);
        options.onChunk?.(errorChunk);
      } finally {
        await writer.close();
      }
    })();

    return {
      stream: readable,
      result: resultPromise,
    };
  }

  // ========================================
  // DAG Planning
  // ========================================

  private async planDAG(task: string, context: TaskPlannerContext): Promise<DAG> {
    // Use custom planner if provided
    if (this.config.taskPlanner) {
      return this.config.taskPlanner(task, context);
    }

    // Default planner using LLM
    return this.defaultTaskPlanner(task, context);
  }

  private async defaultTaskPlanner(task: string, context: TaskPlannerContext): Promise<DAG> {
    // For now, create a simple sequential DAG
    // In production, this would use generateObject to create a proper DAG
    const dag: DAG = {
      id: generateId('dag'),
      originalTask: task,
      nodes: new Map(),
      metadata: { createdAt: new Date() },
    };

    // Create a simple 3-step DAG
    const node1: DAGNode = {
      id: 'research',
      task: `Research: ${task}`,
      dependencies: [],
      status: 'pending',
    };

    const node2: DAGNode = {
      id: 'analyze',
      task: `Analyze findings from research`,
      dependencies: ['research'],
      status: 'pending',
    };

    const node3: DAGNode = {
      id: 'synthesize',
      task: `Synthesize final response for: ${task}`,
      dependencies: ['analyze'],
      status: 'pending',
    };

    dag.nodes.set(node1.id, node1);
    dag.nodes.set(node2.id, node2);
    dag.nodes.set(node3.id, node3);

    return dag;
  }

  // ========================================
  // DAG Execution
  // ========================================

  private async executeDAG(dag: DAG, abortSignal?: AbortSignal): Promise<void> {
    const { maxConcurrency = 3 } = this.config;
    const running = new Set<string>();
    const completed = new Set<string>();

    while (completed.size < dag.nodes.size) {
      // Check for abort
      if (abortSignal?.aborted) {
        throw new Error('DAG execution aborted');
      }

      // Find ready nodes (dependencies satisfied, not running or completed)
      const readyNodes = Array.from(dag.nodes.values()).filter((node) =>
        node.status === 'pending' &&
        !running.has(node.id) &&
        node.dependencies.every((dep) => completed.has(dep))
      );

      if (readyNodes.length === 0 && running.size === 0) {
        // Deadlock or all done
        break;
      }

      // Start new nodes up to concurrency limit
      const toStart = readyNodes.slice(0, maxConcurrency - running.size);

      for (const node of toStart) {
        running.add(node.id);
        node.status = 'running';
        this.config.onNodeStart?.(node);

        // Execute node (don't await, run in parallel)
        this.executeNode(node, dag, abortSignal)
          .then((result) => {
            node.status = 'completed';
            node.result = result;
            this.config.onNodeComplete?.(node, result);
          })
          .catch((error) => {
            node.status = 'failed';
            node.error = error instanceof Error ? error : new Error(String(error));
            this.config.onNodeError?.(node, node.error);
          })
          .finally(() => {
            running.delete(node.id);
            completed.add(node.id);
          });
      }

      // Wait a bit before checking again
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    dag.metadata.completedAt = new Date();
    dag.metadata.totalDuration = dag.metadata.completedAt.getTime() - dag.metadata.createdAt.getTime();
  }

  private async executeDAGWithProgress(
    dag: DAG,
    abortSignal: AbortSignal | undefined,
    onProgress: (progress: DAGProgress) => Promise<void>
  ): Promise<void> {
    // Wrap executeDAG with progress updates
    const originalOnNodeStart = this.config.onNodeStart;
    const originalOnNodeComplete = this.config.onNodeComplete;
    const originalOnNodeError = this.config.onNodeError;

    this.config.onNodeStart = (node) => {
      originalOnNodeStart?.(node);
      onProgress({
        type: 'node-start',
        nodeId: node.id,
        task: node.task,
        totalNodes: dag.nodes.size,
        completedNodes: this.countCompletedNodes(dag),
      });
    };

    this.config.onNodeComplete = (node, result) => {
      originalOnNodeComplete?.(node, result);
      onProgress({
        type: 'node-complete',
        nodeId: node.id,
        task: node.task,
        totalNodes: dag.nodes.size,
        completedNodes: this.countCompletedNodes(dag) + 1,
      });
    };

    this.config.onNodeError = (node, error) => {
      originalOnNodeError?.(node, error);
      onProgress({
        type: 'node-error',
        nodeId: node.id,
        task: node.task,
        error: error.message,
        totalNodes: dag.nodes.size,
        completedNodes: this.countCompletedNodes(dag),
      });
    };

    try {
      await this.executeDAG(dag, abortSignal);
    } finally {
      this.config.onNodeStart = originalOnNodeStart;
      this.config.onNodeComplete = originalOnNodeComplete;
      this.config.onNodeError = originalOnNodeError;
    }
  }

  private async executeNode(node: DAGNode, dag: DAG, abortSignal?: AbortSignal): Promise<DAGNodeResult> {
    const startTime = Date.now();

    // Create agent for this node
    const nodeConfig: ToolLoopAgentConfig = {
      ...this.config,
      ...node.agentConfig,
      name: `node-${node.id}`,
      maxSteps: 5, // Limit steps per node
    };

    const agent = new RubicToolLoopAgent(nodeConfig);

    // Get context from dependencies
    const depContext = this.buildDependencyContext(node, dag);

    // Execute
    const result = await agent.generate({
      messages: [
        {
          id: generateId('msg'),
          role: 'user',
          parts: [{ type: 'text', text: `${depContext}\n\nTask: ${node.task}` }],
          createdAt: new Date(),
        },
      ],
      abortSignal,
    });

    return {
      text: result.message.parts
        .filter((p) => p.type === 'text')
        .map((p) => (p as { text: string }).text)
        .join('\n'),
      usage: result.usage,
      duration: Date.now() - startTime,
    };
  }

  private buildDependencyContext(node: DAGNode, dag: DAG): string {
    if (node.dependencies.length === 0) {
      return '';
    }

    const depResults = node.dependencies
      .map((depId) => dag.nodes.get(depId))
      .filter((n): n is DAGNode => n !== undefined && n.result !== undefined)
      .map((n) => `[${n.id}]: ${n.result!.text}`);

    if (depResults.length === 0) {
      return '';
    }

    return `Context from previous steps:\n${depResults.join('\n\n')}`;
  }

  // ========================================
  // Result Aggregation
  // ========================================

  private async aggregateResults(results: DAGNodeResult[], task: string): Promise<string> {
    // Use custom aggregator if provided
    if (this.config.resultAggregator) {
      return this.config.resultAggregator(results, task);
    }

    // Default: concatenate results
    if (results.length === 0) {
      return 'No results were produced.';
    }

    if (results.length === 1) {
      return results[0].text;
    }

    // For multiple results, use LLM to synthesize
    const agent = new RubicToolLoopAgent({
      ...this.config,
      name: 'aggregator',
      maxSteps: 1,
      tools: undefined, // No tools for aggregation
    });

    const aggregationPrompt = `
You are synthesizing results from multiple parallel research tasks.

Original task: ${task}

Results from subtasks:
${results.map((r, i) => `--- Result ${i + 1} ---\n${r.text}`).join('\n\n')}

Please synthesize these results into a coherent, comprehensive response.
`;

    const result = await agent.generate({
      messages: [{
        id: generateId('msg'),
        role: 'user',
        parts: [{ type: 'text', text: aggregationPrompt }],
        createdAt: new Date(),
      }],
    });

    return result.message.parts
      .filter((p) => p.type === 'text')
      .map((p) => (p as { text: string }).text)
      .join('\n');
  }

  // ========================================
  // Helpers
  // ========================================

  private extractTaskFromMessage(message?: UIMessage): string | null {
    if (!message) return null;

    const textParts = message.parts
      .filter((p) => p.type === 'text')
      .map((p) => (p as { text: string }).text);

    return textParts.join('\n') || null;
  }

  private countCompletedNodes(dag: DAG): number {
    return Array.from(dag.nodes.values()).filter((n) => n.status === 'completed').length;
  }

  private hasFailedNodes(dag: DAG): boolean {
    return Array.from(dag.nodes.values()).some((n) => n.status === 'failed');
  }

  private getCompletedResults(dag: DAG): DAGNodeResult[] {
    return Array.from(dag.nodes.values())
      .filter((n) => n.status === 'completed' && n.result)
      .map((n) => n.result!);
  }

  private calculateTotalUsage(dag: DAG): TokenUsage {
    const results = this.getCompletedResults(dag);
    return results.reduce(
      (acc, r) => ({
        promptTokens: acc.promptTokens + (r.usage?.promptTokens ?? 0),
        completionTokens: acc.completionTokens + (r.usage?.completionTokens ?? 0),
        totalTokens: acc.totalTokens + (r.usage?.totalTokens ?? 0),
      }),
      { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
    );
  }

  private createErrorResult(message: string, startTime: number): AgentGenerateResult {
    return {
      message: {
        id: generateId('msg'),
        role: 'assistant',
        parts: [{ type: 'text', text: message }],
        createdAt: new Date(),
      },
      messages: [],
      finishReason: 'error',
      steps: [],
      duration: Date.now() - startTime,
    };
  }

  // ========================================
  // Public Getters
  // ========================================

  get dag(): DAG | null {
    return this.currentDAG;
  }
}

// ============================================================================
// Types
// ============================================================================

export interface DAGProgress {
  type: 'node-start' | 'node-complete' | 'node-error';
  nodeId: string;
  task: string;
  totalNodes: number;
  completedNodes: number;
  error?: string;
}

// ============================================================================
// Factory
// ============================================================================

export function createDAGAgent(config: DAGAgentConfig): DAGAgent {
  return new DAGAgent(config);
}
