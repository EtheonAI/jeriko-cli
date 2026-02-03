/**
 * @repo/ai - Task Planner
 *
 * Intelligent task decomposition that breaks down complex tasks
 * into executable subtasks with proper dependency ordering.
 */

import type { Agent, AgentToolDefinition } from '../agents/types';
import type { UIMessage } from '../types/ui-message';
import { generateId } from '../streaming';
import type { ExecutionGraph, ExecutionNode } from './dag-executor';
import { ExecutionGraphBuilder } from './dag-executor';

// ============================================================================
// Task Planner Types
// ============================================================================

export interface TaskPlan {
  /** Plan identifier */
  id: string;

  /** Original task description */
  originalTask: string;

  /** Decomposed subtasks */
  subtasks: PlannedTask[];

  /** Planning metadata */
  metadata: {
    createdAt: Date;
    planningDuration: number;
    complexity: 'simple' | 'moderate' | 'complex';
    confidence: number;
  };
}

export interface PlannedTask {
  /** Task identifier */
  id: string;

  /** Task description */
  description: string;

  /** Dependencies (task IDs that must complete first) */
  dependencies: string[];

  /** Estimated complexity */
  complexity: 'trivial' | 'simple' | 'moderate' | 'complex';

  /** Suggested agent type */
  suggestedAgentType?: string;

  /** Required tools */
  requiredTools?: string[];

  /** Task category */
  category?: string;

  /** Expected output type */
  expectedOutput?: 'text' | 'data' | 'code' | 'decision';
}

export interface PlannerContext {
  /** Conversation history */
  messages?: UIMessage[];

  /** Available tools */
  tools?: Record<string, AgentToolDefinition>;

  /** Available agents */
  agents?: Record<string, Agent>;

  /** User preferences */
  preferences?: {
    maxSubtasks?: number;
    preferParallel?: boolean;
    detailLevel?: 'minimal' | 'standard' | 'detailed';
  };
}

// ============================================================================
// Task Planner Configuration
// ============================================================================

export interface TaskPlannerConfig {
  /** Model ID for planning */
  model: string;

  /** Maximum subtasks to generate */
  maxSubtasks?: number;

  /** Minimum subtasks (forces decomposition) */
  minSubtasks?: number;

  /** Planning temperature */
  temperature?: number;

  /** Enable automatic dependency detection */
  autoDetectDependencies?: boolean;

  /** Custom planning prompt */
  customPrompt?: string;

  /** Called when planning starts */
  onPlanningStart?: () => void;

  /** Called when planning completes */
  onPlanningComplete?: (plan: TaskPlan) => void;
}

// ============================================================================
// Task Planner Implementation
// ============================================================================

export class TaskPlanner {
  private config: Required<TaskPlannerConfig>;

  constructor(config: TaskPlannerConfig) {
    this.config = {
      maxSubtasks: config.maxSubtasks ?? 10,
      minSubtasks: config.minSubtasks ?? 1,
      temperature: config.temperature ?? 0.5,
      autoDetectDependencies: config.autoDetectDependencies ?? true,
      customPrompt: config.customPrompt ?? '',
      onPlanningStart: config.onPlanningStart ?? (() => {}),
      onPlanningComplete: config.onPlanningComplete ?? (() => {}),
      model: config.model,
    };
  }

  // ========================================
  // Plan Generation
  // ========================================

  async plan(task: string, context: PlannerContext = {}): Promise<TaskPlan> {
    const startTime = Date.now();
    this.config.onPlanningStart();

    // Analyze task complexity
    const complexity = this.analyzeComplexity(task);

    // Generate subtasks based on complexity
    let subtasks: PlannedTask[];

    if (complexity === 'simple' || task.split(' ').length < 10) {
      // Simple tasks don't need decomposition
      subtasks = [this.createSimpleTask(task)];
    } else {
      // Use LLM for complex task decomposition
      subtasks = await this.decomposeWithLLM(task, context);
    }

    // Build plan
    const plan: TaskPlan = {
      id: generateId('plan'),
      originalTask: task,
      subtasks,
      metadata: {
        createdAt: new Date(),
        planningDuration: Date.now() - startTime,
        complexity,
        confidence: this.calculateConfidence(subtasks),
      },
    };

    this.config.onPlanningComplete(plan);
    return plan;
  }

  async planToGraph(task: string, context: PlannerContext = {}): Promise<ExecutionGraph> {
    const plan = await this.plan(task, context);
    return this.convertPlanToGraph(plan, context.agents);
  }

  // ========================================
  // LLM-Based Decomposition
  // ========================================

  private async decomposeWithLLM(task: string, context: PlannerContext): Promise<PlannedTask[]> {
    const { generateText } = await import('ai');
    const modelInstance = await this.getModelInstance(this.config.model);

    const prompt = this.buildDecompositionPrompt(task, context);

    const result = await generateText({
      model: modelInstance as Parameters<typeof generateText>[0]['model'],
      system: this.getSystemPrompt(context),
      prompt,
      temperature: this.config.temperature,
    });

    return this.parseDecompositionResult(result.text);
  }

  private buildDecompositionPrompt(task: string, context: PlannerContext): string {
    const toolsList = context.tools
      ? `Available tools: ${Object.keys(context.tools).join(', ')}`
      : '';

    const agentsList = context.agents
      ? `Available agents: ${Object.keys(context.agents).join(', ')}`
      : '';

    const preferences = context.preferences ?? {};
    const maxTasks = preferences.maxSubtasks ?? this.config.maxSubtasks;

    return `
Task to decompose:
"${task}"

${toolsList}
${agentsList}

Requirements:
- Maximum ${maxTasks} subtasks
- Each subtask should be independently executable
- Identify dependencies between tasks
- Tasks that can run in parallel should have no dependencies on each other

Output format (JSON array):
[
  {
    "id": "task_1",
    "description": "Description of first task",
    "dependencies": [],
    "complexity": "simple|moderate|complex",
    "category": "research|analysis|synthesis|execution",
    "expectedOutput": "text|data|code|decision"
  },
  ...
]
`;
  }

  private getSystemPrompt(context: PlannerContext): string {
    const detailLevel = context.preferences?.detailLevel ?? 'standard';

    const basePrompt = `You are a task planning expert. Your job is to decompose complex tasks into smaller, manageable subtasks.

Guidelines:
- Create clear, actionable subtasks
- Identify true dependencies (task B requires output from task A)
- Maximize parallelization where possible
- Each subtask should have a single, clear objective
- Consider the order of operations carefully`;

    if (detailLevel === 'minimal') {
      return `${basePrompt}\n\nKeep subtasks minimal and high-level.`;
    } else if (detailLevel === 'detailed') {
      return `${basePrompt}\n\nProvide detailed subtasks with specific instructions.`;
    }

    return basePrompt;
  }

  private parseDecompositionResult(text: string): PlannedTask[] {
    try {
      // Extract JSON from response
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        return [this.createFallbackTask(text)];
      }

      const parsed = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(parsed)) {
        return [this.createFallbackTask(text)];
      }

      return parsed.map((item: Record<string, unknown>, index: number) => ({
        id: (item.id as string) ?? `task_${index + 1}`,
        description: (item.description as string) ?? String(item),
        dependencies: (item.dependencies as string[]) ?? [],
        complexity: this.validateComplexity(item.complexity as string),
        category: item.category as string,
        expectedOutput: item.expectedOutput as PlannedTask['expectedOutput'],
        suggestedAgentType: item.suggestedAgentType as string,
        requiredTools: item.requiredTools as string[],
      }));
    } catch {
      return [this.createFallbackTask(text)];
    }
  }

  // ========================================
  // Analysis
  // ========================================

  private analyzeComplexity(task: string): TaskPlan['metadata']['complexity'] {
    const wordCount = task.split(/\s+/).length;
    const hasMultipleSteps = /and|then|after|before|first|next|finally/i.test(task);
    const hasConditionals = /if|when|unless|while/i.test(task);

    if (wordCount > 50 || (hasMultipleSteps && hasConditionals)) {
      return 'complex';
    } else if (wordCount > 20 || hasMultipleSteps) {
      return 'moderate';
    }

    return 'simple';
  }

  private calculateConfidence(subtasks: PlannedTask[]): number {
    if (subtasks.length === 0) return 0;
    if (subtasks.length === 1) return 0.95; // Simple task

    // Calculate based on task properties
    let confidence = 0.8;

    // Well-formed dependencies increase confidence
    const hasValidDeps = subtasks.every((t) =>
      t.dependencies.every((dep) => subtasks.some((s) => s.id === dep))
    );
    if (hasValidDeps) confidence += 0.1;

    // Varied complexity is good
    const complexities = new Set(subtasks.map((t) => t.complexity));
    if (complexities.size > 1) confidence += 0.05;

    return Math.min(confidence, 1);
  }

  // ========================================
  // Graph Conversion
  // ========================================

  convertPlanToGraph(plan: TaskPlan, agents?: Record<string, Agent>): ExecutionGraph {
    const builder = new ExecutionGraphBuilder(plan.id);

    for (const subtask of plan.subtasks) {
      const agent = subtask.suggestedAgentType
        ? agents?.[subtask.suggestedAgentType]
        : undefined;

      builder.addNode(subtask.id, subtask.description, {
        dependencies: subtask.dependencies,
        agent,
        config: {
          timeout: this.getTimeoutForComplexity(subtask.complexity),
        },
      });
    }

    return builder.build();
  }

  private getTimeoutForComplexity(complexity: PlannedTask['complexity']): number {
    switch (complexity) {
      case 'trivial':
        return 10000;
      case 'simple':
        return 30000;
      case 'moderate':
        return 60000;
      case 'complex':
        return 120000;
      default:
        return 60000;
    }
  }

  // ========================================
  // Helpers
  // ========================================

  private createSimpleTask(task: string): PlannedTask {
    return {
      id: 'task_1',
      description: task,
      dependencies: [],
      complexity: 'simple',
      expectedOutput: 'text',
    };
  }

  private createFallbackTask(text: string): PlannedTask {
    return {
      id: 'task_1',
      description: text.slice(0, 500),
      dependencies: [],
      complexity: 'moderate',
      expectedOutput: 'text',
    };
  }

  private validateComplexity(value: unknown): PlannedTask['complexity'] {
    if (value === 'trivial' || value === 'simple' || value === 'moderate' || value === 'complex') {
      return value;
    }
    return 'moderate';
  }

  private async getModelInstance(modelId: string): Promise<unknown> {
    const [provider, ...modelParts] = modelId.split('/');
    const modelName = modelParts.join('/') || modelId;

    switch (provider) {
      case 'anthropic': {
        const { anthropic } = await import('@ai-sdk/anthropic');
        return anthropic(modelName);
      }
      case 'openai': {
        const { openai } = await import('@ai-sdk/openai');
        return openai(modelName);
      }
      case 'google': {
        const { google } = await import('@ai-sdk/google');
        return google(modelName);
      }
      default: {
        const { anthropic } = await import('@ai-sdk/anthropic');
        return anthropic(modelId);
      }
    }
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

export function createTaskPlanner(config: TaskPlannerConfig): TaskPlanner {
  return new TaskPlanner(config);
}

// ============================================================================
// Quick Plan Function
// ============================================================================

export async function quickPlan(
  task: string,
  options: {
    model?: string;
    context?: PlannerContext;
  } = {}
): Promise<TaskPlan> {
  const planner = new TaskPlanner({
    model: options.model ?? 'anthropic/claude-sonnet-4-5-20250929',
  });

  return planner.plan(task, options.context);
}
