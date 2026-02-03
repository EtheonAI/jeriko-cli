/**
 * @repo/ai - Mock Tools
 *
 * Simulated tools for testing and demo purposes.
 * Provides realistic mock tool responses without external API calls.
 */

import { z } from 'zod';
import type { AgentToolDefinition } from '../agents/types';
import { generateId } from '../streaming';

// ============================================================================
// Mock Tool Definitions
// ============================================================================

export const mockWebSearchTool: AgentToolDefinition<
  { query: string; maxResults?: number },
  { results: Array<{ title: string; snippet: string; url: string }> }
> = {
  description: 'Search the web for information. Returns relevant search results.',
  parameters: z.object({
    query: z.string().describe('The search query'),
    maxResults: z.number().optional().default(5).describe('Maximum results to return'),
  }),
  category: 'search',
  icon: 'search',
  async execute(input) {
    // Simulate network delay
    await new Promise((r) => setTimeout(r, 500 + Math.random() * 500));

    // Generate mock results based on query
    const results = generateMockSearchResults(input.query, input.maxResults ?? 5);

    return { results };
  },
};

export const mockCodeAnalysisTool: AgentToolDefinition<
  { code: string; language?: string },
  { issues: string[]; suggestions: string[]; complexity: string; score: number }
> = {
  description: 'Analyze code for issues and improvements.',
  parameters: z.object({
    code: z.string().describe('The code to analyze'),
    language: z.string().optional().describe('Programming language'),
  }),
  category: 'code',
  icon: 'code',
  async execute(input) {
    await new Promise((r) => setTimeout(r, 300 + Math.random() * 400));

    return {
      issues: ['No critical issues detected', 'Consider adding error handling'],
      suggestions: [
        'Add type annotations for better type safety',
        'Consider extracting repeated logic into functions',
        'Add JSDoc comments for documentation',
      ],
      complexity: input.code.length > 500 ? 'high' : input.code.length > 200 ? 'medium' : 'low',
      score: 70 + Math.floor(Math.random() * 25),
    };
  },
};

export const mockFileReadTool: AgentToolDefinition<
  { path: string },
  { content: string; size: number; type: string }
> = {
  description: 'Read file contents from the filesystem.',
  parameters: z.object({
    path: z.string().describe('Path to the file'),
  }),
  category: 'filesystem',
  icon: 'file',
  needsApproval: true,
  async execute(input) {
    await new Promise((r) => setTimeout(r, 100 + Math.random() * 200));

    const mockContent = generateMockFileContent(input.path);

    return {
      content: mockContent,
      size: mockContent.length,
      type: input.path.split('.').pop() ?? 'txt',
    };
  },
};

export const mockDatabaseQueryTool: AgentToolDefinition<
  { query: string; database?: string },
  { rows: Array<Record<string, unknown>>; rowCount: number; executionTime: number }
> = {
  description: 'Execute a database query and return results.',
  parameters: z.object({
    query: z.string().describe('SQL query to execute'),
    database: z.string().optional().describe('Database name'),
  }),
  category: 'database',
  icon: 'database',
  needsApproval: true,
  async execute(input) {
    await new Promise((r) => setTimeout(r, 200 + Math.random() * 300));

    const rows = generateMockDatabaseResults(input.query);

    return {
      rows,
      rowCount: rows.length,
      executionTime: 50 + Math.floor(Math.random() * 150),
    };
  },
};

export const mockApiCallTool: AgentToolDefinition<
  { url: string; method?: string; body?: unknown },
  { status: number; data: unknown; headers: Record<string, string> }
> = {
  description: 'Make an HTTP API request.',
  parameters: z.object({
    url: z.string().describe('API endpoint URL'),
    method: z.enum(['GET', 'POST', 'PUT', 'DELETE']).optional().default('GET'),
    body: z.unknown().optional().describe('Request body for POST/PUT'),
  }),
  category: 'api',
  icon: 'globe',
  async execute(input) {
    await new Promise((r) => setTimeout(r, 300 + Math.random() * 500));

    return {
      status: 200,
      data: {
        message: 'Success',
        timestamp: new Date().toISOString(),
        requestId: generateId('req'),
        result: { items: [{ id: 1, name: 'Demo Item' }] },
      },
      headers: {
        'content-type': 'application/json',
        'x-request-id': generateId('req'),
      },
    };
  },
};

export const mockImageGenerationTool: AgentToolDefinition<
  { prompt: string; size?: string },
  { url: string; revisedPrompt: string }
> = {
  description: 'Generate an image from a text description.',
  parameters: z.object({
    prompt: z.string().describe('Image description'),
    size: z.enum(['256x256', '512x512', '1024x1024']).optional().default('512x512'),
  }),
  category: 'media',
  icon: 'image',
  async execute(input) {
    await new Promise((r) => setTimeout(r, 1000 + Math.random() * 1000));

    return {
      url: `https://placehold.co/${input.size ?? '512x512'}/png?text=${encodeURIComponent(input.prompt.slice(0, 20))}`,
      revisedPrompt: `Enhanced prompt: ${input.prompt}`,
    };
  },
};

export const mockCalculatorTool: AgentToolDefinition<
  { expression: string },
  { result: number; expression: string }
> = {
  description: 'Evaluate a mathematical expression.',
  parameters: z.object({
    expression: z.string().describe('Mathematical expression to evaluate'),
  }),
  category: 'utility',
  icon: 'calculator',
  async execute(input) {
    await new Promise((r) => setTimeout(r, 50));

    // Simple mock calculation
    let result: number;
    try {
      // Only allow safe math operations
      const sanitized = input.expression.replace(/[^0-9+\-*/().%\s]/g, '');
      result = new Function(`return (${sanitized})`)();
    } catch {
      result = NaN;
    }

    return {
      result: isNaN(result) ? 0 : result,
      expression: input.expression,
    };
  },
};

export const mockWeatherTool: AgentToolDefinition<
  { location: string },
  { temperature: number; conditions: string; humidity: number; forecast: string[] }
> = {
  description: 'Get weather information for a location.',
  parameters: z.object({
    location: z.string().describe('City or location name'),
  }),
  category: 'information',
  icon: 'cloud',
  async execute(input) {
    await new Promise((r) => setTimeout(r, 200 + Math.random() * 300));

    const conditions = ['Sunny', 'Partly Cloudy', 'Cloudy', 'Rainy', 'Stormy'];
    const randomCondition = conditions[Math.floor(Math.random() * conditions.length)];

    return {
      temperature: 15 + Math.floor(Math.random() * 20),
      conditions: randomCondition,
      humidity: 40 + Math.floor(Math.random() * 40),
      forecast: [
        `Tomorrow: ${conditions[Math.floor(Math.random() * conditions.length)]}`,
        `Day after: ${conditions[Math.floor(Math.random() * conditions.length)]}`,
      ],
    };
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

function generateMockSearchResults(
  query: string,
  count: number
): Array<{ title: string; snippet: string; url: string }> {
  const results = [];
  const words = query.toLowerCase().split(' ').filter(Boolean);

  for (let i = 0; i < count; i++) {
    results.push({
      title: `${capitalize(words[0] ?? 'Result')} - ${capitalize(words[1] ?? 'Information')} | Source ${i + 1}`,
      snippet: `This is a mock search result for "${query}". It contains relevant information about ${words.join(' and ')}. Click to learn more about this topic.`,
      url: `https://example.com/search/${encodeURIComponent(query)}/${i + 1}`,
    });
  }

  return results;
}

function generateMockFileContent(path: string): string {
  const extension = path.split('.').pop()?.toLowerCase();

  switch (extension) {
    case 'json':
      return JSON.stringify({ demo: true, path, timestamp: new Date().toISOString() }, null, 2);
    case 'ts':
    case 'tsx':
      return `// Mock TypeScript file: ${path}\nexport function example(): string {\n  return 'Hello, World!';\n}\n`;
    case 'js':
    case 'jsx':
      return `// Mock JavaScript file: ${path}\nfunction example() {\n  return 'Hello, World!';\n}\nmodule.exports = { example };\n`;
    case 'css':
      return `.container {\n  display: flex;\n  padding: 1rem;\n}\n`;
    case 'md':
      return `# Demo File\n\nThis is a mock markdown file for path: ${path}\n\n- Item 1\n- Item 2\n`;
    default:
      return `Mock file content for: ${path}\nGenerated at: ${new Date().toISOString()}\n`;
  }
}

function generateMockDatabaseResults(query: string): Array<Record<string, unknown>> {
  const rows = [];
  const count = 3 + Math.floor(Math.random() * 5);

  for (let i = 0; i < count; i++) {
    rows.push({
      id: i + 1,
      name: `Record ${i + 1}`,
      value: Math.floor(Math.random() * 1000),
      created_at: new Date(Date.now() - Math.random() * 86400000 * 30).toISOString(),
      status: ['active', 'pending', 'completed'][Math.floor(Math.random() * 3)],
    });
  }

  return rows;
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ============================================================================
// Tool Registry
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const MOCK_TOOLS: Record<string, AgentToolDefinition<any, any>> = {
  web_search: mockWebSearchTool,
  code_analysis: mockCodeAnalysisTool,
  file_read: mockFileReadTool,
  database_query: mockDatabaseQueryTool,
  api_call: mockApiCallTool,
  image_generation: mockImageGenerationTool,
  calculator: mockCalculatorTool,
  weather: mockWeatherTool,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getMockTools(): Record<string, AgentToolDefinition<any, any>> {
  return { ...MOCK_TOOLS };
}

export function getMockTool(name: string): AgentToolDefinition | undefined {
  return MOCK_TOOLS[name];
}
