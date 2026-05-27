/**
 * Plan/show_plan tool + schedule + analytics
 */

import { tool } from 'ai';
import { z } from 'zod';
import type { ToolContext } from './types.js';

const stepSchema = z.object({
  id: z.string().describe('Unique step identifier'),
  title: z.string().describe('Short description of the step'),
  description: z.string().optional().describe('Detailed description of what this step does'),
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
    description: `Schedule a task to run at a later time, on a recurring basis, or when an external event triggers it.

Use this when the user asks to:
- Set a reminder
- Schedule a recurring check or report
- Run something at a specific time
- React to an external event (new email, GitHub push, Slack message, etc.)

For event-driven triggers, provide the trigger parameter instead of schedule.
The task will be executed by the Inngest task service.`,
    inputSchema: z.object({
      name: z.string().describe('Human-readable task name'),
      description: z.string().describe('What the task should do when triggered'),
      prompt: z.string().optional().describe('Custom prompt/instructions for the agent when the task runs. If omitted, description is used as the prompt.'),
      schedule: z
        .string()
        .optional()
        .describe('Cron expression (e.g. "0 9 * * 1" for Mon 9am) or ISO datetime for one-shot. Not needed for trigger-only tasks.'),
      recurring: z.boolean().optional().default(false).describe('Whether to repeat on schedule'),
      trigger: z
        .object({
          appName: z.string().describe('App name, e.g. "gmail", "github", "slack"'),
          eventSlug: z.string().describe('Composio trigger slug, e.g. "GMAIL_NEW_GMAIL_MESSAGE"'),
          config: z.record(z.string(), z.unknown()).optional().describe('Trigger-specific configuration'),
        })
        .optional()
        .describe('Event-driven trigger. When provided, the task fires when this external event occurs.'),
      skills: z
        .array(z.string())
        .optional()
        .describe('Skill IDs to activate when the task runs (e.g. ["web-search", "code-interpreter"])'),
    }),
    execute: async (params) => {
      const TASK_SERVICE_URL = process.env.TASK_SERVICE_URL || 'http://localhost:4002';

      const body: Record<string, unknown> = {
        name: params.name,
        description: params.description,
        taskType: 'agent_run',
        payload: {
          prompt: params.prompt ?? params.description,
          sessionId: ctx.sessionId,
          ...(params.skills?.length ? { skillIds: params.skills } : {}),
        },
      };

      if (params.trigger && !params.schedule) {
        // Trigger-only task (no time-based schedule)
        body.scheduleType = 'trigger';
        body.triggerEnabled = true;
        body.triggerAppName = params.trigger.appName;
        body.triggerEventSlug = params.trigger.eventSlug;
        body.triggerConfig = params.trigger.config;
      } else if (params.schedule) {
        // Time-based schedule (with optional trigger)
        const isCron = /^[\d*\/,\-]+(\s+[\d*\/,\-]+){4,5}$/.test(params.schedule.trim());

        if (isCron) {
          body.scheduleType = 'cron';
          body.cronExpression = params.schedule.trim();
        } else if (params.recurring) {
          body.scheduleType = 'recurring';
          body.recurrencePattern = 'daily';
          const date = new Date(params.schedule);
          if (!isNaN(date.getTime())) {
            body.recurrenceTime = `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`;
          }
        } else {
          body.scheduleType = 'once';
          body.scheduledAt = params.schedule;
        }

        // Hybrid: time schedule + trigger
        if (params.trigger) {
          body.triggerEnabled = true;
          body.triggerAppName = params.trigger.appName;
          body.triggerEventSlug = params.trigger.eventSlug;
          body.triggerConfig = params.trigger.config;
        }
      } else {
        return {
          status: 'error' as const,
          error: 'Either schedule or trigger must be provided',
        };
      }

      try {
        const resp = await fetch(`${TASK_SERVICE_URL}/scheduled-tasks`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': ctx.userId,
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(15000),
        });

        if (!resp.ok) {
          const errText = await resp.text().catch(() => 'Unknown error');
          throw new Error(`Task service error: ${resp.status} - ${errText}`);
        }

        const data = (await resp.json()) as { data?: { id?: string } };
        const triggerNote = params.trigger
          ? ` with ${params.trigger.appName} trigger (${params.trigger.eventSlug})`
          : '';
        return {
          status: 'success' as const,
          taskId: data.data?.id,
          message: `Task "${params.name}" scheduled successfully${triggerNote}`,
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
