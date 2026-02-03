/**
 * @repo/ai - Router Agent
 *
 * Task classification and routing agent that analyzes incoming requests
 * and routes them to the appropriate specialized agent or workflow.
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
  AgentType,
} from './types';
import type { UIMessage, FinishReason } from '../types/ui-message';
import { generateId } from '../streaming';

// ============================================================================
// Route Types
// ============================================================================

export interface Route {
  /** Route identifier */
  id: string;

  /** Human-readable name */
  name: string;

  /** Description for the classifier */
  description: string;

  /** Agent type to route to */
  agentType: AgentType;

  /** Agent instance or factory */
  agent: Agent | (() => Agent);

  /** Optional condition function */
  condition?: (task: string, context: RouteContext) => boolean;

  /** Route priority (higher = checked first) */
  priority?: number;
}

export interface RouteContext {
  messages: UIMessage[];
  metadata?: Record<string, unknown>;
}

export interface RouteDecision {
  /** Selected route */
  route: Route;

  /** Confidence score (0-1) */
  confidence: number;

  /** Reasoning for the decision */
  reasoning?: string;

  /** Alternative routes considered */
  alternatives?: Array<{ route: Route; confidence: number }>;
}

// ============================================================================
// Router Agent Configuration
// ============================================================================

export interface RouterAgentConfig extends AgentConfig {
  /** Agent name */
  name?: string;

  /** Agent ID */
  id?: string;

  /** Available routes */
  routes: Route[];

  /** Default route if no match */
  defaultRoute?: Route;

  /** Custom classifier function */
  classifier?: (task: string, routes: Route[], context: RouteContext) => Promise<RouteDecision>;

  /** Minimum confidence threshold for routing */
  minConfidence?: number;

  /** Called when a route is selected */
  onRouteSelected?: (decision: RouteDecision) => void;

  /** Enable reasoning output for route selection */
  explainRouting?: boolean;
}

// ============================================================================
// Router Agent Implementation
// ============================================================================

/**
 * RouterAgent - Task classification and routing
 *
 * @example
 * ```ts
 * const router = new RouterAgent({
 *   model: 'anthropic/claude-sonnet-4-5-20250929',
 *   routes: [
 *     {
 *       id: 'research',
 *       name: 'Research Agent',
 *       description: 'Complex research tasks requiring multiple sources',
 *       agentType: 'dag',
 *       agent: dagAgent,
 *     },
 *     {
 *       id: 'simple',
 *       name: 'Simple Q&A',
 *       description: 'Simple questions with direct answers',
 *       agentType: 'tool-loop',
 *       agent: simpleAgent,
 *     },
 *   ],
 * });
 *
 * const result = await router.generate({ messages });
 * ```
 */
export class RouterAgent implements Agent {
  readonly id: string;
  readonly name: string;
  readonly config: RouterAgentConfig;

  private lastDecision: RouteDecision | null = null;

  constructor(config: RouterAgentConfig) {
    this.id = config.id ?? generateId('router');
    this.name = config.name ?? 'RouterAgent';
    this.config = {
      minConfidence: 0.5,
      explainRouting: false,
      ...config,
    };

    // Sort routes by priority
    this.config.routes.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  }

  // ========================================
  // Generate
  // ========================================

  async generate(options: AgentGenerateOptions): Promise<AgentGenerateResult> {
    const startTime = Date.now();
    const steps: AgentStep[] = [];

    // Extract task
    const lastUserMessage = [...options.messages].reverse().find((m) => m.role === 'user');
    const task = this.extractTaskFromMessage(lastUserMessage);

    if (!task) {
      return this.createErrorResult('No task found in messages', startTime);
    }

    // Step 1: Classify and route
    const classifyStep: AgentStep = {
      stepNumber: 1,
      type: 'generation',
      text: 'Analyzing request...',
      duration: 0,
    };

    const classifyStartTime = Date.now();
    let decision: RouteDecision;

    try {
      decision = await this.classifyAndRoute(task, {
        messages: options.messages,
      });
      classifyStep.duration = Date.now() - classifyStartTime;
      classifyStep.text = `Routed to ${decision.route.name} (${(decision.confidence * 100).toFixed(0)}% confidence)`;
      classifyStep.metadata = {
        routeId: decision.route.id,
        confidence: decision.confidence,
        reasoning: decision.reasoning,
      };
    } catch (error) {
      classifyStep.duration = Date.now() - classifyStartTime;
      return this.createErrorResult(
        `Failed to classify task: ${error instanceof Error ? error.message : String(error)}`,
        startTime
      );
    }

    steps.push(classifyStep);
    this.lastDecision = decision;
    this.config.onRouteSelected?.(decision);

    // Check confidence threshold
    if (decision.confidence < (this.config.minConfidence ?? 0.5)) {
      // Use default route if available
      if (this.config.defaultRoute) {
        decision = {
          route: this.config.defaultRoute,
          confidence: 1,
          reasoning: 'Using default route due to low confidence',
        };
      } else {
        return this.createErrorResult(
          `Low confidence routing (${(decision.confidence * 100).toFixed(0)}%). No default route configured.`,
          startTime
        );
      }
    }

    // Step 2: Execute with selected agent
    const executeStep: AgentStep = {
      stepNumber: 2,
      type: 'generation',
      text: `Executing with ${decision.route.name}...`,
      duration: 0,
    };

    const executeStartTime = Date.now();
    let agentResult: AgentGenerateResult;

    try {
      const agent = typeof decision.route.agent === 'function'
        ? decision.route.agent()
        : decision.route.agent;

      agentResult = await agent.generate(options);
      executeStep.duration = Date.now() - executeStartTime;
      executeStep.text = `Completed with ${decision.route.name}`;
    } catch (error) {
      executeStep.duration = Date.now() - executeStartTime;
      return this.createErrorResult(
        `Agent execution failed: ${error instanceof Error ? error.message : String(error)}`,
        startTime
      );
    }

    steps.push(executeStep);

    // Combine steps
    const allSteps = [...steps, ...agentResult.steps.map((s) => ({
      ...s,
      stepNumber: s.stepNumber + 2,
    }))];

    // Build response with routing metadata
    const responseMessage: UIMessage = {
      ...agentResult.message,
      metadata: {
        ...agentResult.message.metadata,
        routing: {
          routeId: decision.route.id,
          routeName: decision.route.name,
          confidence: decision.confidence,
          reasoning: decision.reasoning,
        },
      },
    };

    return {
      message: responseMessage,
      messages: [...options.messages, responseMessage],
      finishReason: agentResult.finishReason,
      usage: agentResult.usage,
      steps: allSteps,
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

    const { readable, writable } = new TransformStream<AgentStreamChunk>();
    const writer = writable.getWriter();

    // Run in background
    (async () => {
      const startTime = Date.now();

      try {
        // Emit classification start
        const classifyStart: AgentStreamChunk = { type: 'step-start', stepNumber: 1 };
        await writer.write(classifyStart);
        options.onChunk?.(classifyStart);

        // Get task and classify
        const lastUserMessage = [...options.messages].reverse().find((m) => m.role === 'user');
        const task = this.extractTaskFromMessage(lastUserMessage);

        if (!task) {
          throw new Error('No task found');
        }

        const decision = await this.classifyAndRoute(task, { messages: options.messages });
        this.lastDecision = decision;
        this.config.onRouteSelected?.(decision);

        // Emit routing decision
        const routeChunk: AgentStreamChunk = {
          type: 'data',
          dataType: 'route-decision',
          data: {
            routeId: decision.route.id,
            routeName: decision.route.name,
            confidence: decision.confidence,
            reasoning: decision.reasoning,
          },
        };
        await writer.write(routeChunk);
        options.onChunk?.(routeChunk);

        if (this.config.explainRouting && decision.reasoning) {
          const reasoningChunk: AgentStreamChunk = {
            type: 'text-delta',
            delta: `[Routing: ${decision.reasoning}]\n\n`,
          };
          await writer.write(reasoningChunk);
          options.onChunk?.(reasoningChunk);
        }

        // Step end
        const classifyEnd: AgentStreamChunk = { type: 'step-end', stepNumber: 1 };
        await writer.write(classifyEnd);
        options.onChunk?.(classifyEnd);

        // Get agent and stream
        const agent = typeof decision.route.agent === 'function'
          ? decision.route.agent()
          : decision.route.agent;

        const agentStream = await agent.stream({
          ...options,
          onChunk: async (chunk) => {
            // Offset step numbers
            if (chunk.type === 'step-start' || chunk.type === 'step-end') {
              const offsetChunk = { ...chunk, stepNumber: chunk.stepNumber + 1 };
              await writer.write(offsetChunk);
              options.onChunk?.(offsetChunk);
            } else {
              await writer.write(chunk);
              options.onChunk?.(chunk);
            }
          },
        });

        // Wait for agent result
        const agentResult = await agentStream.result;

        resultResolver({
          ...agentResult,
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
  // Classification
  // ========================================

  private async classifyAndRoute(task: string, context: RouteContext): Promise<RouteDecision> {
    // Use custom classifier if provided
    if (this.config.classifier) {
      return this.config.classifier(task, this.config.routes, context);
    }

    // Default classifier using condition functions and LLM
    return this.defaultClassifier(task, context);
  }

  private async defaultClassifier(task: string, context: RouteContext): Promise<RouteDecision> {
    const routes = this.config.routes;

    // First, check condition functions
    for (const route of routes) {
      if (route.condition && route.condition(task, context)) {
        return {
          route,
          confidence: 1,
          reasoning: 'Matched route condition',
        };
      }
    }

    // Use LLM-based classification
    const classificationPrompt = this.buildClassificationPrompt(task, routes);

    // Import AI SDK dynamically
    const { generateText } = await import('ai');
    const modelInstance = await this.getModelInstance(this.config.model);

    const result = await generateText({
      model: modelInstance as Parameters<typeof generateText>[0]['model'],
      system: `You are a task classifier. Analyze the user's request and determine which route best handles it.
Output format: JSON with "routeId", "confidence" (0-1), and "reasoning".`,
      prompt: classificationPrompt,
      temperature: 0.3, // Lower temperature for classification
    });

    // Parse result
    try {
      const jsonMatch = result.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const selectedRoute = routes.find((r) => r.id === parsed.routeId);

        if (selectedRoute) {
          return {
            route: selectedRoute,
            confidence: Math.max(0, Math.min(1, parsed.confidence ?? 0.5)),
            reasoning: parsed.reasoning,
          };
        }
      }
    } catch {
      // Fall through to default
    }

    // Default to first route with medium confidence
    return {
      route: routes[0],
      confidence: 0.5,
      reasoning: 'Default selection (classification uncertain)',
    };
  }

  private buildClassificationPrompt(task: string, routes: Route[]): string {
    const routeDescriptions = routes
      .map((r) => `- ${r.id}: ${r.name} - ${r.description}`)
      .join('\n');

    return `Task: "${task}"

Available routes:
${routeDescriptions}

Which route should handle this task? Respond with JSON:
{"routeId": "...", "confidence": 0.X, "reasoning": "..."}`;
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

  get lastRouteDecision(): RouteDecision | null {
    return this.lastDecision;
  }

  get routes(): Route[] {
    return this.config.routes;
  }
}

// ============================================================================
// Factory
// ============================================================================

export function createRouterAgent(config: RouterAgentConfig): RouterAgent {
  return new RouterAgent(config);
}

// ============================================================================
// Route Builders
// ============================================================================

export function createRoute(
  id: string,
  name: string,
  description: string,
  agent: Agent | (() => Agent),
  agentType: AgentType = 'custom'
): Route {
  return { id, name, description, agent, agentType };
}

export function withCondition(route: Route, condition: Route['condition']): Route {
  return { ...route, condition };
}

export function withPriority(route: Route, priority: number): Route {
  return { ...route, priority };
}
