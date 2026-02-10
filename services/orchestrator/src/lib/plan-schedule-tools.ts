interface PlanStep {
  id: string;
  description: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  dependencies?: string[];
}

interface Plan {
  id: string;
  task: string;
  steps: PlanStep[];
  createdAt: string;
  updatedAt: string;
}

interface ScheduledTask {
  id: string;
  task: string;
  scheduledTime: string;
  status: "scheduled" | "running" | "completed" | "failed";
  createdAt: string;
}

export class PlanScheduleTools {
  private plans: Map<string, Plan> = new Map();
  private scheduledTasks: Map<string, ScheduledTask> = new Map();

  createPlan(task: string, steps: string[]): Plan {
    const plan: Plan = {
      id: crypto.randomUUID(),
      task,
      steps: steps.map((desc, index) => ({
        id: `step-${index + 1}`,
        description: desc,
        status: "pending",
      })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.plans.set(plan.id, plan);
    return plan;
  }

  getPlan(id: string): Plan | undefined {
    return this.plans.get(id);
  }

  getAllPlans(): Plan[] {
    return Array.from(this.plans.values());
  }

  updatePlanStep(planId: string, stepId: string, status: PlanStep["status"]): boolean {
    const plan = this.plans.get(planId);
    if (!plan) return false;

    const step = plan.steps.find((s) => s.id === stepId);
    if (!step) return false;

    step.status = status;
    plan.updatedAt = new Date().toISOString();
    return true;
  }

  scheduleTask(task: string, scheduledTime: string): ScheduledTask {
    const scheduled: ScheduledTask = {
      id: crypto.randomUUID(),
      task,
      scheduledTime,
      status: "scheduled",
      createdAt: new Date().toISOString(),
    };

    this.scheduledTasks.set(scheduled.id, scheduled);
    return scheduled;
  }

  getScheduledTask(id: string): ScheduledTask | undefined {
    return this.scheduledTasks.get(id);
  }

  getAllScheduledTasks(): ScheduledTask[] {
    return Array.from(this.scheduledTasks.values());
  }

  updateTaskStatus(taskId: string, status: ScheduledTask["status"]): boolean {
    const task = this.scheduledTasks.get(taskId);
    if (!task) return false;

    task.status = status;
    return true;
  }

  getReadyTasks(): ScheduledTask[] {
    const now = new Date();
    return this.getAllScheduledTasks().filter(
      (task) => task.status === "scheduled" && new Date(task.scheduledTime) <= now
    );
  }

  clear(): void {
    this.plans.clear();
    this.scheduledTasks.clear();
  }
}
