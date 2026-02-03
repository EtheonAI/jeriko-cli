/**
 * @repo/ai - Orchestration Module
 *
 * High-level orchestration utilities for multi-agent workflows,
 * DAG execution, task planning, and parallel processing.
 */

// ============================================================================
// DAG Executor
// ============================================================================

export {
  DAGExecutor,
  ExecutionGraphBuilder,
  createDAGExecutor,
  createExecutionGraph,
  type ExecutionNode,
  type ExecutionStatus,
  type NodeResult,
  type ExecutionGraph,
  type ExecutionProgress,
  type DAGExecutorConfig,
} from './dag-executor';

// ============================================================================
// Task Planner
// ============================================================================

export {
  TaskPlanner,
  createTaskPlanner,
  quickPlan,
  type TaskPlan,
  type PlannedTask,
  type PlannerContext,
  type TaskPlannerConfig,
} from './task-planner';

// ============================================================================
// Parallel Runner
// ============================================================================

export {
  ParallelRunner,
  createParallelRunner,
  runParallel,
  mapParallel,
  type ParallelTask,
  type ParallelResult,
  type BatchResult,
  type RunnerProgress,
  type ParallelRunnerConfig,
} from './parallel-runner';

// ============================================================================
// Orchestration Utilities
// ============================================================================

/**
 * Create a simple DAG from a list of tasks with linear dependencies
 */
export function createLinearWorkflow(
  tasks: Array<{ id: string; task: string }>,
): import('./dag-executor').ExecutionGraph {
  const builder = new (require('./dag-executor').ExecutionGraphBuilder)();

  tasks.forEach((task, index) => {
    builder.addNode(task.id, task.task, {
      dependencies: index > 0 ? [tasks[index - 1].id] : [],
    });
  });

  return builder.build();
}

/**
 * Create a fan-out/fan-in workflow pattern
 */
export function createFanOutFanInWorkflow(
  initialTask: { id: string; task: string },
  parallelTasks: Array<{ id: string; task: string }>,
  finalTask: { id: string; task: string },
): import('./dag-executor').ExecutionGraph {
  const builder = new (require('./dag-executor').ExecutionGraphBuilder)();

  // Initial task
  builder.addNode(initialTask.id, initialTask.task, { dependencies: [] });

  // Parallel tasks depend on initial
  for (const task of parallelTasks) {
    builder.addNode(task.id, task.task, { dependencies: [initialTask.id] });
  }

  // Final task depends on all parallel tasks
  builder.addNode(finalTask.id, finalTask.task, {
    dependencies: parallelTasks.map((t) => t.id),
  });

  return builder.build();
}

/**
 * Create a pipeline workflow with stages
 */
export function createPipelineWorkflow(
  stages: Array<{
    name: string;
    tasks: Array<{ id: string; task: string }>;
  }>,
): import('./dag-executor').ExecutionGraph {
  const builder = new (require('./dag-executor').ExecutionGraphBuilder)();
  let previousStageTasks: string[] = [];

  for (const stage of stages) {
    const currentStageTasks: string[] = [];

    for (const task of stage.tasks) {
      builder.addNode(task.id, task.task, {
        dependencies: previousStageTasks,
      });
      currentStageTasks.push(task.id);
    }

    previousStageTasks = currentStageTasks;
  }

  return builder.build();
}
