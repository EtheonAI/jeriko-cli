export type FlowMode = "draft_only" | "supervised" | "auto" | "live_orchestration";

export type TaskType =
  | "ai_task"
  | "tool_call"
  | "sandbox_command"
  | "human_review"
  | "wait_for_event"
  | "sleep"
  | "foreach"
  | "parallel"
  | "condition"
  | "verify"
  | "emit_event"
  | "invoke_workflow"
  | "memory_patch"
  | "flow_patch"
  | "issue_card";

export type FailurePolicy =
  | "stop"
  | "retry"
  | "retry_then_stop"
  | "retry_then_ask"
  | "continue_degraded"
  | "use_cached"
  | "fallback"
  | "create_issue_card"
  | "regenerate_once_then_ask"
  | "ask_user"
  | "skip_optional";

export type WorkerType =
  | "ai"
  | "image"
  | "voice"
  | "code"
  | "tool"
  | "sandbox"
  | "verifier"
  | "analytics"
  | "memory"
  | "router"
  | "system";

export interface FlowDocument {
  flow: "0.1";
  name: string;
  goal: string;
  mode?: FlowMode;
  imports?: Record<string, string>;
  files?: Record<string, string>;
  permissions?: PermissionPolicy;
  tools?: string[];
  workers?: Record<string, WorkerDefinition>;
  budgets?: BudgetPolicy;
  triggers?: TriggerDefinition[];
  jobs: Record<string, JobDefinition>;
  reflection?: ReflectionPolicy;
  notifications?: Record<string, unknown>;
  exports?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface PermissionPolicy {
  auto?: string[];
  ask?: string[];
  block?: string[];
}

export interface WorkerDefinition {
  type: WorkerType;
  capabilities?: string[];
  model_policy?: string;
  allowed_tools?: string[];
  max_concurrency?: number;
}

export interface BudgetPolicy {
  max_credits_per_run?: number;
  max_credits_per_day?: number;
  max_runtime_minutes?: number;
  max_tool_calls?: number;
  max_ai_tasks?: number;
  max_sandbox_seconds?: number;
  max_events_per_minute?: number;
  on_exceed?: "pause_and_ask" | "stop_run" | "continue_degraded" | "notify_only";
  [key: string]: unknown;
}

export interface TriggerDefinition {
  id: string;
  type: "manual" | "schedule" | "app_event" | "workflow_event" | "webhook" | "approval_event";
  cron?: string;
  timezone?: string;
  jitter?: string;
  misfire?: "skip" | "run_once" | "catch_up_limited" | "ask_user";
  event?: string;
  match?: Record<string, unknown>;
}

export interface JobDefinition {
  trigger?: string | TriggerDefinition;
  budget?: Record<string, unknown>;
  concurrency?: Record<string, unknown>;
  tasks: TaskDefinition[];
  emit?: string | string[];
}

export interface TaskDefinition {
  id: string;
  type: TaskType;
  purpose?: string;
  worker?: string;
  worker_policy?: WorkerPolicy;
  uses?: string | string[];
  run?: string;
  input?: string[];
  output?: string[];
  after?: string[] | { required?: string[]; optional?: string[] };
  required?: boolean;
  requires_approval?: boolean;
  if_fail?: FailurePolicy;
  failure?: Record<string, unknown>;
  timeout?: string;
  retries?: number | Record<string, unknown>;
  emit?: string | string[];
  notify?: NotifyPolicy;
  verify?: string[];
  budget?: Record<string, unknown>;

  // foreach/parallel/condition/wait specifics
  items?: unknown[];
  as?: string;
  max_parallelism?: number;
  max_items?: number;
  body?: TaskDefinition[];
  branches?: Array<{ id: string; tasks: TaskDefinition[] }>;
  if?: string;
  then?: TaskDefinition[];
  else?: TaskDefinition[];
  event?: string;
  match?: Record<string, unknown>;
  duration?: string;
  workflow?: string;
  review?: string[];
  target?: string;
  title?: string;
  message?: string;

  [key: string]: unknown;
}

export interface WorkerPolicy {
  require?: string[];
  choose_from?: string[];
  optimize_for?: "cost" | "quality" | "speed" | "reliability" | "balanced";
  max_credits?: number;
  fallback?: string;
}

export interface NotifyPolicy {
  ui?: boolean;
  tasks?: string[];
  workflows?: string[];
  main_ai?: boolean | { when?: string[] };
}

export interface ReflectionPolicy {
  mode?: "off" | "on_triggers" | "always";
  send_to_main_ai?: {
    when?: string[];
    include?: string[];
    exclude?: string[];
  };
}

export interface CompileDiagnostic {
  code: string;
  severity: "error" | "warning" | "info";
  message: string;
  path?: string;
  suggested_fix?: string;
}

export interface CompiledFlow {
  source_hash: string;
  flow: "0.1";
  name: string;
  goal: string;
  mode: FlowMode;
  jobs: Record<string, CompiledJob>;
  triggers: CompiledTrigger[];
  permissions: PermissionPolicy;
  workers: Record<string, WorkerDefinition>;
  tools: string[];
  budgets: BudgetPolicy;
  semantic_summary: Record<string, unknown>;
}

export interface CompiledJob {
  id: string;
  trigger?: string | TriggerDefinition;
  tasks: TaskDefinition[];
  emit?: string | string[];
}

export interface CompiledTrigger extends TriggerDefinition {
  workflow_name: string;
  job_id: string;
}

export interface EventContextPacket {
  id: string;
  type: string;
  schema_version: "0.1";
  org_id: string;
  workflow_id: string;
  workflow_version_id?: string;
  run_id: string;
  job_id?: string;
  task_id?: string;
  worker_id?: string;
  source: {
    kind: "app" | "workflow" | "subagent" | "system" | "user";
    provider?: string;
    name?: string;
  };
  correlation_id?: string;
  causation_id?: string;
  created_at?: string;
  summary: string;
  payload?: Record<string, unknown>;
  artifacts?: Array<Record<string, unknown>>;
  quality?: Record<string, unknown>;
  routing?: Record<string, unknown>;
  cost?: Record<string, unknown>;
  security?: Record<string, unknown>;
}

export interface TaskReport {
  task_id: string;
  worker_id?: string;
  status: "queued" | "running" | "completed" | "failed" | "skipped" | "degraded" | "waiting";
  summary: string;
  inputs_used?: string[];
  outputs_created?: string[];
  emitted_events?: string[];
  tools_used?: string[];
  model_used?: string;
  cost?: Record<string, unknown>;
  quality?: Record<string, unknown>;
  issues?: Array<Record<string, unknown>>;
  suggested_patches?: Array<Record<string, unknown>>;
}
