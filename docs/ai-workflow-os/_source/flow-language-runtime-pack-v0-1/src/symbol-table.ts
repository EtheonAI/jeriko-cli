import type { CompileDiagnostic, FlowDocument, TaskDefinition } from "./types.js";

export interface SymbolTable {
  diagnostics: CompileDiagnostic[];
  jobs: Record<string, { id: string }>;
  tasks: Record<string, TaskDefinition & { jobId: string }>;
  artifacts: Record<string, { producedBy: string }>;
  imports: Record<string, string>;
  tools: Set<string>;
  workers: Set<string>;
  events: Set<string>;
}

export function buildSymbolTable(doc: FlowDocument): SymbolTable {
  const diagnostics: CompileDiagnostic[] = [];
  const table: SymbolTable = {
    diagnostics,
    jobs: {},
    tasks: {},
    artifacts: {},
    imports: doc.imports ?? {},
    tools: new Set(doc.tools ?? []),
    workers: new Set(Object.keys(doc.workers ?? {})),
    events: new Set(),
  };

  for (const [jobId, job] of Object.entries(doc.jobs)) {
    if (table.jobs[jobId]) {
      diagnostics.push({
        code: "DUPLICATE_JOB_ID",
        severity: "error",
        message: `Duplicate job id: ${jobId}`,
        path: `jobs.${jobId}`,
      });
    }
    table.jobs[jobId] = { id: jobId };
    collectTasks(jobId, job.tasks, table, `jobs.${jobId}.tasks`);
  }

  return table;
}

function collectTasks(jobId: string, tasks: TaskDefinition[], table: SymbolTable, path: string) {
  for (const task of tasks) {
    const fqid = `${jobId}.${task.id}`;
    if (table.tasks[fqid]) {
      table.diagnostics.push({
        code: "DUPLICATE_TASK_ID",
        severity: "error",
        message: `Duplicate task id in job ${jobId}: ${task.id}`,
        path,
      });
    }

    table.tasks[fqid] = { ...task, jobId };

    const outputs = task.output ?? [];
    for (const out of outputs) {
      if (out.startsWith("artifacts/")) {
        if (table.artifacts[out]) {
          table.diagnostics.push({
            code: "DUPLICATE_ARTIFACT_PRODUCER",
            severity: "error",
            message: `Artifact ${out} has more than one producer.`,
            path: `${path}.${task.id}.output`,
          });
        }
        table.artifacts[out] = { producedBy: fqid };
      }
    }

    const emits = Array.isArray(task.emit) ? task.emit : task.emit ? [task.emit] : [];
    for (const e of emits) table.events.add(e);

    if (task.type === "foreach" && Array.isArray(task.body)) {
      collectTasks(jobId, task.body, table, `${path}.${task.id}.body`);
    }
    if (task.type === "condition") {
      if (Array.isArray(task.then)) collectTasks(jobId, task.then, table, `${path}.${task.id}.then`);
      if (Array.isArray(task.else)) collectTasks(jobId, task.else, table, `${path}.${task.id}.else`);
    }
    if (task.type === "parallel" && Array.isArray(task.branches)) {
      for (const branch of task.branches as Array<{ id: string; tasks: TaskDefinition[] }>) {
        collectTasks(jobId, branch.tasks ?? [], table, `${path}.${task.id}.branches.${branch.id}`);
      }
    }
  }
}
