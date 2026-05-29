import type { TaskDefinition, TaskReport } from "../types.js";
import type { RuntimeContext } from "./dispatcher.js";
import { enforceToolPermission } from "../security/permissions.js";

export async function runToolCall(task: TaskDefinition, ctx: RuntimeContext): Promise<TaskReport> {
  const tool = Array.isArray(task.uses) ? task.uses[0] : task.uses;
  if (!tool) throw new Error(`tool_call task ${task.id} missing uses`);

  await enforceToolPermission(tool, task, ctx);

  // Real implementation:
  // - resolve connection
  // - validate args
  // - check approval
  // - execute via Composio/direct API
  // - save result artifact
  // - emit ECP event
  return {
    task_id: task.id,
    status: "completed",
    summary: `Tool ${tool} executed.`,
    tools_used: [tool],
    outputs_created: task.output ?? [],
    cost: { credits: 0.25 },
  };
}
