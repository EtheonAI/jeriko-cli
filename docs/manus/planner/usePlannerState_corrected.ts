
import { useMemo } from 'react';
import { type Message } from 'ai';

// Define your Plan and Todo types based on your tool's Zod schema
export interface PlanTodo {
  id: string;
  label: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  toolsUsed?: { toolCallId: string; toolName: string }[];
}

export interface Plan {
  title: string;
  todos: PlanTodo[];
}

export function usePlannerState(messages: Message[]) {
  return useMemo(() => {
    let latestPlan: Plan | null = null;
    const allToolCalls: any[] = [];

    // Iterate through all messages and their parts to find the latest plan and all tool calls
    for (const message of messages) {
      if (message.role !== 'assistant') continue;

      for (const part of message.parts) {
        // Check for the 'showPlan' tool output and save the latest one
        if (part.type === 'tool-showPlan' && part.state === 'output-available') {
          latestPlan = part.output as Plan;
        }
        
        // Collect all other tool calls
        if (part.type.startsWith('tool-') && part.type !== 'tool-showPlan') {
          allToolCalls.push(part);
        }
      }
    }

    if (!latestPlan) {
      return { plan: null, toolsByStep: {} };
    }

    // Link tool calls to their respective plan steps.
    // This assumes the agent includes a `planStepId` in the tool's input or output.
    const toolsByStep: Record<string, any[]> = {};

    for (const toolCall of allToolCalls) {
      // Attempt to find a planStepId in the tool's input or output.
      const stepId = toolCall.input?.planStepId || (typeof toolCall.output === 'object' && toolCall.output?.planStepId);
      
      if (stepId) {
        if (!toolsByStep[stepId]) {
          toolsByStep[stepId] = [];
        }
        toolsByStep[stepId].push(toolCall);
      }
    }

    return { plan: latestPlan, toolsByStep };

  }, [messages]);
}
