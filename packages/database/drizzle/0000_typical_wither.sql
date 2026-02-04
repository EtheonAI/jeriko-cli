CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"id_token" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text,
	"status" text DEFAULT 'active',
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"parent_task_id" text,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'pending',
	"priority" integer DEFAULT 0,
	"result" jsonb,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agents" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"type" text NOT NULL,
	"name" text,
	"status" text DEFAULT 'idle',
	"current_task" text,
	"progress" integer DEFAULT 0,
	"metadata" jsonb,
	"last_activity" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"active_organization_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "auth_sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "connector_definitions" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"icon" text,
	"category" text NOT NULL,
	"auth_type" text NOT NULL,
	"oauth_config" jsonb,
	"capabilities" jsonb,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"is_premium" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "connector_definitions_type_unique" UNIQUE("type")
);
--> statement-breakpoint
CREATE TABLE "connector_sync_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_connector_id" text NOT NULL,
	"status" text NOT NULL,
	"items_synced" integer DEFAULT 0,
	"items_failed" integer DEFAULT 0,
	"error_message" text,
	"details" jsonb,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "credit_balances" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text,
	"balance" integer DEFAULT 0 NOT NULL,
	"period_credits" integer DEFAULT 0 NOT NULL,
	"period_credits_used" integer DEFAULT 0 NOT NULL,
	"period_start" timestamp,
	"period_end" timestamp,
	"purchased_credits" integer DEFAULT 0 NOT NULL,
	"auto_topup_enabled" boolean DEFAULT false NOT NULL,
	"auto_topup_threshold" integer,
	"auto_topup_package_id" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "credit_balances_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "credit_packages" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"credits" integer NOT NULL,
	"price" integer NOT NULL,
	"currency" text DEFAULT 'usd' NOT NULL,
	"bonus_credits" integer DEFAULT 0,
	"stripe_price_id" text,
	"stripe_product_id" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_popular" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text,
	"type" text NOT NULL,
	"amount" integer NOT NULL,
	"balance_after" integer NOT NULL,
	"reference_type" text,
	"reference_id" text,
	"description" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "device_commands" (
	"id" text PRIMARY KEY NOT NULL,
	"device_id" text NOT NULL,
	"session_id" text,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"result" jsonb,
	"error" text,
	"queued_at" timestamp DEFAULT now() NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"max_retries" integer DEFAULT 3 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "device_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"device_id" text NOT NULL,
	"agent_session_id" text,
	"user_id" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp,
	"last_activity_at" timestamp DEFAULT now() NOT NULL,
	"current_url" text,
	"current_title" text,
	"screenshot" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "devices" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text,
	"name" text NOT NULL,
	"type" text DEFAULT 'browser' NOT NULL,
	"status" text DEFAULT 'offline' NOT NULL,
	"connection_id" text,
	"last_heartbeat" timestamp,
	"ip_address" text,
	"user_agent" text,
	"capabilities" jsonb DEFAULT '[]'::jsonb,
	"config" jsonb DEFAULT '{}'::jsonb,
	"browser_type" text,
	"browser_version" text,
	"viewport" jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "file_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"file_id" text NOT NULL,
	"version" integer NOT NULL,
	"storage_key" text NOT NULL,
	"size" integer,
	"change_description" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"path" text NOT NULL,
	"mime_type" text,
	"size" integer,
	"storage_key" text,
	"storage_provider" text DEFAULT 'local',
	"is_public" boolean DEFAULT false,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"organization_id" text NOT NULL,
	"inviter_id" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text,
	"subscription_id" text,
	"stripe_invoice_id" text,
	"number" text,
	"status" text NOT NULL,
	"subtotal" integer NOT NULL,
	"tax" integer DEFAULT 0,
	"total" integer NOT NULL,
	"amount_paid" integer DEFAULT 0,
	"amount_due" integer NOT NULL,
	"currency" text DEFAULT 'usd' NOT NULL,
	"period_start" timestamp,
	"period_end" timestamp,
	"due_date" timestamp,
	"paid_at" timestamp,
	"invoice_url" text,
	"invoice_pdf_url" text,
	"description" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_stripe_invoice_id_unique" UNIQUE("stripe_invoice_id")
);
--> statement-breakpoint
CREATE TABLE "knowledge_chunks" (
	"id" text PRIMARY KEY NOT NULL,
	"item_id" text NOT NULL,
	"content" text NOT NULL,
	"chunk_index" integer NOT NULL,
	"start_offset" integer,
	"end_offset" integer,
	"page_number" integer,
	"embedding_id" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_groups" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text,
	"parent_id" text,
	"name" text NOT NULL,
	"description" text,
	"icon" text,
	"color" text,
	"sort_order" integer DEFAULT 0,
	"is_expanded" boolean DEFAULT true NOT NULL,
	"is_shared" boolean DEFAULT false NOT NULL,
	"share_settings" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_items" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text,
	"group_id" text,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"content" text,
	"content_preview" text,
	"source_url" text,
	"source_type" text,
	"source_id" text,
	"mime_type" text,
	"file_size" integer,
	"storage_key" text,
	"thumbnail_url" text,
	"status" text DEFAULT 'processing' NOT NULL,
	"processing_error" text,
	"embedding_id" text,
	"embedding_model" text,
	"tags" jsonb,
	"metadata" jsonb,
	"last_accessed_at" timestamp,
	"archived_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"email_enabled" boolean DEFAULT true NOT NULL,
	"email_digest" text DEFAULT 'daily' NOT NULL,
	"push_enabled" boolean DEFAULT true NOT NULL,
	"in_app_enabled" boolean DEFAULT true NOT NULL,
	"in_app_sound" boolean DEFAULT true NOT NULL,
	"type_settings" jsonb,
	"quiet_hours_enabled" boolean DEFAULT false NOT NULL,
	"quiet_hours_start" text,
	"quiet_hours_end" text,
	"quiet_hours_timezone" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "notification_preferences_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text,
	"type" text NOT NULL,
	"priority" text DEFAULT 'normal' NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"action_url" text,
	"action_label" text,
	"entity_type" text,
	"entity_id" text,
	"is_read" boolean DEFAULT false NOT NULL,
	"read_at" timestamp,
	"is_dismissed" boolean DEFAULT false NOT NULL,
	"dismissed_at" timestamp,
	"metadata" jsonb,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"logo" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "payment_methods" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"stripe_payment_method_id" text NOT NULL,
	"type" text NOT NULL,
	"brand" text,
	"last4" text,
	"expiry_month" integer,
	"expiry_year" integer,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_group_items" (
	"id" text PRIMARY KEY NOT NULL,
	"group_id" text NOT NULL,
	"project_id" text NOT NULL,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_groups" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text,
	"name" text NOT NULL,
	"color" text,
	"icon" text,
	"sort_order" integer DEFAULT 0,
	"is_expanded" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_members" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'viewer' NOT NULL,
	"permissions" jsonb,
	"notifications_enabled" boolean DEFAULT true NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"session_id" text NOT NULL,
	"sort_order" integer DEFAULT 0,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text,
	"name" text NOT NULL,
	"description" text,
	"icon" text,
	"color" text,
	"status" text DEFAULT 'active' NOT NULL,
	"visibility" text DEFAULT 'private' NOT NULL,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0,
	"settings" jsonb,
	"tags" jsonb,
	"metadata" jsonb,
	"last_activity_at" timestamp,
	"archived_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_used_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "sandbox_executions" (
	"id" text PRIMARY KEY NOT NULL,
	"sandbox_id" text NOT NULL,
	"type" text NOT NULL,
	"language" text,
	"code" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"stdout" text,
	"stderr" text,
	"exit_code" integer,
	"result" jsonb,
	"error" text,
	"started_at" timestamp,
	"completed_at" timestamp,
	"execution_time_ms" integer,
	"timeout_ms" integer DEFAULT 30000,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sandbox_files" (
	"id" text PRIMARY KEY NOT NULL,
	"sandbox_id" text NOT NULL,
	"path" text NOT NULL,
	"name" text NOT NULL,
	"is_directory" boolean DEFAULT false NOT NULL,
	"content" text,
	"storage_url" text,
	"size" integer,
	"mime_type" text,
	"version" integer DEFAULT 1 NOT NULL,
	"checksum" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sandboxes" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text,
	"project_id" text,
	"agent_session_id" text,
	"e2b_sandbox_id" text,
	"template_id" text,
	"name" text NOT NULL,
	"type" text DEFAULT 'code' NOT NULL,
	"status" text DEFAULT 'creating' NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb,
	"hostname" text,
	"ports" jsonb DEFAULT '[]'::jsonb,
	"working_directory" text DEFAULT '/home/user',
	"started_at" timestamp,
	"last_activity_at" timestamp,
	"expires_at" timestamp,
	"cpu_usage" integer,
	"memory_usage" integer,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scheduled_tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text,
	"name" text NOT NULL,
	"description" text,
	"task_type" text NOT NULL,
	"schedule_type" text NOT NULL,
	"scheduled_at" timestamp,
	"recurrence_pattern" text,
	"recurrence_interval" integer DEFAULT 1,
	"recurrence_days_of_week" jsonb,
	"recurrence_day_of_month" integer,
	"recurrence_time" text,
	"cron_expression" text,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"last_run_at" timestamp,
	"last_run_status" text,
	"last_run_error" text,
	"next_run_at" timestamp,
	"run_count" integer DEFAULT 0 NOT NULL,
	"max_retries" integer DEFAULT 3,
	"retry_delay_seconds" integer DEFAULT 60,
	"current_retry_count" integer DEFAULT 0,
	"payload" jsonb,
	"end_date" timestamp,
	"max_runs" integer,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_attachments" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"user_id" text NOT NULL,
	"knowledge_item_id" text,
	"name" text NOT NULL,
	"mime_type" text,
	"file_size" integer,
	"storage_key" text,
	"thumbnail_url" text,
	"status" text DEFAULT 'uploading' NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_plans" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"description" text,
	"price_monthly" integer DEFAULT 0 NOT NULL,
	"price_yearly" integer DEFAULT 0 NOT NULL,
	"discount_yearly_percent" integer DEFAULT 0,
	"monthly_credits" integer DEFAULT 0 NOT NULL,
	"features" jsonb,
	"limits" jsonb,
	"stripe_price_id_monthly" text,
	"stripe_price_id_yearly" text,
	"stripe_product_id" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_popular" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_executions" (
	"id" text PRIMARY KEY NOT NULL,
	"scheduled_task_id" text NOT NULL,
	"status" text NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp,
	"duration_ms" integer,
	"output" jsonb,
	"error" text,
	"error_stack" text,
	"retry_number" integer DEFAULT 0,
	"session_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage_records" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text,
	"type" text NOT NULL,
	"credits" integer NOT NULL,
	"session_id" text,
	"agent_id" text,
	"model" text,
	"input_tokens" integer,
	"output_tokens" integer,
	"description" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_connectors" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"connector_definition_id" text NOT NULL,
	"organization_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"token_expires_at" timestamp,
	"api_key" text,
	"credentials" jsonb,
	"sync_enabled" boolean DEFAULT true NOT NULL,
	"sync_interval" integer DEFAULT 3600,
	"last_sync_at" timestamp,
	"last_sync_status" text,
	"last_sync_error" text,
	"config" jsonb,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text,
	"plan_id" text NOT NULL,
	"stripe_subscription_id" text,
	"stripe_customer_id" text,
	"interval" text DEFAULT 'monthly' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"current_period_start" timestamp NOT NULL,
	"current_period_end" timestamp NOT NULL,
	"trial_start" timestamp,
	"trial_end" timestamp,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"canceled_at" timestamp,
	"cancellation_reason" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_subscriptions_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"image" text,
	"password" text,
	"email_verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"stripe_price_id" text,
	"stripe_current_period_end" timestamp,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_stripe_customer_id_unique" UNIQUE("stripe_customer_id"),
	CONSTRAINT "users_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id")
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "webhook_deliveries" (
	"id" text PRIMARY KEY NOT NULL,
	"webhook_id" text NOT NULL,
	"event_type" text NOT NULL,
	"event_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"request_headers" jsonb,
	"request_body" text,
	"signature" text,
	"response_status" integer,
	"response_headers" jsonb,
	"response_body" text,
	"error" text,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"next_retry_at" timestamp,
	"attempted_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"duration_ms" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" text PRIMARY KEY NOT NULL,
	"event_type" text NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"user_id" text,
	"organization_id" text,
	"processed" boolean DEFAULT false NOT NULL,
	"processed_at" timestamp,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhooks" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text,
	"name" text NOT NULL,
	"description" text,
	"url" text NOT NULL,
	"secret" text NOT NULL,
	"events" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"headers" jsonb DEFAULT '{}'::jsonb,
	"max_retries" integer DEFAULT 3 NOT NULL,
	"retry_delay_ms" integer DEFAULT 1000 NOT NULL,
	"timeout_ms" integer DEFAULT 30000 NOT NULL,
	"rate_limit_per_minute" integer DEFAULT 60,
	"total_deliveries" integer DEFAULT 0 NOT NULL,
	"successful_deliveries" integer DEFAULT 0 NOT NULL,
	"failed_deliveries" integer DEFAULT 0 NOT NULL,
	"last_delivery_at" timestamp,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "website_crawl_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"website_id" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"pages_queued" integer DEFAULT 0 NOT NULL,
	"pages_processed" integer DEFAULT 0 NOT NULL,
	"pages_succeeded" integer DEFAULT 0 NOT NULL,
	"pages_failed" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp,
	"error" text,
	"error_details" jsonb,
	"config" jsonb,
	"bytes_downloaded" integer DEFAULT 0 NOT NULL,
	"request_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "website_pages" (
	"id" text PRIMARY KEY NOT NULL,
	"website_id" text NOT NULL,
	"url" text NOT NULL,
	"path" text NOT NULL,
	"title" text,
	"raw_html" text,
	"text_content" text,
	"markdown" text,
	"links" jsonb DEFAULT '[]'::jsonb,
	"images" jsonb DEFAULT '[]'::jsonb,
	"headings" jsonb DEFAULT '[]'::jsonb,
	"status_code" integer,
	"content_type" text,
	"content_length" integer,
	"meta_description" text,
	"meta_keywords" text,
	"canonical" text,
	"depth" integer DEFAULT 0 NOT NULL,
	"crawled_at" timestamp,
	"error" text,
	"content_hash" text,
	"last_changed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "websites" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text,
	"project_id" text,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"domain" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb,
	"pages_discovered" integer DEFAULT 0 NOT NULL,
	"pages_crawled" integer DEFAULT 0 NOT NULL,
	"pages_errored" integer DEFAULT 0 NOT NULL,
	"last_crawl_at" timestamp,
	"next_crawl_at" timestamp,
	"crawl_frequency" text DEFAULT 'once',
	"favicon" text,
	"title" text,
	"description" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_sessions" ADD CONSTRAINT "agent_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_tasks" ADD CONSTRAINT "agent_tasks_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_session_id_agent_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."agent_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connector_sync_logs" ADD CONSTRAINT "connector_sync_logs_user_connector_id_user_connectors_id_fk" FOREIGN KEY ("user_connector_id") REFERENCES "public"."user_connectors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_balances" ADD CONSTRAINT "credit_balances_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_balances" ADD CONSTRAINT "credit_balances_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_balances" ADD CONSTRAINT "credit_balances_auto_topup_package_id_credit_packages_id_fk" FOREIGN KEY ("auto_topup_package_id") REFERENCES "public"."credit_packages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_versions" ADD CONSTRAINT "file_versions_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_session_id_agent_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."agent_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_inviter_id_users_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_subscription_id_user_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."user_subscriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_item_id_knowledge_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."knowledge_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_groups" ADD CONSTRAINT "knowledge_groups_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_groups" ADD CONSTRAINT "knowledge_groups_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_items" ADD CONSTRAINT "knowledge_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_items" ADD CONSTRAINT "knowledge_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_items" ADD CONSTRAINT "knowledge_items_group_id_knowledge_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."knowledge_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_session_id_agent_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."agent_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_group_items" ADD CONSTRAINT "project_group_items_group_id_project_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."project_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_group_items" ADD CONSTRAINT "project_group_items_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_groups" ADD CONSTRAINT "project_groups_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_groups" ADD CONSTRAINT "project_groups_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_sessions" ADD CONSTRAINT "project_sessions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_sessions" ADD CONSTRAINT "project_sessions_session_id_agent_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."agent_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_tasks" ADD CONSTRAINT "scheduled_tasks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_tasks" ADD CONSTRAINT "scheduled_tasks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_attachments" ADD CONSTRAINT "session_attachments_session_id_agent_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."agent_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_attachments" ADD CONSTRAINT "session_attachments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_attachments" ADD CONSTRAINT "session_attachments_knowledge_item_id_knowledge_items_id_fk" FOREIGN KEY ("knowledge_item_id") REFERENCES "public"."knowledge_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_executions" ADD CONSTRAINT "task_executions_scheduled_task_id_scheduled_tasks_id_fk" FOREIGN KEY ("scheduled_task_id") REFERENCES "public"."scheduled_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_connectors" ADD CONSTRAINT "user_connectors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_connectors" ADD CONSTRAINT "user_connectors_connector_definition_id_connector_definitions_id_fk" FOREIGN KEY ("connector_definition_id") REFERENCES "public"."connector_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_connectors" ADD CONSTRAINT "user_connectors_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_plan_id_subscription_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE no action ON UPDATE no action;