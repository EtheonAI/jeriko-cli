/**
 * @repo/ai - DAG Executor
 *
 * Executes Directed Acyclic Graphs of tasks with dependency management,
 * parallel execution, and progress tracking.
 */

import type { Agent, AgentGenerateResult, TokenUsage } from '../agents/types';
import type { UIMessage } from '../types/ui-message';
import { generateId } from '../streaming';

// ============================================================================
// DAG Executor Types
// ============================================================================

export interface ExecutionNode {
  /** Unique node identifier */
  id: string;

  /** Task description */
  task: string;

  /** Node dependencies (must complete before this node) */
  dependencies: string[];

  /** Agent to execute this node (optional - uses default if not provided) */
  agent?: Agent;

  /** Node-specific configuration */
  config?: {
    timeout?: number;
    retries?: number;
    retryDelay?: number;
  };

  /** Current execution status */
  status: ExecutionStatus;

  /** Result after completion */
  result?: NodeResult;

  /** Error if failed */
  error?: Error;

  /** Retry count */
  retryCount: number;
}

export type ExecutionStatus =
  | 'pending'
  | 'ready'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped'
  | 'cancelled';

export interface NodeResult {
  /** Generated text output */
  text: string;

  /** Token usage */
  usage?: TokenUsage;

  /** Execution duration in ms */
  duration: number;

  /** Structured data output */
  data?: unknown;

  /** Messages from agent */
  messages?: UIMessage[];
}

export interface ExecutionGraph {
  /** Graph identifier */
  id: string;

  /** All nodes in the graph */
  nodes: Map<string, ExecutionNode>;

  /** Adjacency list for dependencies */
  edges: Map<string, Set<string>>;

  /** Execution metadata */
  metadata: {
    createdAt: Date;
    startedAt?: Date;
    completedAt?: Date;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  };
}

export interface ExecutionProgress {
  /** Progress event type */
  type: 'node-start' | 'node-progress' | 'node-complete' | 'node-error' | 'graph-complete';

  /** Node ID (if applicable) */
  nodeId?: string;

  /** Task description */
  task?: string;

  /** Total nodes */
  totalNodes: number;

  /** Completed nodes */
  completedNodes: number;

  /** Running nodes */
  runningNodes: number;

  /** Progress percentage (0-100) */
  percentage: number;

  /** Error message (if error) */
  error?: string;

  /** Node result (if complete) */
  result?: NodeResult;
}

// ============================================================================
// DAG Executor Configuration
// ============================================================================

export interface DAGExecutorConfig {
  /** Maximum concurrent node executions */
  maxConcurrency?: number;

  /** Default timeout per node (ms) */
  defaultTimeout?: number;

  /** Default retry count */
  defaultRetries?: number;

  /** Default retry delay (ms) */
  defaultRetryDelay?: number;

  /** Default agent for nodes without specific agents */
  defaultAgent?: Agent;

  /** Progress callback */
  onProgress?: (progress: ExecutionProgress) => void;

  /** Node start callback */
  onNodeStart?: (node: ExecutionNode) => void;

  /** Node complete callback */
  onNodeComplete?: (node: ExecutionNode, result: NodeResult) => void;

  /** Node error callback */
  onNodeError?: (node: ExecutionNode, error: Error) => void;

  /** Continue on node failure */
  continueOnError?: boolean;

  /** Skip dependent nodes on failure */
  skipDependentsOnError?: boolean;
}

// ============================================================================
// DAG Executor Implementation
// ============================================================================

export class DAGExecutor {
  private config: Required<DAGExecutorConfig>;

  constructor(config: DAGExecutorConfig = {}) {
    this.config = {
      maxConcurrency: config.maxConcurrency ?? 5,
      defaultTimeout: config.defaultTimeout ?? 60000,
      defaultRetries: config.defaultRetries ?? 0,
      defaultRetryDelay: config.defaultRetryDelay ?? 1000,
      defaultAgent: config.defaultAgent as Agent,
      onProgress: config.onProgress ?? (() => {}),
      onNodeStart: config.onNodeStart ?? (() => {}),
      onNodeComplete: config.onNodeComplete ?? (() => {}),
      onNodeError: config.onNodeError ?? (() => {}),
      continueOnError: config.continueOnError ?? true,
      skipDependentsOnError: config.skipDependentsOnError ?? true,
    };
  }

  // ========================================
  // Graph Execution
  // ========================================

  async execute(
    graph: ExecutionGraph,
    context: { messages?: UIMessage[] } = {},
    abortSignal?: AbortSignal
  ): Promise<ExecutionGraph> {
    graph.metadata.startedAt = new Date();
    graph.metadata.status = 'running';

    const running = new Set<string>();
    const completed = new Set<string>();
    const failed = new Set<string>();

    // Mark all nodes as ready if dependencies are met
    this.updateReadyNodes(graph, completed, failed);

    while (this.hasIncompleteNodes(graph, completed, failed)) {
      // Check for abort
      if (abortSignal?.aborted) {
        graph.metadata.status = 'cancelled';
        this.cancelPendingNodes(graph);
        break;
      }

      // Get ready nodes
      const readyNodes = this.getReadyNodes(graph, running, completed, failed);

      if (readyNodes.length === 0 && running.size === 0) {
        // Deadlock detection
        break;
      }

      // Start nodes up to concurrency limit
      const toStart = readyNodes.slice(0, this.config.maxConcurrency - running.size);

      const nodePromises = toStart.map(async (node) => {
        running.add(node.id);
        node.status = 'running';

        this.config.onNodeStart(node);
        this.emitProgress(graph, 'node-start', node);

        try {
          const result = await this.executeNode(node, graph, context, abortSignal);
          node.status = 'completed';
          node.result = result;

          this.config.onNodeComplete(node, result);
          this.emitProgress(graph, 'node-complete', node, result);

          completed.add(node.id);
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          node.status = 'failed';
          node.error = err;

          this.config.onNodeError(node, err);
          this.emitProgress(graph, 'node-error', node, undefined, err.message);

          failed.add(node.id);

          // Skip dependents if configured
          if (this.config.skipDependentsOnError) {
            this.skipDependentNodes(graph, node.id, completed, failed);
          }

          if (!this.config.continueOnError) {
            throw err;
          }
        } finally {
          running.delete(node.id);
        }
      });

      // Wait for at least one node to complete
      await Promise.race(nodePromises);

      // Small delay to allow state to settle
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    // Finalize
    graph.metadata.completedAt = new Date();
    graph.metadata.status = failed.size > 0 ? 'failed' : 'completed';

    this.emitProgress(graph, 'graph-complete');

    return graph;
  }

  // ========================================
  // Node Execution
  // ========================================

  private async executeNode(
    node: ExecutionNode,
    graph: ExecutionGraph,
    context: { messages?: UIMessage[] },
    abortSignal?: AbortSignal
  ): Promise<NodeResult> {
    const startTime = Date.now();
    const timeout = node.config?.timeout ?? this.config.defaultTimeout;
    const retries = node.config?.retries ?? this.config.defaultRetries;
    const retryDelay = node.config?.retryDelay ?? this.config.defaultRetryDelay;

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= retries; attempt++) {
      node.retryCount = attempt;

      try {
        const result = await this.executeNodeWithTimeout(
          node,
          graph,
          context,
          timeout,
          abortSignal
        );

        return {
          ...result,
          duration: Date.now() - startTime,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < retries) {
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
        }
      }
    }

    throw lastError ?? new Error('Unknown execution error');
  }

  private async executeNodeWithTimeout(
    node: ExecutionNode,
    graph: ExecutionGraph,
    context: { messages?: UIMessage[] },
    timeout: number,
    abortSignal?: AbortSignal
  ): Promise<Omit<NodeResult, 'duration'>> {
    const agent = node.agent ?? this.config.defaultAgent;

    if (!agent) {
      throw new Error(`No agent configured for node ${node.id}`);
    }

    // Build context from dependencies
    const depContext = this.buildDependencyContext(node, graph);

    // Build messages
    const messages: UIMessage[] = [
      ...(context.messages ?? []),
      {
        id: generateId('msg'),
        role: 'user',
        parts: [
          {
            type: 'text',
            text: depContext ? `${depContext}\n\nTask: ${node.task}` : node.task,
          },
        ],
        createdAt: new Date(),
      },
    ];

    // Execute with timeout
    const result = await Promise.race([
      agent.generate({ messages, abortSignal }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Node ${node.id} timed out`)), timeout)
      ),
    ]);

    // Extract text from result
    const text = result.message.parts
      .filter((p) => p.type === 'text')
      .map((p) => (p as { text: string }).text)
      .join('\n');

    return {
      text,
      usage: result.usage,
      messages: result.messages,
    };
  }

  private buildDependencyContext(node: ExecutionNode, graph: ExecutionGraph): string {
    if (node.dependencies.length === 0) {
      return '';
    }

    const depResults = node.dependencies
      .map((depId) => graph.nodes.get(depId))
      .filter((n): n is ExecutionNode => n !== undefined && n.result !== undefined)
      .map((n) => `[${n.id}]: ${n.result!.text}`);

    if (depResults.length === 0) {
      return '';
    }

    return `Context from previous steps:\n${depResults.join('\n\n')}`;
  }

  // ========================================
  // Graph Helpers
  // ========================================

  private updateReadyNodes(
    graph: ExecutionGraph,
    completed: Set<string>,
    failed: Set<string>
  ): void {
    for (const node of graph.nodes.values()) {
      if (node.status === 'pending') {
        const depsReady = node.dependencies.every(
          (dep) => completed.has(dep) || failed.has(dep)
        );

        if (depsReady) {
          const depsFailed = node.dependencies.some((dep) => failed.has(dep));
          if (depsFailed && this.config.skipDependentsOnError) {
            node.status = 'skipped';
          } else {
            node.status = 'ready';
          }
        }
      }
    }
  }

  private getReadyNodes(
    graph: ExecutionGraph,
    running: Set<string>,
    completed: Set<string>,
    failed: Set<string>
  ): ExecutionNode[] {
    const ready: ExecutionNode[] = [];

    for (const node of graph.nodes.values()) {
      if (node.status !== 'ready' && node.status !== 'pending') {
        continue;
      }

      if (running.has(node.id) || completed.has(node.id) || failed.has(node.id)) {
        continue;
      }

      const depsReady = node.dependencies.every(
        (dep) => completed.has(dep) || (failed.has(dep) && !this.config.skipDependentsOnError)
      );

      if (depsReady) {
        ready.push(node);
      }
    }

    return ready;
  }

  private hasIncompleteNodes(
    graph: ExecutionGraph,
    completed: Set<string>,
    failed: Set<string>
  ): boolean {
    for (const node of graph.nodes.values()) {
      if (
        !completed.has(node.id) &&
        !failed.has(node.id) &&
        node.status !== 'skipped' &&
        node.status !== 'cancelled'
      ) {
        return true;
      }
    }
    return false;
  }

  private skipDependentNodes(
    graph: ExecutionGraph,
    failedNodeId: string,
    completed: Set<string>,
    failed: Set<string>
  ): void {
    for (const node of graph.nodes.values()) {
      if (
        node.dependencies.includes(failedNodeId) &&
        !completed.has(node.id) &&
        !failed.has(node.id)
      ) {
        node.status = 'skipped';
        // Recursively skip dependents
        this.skipDependentNodes(graph, node.id, completed, failed);
      }
    }
  }

  private cancelPendingNodes(graph: ExecutionGraph): void {
    for (const node of graph.nodes.values()) {
      if (node.status === 'pending' || node.status === 'ready') {
        node.status = 'cancelled';
      }
    }
  }

  private emitProgress(
    graph: ExecutionGraph,
    type: ExecutionProgress['type'],
    node?: ExecutionNode,
    result?: NodeResult,
    error?: string
  ): void {
    const totalNodes = graph.nodes.size;
    const completedNodes = Array.from(graph.nodes.values()).filter(
      (n) => n.status === 'completed' || n.status === 'skipped'
    ).length;
    const runningNodes = Array.from(graph.nodes.values()).filter(
      (n) => n.status === 'running'
    ).length;

    this.config.onProgress({
      type,
      nodeId: node?.id,
      task: node?.task,
      totalNodes,
      completedNodes,
      runningNodes,
      percentage: Math.round((completedNodes / totalNodes) * 100),
      error,
      result,
    });
  }
}

// ============================================================================
// Graph Builder
// ============================================================================

export class ExecutionGraphBuilder {
  private nodes = new Map<string, ExecutionNode>();
  private edges = new Map<string, Set<string>>();

  constructor(private id: string = generateId('graph')) {}

  addNode(
    id: string,
    task: string,
    options: {
      dependencies?: string[];
      agent?: Agent;
      config?: ExecutionNode['config'];
    } = {}
  ): this {
    this.nodes.set(id, {
      id,
      task,
      dependencies: options.dependencies ?? [],
      agent: options.agent,
      config: options.config,
      status: 'pending',
      retryCount: 0,
    });

    // Add edges
    for (const dep of options.dependencies ?? []) {
      if (!this.edges.has(dep)) {
        this.edges.set(dep, new Set());
      }
      this.edges.get(dep)!.add(id);
    }

    return this;
  }

  build(): ExecutionGraph {
    // Validate DAG (no cycles)
    this.validateNoCycles();

    return {
      id: this.id,
      nodes: new Map(this.nodes),
      edges: new Map(this.edges),
      metadata: {
        createdAt: new Date(),
        status: 'pending',
      },
    };
  }

  private validateNoCycles(): void {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (nodeId: string): boolean => {
      if (recursionStack.has(nodeId)) {
        return true;
      }

      if (visited.has(nodeId)) {
        return false;
      }

      visited.add(nodeId);
      recursionStack.add(nodeId);

      const dependents = this.edges.get(nodeId) ?? new Set();
      for (const dep of dependents) {
        if (hasCycle(dep)) {
          return true;
        }
      }

      recursionStack.delete(nodeId);
      return false;
    };

    for (const nodeId of this.nodes.keys()) {
      if (hasCycle(nodeId)) {
        throw new Error(`Cycle detected in execution graph involving node: ${nodeId}`);
      }
    }
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

export function createDAGExecutor(config: DAGExecutorConfig = {}): DAGExecutor {
  return new DAGExecutor(config);
}

export function createExecutionGraph(): ExecutionGraphBuilder {
  return new ExecutionGraphBuilder();
}
