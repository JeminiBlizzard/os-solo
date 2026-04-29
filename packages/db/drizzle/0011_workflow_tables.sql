-- Create agent_workflows table
CREATE TABLE IF NOT EXISTS "agent_workflows" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"agent_id" integer NOT NULL,
	"nodes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"edges" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_workflows_agent_id_unique" UNIQUE("agent_id")
);
--> statement-breakpoint

-- Create workflow_components table
CREATE TABLE IF NOT EXISTS "workflow_components" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"type" varchar(20) NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"icon" varchar(50),
	"default_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_builtin" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- Add foreign keys for agent_workflows
DO $$ BEGIN
 ALTER TABLE "agent_workflows" ADD CONSTRAINT "agent_workflows_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "agent_workflows" ADD CONSTRAINT "agent_workflows_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

-- Add foreign key for workflow_components
DO $$ BEGIN
 ALTER TABLE "workflow_components" ADD CONSTRAINT "workflow_components_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

-- Create indexes for agent_workflows
CREATE INDEX IF NOT EXISTS "agent_workflows_user_id_idx" ON "agent_workflows" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_workflows_agent_id_idx" ON "agent_workflows" USING btree ("agent_id");
--> statement-breakpoint

-- Create indexes for workflow_components
CREATE INDEX IF NOT EXISTS "workflow_components_type_idx" ON "workflow_components" USING btree ("type");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workflow_components_is_builtin_idx" ON "workflow_components" USING btree ("is_builtin");
