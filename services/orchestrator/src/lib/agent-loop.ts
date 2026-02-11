import { buildSystemPrompt } from './prompt-builder.js';
import { compactHistory, type CompactMessage } from './context-compactor.js';
import { getBaseTools } from './tool-registry.js';

export interface AgentLoopInput {
  messages: CompactMessage[];
  skills: string[];
  relatedKnowledge: string[];
  maxSteps?: number;
}

export interface AgentLoopEvent {
  type: string;
  timestamp: string;
  [key: string]: unknown;
}

export async function runAgentLoop(input: AgentLoopInput) {
  const { kept, compactedHistory } = compactHistory(input.messages);
  const prompt = buildSystemPrompt({
    skills: input.skills,
    relatedKnowledge: input.relatedKnowledge,
  });
  const timestamp = new Date().toISOString();

  const lastUserMessage = [...kept].reverse().find((m) => m.role === 'user')?.content ?? '';
  const assistantText = `Processed request: ${lastUserMessage}`.trim();

  const events: AgentLoopEvent[] = [
    { type: 'start', timestamp, sessionId: 'runtime', messageId: `msg_${Date.now()}` },
    { type: 'text-start', timestamp },
    { type: 'text-delta', timestamp, delta: assistantText },
    { type: 'text-end', timestamp },
    { type: 'finish', timestamp, finishReason: 'stop' },
  ];

  return {
    ok: true,
    systemPrompt: prompt,
    compactedHistory,
    events,
    assistantMessage: assistantText,
    availableTools: getBaseTools().map((t) => t.name),
    stepsBudget: input.maxSteps ?? 12,
    messageCount: kept.length,
  };
}
