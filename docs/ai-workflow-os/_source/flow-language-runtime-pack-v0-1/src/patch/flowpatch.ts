import type { FlowDocument } from "../types.js";

export type FlowPatch =
  | { type: "add_task"; job_id: string; task: unknown }
  | { type: "update_task"; job_id: string; task_id: string; changes: Record<string, unknown> }
  | { type: "remove_task"; job_id: string; task_id: string }
  | { type: "update_trigger"; trigger_id: string; changes: Record<string, unknown> }
  | { type: "update_permission"; changes: Record<string, unknown> }
  | { type: "update_import"; key: string; path: string }
  | { type: "update_budget"; changes: Record<string, unknown> }
  | { type: "update_worker_policy"; job_id: string; task_id: string; worker_policy: Record<string, unknown> }
  | { type: "update_reflection_rules"; changes: Record<string, unknown> };

export function applyFlowPatch(flow: FlowDocument, patch: FlowPatch): FlowDocument {
  const clone = structuredClone(flow);

  switch (patch.type) {
    case "update_task": {
      const job = clone.jobs[patch.job_id];
      if (!job) throw new Error(`Job not found: ${patch.job_id}`);
      const task = job.tasks.find((t) => t.id === patch.task_id);
      if (!task) throw new Error(`Task not found: ${patch.task_id}`);
      Object.assign(task, patch.changes);
      return clone;
    }
    case "add_task": {
      const job = clone.jobs[patch.job_id];
      if (!job) throw new Error(`Job not found: ${patch.job_id}`);
      job.tasks.push(patch.task as any);
      return clone;
    }
    case "remove_task": {
      const job = clone.jobs[patch.job_id];
      if (!job) throw new Error(`Job not found: ${patch.job_id}`);
      job.tasks = job.tasks.filter((t) => t.id !== patch.task_id);
      return clone;
    }
    case "update_import": {
      clone.imports = clone.imports ?? {};
      clone.imports[patch.key] = patch.path;
      return clone;
    }
    case "update_budget": {
      clone.budgets = { ...(clone.budgets ?? {}), ...patch.changes };
      return clone;
    }
    case "update_reflection_rules": {
      clone.reflection = { ...(clone.reflection ?? {}), ...patch.changes };
      return clone;
    }
    default:
      throw new Error(`Patch type not implemented: ${(patch as any).type}`);
  }
}
