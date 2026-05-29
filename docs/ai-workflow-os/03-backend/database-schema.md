# Database Schema Blueprint — Postgres + Drizzle

## Principles

- Use relational tables for ownership, workflows, runs, approvals, artifacts, and billing.
- Store `compiled_ast`, compiled plans, and `.flow`-derived structured data as `jsonb`.
- Store artifact file contents in object storage; store metadata in Postgres.
- Append-only execution events power timeline, audit, pulse, and debugging.
- Every table with org-owned data has `org_id`.
- Every critical row has `created_at` and `updated_at`.

## Core tables

### users

- id uuid pk
- email text unique
- name text
- image text nullable
- default_org_id uuid nullable
- preferences jsonb
- created_at timestamptz
- updated_at timestamptz

### organizations

- id uuid pk
- name text
- slug text unique
- owner_user_id uuid fk users.id
- plan text
- created_at timestamptz
- updated_at timestamptz

### memberships

- id uuid pk
- org_id uuid fk organizations.id
- user_id uuid fk users.id
- role text check owner/admin/member/viewer
- status text check active/invited/removed
- created_at timestamptz
- unique(org_id, user_id)

### projects

- id uuid pk
- org_id uuid fk organizations.id
- name text
- description text
- status text
- created_at timestamptz
- updated_at timestamptz

### workflows

- id uuid pk
- org_id uuid fk organizations.id
- project_id uuid nullable fk projects.id
- name text
- description text
- status text check draft/active/paused/archived
- latest_version_id uuid nullable
- trigger_summary jsonb
- health_status text
- created_by uuid fk users.id
- created_at timestamptz
- updated_at timestamptz

### workflow_versions

- id uuid pk
- workflow_id uuid fk workflows.id
- org_id uuid fk organizations.id
- version_number int
- flow_source text
- compiled_ast jsonb
- schema_version text
- files_manifest jsonb
- hash text
- status text check draft/validated/active/archived
- created_by uuid fk users.id
- created_at timestamptz
- unique(workflow_id, version_number)

### workflow_triggers

- id uuid pk
- org_id uuid fk organizations.id
- workflow_id uuid fk workflows.id
- workflow_version_id uuid fk workflow_versions.id
- job_id text
- trigger_type text check manual/schedule/app_event/workflow_event/webhook
- event_type text nullable
- match_rules jsonb nullable
- cron_expr text nullable
- timezone text nullable
- next_run_at timestamptz nullable
- last_run_at timestamptz nullable
- status text check active/paused/disabled/errored
- min_interval_seconds int nullable
- jitter_seconds int nullable
- max_runs_per_day int nullable
- concurrency_key text nullable
- misfire_policy text check skip/run_once/catch_up_limited/ask_user
- dedupe_key text nullable
- created_at timestamptz
- updated_at timestamptz

### workflow_files

- id uuid pk
- org_id uuid
- workflow_id uuid
- workflow_version_id uuid
- file_type text check rules/memory/permissions/tools/verifiers/budget/script/artifact_manifest
- path text
- content_text text nullable
- storage_url text nullable
- content_hash text
- metadata jsonb
- created_at timestamptz
- updated_at timestamptz

### workflow_runs

- id uuid pk
- org_id uuid
- workflow_id uuid
- workflow_version_id uuid
- project_id uuid nullable
- trigger_type text
- trigger_payload jsonb
- status text check queued/running/waiting_approval/succeeded/failed/cancelled
- current_step_id text nullable
- state jsonb
- estimated_credits numeric
- actual_credits numeric
- started_at timestamptz
- completed_at timestamptz nullable
- created_at timestamptz

### run_steps

- id uuid pk
- org_id uuid
- run_id uuid fk workflow_runs.id
- workflow_step_id text
- step_type text
- status text
- attempt int
- input_refs jsonb
- output_refs jsonb
- error jsonb nullable
- cost jsonb
- started_at timestamptz
- completed_at timestamptz nullable

### task_reports

- id uuid pk
- org_id uuid
- workflow_id uuid
- run_id uuid fk workflow_runs.id
- run_step_id uuid nullable fk run_steps.id
- workflow_step_id text
- worker_id text nullable
- status text
- summary text
- inputs_used jsonb
- outputs_created jsonb
- emitted_events jsonb
- tools_used jsonb
- model_used text nullable
- token_usage jsonb nullable
- cost jsonb nullable
- confidence numeric nullable
- issues jsonb nullable
- suggested_patches jsonb nullable
- created_at timestamptz

### workflow_events

- id uuid pk
- org_id uuid
- workflow_id uuid
- run_id uuid nullable
- step_id uuid nullable
- event_type text
- title text
- message text
- payload jsonb
- ecp jsonb nullable
- correlation_id text nullable
- causation_id text nullable
- severity text check info/warning/error
- created_at timestamptz

### run_reflections

- id uuid pk
- org_id uuid
- workflow_id uuid
- workflow_version_id uuid
- run_id uuid fk workflow_runs.id
- status text
- summary text
- packet jsonb
- patch_opportunities jsonb
- main_ai_invoked boolean default false
- created_at timestamptz

### approvals

- id uuid pk
- org_id uuid
- workflow_id uuid
- run_id uuid
- step_id uuid nullable
- action_type text
- proposed_payload jsonb
- evidence_refs jsonb
- status text check pending/approved/rejected/edited/expired
- requested_by_system boolean
- reviewer_user_id uuid nullable
- decision_payload jsonb nullable
- created_at timestamptz
- decided_at timestamptz nullable

### artifacts

- id uuid pk
- org_id uuid
- workflow_id uuid
- run_id uuid nullable
- step_id uuid nullable
- path text
- artifact_type text
- mime_type text
- storage_url text
- size_bytes bigint
- hash text
- metadata jsonb
- created_at timestamptz

### tool_connections

- id uuid pk
- org_id uuid
- user_id uuid nullable
- provider text
- account_label text
- scopes jsonb
- status text check connected/expired/revoked/error
- encrypted_token_ref text nullable
- provider_metadata jsonb
- created_at timestamptz
- updated_at timestamptz

### tool_calls

- id uuid pk
- org_id uuid
- workflow_id uuid
- run_id uuid
- step_id uuid nullable
- tool_name text
- provider text
- connection_id uuid nullable
- input_hash text
- input_payload jsonb
- output_ref jsonb
- status text
- idempotency_key text nullable
- permission_decision jsonb
- created_at timestamptz
- completed_at timestamptz nullable

### sandbox_sessions

- id uuid pk
- org_id uuid
- workflow_id uuid
- run_id uuid
- step_id uuid nullable
- provider text default 'vercel_sandbox'
- sandbox_id text nullable
- command text
- status text
- duration_ms int
- stdout_ref text nullable
- stderr_ref text nullable
- resource_usage jsonb
- created_at timestamptz
- completed_at timestamptz nullable

### usage_events

- id uuid pk
- org_id uuid
- user_id uuid nullable
- workflow_id uuid nullable
- run_id uuid nullable
- category text check model/tool/sandbox/storage/search/image
- provider text
- units numeric
- unit_type text
- internal_cost_usd numeric
- credits_charged numeric
- metadata jsonb
- created_at timestamptz

### billing_accounts

- id uuid pk
- org_id uuid unique
- plan text
- credit_balance numeric
- stripe_customer_id text nullable
- stripe_subscription_id text nullable
- billing_status text
- period_start timestamptz
- period_end timestamptz
- created_at timestamptz
- updated_at timestamptz

### workflow_templates

- id uuid pk
- category text
- name text
- description text
- default_yaml text
- required_inputs jsonb
- required_connections jsonb
- tags text[]
- status text check draft/published/archived
- created_at timestamptz
- updated_at timestamptz

### memory_patches

- id uuid pk
- org_id uuid
- workflow_id uuid
- run_id uuid nullable
- patch_type text check rules/memory/workflow/verifier/budget
- diff jsonb
- explanation text
- status text check proposed/applied/rejected
- created_at timestamptz
- decided_at timestamptz nullable

## Recommended indexes

- workflows(org_id, status, updated_at desc)
- workflow_versions(workflow_id, version_number desc)
- workflow_triggers(org_id, status, next_run_at)
- workflow_triggers(org_id, workflow_id, trigger_type)
- workflow_triggers(org_id, event_type)
- workflow_runs(org_id, workflow_id, created_at desc)
- workflow_events(org_id, run_id, created_at)
- workflow_events(org_id, event_type, created_at)
- workflow_events(org_id, correlation_id)
- task_reports(org_id, run_id, created_at)
- run_reflections(org_id, workflow_id, created_at desc)
- approvals(org_id, status, created_at desc)
- artifacts(org_id, run_id, created_at)
- tool_connections(org_id, provider, status)
- usage_events(org_id, created_at desc)
- GIN indexes: workflow_versions.compiled_ast, workflow_runs.state, workflow_events.payload, workflow_events.ecp, workflow_triggers.match_rules
