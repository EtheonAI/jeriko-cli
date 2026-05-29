import type { TaskDefinition, TaskReport } from "../types.js";
import type { RuntimeContext } from "../runtime/dispatcher.js";

export interface UsageEvent {
  orgId: string;
  workflowId: string;
  runId: string;
  taskId?: string;
  category: "workflow_run" | "ai_task" | "tool_call" | "sandbox" | "image" | "voice" | "event" | "reflection";
  units: number;
  credits: number;
  provider?: string;
  metadata?: Record<string, unknown>;
}

export async function meterRunStart(ctx: RuntimeContext): Promise<void> {
  await recordUsage({
    orgId: ctx.orgId,
    workflowId: ctx.workflowId,
    runId: ctx.runId,
    category: "workflow_run",
    units: 1,
    credits: 1,
  });
}

export async function meterTaskStart(task: TaskDefinition, ctx: RuntimeContext): Promise<void> {
  // Optional pre-reserve credits.
}

export async function meterTaskEnd(task: TaskDefinition, ctx: RuntimeContext, report: TaskReport): Promise<void> {
  const category = categoryForTask(task);
  const credits = Number((report.cost as any)?.credits ?? defaultCreditsForTask(task));
  await recordUsage({
    orgId: ctx.orgId,
    workflowId: ctx.workflowId,
    runId: ctx.runId,
    taskId: task.id,
    category,
    units: 1,
    credits,
    metadata: { status: report.status },
  });
}

function categoryForTask(task: TaskDefinition): UsageEvent["category"] {
  if (task.type === "ai_task") return "ai_task";
  if (task.type === "tool_call") return "tool_call";
  if (task.type === "sandbox_command") return "sandbox";
  if (task.type === "memory_patch" || task.type === "flow_patch") return "reflection";
  return "event";
}

function defaultCreditsForTask(task: TaskDefinition): number {
  switch (task.type) {
    case "ai_task": return 2;
    case "tool_call": return 0.25;
    case "sandbox_command": return 1;
    case "memory_patch":
    case "flow_patch": return 2;
    default: return 0.05;
  }
}

async function recordUsage(event: UsageEvent): Promise<void> {
  // Real implementation inserts into usage_events and updates credit ledger atomically.
}
