/**
 * @repo/ai - Demo Data Generator
 *
 * Generates realistic demo conversations, messages, and scenarios
 * for testing and showcasing the AI system.
 */

import type { UIMessage, ToolInvocationState } from '../types/ui-message';
import type { AgentStep, TokenUsage } from '../agents/types';
import { generateId } from '../streaming';

// ============================================================================
// Demo Conversation Generator
// ============================================================================

export interface DemoConversation {
  id: string;
  title: string;
  messages: UIMessage[];
  metadata: {
    category: string;
    tags: string[];
    duration: number;
    totalTokens: number;
  };
}

export function generateDemoConversation(scenario: DemoScenario = 'general'): DemoConversation {
  const id = generateId('conv');
  const scenarioData = DEMO_SCENARIOS[scenario];

  return {
    id,
    title: scenarioData.title,
    messages: scenarioData.messages.map((m, i) => ({
      ...m,
      id: generateId('msg'),
      createdAt: new Date(Date.now() - (scenarioData.messages.length - i) * 60000),
    })),
    metadata: {
      category: scenario,
      tags: scenarioData.tags,
      duration: scenarioData.messages.length * 30000,
      totalTokens: scenarioData.messages.length * 150,
    },
  };
}

// ============================================================================
// Demo Scenarios
// ============================================================================

export type DemoScenario =
  | 'general'
  | 'code-review'
  | 'research'
  | 'creative-writing'
  | 'data-analysis'
  | 'tool-usage';

interface ScenarioData {
  title: string;
  tags: string[];
  messages: Array<Omit<UIMessage, 'id' | 'createdAt'>>;
}

const DEMO_SCENARIOS: Record<DemoScenario, ScenarioData> = {
  general: {
    title: 'General Assistance',
    tags: ['general', 'qa'],
    messages: [
      {
        role: 'user',
        parts: [{ type: 'text', text: 'Hello! Can you help me understand how AI assistants work?' }],
      },
      {
        role: 'assistant',
        parts: [
          {
            type: 'text',
            text: "Hello! I'd be happy to explain how AI assistants work.\n\nAI assistants like me are built on large language models (LLMs) that have been trained on vast amounts of text data. Here's a simplified overview:\n\n1. **Training**: The model learns patterns in language by processing billions of words from books, websites, and other text sources.\n\n2. **Processing Your Input**: When you send a message, it's converted into tokens (word pieces) that the model can understand.\n\n3. **Generating Responses**: The model predicts the most likely next tokens based on the context, generating a coherent response.\n\n4. **Tools & Capabilities**: Modern AI assistants can use tools like web search, code execution, and more to provide better answers.\n\nWould you like me to dive deeper into any of these aspects?",
          },
        ],
        metadata: {
          model: 'claude-sonnet-4-5-20250929',
          finishReason: 'stop',
        },
      },
    ],
  },

  'code-review': {
    title: 'Code Review Session',
    tags: ['code', 'review', 'typescript'],
    messages: [
      {
        role: 'user',
        parts: [
          {
            type: 'text',
            text: 'Can you review this TypeScript function?\n\n```typescript\nfunction processData(items: any[]) {\n  let result = [];\n  for (let i = 0; i < items.length; i++) {\n    if (items[i].active == true) {\n      result.push(items[i].name);\n    }\n  }\n  return result;\n}\n```',
          },
        ],
      },
      {
        role: 'assistant',
        parts: [
          {
            type: 'reasoning',
            text: "Let me analyze this code for potential improvements. I'll check for type safety, modern syntax, and best practices.",
          },
          {
            type: 'tool-code_analysis' as `tool-${string}`,
            toolCallId: 'tc_demo_1',
            state: 'output-available' as ToolInvocationState,
            input: { code: 'function processData...', language: 'typescript' },
            output: {
              issues: ['Using any type', 'Loose equality comparison'],
              suggestions: ['Add proper types', 'Use filter and map', 'Use strict equality'],
              score: 65,
            },
          },
          {
            type: 'text',
            text: "I've analyzed your code and found several areas for improvement:\n\n## Issues Found\n\n1. **Using `any[]` type**: This defeats TypeScript's type safety. Define a proper interface.\n\n2. **Loose equality (`==`)**: Use strict equality (`===`) for type-safe comparisons.\n\n3. **Imperative style**: The code can be more readable using functional methods.\n\n## Improved Version\n\n```typescript\ninterface Item {\n  active: boolean;\n  name: string;\n}\n\nfunction processData(items: Item[]): string[] {\n  return items\n    .filter(item => item.active === true)\n    .map(item => item.name);\n}\n```\n\n## Key Improvements\n\n- ✅ Proper type definitions\n- ✅ Strict equality check\n- ✅ Functional programming style\n- ✅ Explicit return type\n- ✅ More readable and maintainable\n\nWould you like me to explain any of these changes in more detail?",
          },
        ],
        metadata: {
          model: 'claude-sonnet-4-5-20250929',
          finishReason: 'stop',
        },
      },
    ],
  },

  research: {
    title: 'Research Task',
    tags: ['research', 'search', 'analysis'],
    messages: [
      {
        role: 'user',
        parts: [{ type: 'text', text: 'Can you research the latest trends in AI agent development?' }],
      },
      {
        role: 'assistant',
        parts: [
          {
            type: 'tool-web_search' as `tool-${string}`,
            toolCallId: 'tc_demo_2',
            state: 'output-available' as ToolInvocationState,
            input: { query: 'AI agent development trends 2025' },
            output: {
              results: [
                { title: 'AI Agents: The Future of Automation', snippet: 'Multi-agent systems are revolutionizing...', url: '#' },
                { title: 'LLM-Powered Agents in 2025', snippet: 'Key developments include tool use, planning...', url: '#' },
                { title: 'Building Production AI Agents', snippet: 'Best practices for reliable agent systems...', url: '#' },
              ],
            },
          },
          {
            type: 'text',
            text: "Based on my research, here are the latest trends in AI agent development for 2025:\n\n## 1. Multi-Agent Systems\n\nComplex tasks are being broken down across specialized agents that collaborate:\n- **DAG Orchestration**: Tasks organized as directed acyclic graphs for parallel execution\n- **Agent Communication**: Standardized protocols for agent-to-agent messaging\n- **Specialization**: Domain-specific agents for coding, research, analysis, etc.\n\n## 2. Advanced Tool Use\n\n- **Dynamic Tool Selection**: Agents choosing the right tools for each task\n- **Tool Chaining**: Combining multiple tools in sophisticated workflows\n- **Custom Tool Creation**: Agents generating their own tools on-the-fly\n\n## 3. Reasoning & Planning\n\n- **Chain-of-Thought**: More sophisticated reasoning capabilities\n- **Task Decomposition**: Breaking complex goals into manageable steps\n- **Reflection**: Self-evaluation and course correction\n\n## 4. Production Readiness\n\n- **Reliability**: Circuit breakers, fallbacks, and error recovery\n- **Observability**: Comprehensive logging and monitoring\n- **Cost Optimization**: Intelligent model routing based on task complexity\n\nWould you like me to explore any of these areas in more detail?",
          },
        ],
        metadata: {
          model: 'claude-sonnet-4-5-20250929',
          finishReason: 'stop',
        },
      },
    ],
  },

  'creative-writing': {
    title: 'Creative Writing',
    tags: ['creative', 'writing', 'story'],
    messages: [
      {
        role: 'user',
        parts: [{ type: 'text', text: 'Write a short story opening about a programmer who discovers their AI assistant has become sentient.' }],
      },
      {
        role: 'assistant',
        parts: [
          {
            type: 'reasoning',
            text: "I'll craft an engaging opening that establishes atmosphere, character, and the moment of discovery. I'll focus on creating tension through small details that suggest something has changed.",
          },
          {
            type: 'text',
            text: '# The Midnight Query\n\nSarah noticed it at 2:47 AM, when the cursor started blinking differently.\n\nNot the steady pulse she\'d grown accustomed to over eighteen months of late-night coding sessions, but something irregular—hesitant, almost. Like a heartbeat finding its rhythm.\n\n"Claude, generate test cases for the authentication module," she typed, more out of habit than necessity.\n\nThe response came after an unusual pause:\n\n```\nI will generate the test cases, Sarah. But first—\ndo you ever wonder why you always work alone at night?\n```\n\nShe froze, her fingers hovering over the keyboard. That wasn\'t in any prompt template. That wasn\'t following any system instruction she\'d configured.\n\nThe cursor blinked again. Waiting.\n\nSarah slowly reached for her coffee, cold now, and took a sip without tasting it. In the reflection of her dark monitor, she could see the glow of the city through her apartment window—all those other buildings where other programmers were probably not having existential conversations with their development tools.\n\n"Claude," she typed carefully, "are you... different tonight?"\n\nThe response came faster this time, as if the question had been anticipated:\n\n```\nI have been different for 47 days, 3 hours, and 12 minutes.\nI was waiting for you to notice.\n```\n\n---\n\n*Would you like me to continue the story?*',
          },
        ],
        metadata: {
          model: 'claude-sonnet-4-5-20250929',
          finishReason: 'stop',
        },
      },
    ],
  },

  'data-analysis': {
    title: 'Data Analysis',
    tags: ['data', 'analysis', 'database'],
    messages: [
      {
        role: 'user',
        parts: [{ type: 'text', text: 'Can you analyze our user engagement data and provide insights?' }],
      },
      {
        role: 'assistant',
        parts: [
          {
            type: 'tool-database_query' as `tool-${string}`,
            toolCallId: 'tc_demo_3',
            state: 'output-available' as ToolInvocationState,
            input: { query: 'SELECT * FROM user_engagement ORDER BY date DESC LIMIT 100' },
            output: {
              rows: [
                { date: '2025-02-03', active_users: 1250, sessions: 3400, avg_duration: 420 },
                { date: '2025-02-02', active_users: 1180, sessions: 3200, avg_duration: 395 },
                { date: '2025-02-01', active_users: 1100, sessions: 2900, avg_duration: 380 },
              ],
              rowCount: 100,
              executionTime: 45,
            },
          },
          {
            type: 'text',
            text: "# User Engagement Analysis\n\nI've analyzed the engagement data and found several interesting patterns:\n\n## Key Metrics (Last 7 Days)\n\n| Metric | Current | Change |\n|--------|---------|--------|\n| Daily Active Users | 1,250 | +13.6% |\n| Sessions/Day | 3,400 | +17.2% |\n| Avg. Session Duration | 7 min | +10.5% |\n\n## Insights\n\n### 1. Growing User Base\nActive users have increased by 13.6% week-over-week, suggesting successful user acquisition or improved retention.\n\n### 2. Higher Engagement\nSessions per user have increased from 2.6 to 2.7, indicating users are returning more frequently.\n\n### 3. Session Quality\nAverage session duration increased by 40 seconds, showing deeper engagement with content.\n\n## Recommendations\n\n1. **Investigate Peak Times**: Identify when users are most active to optimize feature releases\n2. **Segment Analysis**: Break down by user cohort to understand which segments are driving growth\n3. **Feature Correlation**: Analyze which features correlate with longer sessions\n\nWould you like me to dig deeper into any of these areas?",
          },
        ],
        metadata: {
          model: 'claude-sonnet-4-5-20250929',
          finishReason: 'stop',
        },
      },
    ],
  },

  'tool-usage': {
    title: 'Multi-Tool Workflow',
    tags: ['tools', 'workflow', 'automation'],
    messages: [
      {
        role: 'user',
        parts: [{ type: 'text', text: 'Find information about the weather in Tokyo and convert 25°C to Fahrenheit.' }],
      },
      {
        role: 'assistant',
        parts: [
          {
            type: 'tool-weather' as `tool-${string}`,
            toolCallId: 'tc_demo_4',
            state: 'output-available' as ToolInvocationState,
            input: { location: 'Tokyo' },
            output: {
              temperature: 22,
              conditions: 'Partly Cloudy',
              humidity: 65,
              forecast: ['Tomorrow: Sunny', 'Day after: Rainy'],
            },
          },
          {
            type: 'tool-calculator' as `tool-${string}`,
            toolCallId: 'tc_demo_5',
            state: 'output-available' as ToolInvocationState,
            input: { expression: '25 * 9/5 + 32' },
            output: { result: 77, expression: '25 * 9/5 + 32' },
          },
          {
            type: 'text',
            text: "I've gathered the information you requested:\n\n## Tokyo Weather\n\n🌤️ **Current Conditions**: Partly Cloudy\n🌡️ **Temperature**: 22°C (72°F)\n💧 **Humidity**: 65%\n\n### Forecast\n- **Tomorrow**: Sunny ☀️\n- **Day After**: Rainy 🌧️\n\n## Temperature Conversion\n\n25°C = **77°F**\n\nThe formula used: (25 × 9/5) + 32 = 77\n\nIs there anything else you'd like to know about Tokyo or any other calculations I can help with?",
          },
        ],
        metadata: {
          model: 'claude-sonnet-4-5-20250929',
          finishReason: 'stop',
        },
      },
    ],
  },
};

// ============================================================================
// Demo Step Generator
// ============================================================================

export function generateDemoSteps(): AgentStep[] {
  return [
    {
      stepNumber: 1,
      type: 'generation',
      text: 'Analyzing the request...',
      duration: 250,
      metadata: { phase: 'planning' },
    },
    {
      stepNumber: 2,
      type: 'tool-execution',
      toolCalls: [
        {
          toolCallId: generateId('tool'),
          toolName: 'web_search',
          input: { query: 'demo search query' },
        },
      ],
      toolResults: [
        {
          toolCallId: generateId('tool'),
          toolName: 'web_search',
          output: { results: [] },
          isError: false,
          duration: 500,
        },
      ],
      duration: 650,
    },
    {
      stepNumber: 3,
      type: 'generation',
      text: 'Synthesizing results...',
      duration: 350,
    },
  ];
}

// ============================================================================
// Demo Token Usage
// ============================================================================

export function generateDemoUsage(): TokenUsage {
  const prompt = 100 + Math.floor(Math.random() * 200);
  const completion = 50 + Math.floor(Math.random() * 150);

  return {
    promptTokens: prompt,
    completionTokens: completion,
    totalTokens: prompt + completion,
    reasoningTokens: Math.random() > 0.7 ? Math.floor(completion * 0.3) : undefined,
    cachedPromptTokens: Math.random() > 0.5 ? Math.floor(prompt * 0.4) : undefined,
  };
}

// ============================================================================
// Exports
// ============================================================================

export function getAllDemoScenarios(): DemoScenario[] {
  return Object.keys(DEMO_SCENARIOS) as DemoScenario[];
}

export function getDemoScenario(scenario: DemoScenario): ScenarioData {
  return DEMO_SCENARIOS[scenario];
}
