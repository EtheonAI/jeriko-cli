CREATE TABLE "skill_definitions" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" text NOT NULL,
	"icon" text,
	"is_premium" boolean DEFAULT false NOT NULL,
	"default_enabled" boolean DEFAULT true NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "skill_definitions_type_unique" UNIQUE("type")
);
--> statement-breakpoint
ALTER TABLE "user_connectors" ADD COLUMN "project_id" text;--> statement-breakpoint
ALTER TABLE "user_connectors" ADD CONSTRAINT "user_connectors_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_messages_session_created" ON "messages" USING btree ("session_id","created_at");