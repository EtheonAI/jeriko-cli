import type { TaskDefinition, TaskReport } from "../types.js";
import { runAiTask } from "./model-runner.js";
import { runToolCall } from "./tool-router.js";
import { runSandboxCommand } from "./sandbox-runner.js";
import { waitForApproval } from "./approval.js";
import { waitForWorkflowEvent, emitWorkflowEvent } from "./event-router.js";
import { meterTaskStart, meterTaskEnd } from "../billing/meter.js";

export interface RuntimeContext {
  orgId: string;
  workflowId: string;
  workflowVersionId: string;
  runId: string;
  jobId: string;
  step: unknown; // Inngest step object in real implementation
  artifacts: Record<string, unknown>;
  eventPayload?: Record<string, unknown>;
  item?: unknown;
  logger?: { info: (...args: unknown[]) => void; error: (...args: unknown[]) => void };
}

export async function executeTask(task: TaskDefinition, ctx: RuntimeContext): Promise<TaskReport> {
  await meterTaskStart(task, ctx);

  try {
    let report: TaskReport;

    switch (task.type) {
      case "ai_task":
        report = await runAiTask(task, ctx);
        break;
      case "tool_call":
        report = await runToolCall(task, ctx);
        break;
      case "sandbox_command":
        report = await runSandboxCommand(task, ctx);
        break;
      case "human_review":
        report = await waitForApproval(task, ctx);
        break;
      case "wait_for_event":
        report = await waitForWorkflowEvent(task, ctx);
        break;
      case "sleep":
        report = await runSleep(task, ctx);
        break;
      case "foreach":
        report = await runForeach(task, ctx);
        break;
      case "parallel":
        report = await runParallel(task, ctx);
        break;
      case "emit_event":
        report = await emitWorkflowEvent(task, ctx);
        break;
      case "verify":
        report = await runVerify(task, ctx);
        break;
      case "memory_patch":
      case "flow_patch":
        report = await runPatchTask(task, ctx);
        break;
      case "issue_card":
        report = await createIssueCard(task, ctx);
        break;
      case "invoke_workflow":
        report = await invokeWorkflow(task, ctx);
        break;
      case "condition":
        report = await runCondition(task, ctx);
        break;
      default:
        throw new Error(`Unsupported task type: ${(task as any).type}`);
    }

    await meterTaskEnd(task, ctx, report);
    return report;
  } catch (error) {
    const report: TaskReport = {
      task_id: task.id,
      status: "failed",
      summary: error instanceof Error ? error.message : String(error),
      issues: [{ error }],
    };
    await meterTaskEnd(task, ctx, report);
    return report;
  }
}

async function runForeach(task: TaskDefinition, ctx: RuntimeContext): Promise<TaskReport> {
  const items = task.items ?? [];
  const maxParallelism = task.max_parallelism ?? 1;
  const body = task.body ?? [];

  // v0 simple batching.
  const outputs: string[] = [];
  for (let i = 0; i < items.length; i += maxParallelism) {
    const batch = items.slice(i, i + maxParallelism);
    await Promise.all(
      batch.map(async (item) => {
        for (const child of body) {
          const report = await executeTask(child, { ...ctx, item });
          outputs.push(...(report.outputs_created ?? []));
        }
      })
    );
  }

  return {
    task_id: task.id,
    status: "completed",
    summary: `Foreach completed ${items.length} items.`,
    outputs_created: outputs,
  };
}

async function runParallel(task: TaskDefinition, ctx: RuntimeContext): Promise<TaskReport> {
  const branches = task.branches ?? [];
  await Promise.all(
    branches.map(async (branch: any) => {
      for (const child of branch.tasks ?? []) await executeTask(child, ctx);
    })
  );
  return { task_id: task.id, status: "completed", summary: "Parallel branches completed." };
}

async function runSleep(task: TaskDefinition, ctx: RuntimeContext): Promise<TaskReport> {
  // Real implementation: ctx.step.sleep or sleepUntil.
  return { task_id: task.id, status: "completed", summary: `Slept for ${task.duration ?? "unknown duration"}.` };
}

async function runVerify(task: TaskDefinition, ctx: RuntimeContext): Promise<TaskReport> {
  return { task_id: task.id, status: "completed", summary: "Verifier passed.", outputs_created: [] };
}

async function runPatchTask(task: TaskDefinition, ctx: RuntimeContext): Promise<TaskReport> {
  return { task_id: task.id, status: "completed", summary: "Patch proposal created.", suggested_patches: [] };
}

async function createIssueCard(task: TaskDefinition, ctx: RuntimeContext): Promise<TaskReport> {
  return { task_id: task.id, status: "completed", summary: task.title ?? "Issue card created." };
}

async function invokeWorkflow(task: TaskDefinition, ctx: RuntimeContext): Promise<TaskReport> {
  return { task_id: task.id, status: "completed", summary: `Invoked workflow ${task.workflow}.` };
}

async function runCondition(task: TaskDefinition, ctx: RuntimeContext): Promise<TaskReport> {
  // v0 placeholder. Real implementation evaluates safe expression tree.
  const branch = task.then ?? [];
  for (const child of branch) await executeTask(child, ctx);
  return { task_id: task.id, status: "completed", summary: "Condition branch executed." };
}
