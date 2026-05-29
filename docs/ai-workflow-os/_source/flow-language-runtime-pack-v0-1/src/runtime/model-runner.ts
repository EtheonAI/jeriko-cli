import type { TaskDefinition, TaskReport } from "../types.js";
import type { RuntimeContext } from "./dispatcher.js";
import { selectWorker } from "../workers/worker-router.js";

export async function runAiTask(task: TaskDefinition, ctx: RuntimeContext): Promise<TaskReport> {
  const worker = await selectWorker(task, ctx);

  // Real implementation:
  // 1. Resolve task input artifacts/imports.
  // 2. Build scoped prompt.
  // 3. Pick model via worker/model_policy.
  // 4. Call Claude/OpenAI/etc.
  // 5. Validate structured output.
  // 6. Save artifacts.
  // 7. Emit EventContextPacket.
  return {
    task_id: task.id,
    worker_id: worker.id,
    status: "completed",
    summary: `AI task ${task.id} completed by ${worker.id}.`,
    inputs_used: task.input ?? [],
    outputs_created: task.output ?? [],
    cost: { credits: 1 },
  };
}
