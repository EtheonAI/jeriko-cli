/**
 * @repo/ai - Demo Module
 *
 * Testing and demo utilities for the AI system.
 * Includes mock agents, tools, and data generators.
 */

// ============================================================================
// Mock Agent
// ============================================================================

export {
  MockAgent,
  createMockAgent,
  createDemoAgent,
  type MockResponse,
  type MockAgentConfig,
} from './mock-agent';

// ============================================================================
// Mock Tools
// ============================================================================

export {
  mockWebSearchTool,
  mockCodeAnalysisTool,
  mockFileReadTool,
  mockDatabaseQueryTool,
  mockApiCallTool,
  mockImageGenerationTool,
  mockCalculatorTool,
  mockWeatherTool,
  MOCK_TOOLS,
  getMockTools,
  getMockTool,
} from './mock-tools';

// ============================================================================
// Demo Data
// ============================================================================

export {
  generateDemoConversation,
  generateDemoSteps,
  generateDemoUsage,
  getAllDemoScenarios,
  getDemoScenario,
  type DemoConversation,
  type DemoScenario,
} from './demo-data';

// ============================================================================
// Quick Start Functions
// ============================================================================

import { createDemoAgent } from './mock-agent';
import { getMockTools } from './mock-tools';
import { generateDemoConversation, type DemoScenario } from './demo-data';

/**
 * Create a complete demo setup with agent, tools, and sample conversation
 */
export function createDemoSetup(scenario: DemoScenario = 'general') {
  const agent = createDemoAgent();
  const tools = getMockTools();
  const conversation = generateDemoConversation(scenario);

  return {
    agent,
    tools,
    conversation,
    async testGenerate(input: string) {
      return agent.generate({
        messages: [
          {
            id: 'demo_msg',
            role: 'user',
            parts: [{ type: 'text', text: input }],
            createdAt: new Date(),
          },
        ],
      });
    },
    async testStream(input: string, onChunk?: (chunk: unknown) => void) {
      return agent.stream({
        messages: [
          {
            id: 'demo_msg',
            role: 'user',
            parts: [{ type: 'text', text: input }],
            createdAt: new Date(),
          },
        ],
        onChunk,
      });
    },
  };
}

/**
 * Run a quick demo test
 */
export async function runDemoTest() {
  const demo = createDemoSetup();

  console.log('=== AI Demo Test ===\n');
  console.log('Conversation:', demo.conversation.title);
  console.log('Messages:', demo.conversation.messages.length);
  console.log('\nTesting generate...\n');

  const result = await demo.testGenerate('Hello, can you help me with a demo?');

  console.log('Response:', result.message.parts.find((p) => p.type === 'text'));
  console.log('Duration:', result.duration, 'ms');
  console.log('Usage:', result.usage);
  console.log('\n=== Demo Complete ===');

  return result;
}
