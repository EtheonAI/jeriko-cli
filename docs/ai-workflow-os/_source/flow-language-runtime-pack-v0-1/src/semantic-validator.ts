import type { CompileDiagnostic, FlowDocument, TaskDefinition } from "./types.js";
import type { SymbolTable } from "./symbol-table.js";

const DEFAULT_BLOCKED = new Set([
  "delete_data",
  "transfer_money",
  "expose_secrets",
  "change_security_settings",
  "bypass_captcha",
]);

const EXTERNAL_ACTION_HINTS = [
  "send",
  "publish",
  "post",
  "update",
  "submit",
  "create_charge",
  "refund",
];

export function runSemanticValidation(doc: FlowDocument, symbols: SymbolTable): CompileDiagnostic[] {
  const diagnostics: CompileDiagnostic[] = [];

  for (const [jobId, job] of Object.entries(doc.jobs)) {
    const seen = new Set<string>();
    for (const task of job.tasks) {
      validateTask(doc, symbols, jobId, task, diagnostics, seen);
      seen.add(task.id);
    }
  }

  return diagnostics;
}

function validateTask(
  doc: FlowDocument,
  symbols: SymbolTable,
  jobId: string,
  task: TaskDefinition,
  diagnostics: CompileDiagnostic[],
  previousTasks: Set<string>
) {
  const path = `jobs.${jobId}.tasks.${task.id}`;

  // Tool existence.
  const usedTools = normalizeTools(task.uses);
  for (const tool of usedTools) {
    if (!symbols.tools.has(tool)) {
      diagnostics.push({
        code: "UNKNOWN_TOOL",
        severity: "error",
        message: `Task ${task.id} uses tool ${tool}, but it is not listed in top-level tools.`,
        path: `${path}.uses`,
        suggested_fix: `Add ${tool} to top-level tools or change the task tool.`,
      });
    }

    if (looksExternal(tool) && task.requires_approval !== true) {
      diagnostics.push({
        code: "EXTERNAL_ACTION_REQUIRES_APPROVAL",
        severity: "error",
        message: `Task ${task.id} uses likely external action ${tool} but does not require approval.`,
        path,
        suggested_fix: "Add requires_approval: true.",
      });
    }
  }

  // Worker existence.
  if (task.worker && !symbols.workers.has(task.worker)) {
    diagnostics.push({
      code: "UNKNOWN_WORKER",
      severity: "error",
      message: `Task ${task.id} references unknown worker ${task.worker}.`,
      path: `${path}.worker`,
    });
  }

  // Artifact dataflow.
  for (const input of task.input ?? []) {
    if (input.startsWith("artifacts/") && !symbols.artifacts[input] && !input.includes("*")) {
      diagnostics.push({
        code: "MISSING_ARTIFACT_PRODUCER",
        severity: "error",
        message: `Task ${task.id} reads ${input}, but no task produces it.`,
        path: `${path}.input`,
      });
    }
  }

  // Dependencies.
  const deps = dependencyIds(task.after);
  for (const dep of deps) {
    if (!previousTasks.has(dep)) {
      // v0 only allows previous task deps in same job unless fully-qualified.
      if (!dep.includes(".")) {
        diagnostics.push({
          code: "DEPENDENCY_NOT_PREVIOUS",
          severity: "warning",
          message: `Task ${task.id} depends on ${dep}, which has not appeared earlier in the same job.`,
          path: `${path}.after`,
        });
      }
    }
  }

  // Foreach bounds.
  if (task.type === "foreach") {
    if (!Array.isArray(task.items)) {
      diagnostics.push({
        code: "FOREACH_ITEMS_REQUIRED",
        severity: "error",
        message: `Foreach task ${task.id} must declare bounded items.`,
        path,
      });
    }
    if (!task.max_parallelism) {
      diagnostics.push({
        code: "FOREACH_MAX_PARALLELISM_REQUIRED",
        severity: "error",
        message: `Foreach task ${task.id} must declare max_parallelism.`,
        path,
      });
    }
    if (Array.isArray(task.items) && task.max_items && task.items.length > task.max_items) {
      diagnostics.push({
        code: "FOREACH_MAX_ITEMS_EXCEEDED",
        severity: "error",
        message: `Foreach task ${task.id} has ${task.items.length} items but max_items is ${task.max_items}.`,
        path,
      });
    }
  }

  // Sandbox checks.
  if (task.type === "sandbox_command") {
    if (!task.run) {
      diagnostics.push({ code: "SANDBOX_RUN_REQUIRED", severity: "error", message: "sandbox_command requires run.", path });
    }
    if (task.run && !task.run.includes("scripts/")) {
      diagnostics.push({
        code: "SANDBOX_SCRIPT_OUTSIDE_SCRIPTS",
        severity: "warning",
        message: "sandbox_command should run scripts under scripts/.",
        path: `${path}.run`,
      });
    }
    if (!task.output || task.output.length === 0) {
      diagnostics.push({
        code: "SANDBOX_OUTPUT_REQUIRED",
        severity: "warning",
        message: "sandbox_command should declare outputs.",
        path,
      });
    }
  }

  // Recursively validate nested tasks.
  if (Array.isArray(task.body)) {
    const nestedPrev = new Set<string>();
    for (const nested of task.body) {
      validateTask(doc, symbols, jobId, nested, diagnostics, nestedPrev);
      nestedPrev.add(nested.id);
    }
  }
}

function normalizeTools(uses: string | string[] | undefined): string[] {
  if (!uses) return [];
  return Array.isArray(uses) ? uses : [uses];
}

function dependencyIds(after: TaskDefinition["after"]): string[] {
  if (!after) return [];
  if (Array.isArray(after)) return after;
  return [...(after.required ?? []), ...(after.optional ?? [])];
}

function looksExternal(tool: string): boolean {
  return EXTERNAL_ACTION_HINTS.some((hint) => tool.toLowerCase().includes(hint));
}
