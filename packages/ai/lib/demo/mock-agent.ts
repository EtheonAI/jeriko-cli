/**
 * @repo/ai - Mock Agent
 *
 * Simulated agent for testing and demo purposes.
 * Returns realistic mock responses without hitting actual AI APIs.
 */

import type {
  Agent,
  AgentGenerateOptions,
  AgentGenerateResult,
  AgentStreamOptions,
  AgentStreamResult,
  AgentStep,
  AgentToolCall,
  AgentToolResult,
  AgentStreamChunk,
  TokenUsage,
} from '../agents/types';
import type { UIMessage, FinishReason } from '../types/ui-message';
import { generateId } from '../streaming';

// ============================================================================
// Mock Data Types
// ============================================================================

export interface MockResponse {
  /** Response text */
  text: string;

  /** Simulated tool calls */
  toolCalls?: Array<{
    name: string;
    input: Record<string, unknown>;
    output: unknown;
  }>;

  /** Simulated thinking/reasoning */
  reasoning?: string;

  /** Response delay in ms */
  delay?: number;

  /** Token count override */
  tokens?: { prompt: number; completion: number };
}

export interface MockAgentConfig {
  /** Agent name */
  name?: string;

  /** Default response when no match */
  defaultResponse?: MockResponse;

  /** Response patterns (regex -> response) */
  patterns?: Array<{
    pattern: RegExp;
    response: MockResponse;
  }>;

  /** Fixed responses for exact matches */
  responses?: Record<string, MockResponse>;

  /** Simulated latency range [min, max] in ms */
  latencyRange?: [number, number];

  /** Enable realistic streaming simulation */
  simulateStreaming?: boolean;

  /** Words per second for streaming */
  streamingWPS?: number;

  /** Failure rate (0-1) for testing error handling */
  failureRate?: number;

  /** Custom response generator */
  generateResponse?: (input: string, messages: UIMessage[]) => Promise<MockResponse>;
}

// ============================================================================
// Default Mock Responses
// ============================================================================

const DEFAULT_RESPONSES: MockResponse[] = [
  {
    text: "I understand you're looking for assistance. Based on your request, I'll help you analyze this step by step.\n\nFirst, let me gather some relevant information...",
    delay: 500,
    tokens: { prompt: 150, completion: 45 },
  },
  {
    text: "Great question! Here's what I found:\n\n1. **Key Point**: The analysis shows interesting patterns\n2. **Recommendation**: Consider the following approach\n3. **Next Steps**: We should explore further options\n\nWould you like me to elaborate on any of these points?",
    delay: 700,
    tokens: { prompt: 180, completion: 65 },
  },
  {
    text: "I've processed your request and here are my findings:\n\n## Summary\nThe data indicates several important trends that we should consider.\n\n## Details\n- Primary observation: Significant correlation detected\n- Secondary finding: Patterns align with expected behavior\n- Recommendation: Proceed with caution\n\nLet me know if you need more details!",
    delay: 600,
    tokens: { prompt: 200, completion: 85 },
  },
];

const TOOL_CALL_RESPONSES: Array<MockResponse & { toolCalls: NonNullable<MockResponse['toolCalls']> }> = [
  {
    text: "Let me search for that information...",
    toolCalls: [
      {
        name: 'web_search',
        input: { query: 'relevant search query' },
        output: {
          results: [
            { title: 'Result 1', snippet: 'Relevant information found', url: 'https://example.com/1' },
            { title: 'Result 2', snippet: 'Additional context', url: 'https://example.com/2' },
          ],
        },
      },
    ],
    delay: 1000,
    tokens: { prompt: 250, completion: 120 },
  },
  {
    text: "I'll analyze that code for you...",
    toolCalls: [
      {
        name: 'code_analysis',
        input: { code: 'function example() { return true; }', language: 'javascript' },
        output: {
          issues: [],
          suggestions: ['Consider adding type annotations', 'Add JSDoc comments'],
          complexity: 'low',
        },
      },
    ],
    delay: 800,
    tokens: { prompt: 180, completion: 90 },
  },
];

// ============================================================================
// Mock Agent Implementation
// ============================================================================

export class MockAgent implements Agent {
  readonly id: string;
  readonly name: string;
  private config: MockAgentConfig;

  constructor(config: MockAgentConfig = {}) {
    this.id = generateId('mock-agent');
    this.name = config.name ?? 'MockAgent';
    this.config = {
      latencyRange: [100, 500],
      simulateStreaming: true,
      streamingWPS: 20,
      failureRate: 0,
      ...config,
    };
  }

  // ========================================
  // Generate
  // ========================================

  async generate(options: AgentGenerateOptions): Promise<AgentGenerateResult> {
    const startTime = Date.now();

    // Check for simulated failure
    if (this.config.failureRate && Math.random() < this.config.failureRate) {
      throw new Error('Simulated API failure');
    }

    // Get input text
    const inputText = this.extractInputText(options.messages);

    // Get response
    const mockResponse = await this.getResponse(inputText, options.messages);

    // Simulate latency
    await this.simulateLatency(mockResponse.delay);

    // Build steps
    const steps: AgentStep[] = [];
    let stepNumber = 0;

    // Add reasoning step if present
    if (mockResponse.reasoning) {
      steps.push({
        stepNumber: ++stepNumber,
        type: 'generation',
        text: mockResponse.reasoning,
        duration: 200,
        metadata: { type: 'reasoning' },
      });
    }

    // Add tool call steps
    const toolCalls: AgentToolCall[] = [];
    const toolResults: AgentToolResult[] = [];

    if (mockResponse.toolCalls) {
      for (const tc of mockResponse.toolCalls) {
        const toolCallId = generateId('tool');

        toolCalls.push({
          toolCallId,
          toolName: tc.name,
          input: tc.input,
        });

        toolResults.push({
          toolCallId,
          toolName: tc.name,
          output: tc.output,
          isError: false,
          duration: 300,
        });
      }

      steps.push({
        stepNumber: ++stepNumber,
        type: 'tool-execution',
        toolCalls,
        toolResults,
        duration: 500,
      });
    }

    // Add generation step
    steps.push({
      stepNumber: ++stepNumber,
      type: 'generation',
      text: mockResponse.text,
      duration: 300,
    });

    // Build message parts
    const parts: UIMessage['parts'] = [];

    if (mockResponse.reasoning) {
      parts.push({ type: 'reasoning', text: mockResponse.reasoning });
    }

    parts.push({ type: 'text', text: mockResponse.text });

    for (const tc of toolCalls) {
      parts.push({
        type: `tool-${tc.toolName}` as `tool-${string}`,
        toolCallId: tc.toolCallId,
        state: 'output-available',
        input: tc.input,
        output: toolResults.find((r) => r.toolCallId === tc.toolCallId)?.output,
      } as any);
    }

    // Build response message
    const responseMessage: UIMessage = {
      id: generateId('msg'),
      role: 'assistant',
      parts,
      metadata: {
        model: 'mock/demo-model',
        finishReason: 'stop' as FinishReason,
        cached: false,
      },
      createdAt: new Date(),
    };

    // Calculate usage
    const usage: TokenUsage = {
      promptTokens: mockResponse.tokens?.prompt ?? this.estimateTokens(inputText),
      completionTokens: mockResponse.tokens?.completion ?? this.estimateTokens(mockResponse.text),
      totalTokens: 0,
    };
    usage.totalTokens = usage.promptTokens + usage.completionTokens;

    return {
      message: responseMessage,
      messages: [...options.messages, responseMessage],
      finishReason: 'stop',
      usage,
      steps,
      duration: Date.now() - startTime,
    };
  }

  // ========================================
  // Stream
  // ========================================

  async stream(options: AgentStreamOptions): Promise<AgentStreamResult> {
    const startTime = Date.now();

    // Check for simulated failure
    if (this.config.failureRate && Math.random() < this.config.failureRate) {
      throw new Error('Simulated API failure');
    }

    // Get input and response
    const inputText = this.extractInputText(options.messages);
    const mockResponse = await this.getResponse(inputText, options.messages);

    // Create result promise
    let resolveResult: (result: AgentGenerateResult) => void;
    const resultPromise = new Promise<AgentGenerateResult>((resolve) => {
      resolveResult = resolve;
    });

    // Create stream
    const wps = this.config.streamingWPS ?? 20;
    const delayPerWord = 1000 / wps;

    const stream = new ReadableStream<AgentStreamChunk>({
      async start(controller) {
        const chunks: AgentStreamChunk[] = [];
        let stepNumber = 0;

        // Helper to emit chunk
        const emit = (chunk: AgentStreamChunk) => {
          controller.enqueue(chunk);
          chunks.push(chunk);
          options.onChunk?.(chunk);
        };

        // Stream reasoning if present
        if (mockResponse.reasoning) {
          emit({ type: 'step-start', stepNumber: ++stepNumber });

          const words = mockResponse.reasoning.split(' ');
          for (const word of words) {
            emit({ type: 'reasoning-delta', delta: word + ' ' });
            await new Promise((r) => setTimeout(r, delayPerWord / 2));
          }

          emit({ type: 'reasoning-done', text: mockResponse.reasoning });
          emit({ type: 'step-end', stepNumber });
        }

        // Stream tool calls if present
        if (mockResponse.toolCalls?.length) {
          emit({ type: 'step-start', stepNumber: ++stepNumber });

          for (const tc of mockResponse.toolCalls) {
            const toolCallId = generateId('tool');

            emit({ type: 'tool-call-start', toolCallId, toolName: tc.name });
            await new Promise((r) => setTimeout(r, 200));

            emit({ type: 'tool-call-args-done', toolCallId, args: tc.input });
            await new Promise((r) => setTimeout(r, 300));

            emit({
              type: 'tool-call-result',
              toolCallId,
              result: tc.output,
              isError: false,
            });
          }

          emit({ type: 'step-end', stepNumber });
        }

        // Stream main text
        emit({ type: 'step-start', stepNumber: ++stepNumber });

        const words = mockResponse.text.split(' ');
        for (const word of words) {
          emit({ type: 'text-delta', delta: word + ' ' });
          await new Promise((r) => setTimeout(r, delayPerWord));
        }

        emit({ type: 'text-done', text: mockResponse.text });
        emit({ type: 'step-end', stepNumber });

        // Finish
        const usage: TokenUsage = {
          promptTokens: mockResponse.tokens?.prompt ?? 150,
          completionTokens: mockResponse.tokens?.completion ?? 50,
          totalTokens: 200,
        };

        emit({ type: 'finish', finishReason: 'stop', usage });

        controller.close();

        // Resolve result
        resolveResult({
          message: {
            id: generateId('msg'),
            role: 'assistant',
            parts: [{ type: 'text', text: mockResponse.text }],
            createdAt: new Date(),
          },
          messages: options.messages,
          finishReason: 'stop',
          usage,
          steps: [],
          duration: Date.now() - startTime,
        });
      },
    });

    return {
      stream,
      result: resultPromise,
    };
  }

  // ========================================
  // Response Selection
  // ========================================

  private async getResponse(input: string, messages: UIMessage[]): Promise<MockResponse> {
    // Custom generator
    if (this.config.generateResponse) {
      return this.config.generateResponse(input, messages);
    }

    // Check exact matches
    if (this.config.responses?.[input]) {
      return this.config.responses[input];
    }

    // Check patterns
    if (this.config.patterns) {
      for (const { pattern, response } of this.config.patterns) {
        if (pattern.test(input)) {
          return response;
        }
      }
    }

    // Default response
    if (this.config.defaultResponse) {
      return this.config.defaultResponse;
    }

    // Random from defaults
    const hasToolKeywords = /search|find|analyze|check|look up/i.test(input);

    if (hasToolKeywords && Math.random() > 0.5) {
      return TOOL_CALL_RESPONSES[Math.floor(Math.random() * TOOL_CALL_RESPONSES.length)];
    }

    return DEFAULT_RESPONSES[Math.floor(Math.random() * DEFAULT_RESPONSES.length)];
  }

  // ========================================
  // Helpers
  // ========================================

  private extractInputText(messages: UIMessage[]): string {
    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');
    if (!lastUserMessage) return '';

    return lastUserMessage.parts
      .filter((p) => p.type === 'text')
      .map((p) => (p as { text: string }).text)
      .join('\n');
  }

  private async simulateLatency(overrideDelay?: number): Promise<void> {
    const [min, max] = this.config.latencyRange ?? [100, 500];
    const delay = overrideDelay ?? min + Math.random() * (max - min);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  private estimateTokens(text: string): number {
    // Rough estimate: ~4 chars per token
    return Math.ceil(text.length / 4);
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

export function createMockAgent(config?: MockAgentConfig): MockAgent {
  return new MockAgent(config);
}

/**
 * Create a mock agent with predefined demo responses
 */
export function createDemoAgent(): MockAgent {
  return new MockAgent({
    name: 'DemoAgent',
    patterns: [
      {
        pattern: /hello|hi|hey/i,
        response: {
          text: "Hello! I'm a demo AI assistant. I can help you explore the capabilities of this AI system. Try asking me to search for something or analyze some code!",
          delay: 300,
        },
      },
      {
        pattern: /search|find|look up/i,
        response: {
          text: "I found some relevant results for you:",
          toolCalls: [
            {
              name: 'web_search',
              input: { query: 'demo search' },
              output: {
                results: [
                  { title: 'Demo Result 1', snippet: 'This is a demonstration of search capabilities', url: '#' },
                  { title: 'Demo Result 2', snippet: 'Search functionality is working correctly', url: '#' },
                ],
              },
            },
          ],
          delay: 800,
        },
      },
      {
        pattern: /code|analyze|review/i,
        response: {
          text: "I've analyzed the code and here are my findings:",
          toolCalls: [
            {
              name: 'code_analysis',
              input: { code: 'example code', language: 'typescript' },
              output: {
                issues: ['No critical issues found'],
                suggestions: ['Consider adding type annotations', 'Add error handling'],
                score: 85,
              },
            },
          ],
          reasoning: "Let me analyze this code step by step. First, I'll check for syntax errors, then review the logic...",
          delay: 1000,
        },
      },
    ],
    simulateStreaming: true,
    streamingWPS: 25,
  });
}
