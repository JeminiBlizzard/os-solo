CREATE TABLE "approval_queue" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"agent_id" integer NOT NULL,
	"action_type" varchar(50) NOT NULL,
	"title" varchar(500) NOT NULL,
	"description" text,
	"proposed_output" text,
	"confidence_score" real,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"context" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"reviewed_at" timestamp with time zone,
	"review_notes" text,
	"expires_at" timestamp with time zone DEFAULT now() + interval '48 hours' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_runs" ADD COLUMN "approval_queue_id" integer;--> statement-breakpoint
ALTER TABLE "approval_queue" ADD CONSTRAINT "approval_queue_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_queue" ADD CONSTRAINT "approval_queue_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "approval_queue_user_id_status_idx" ON "approval_queue" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "approval_queue_agent_id_status_idx" ON "approval_queue" USING btree ("agent_id","status");--> statement-breakpoint
CREATE INDEX "approval_queue_expires_at_idx" ON "approval_queue" USING btree ("expires_at");--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_approval_queue_id_approval_queue_id_fk" FOREIGN KEY ("approval_queue_id") REFERENCES "public"."approval_queue"("id") ON DELETE set null ON UPDATE no action;