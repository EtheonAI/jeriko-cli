CREATE TABLE "webdev_domains" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"session_id" text,
	"sandbox_id" text,
	"domain" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"cname_target" text,
	"purchased_via" text,
	"project_path" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"verified_at" timestamp
);
