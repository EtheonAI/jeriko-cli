import type { EventContextPacket, TaskDefinition, TaskReport } from "../types.js";
import type { RuntimeContext } from "./dispatcher.js";

export async function ingestEvent(packet: EventContextPacket): Promise<void> {
  // Real implementation:
  // - validate schema
  // - dedupe by id/correlation/source id
  // - store workflow_events
  // - match workflow_triggers
  // - send workflow/run.requested
  // - wake Inngest waits
  // - dispatch notifications
}

export async function waitForWorkflowEvent(task: TaskDefinition, ctx: RuntimeContext): Promise<TaskReport> {
  // Real implementation: ctx.step.waitForEvent with matching rules.
  return {
    task_id: task.id,
    status: "waiting",
    summary: `Waiting for event ${task.event}`,
  };
}

export async function emitWorkflowEvent(task: TaskDefinition, ctx: RuntimeContext): Promise<TaskReport> {
  const eventType = Array.isArray(task.emit) ? task.emit[0] : task.emit ?? task.event;
  if (!eventType) throw new Error(`emit_event task ${task.id} missing event/emit`);

  const packet: EventContextPacket = {
    id: crypto.randomUUID(),
    type: eventType,
    schema_version: "0.1",
    org_id: ctx.orgId,
    workflow_id: ctx.workflowId,
    workflow_version_id: ctx.workflowVersionId,
    run_id: ctx.runId,
    job_id: ctx.jobId,
    task_id: task.id,
    source: { kind: "workflow", name: ctx.workflowId },
    summary: `Event emitted: ${eventType}`,
    payload: {},
    routing: task.notify ?? {},
  };

  await ingestEvent(packet);

  return {
    task_id: task.id,
    status: "completed",
    summary: `Event emitted: ${eventType}`,
    emitted_events: [eventType],
  };
}
