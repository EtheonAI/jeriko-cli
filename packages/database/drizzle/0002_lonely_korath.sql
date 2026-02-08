CREATE TABLE "device_definitions" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"icon" text,
	"category" text NOT NULL,
	"platform" text,
	"setup_instructions" text,
	"agent_command" text,
	"capabilities" jsonb,
	"requirements" jsonb,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"is_premium" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "device_definitions_type_unique" UNIQUE("type")
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" text PRIMARY KEY NOT NULL,
	"chat_id" text NOT NULL,
	"title" text NOT NULL,
	"kind" text DEFAULT 'text' NOT NULL,
	"content" text,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "file_shares" (
	"id" text PRIMARY KEY NOT NULL,
	"file_id" text NOT NULL,
	"shared_by_user_id" text NOT NULL,
	"share_token" text NOT NULL,
	"access_level" text DEFAULT 'viewer' NOT NULL,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "file_shares_share_token_unique" UNIQUE("share_token")
);
--> statement-breakpoint
CREATE TABLE "smart_home_entities" (
	"id" text PRIMARY KEY NOT NULL,
	"hub_id" text NOT NULL,
	"entity_id" text NOT NULL,
	"domain" text NOT NULL,
	"name" text NOT NULL,
	"area_id" text,
	"area_name" text,
	"state" text,
	"attributes" jsonb,
	"last_updated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "smart_home_hubs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text,
	"name" text NOT NULL,
	"type" text DEFAULT 'home_assistant' NOT NULL,
	"status" text DEFAULT 'disconnected' NOT NULL,
	"config" jsonb,
	"last_sync_at" timestamp,
	"entity_count" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "votes" (
	"chat_id" text NOT NULL,
	"message_id" text NOT NULL,
	"rating" integer NOT NULL,
	CONSTRAINT "votes_chat_id_message_id_pk" PRIMARY KEY("chat_id","message_id")
);
--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "parts" jsonb;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_chat_id_agent_sessions_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."agent_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_shares" ADD CONSTRAINT "file_shares_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_shares" ADD CONSTRAINT "file_shares_shared_by_user_id_users_id_fk" FOREIGN KEY ("shared_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "smart_home_entities" ADD CONSTRAINT "smart_home_entities_hub_id_smart_home_hubs_id_fk" FOREIGN KEY ("hub_id") REFERENCES "public"."smart_home_hubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "smart_home_hubs" ADD CONSTRAINT "smart_home_hubs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "smart_home_hubs" ADD CONSTRAINT "smart_home_hubs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_chat_id_agent_sessions_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."agent_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- REMOVED: votes_message_id_messages_id_fk — messageId uses AI SDK-generated IDs, not DB IDs