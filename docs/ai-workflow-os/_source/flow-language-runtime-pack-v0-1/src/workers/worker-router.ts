import type { TaskDefinition } from "../types.js";
import type { RuntimeContext } from "../runtime/dispatcher.js";

export interface WorkerCandidate {
  id: string;
  type: string;
  capabilities: string[];
  quality_score: number;
  failure_rate: number;
  avg_cost_credits: number;
  avg_latency_ms: number;
}

const DEFAULT_WORKERS: WorkerCandidate[] = [
  { id: "researcher", type: "ai", capabilities: ["research", "summarize", "cite_sources"], quality_score: 0.8, failure_rate: 0.05, avg_cost_credits: 4, avg_latency_ms: 8000 },
  { id: "writer", type: "ai", capabilities: ["write_content", "brand_voice"], quality_score: 0.85, failure_rate: 0.04, avg_cost_credits: 5, avg_latency_ms: 9000 },
  { id: "writer_fast", type: "ai", capabilities: ["write_content"], quality_score: 0.65, failure_rate: 0.08, avg_cost_credits: 1, avg_latency_ms: 2500 },
  { id: "image_worker", type: "image", capabilities: ["image_prompt", "image_generation"], quality_score: 0.8, failure_rate: 0.08, avg_cost_credits: 8, avg_latency_ms: 12000 },
  { id: "code_worker", type: "code", capabilities: ["write_python", "write_typescript", "debug_script"], quality_score: 0.82, failure_rate: 0.08, avg_cost_credits: 7, avg_latency_ms: 10000 },
  { id: "verifier", type: "verifier", capabilities: ["schema_check", "policy_check", "content_check"], quality_score: 0.75, failure_rate: 0.03, avg_cost_credits: 1, avg_latency_ms: 2000 },
];

export async function selectWorker(task: TaskDefinition, ctx: RuntimeContext): Promise<WorkerCandidate> {
  if (task.worker) {
    const direct = DEFAULT_WORKERS.find((w) => w.id === task.worker);
    if (direct) return direct;
  }

  const policy = task.worker_policy;
  if (!policy) return DEFAULT_WORKERS[0];

  const candidates = DEFAULT_WORKERS.filter((worker) => {
    const required = policy.require ?? [];
    return required.every((cap) => worker.capabilities.includes(cap));
  });

  if (candidates.length === 0) {
    const fallback = policy.fallback && DEFAULT_WORKERS.find((w) => w.id === policy.fallback);
    if (fallback) return fallback;
    throw new Error(`No worker matches policy for task ${task.id}`);
  }

  return candidates
    .map((w) => ({ worker: w, score: scoreWorker(w, policy.optimize_for ?? "balanced", policy.max_credits) }))
    .sort((a, b) => b.score - a.score)[0].worker;
}

function scoreWorker(worker: WorkerCandidate, optimizeFor: string, maxCredits?: number): number {
  if (maxCredits && worker.avg_cost_credits > maxCredits) return -Infinity;

  const reliability = 1 - worker.failure_rate;
  const costFit = 1 / Math.max(1, worker.avg_cost_credits);
  const latencyFit = 1 / Math.max(1, worker.avg_latency_ms / 1000);

  const weights = {
    cost: { quality: 0.15, reliability: 0.2, cost: 0.55, latency: 0.1 },
    quality: { quality: 0.55, reliability: 0.2, cost: 0.1, latency: 0.15 },
    speed: { quality: 0.2, reliability: 0.2, cost: 0.1, latency: 0.5 },
    reliability: { quality: 0.25, reliability: 0.55, cost: 0.1, latency: 0.1 },
    balanced: { quality: 0.35, reliability: 0.25, cost: 0.2, latency: 0.2 },
  }[optimizeFor] ?? { quality: 0.35, reliability: 0.25, cost: 0.2, latency: 0.2 };

  return worker.quality_score * weights.quality
    + reliability * weights.reliability
    + costFit * weights.cost
    + latencyFit * weights.latency;
}
