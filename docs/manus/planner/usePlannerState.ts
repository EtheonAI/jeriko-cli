
import { useMemo } from 'react';
import { type Message } from 'ai';

export interface PlanStep {
  status: 'done' | 'doing' | 'todo';
  title: string;
}

export function usePlannerState(messages: Message[]) {
  return useMemo(() => {
    let plan: PlanStep[] = [];
    let currentStep = 0;
    let totalSteps = 0;
    let latestToolThumbnail: string | null = null;

    // Find the latest plan update from the agent
    const planMessage = [...messages].reverse().find(
      (m) => m.role === 'assistant' && m.ui && (m.ui as any).props?.plan
    );

    if (planMessage) {
      const planData = (planMessage.ui as any).props.plan;
      if (Array.isArray(planData)) {
        plan = planData;
        totalSteps = plan.length;
        const doingIndex = plan.findIndex(p => p.status === 'doing');
        const firstTodoIndex = plan.findIndex(p => p.status === 'todo');
        const lastDoneIndex = plan.map(p => p.status).lastIndexOf('done');

        if (doingIndex !== -1) {
          currentStep = doingIndex + 1;
        } else if (firstTodoIndex !== -1) {
          currentStep = firstTodoIndex;
        } else {
          currentStep = totalSteps; // All done
        }
      }
    }

    // Find the latest tool usage for the thumbnail
    const toolMessage = [...messages].reverse().find(
      (m) => m.role === 'tool' && m.content
    );

    if (toolMessage) {
      try {
        const toolData = JSON.parse(toolMessage.content);
        // This is a simplification. In a real scenario, you'd have a mapping
        // from tool name to a thumbnail or a way to get a screenshot URL.
        if (toolData.tool === 'browser') {
            latestToolThumbnail = 'https://img.icons8.com/ios-filled/50/ffffff/safari.png';
        } else if (toolData.tool === 'terminal') {
            latestToolThumbnail = 'https://img.icons8.com/ios-filled/50/ffffff/terminal.png';
        } else if (toolData.tool === 'code_editor') {
            latestToolThumbnail = 'https://img.icons8.com/ios-filled/50/ffffff/source-code.png';
        }
      } catch (e) {
        // Ignore parsing errors
      }
    }

    return { plan, currentStep, totalSteps, latestToolThumbnail };
  }, [messages]);
}
