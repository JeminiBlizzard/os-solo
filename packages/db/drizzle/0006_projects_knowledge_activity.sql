-- Add server_id and stripe_product_id to projects table
ALTER TABLE "projects" ADD COLUMN "server_id" integer;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "stripe_product_id" varchar(255);--> statement-breakpoint

-- Create project_knowledge table (1:1 with projects)
CREATE TABLE "project_knowledge" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"version" varchar(50),
	"tech_stack" text,
	"architecture" text,
	"conventions" text,
	"folder_structure" text,
	"auth_approach" text,
	"error_handling" text,
	"hard_constraints" text,
	"end_state_vision" text,
	"custom_fields" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_knowledge_project_id_unique" UNIQUE("project_id")
);
--> statement-breakpoint

-- Create project_activity table
CREATE TABLE "project_activity" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"type" varchar(50) NOT NULL,
	"description" text NOT NULL,
	"source_type" varchar(50),
	"source_id" integer,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- Add foreign key constraints
ALTER TABLE "projects" ADD CONSTRAINT "projects_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_knowledge" ADD CONSTRAINT "project_knowledge_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_activity" ADD CONSTRAINT "project_activity_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

-- Create indexes
CREATE INDEX "project_activity_project_id_created_at_idx" ON "project_activity" USING btree ("project_id","created_at" DESC NULLS LAST);
