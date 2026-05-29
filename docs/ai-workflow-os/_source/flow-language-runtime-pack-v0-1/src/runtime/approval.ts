import type { TaskDefinition, TaskReport } from "../types.js";
import type { RuntimeContext } from "./dispatcher.js";

export async function waitForApproval(task: TaskDefinition, ctx: RuntimeContext): Promise<TaskReport> {
  // Real implementation:
  // 1. Create approval_request row.
  // 2. Emit approval.requested ECP.
  // 3. step.waitForSignal or waitForEvent.
  // 4. Continue on approval, branch on rejection.
  return {
    task_id: task.id,
    status: "waiting",
    summary: "Approval requested.",
    outputs_created: [],
  };
}
