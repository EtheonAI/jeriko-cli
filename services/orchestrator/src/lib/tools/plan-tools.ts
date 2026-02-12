/**
 * Plan/show_plan tool + schedule + analytics
 */

import { tool } from 'ai';
import { z } from 'zod';
import type { ToolContext } from './types.js';

const stepSchema = z.object({
  id: z.string().describe('Unique step identifier'),
  title: z.string().describe('Short description of the step'),
  status: z
    .enum(['pending', 'in_progress', 'completed', 'failed'])
    .default('pending')
    .describe('Step status'),
});

export function createShowPlanTool(ctx: ToolContext) {
  return tool({
    description: `Create or update the execution plan displayed to the user.

You MUST call this at the start of any multi-step task to show the user what you're about to do.
Call it again as you progress to update step statuses.

Rules:
- Max 10 steps per plan
- Keep step titles concise (under 60 chars)
- Update status as you complete each step
- For simple Q&A (no tools needed), do NOT create a plan`,
    inputSchema: z.object({
      steps: z.array(stepSchema).min(1).max(10).describe('Plan steps'),
    }),
    execute: async (params) => {
      // Broadcast plan to frontend via WebSocket
      await ctx.ws.emit(ctx.sessionId, {
        type: 'plan.update',
        steps: params.steps,
        timestamp: Date.now(),
      });

      return {
        status: 'success' as const,
        plan: params.steps,
      };
    },
  });
}

export function createScheduleTaskTool(ctx: ToolContext) {
  return tool({
    description: `Schedule a task to run at a later time or on a recurring basis.

Use this when the user asks to:
- Set a reminder
- Schedule a recurring check or report
- Run something at a specific time

The task will be executed by the Inngest task service.`,
    inputSchema: z.object({
      name: z.string().describe('Human-readable task name'),
      description: z.string().describe('What the task should do when triggered'),
      schedule: z
        .string()
        .describe('Cron expression (e.g. "0 9 * * 1" for Mon 9am) or ISO datetime for one-shot'),
      recurring: z.boolean().optional().default(false).describe('Whether to repeat on schedule'),
    }),
    execute: async (params) => {
      const TASK_SERVICE_URL = process.env.TASK_SERVICE_URL || 'http://localhost:4002';

      try {
        const resp = await fetch(`${TASK_SERVICE_URL}/api/tasks`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': ctx.userId,
          },
          body: JSON.stringify({
            name: params.name,
            description: params.description,
            schedule: params.schedule,
            recurring: params.recurring,
            sessionId: ctx.sessionId,
          }),
          signal: AbortSignal.timeout(10000),
        });

        if (!resp.ok) {
          throw new Error(`Task service error: ${resp.status}`);
        }

        const data = (await resp.json()) as { id?: string };
        return {
          status: 'success' as const,
          taskId: data.id,
          message: `Task "${params.name}" scheduled successfully`,
        };
      } catch (error) {
        return {
          status: 'error' as const,
          error: error instanceof Error ? error.message : 'Failed to schedule task',
        };
      }
    },
  });
}

export function createTrackAnalyticsTool(ctx: ToolContext) {
  return tool({
    description: `Track an analytics event for observability and usage metrics.

Use this to record significant events during task execution:
- Task completion milestones
- Tool usage patterns
- Error occurrences
- User interaction points`,
    inputSchema: z.object({
      event: z.string().describe('Event name (e.g. "task_completed", "deployment_created")'),
      properties: z.record(z.string(), z.unknown()).optional().describe('Event properties/metadata'),
    }),
    execute: async (params) => {
      // Emit analytics event via WebSocket
      await ctx.ws.emit(ctx.sessionId, {
        type: 'analytics.event',
        event: params.event,
        properties: {
          ...params.properties,
          sessionId: ctx.sessionId,
          userId: ctx.userId,
          timestamp: Date.now(),
        },
      });

      return { status: 'success' as const, tracked: true };
    },
  });
}

export function createPlanTools(ctx: ToolContext) {
  return {
    show_plan: createShowPlanTool(ctx),
    schedule_task: createScheduleTaskTool(ctx),
    track_analytics: createTrackAnalyticsTool(ctx),
  } as const;
}
