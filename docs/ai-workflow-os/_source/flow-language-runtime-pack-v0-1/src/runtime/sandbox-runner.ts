import type { TaskDefinition, TaskReport } from "../types.js";
import type { RuntimeContext } from "./dispatcher.js";

/**
 * Vercel Sandbox runner scaffold.
 *
 * Real implementation:
 * - create sandbox
 * - stage input artifacts and scripts
 * - run static policy scanner
 * - execute command
 * - collect declared outputs
 * - upload artifacts
 * - save stdout/stderr
 * - destroy/snapshot sandbox
 */
export async function runSandboxCommand(task: TaskDefinition, ctx: RuntimeContext): Promise<TaskReport> {
  if (!task.run) throw new Error(`sandbox_command ${task.id} missing run`);

  if (!task.run.includes("scripts/")) {
    throw new Error(`sandbox_command ${task.id} must execute scripts/ path`);
  }

  return {
    task_id: task.id,
    worker_id: "sandbox_runner",
    status: "completed",
    summary: `Sandbox command executed: ${task.run}`,
    inputs_used: task.input ?? [],
    outputs_created: task.output ?? [],
    cost: { sandbox_seconds: 1, credits: 1 },
  };
}
