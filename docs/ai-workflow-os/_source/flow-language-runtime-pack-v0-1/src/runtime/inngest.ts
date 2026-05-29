import { Inngest } from "inngest";
import { executeTask } from "./dispatcher.js";
import type { CompiledFlow, TaskDefinition } from "../types.js";

export const inngest = new Inngest({ id: "kuest-flow-runtime" });

// These DB helpers are intentionally placeholders for app integration.
async function loadRun(runId: string): Promise<any> { return { id: runId }; }
async function loadCompiledFlow(workflowVersionId: string): Promise<CompiledFlow> {
  throw new Error("Implement loadCompiledFlow from Postgres workflow_versions.compiled_json");
}
async function markRunComplete(runId: string): Promise<void> {}
async function createRunFromTrigger(data: any): Promise<any> { return { id: data.runId ?? crypto.randomUUID(), ...data }; }

export const runWorkflow = inngest.createFunction(
  {
    id: "workflow-run",
    concurrency: [
      { limit: 5, key: "event.data.orgId" },
      { limit: 1, key: "event.data.workflowId" }
    ],
  },
  { event: "workflow/run.requested" },
  async ({ event, step }) => {
    const run = await step.run("load-or-create-run", async () => createRunFromTrigger(event.data));
    const flow = await step.run("load-compiled-flow", async () => loadCompiledFlow(event.data.workflowVersionId));

    const job = flow.jobs[event.data.jobId];
    if (!job) throw new Error(`Job not found: ${event.data.jobId}`);

    for (const task of job.tasks as TaskDefinition[]) {
      await step.run(`task:${task.id}`, async () => {
        return executeTask(task, {
          orgId: event.data.orgId,
          workflowId: event.data.workflowId,
          workflowVersionId: event.data.workflowVersionId,
          runId: run.id,
          jobId: event.data.jobId,
          step,
          artifacts: {},
          eventPayload: event.data.eventPayload,
        });
      });
    }

    await step.run("mark-complete", () => markRunComplete(run.id));

    if (job.emit) {
      const events = Array.isArray(job.emit) ? job.emit : [job.emit];
      await step.sendEvent(
        "emit-job-events",
        events.map((name) => ({
          name,
          data: {
            orgId: event.data.orgId,
            workflowId: event.data.workflowId,
            runId: run.id,
            jobId: event.data.jobId,
          },
        }))
      );
    }
  }
);

export const schedulerTick = inngest.createFunction(
  { id: "workflow-scheduler-tick" },
  { cron: "*/1 * * * *" },
  async ({ step }) => {
    const due = await step.run("claim-due-triggers", async () => {
      // SELECT ... FOR UPDATE SKIP LOCKED
      return [] as Array<any>;
    });

    if (due.length === 0) return { scheduled: 0 };

    await step.sendEvent(
      "emit-workflow-runs",
      due.map((trigger) => ({
        name: "workflow/run.requested",
        data: {
          orgId: trigger.orgId,
          workflowId: trigger.workflowId,
          workflowVersionId: trigger.workflowVersionId,
          jobId: trigger.jobId,
          triggerId: trigger.id,
          scheduledFor: trigger.nextRunAt,
        },
      }))
    );

    await step.run("advance-triggers", async () => {
      // update next_run_at
    });

    return { scheduled: due.length };
  }
);
