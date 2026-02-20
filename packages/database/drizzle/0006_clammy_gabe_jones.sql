CREATE TABLE "media_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"sandbox_id" text,
	"user_id" text NOT NULL,
	"e2b_sandbox_id" text,
	"neko_host" text,
	"neko_password" text,
	"provider" text DEFAULT 'neko',
	"status" text DEFAULT 'pending',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
