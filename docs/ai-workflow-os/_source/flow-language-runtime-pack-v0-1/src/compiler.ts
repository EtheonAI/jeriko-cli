import crypto from "node:crypto";
import type { CompiledFlow, CompileDiagnostic, FlowDocument, TriggerDefinition } from "./types.js";
import { validateFlowShape } from "./schema-validator.js";
import { buildSymbolTable } from "./symbol-table.js";
import { runSemanticValidation } from "./semantic-validator.js";

export interface CompileResult {
  ok: boolean;
  compiled?: CompiledFlow;
  diagnostics: CompileDiagnostic[];
}

export function compileFlow(document: FlowDocument, source: string): CompileResult {
  const diagnostics: CompileDiagnostic[] = [];

  diagnostics.push(...validateFlowShape(document));

  const symbolTable = buildSymbolTable(document);
  diagnostics.push(...symbolTable.diagnostics);

  diagnostics.push(...runSemanticValidation(document, symbolTable));

  const hasErrors = diagnostics.some((d) => d.severity === "error");
  if (hasErrors) return { ok: false, diagnostics };

  const triggers = extractTriggers(document);

  const compiled: CompiledFlow = {
    source_hash: sha256(source),
    flow: document.flow,
    name: document.name,
    goal: document.goal,
    mode: document.mode ?? "supervised",
    jobs: Object.fromEntries(
      Object.entries(document.jobs).map(([id, job]) => [
        id,
        {
          id,
          trigger: job.trigger,
          tasks: job.tasks,
          emit: job.emit,
        },
      ])
    ),
    triggers,
    permissions: document.permissions ?? { auto: [], ask: [], block: [] },
    workers: document.workers ?? {},
    tools: document.tools ?? [],
    budgets: document.budgets ?? {},
    semantic_summary: {
      symbols: {
        jobs: Object.keys(symbolTable.jobs),
        tasks: Object.keys(symbolTable.tasks),
        artifacts: Object.keys(symbolTable.artifacts),
        events: Array.from(symbolTable.events),
      },
    },
  };

  return { ok: true, compiled, diagnostics };
}

function extractTriggers(document: FlowDocument): TriggerDefinition[] {
  const workflowLevel = document.triggers ?? [];
  const triggerById = new Map(workflowLevel.map((t) => [t.id, t]));

  const compiled: TriggerDefinition[] = [];

  for (const [jobId, job] of Object.entries(document.jobs)) {
    if (!job.trigger) continue;

    if (typeof job.trigger === "string") {
      const found = triggerById.get(job.trigger);
      if (found) compiled.push({ ...found });
      continue;
    }

    compiled.push({
      ...job.trigger,
      id: job.trigger.id ?? `${jobId}_trigger`,
    });
  }

  return compiled;
}

function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}
