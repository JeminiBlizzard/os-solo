-- Create update_history table for tracking self-update operations
CREATE TABLE IF NOT EXISTS "update_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"from_version" varchar(20) NOT NULL,
	"to_version" varchar(20) NOT NULL,
	"status" varchar(20) NOT NULL,
	"changelog_summary" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"error" text
);

-- Add foreign key constraint to users table
ALTER TABLE "update_history" ADD CONSTRAINT "update_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS "update_history_user_id_idx" ON "update_history" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "update_history_status_idx" ON "update_history" USING btree ("status");
CREATE INDEX IF NOT EXISTS "update_history_started_at_idx" ON "update_history" USING btree ("started_at" DESC);
