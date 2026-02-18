CREATE TABLE "api_keys" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"key" text NOT NULL,
	"key_prefix" text NOT NULL,
	"name" text DEFAULT 'Default' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"expires_at" timestamp,
	"last_used_at" timestamp,
	"total_requests" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "api_keys_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "trigger_events" (
	"id" text PRIMARY KEY NOT NULL,
	"scheduled_task_id" text NOT NULL,
	"composio_trigger_id" text NOT NULL,
	"event_slug" text NOT NULL,
	"external_event_id" text,
	"payload" jsonb,
	"processed" boolean DEFAULT false NOT NULL,
	"processed_at" timestamp,
	"execution_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage_ledger" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"event_type" text NOT NULL,
	"session_id" text,
	"step_id" text,
	"tool_name" text,
	"credits_charged" integer DEFAULT 0 NOT NULL,
	"input_tokens" integer,
	"output_tokens" integer,
	"model" text,
	"balance_before" integer,
	"balance_after" integer,
	"metadata" jsonb,
	"recorded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_sessions" ADD COLUMN "active_stream_id" text;--> statement-breakpoint
ALTER TABLE "credit_balances" ADD COLUMN "daily_credits" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "credit_balances" ADD COLUMN "daily_credits_used" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "credit_balances" ADD COLUMN "daily_refresh_amount" integer DEFAULT 300 NOT NULL;--> statement-breakpoint
ALTER TABLE "credit_balances" ADD COLUMN "last_daily_refresh_at" timestamp;--> statement-breakpoint
ALTER TABLE "credit_balances" ADD COLUMN "starter_credits" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "credit_balances" ADD COLUMN "starter_credits_used" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "credit_balances" ADD COLUMN "purchased_credits_used" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "file_versions" ADD COLUMN "checksum" text;--> statement-breakpoint
ALTER TABLE "file_versions" ADD COLUMN "checksum_algorithm" text DEFAULT 'sha256';--> statement-breakpoint
ALTER TABLE "files" ADD COLUMN "checksum" text;--> statement-breakpoint
ALTER TABLE "files" ADD COLUMN "checksum_algorithm" text DEFAULT 'sha256';--> statement-breakpoint
ALTER TABLE "scheduled_tasks" ADD COLUMN "trigger_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "scheduled_tasks" ADD COLUMN "trigger_app_name" text;--> statement-breakpoint
ALTER TABLE "scheduled_tasks" ADD COLUMN "trigger_event_slug" text;--> statement-breakpoint
ALTER TABLE "scheduled_tasks" ADD COLUMN "trigger_config" jsonb;--> statement-breakpoint
ALTER TABLE "scheduled_tasks" ADD COLUMN "composio_trigger_id" text;--> statement-breakpoint
ALTER TABLE "scheduled_tasks" ADD COLUMN "last_trigger_at" timestamp;--> statement-breakpoint
ALTER TABLE "scheduled_tasks" ADD COLUMN "last_trigger_event_id" text;--> statement-breakpoint
ALTER TABLE "scheduled_tasks" ADD COLUMN "session_id" text;--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD COLUMN "starter_credits" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD COLUMN "daily_refresh_credits" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD COLUMN "max_concurrent_sessions" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD COLUMN "max_parallel_subtasks" integer DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD COLUMN "max_scheduled_tasks" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD COLUMN "max_steps_per_session" integer DEFAULT 25 NOT NULL;--> statement-breakpoint
ALTER TABLE "trigger_events" ADD CONSTRAINT "trigger_events_scheduled_task_id_scheduled_tasks_id_fk" FOREIGN KEY ("scheduled_task_id") REFERENCES "public"."scheduled_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_ledger" ADD CONSTRAINT "usage_ledger_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sandboxes" ADD CONSTRAINT "sandboxes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sandboxes" ADD CONSTRAINT "sandboxes_agent_session_id_agent_sessions_id_fk" FOREIGN KEY ("agent_session_id") REFERENCES "public"."agent_sessions"("id") ON DELETE set null ON UPDATE no action;