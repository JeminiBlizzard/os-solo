-- Create enums for audit log (if not exists)
DO $$ BEGIN
  CREATE TYPE "actor_type" AS ENUM('human', 'agent', 'system');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "audit_domain" AS ENUM('agents', 'inbox', 'infrastructure', 'finance', 'projects', 'vault', 'settings', 'auth');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "audit_action" AS ENUM('create', 'update', 'delete', 'read', 'execute', 'approve', 'reject', 'login', 'logout', 'export', 'import');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

-- Rename user_preferences_kv table (was previously named user_settings) - only if not already renamed
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_settings')
  AND NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_preferences_kv')
  THEN
    ALTER TABLE "user_settings" RENAME TO "user_preferences_kv";
  END IF;
END $$;
--> statement-breakpoint

-- Drop old audit_log table and recreate with new schema
DROP TABLE IF EXISTS "audit_log" CASCADE;
--> statement-breakpoint

-- Create new audit_log table with proper schema
CREATE TABLE "audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"actor" varchar(255) NOT NULL,
	"actor_type" "actor_type" NOT NULL,
	"domain" "audit_domain" NOT NULL,
	"action" "audit_action" NOT NULL,
	"resource_type" varchar(100),
	"resource_id" varchar(100),
	"description" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ip_address" varchar(45),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- Add foreign key constraint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint

-- Create indexes for query performance
CREATE INDEX "audit_log_user_id_created_at_idx" ON "audit_log" USING btree ("user_id","created_at" DESC);
--> statement-breakpoint
CREATE INDEX "audit_log_domain_created_at_idx" ON "audit_log" USING btree ("domain","created_at" DESC);
--> statement-breakpoint

-- Create function to prevent updates and deletes on audit_log
CREATE OR REPLACE FUNCTION prevent_audit_log_modifications()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only: UPDATE and DELETE operations are not permitted';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

-- Create trigger to enforce append-only behavior
CREATE TRIGGER audit_log_prevent_modifications
  BEFORE UPDATE OR DELETE ON "audit_log"
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_log_modifications();
