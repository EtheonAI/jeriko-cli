-- Core database schema for .flow runtime v0.1
-- Adapt to Drizzle migrations in implementation.

create table organizations (
  id uuid primary key,
  name text not null,
  slug text unique not null,
  plan text not null default 'free',
  created_at timestamptz not null default now()
);

create table workflows (
  id uuid primary key,
  org_id uuid not null references organizations(id),
  name text not null,
  status text not null default 'draft',
  latest_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table workflow_versions (
  id uuid primary key,
  org_id uuid not null references organizations(id),
  workflow_id uuid not null references workflows(id),
  version_number int not null,
  flow_source text not null,
  compiled_json jsonb not null,
  source_hash text not null,
  schema_version text not null,
  semantic_summary jsonb,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  unique(workflow_id, version_number)
);

create table workflow_files (
  id uuid primary key,
  org_id uuid not null references organizations(id),
  workflow_id uuid not null references workflows(id),
  workflow_version_id uuid references workflow_versions(id),
  path text not null,
  file_type text not null,
  content_text text,
  storage_url text,
  content_hash text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table workflow_triggers (
  id uuid primary key,
  org_id uuid not null references organizations(id),
  workflow_id uuid not null references workflows(id),
  workflow_version_id uuid not null references workflow_versions(id),
  job_id text not null,
  trigger_type text not null,
  event_type text,
  match_rules jsonb,
  cron_expr text,
  timezone text,
  next_run_at timestamptz,
  last_run_at timestamptz,
  status text not null default 'active',
  min_interval_seconds int,
  jitter_seconds int,
  max_runs_per_day int,
  concurrency_key text,
  misfire_policy text,
  dedupe_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table workflow_runs (
  id uuid primary key,
  org_id uuid not null references organizations(id),
  workflow_id uuid not null references workflows(id),
  workflow_version_id uuid not null references workflow_versions(id),
  trigger_id uuid references workflow_triggers(id),
  job_id text not null,
  status text not null,
  scheduled_for timestamptz,
  event_context_id uuid,
  state jsonb,
  credits_estimated numeric,
  credits_used numeric,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table run_tasks (
  id uuid primary key,
  org_id uuid not null references organizations(id),
  run_id uuid not null references workflow_runs(id),
  task_id text not null,
  task_type text not null,
  worker_id text,
  status text not null,
  attempt int not null default 0,
  input_refs jsonb,
  output_refs jsonb,
  cost jsonb,
  error jsonb,
  started_at timestamptz,
  completed_at timestamptz
);

create table workflow_events (
  id uuid primary key,
  org_id uuid not null references organizations(id),
  workflow_id uuid references workflows(id),
  run_id uuid references workflow_runs(id),
  parent_run_id uuid,
  job_id text,
  task_id text,
  event_type text not null,
  source text,
  correlation_id text,
  causation_id text,
  dedupe_key text,
  payload jsonb,
  cost_delta jsonb,
  created_at timestamptz not null default now()
);

create index workflow_events_org_type_created_idx on workflow_events(org_id, event_type, created_at desc);
create unique index workflow_events_dedupe_idx on workflow_events(org_id, dedupe_key) where dedupe_key is not null;

create table task_reports (
  id uuid primary key,
  org_id uuid not null references organizations(id),
  run_id uuid not null references workflow_runs(id),
  task_id text not null,
  worker_id text,
  status text not null,
  summary text not null,
  inputs_used jsonb,
  outputs_created jsonb,
  emitted_events jsonb,
  tools_used jsonb,
  model_used text,
  cost jsonb,
  quality jsonb,
  issues jsonb,
  suggested_patches jsonb,
  created_at timestamptz not null default now()
);

create table issue_cards (
  id uuid primary key,
  org_id uuid not null references organizations(id),
  workflow_id uuid not null references workflows(id),
  run_id uuid references workflow_runs(id),
  task_id text,
  title text not null,
  impact text,
  reason text,
  fallback_used text,
  status text not null default 'open',
  actions jsonb,
  created_at timestamptz not null default now()
);

create table artifacts (
  id uuid primary key,
  org_id uuid not null references organizations(id),
  workflow_id uuid not null references workflows(id),
  run_id uuid references workflow_runs(id),
  task_id text,
  path text not null,
  artifact_type text not null,
  mime_type text,
  storage_url text not null,
  hash text,
  size_bytes bigint,
  metadata jsonb,
  visibility text not null default 'workflow',
  created_at timestamptz not null default now()
);

create table approval_requests (
  id uuid primary key,
  org_id uuid not null references organizations(id),
  workflow_id uuid not null references workflows(id),
  run_id uuid not null references workflow_runs(id),
  task_id text,
  status text not null default 'pending',
  review_refs jsonb,
  proposed_action jsonb,
  decision jsonb,
  reviewer_user_id uuid,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

create table tool_connections (
  id uuid primary key,
  org_id uuid not null references organizations(id),
  provider text not null,
  account_label text,
  scopes jsonb,
  status text not null,
  encrypted_token_ref text,
  provider_metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table tool_calls (
  id uuid primary key,
  org_id uuid not null references organizations(id),
  workflow_id uuid not null references workflows(id),
  run_id uuid references workflow_runs(id),
  task_id text,
  tool_name text not null,
  status text not null,
  idempotency_key text,
  input_hash text,
  input_payload jsonb,
  output_ref jsonb,
  cost jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create unique index tool_calls_idempotency_idx on tool_calls(org_id, idempotency_key) where idempotency_key is not null;

create table sandbox_sessions (
  id uuid primary key,
  org_id uuid not null references organizations(id),
  workflow_id uuid not null references workflows(id),
  run_id uuid references workflow_runs(id),
  task_id text,
  provider text not null default 'vercel_sandbox',
  sandbox_id text,
  command text,
  status text not null,
  stdout_ref text,
  stderr_ref text,
  duration_ms int,
  resource_usage jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table usage_events (
  id uuid primary key,
  org_id uuid not null references organizations(id),
  workflow_id uuid references workflows(id),
  run_id uuid references workflow_runs(id),
  task_id text,
  category text not null,
  provider text,
  units numeric not null,
  credits numeric not null,
  cost_usd numeric,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table credit_ledger (
  id uuid primary key,
  org_id uuid not null references organizations(id),
  delta numeric not null,
  reason text not null,
  usage_event_id uuid references usage_events(id),
  balance_after numeric,
  created_at timestamptz not null default now()
);
