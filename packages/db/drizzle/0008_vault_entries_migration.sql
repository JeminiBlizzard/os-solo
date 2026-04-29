-- Create enums for vault entries
CREATE TYPE "public"."vault_environment" AS ENUM('development', 'staging', 'production', 'all');--> statement-breakpoint
CREATE TYPE "public"."vault_category" AS ENUM('api_key', 'database_credential', 'ssh_key', 'oauth_token', 'certificate', 'password', 'note', 'other');--> statement-breakpoint
CREATE TYPE "public"."vault_access_type" AS ENUM('reveal', 'agent_read', 'copy');--> statement-breakpoint

-- Rename vault_items to vault_entries
ALTER TABLE "vault_items" RENAME TO "vault_entries";--> statement-breakpoint

-- Rename the unique constraint
ALTER TABLE "vault_entries" RENAME CONSTRAINT "vault_items_user_id_name_unique" TO "vault_entries_user_id_name_unique";--> statement-breakpoint

-- Add new columns to vault_entries
ALTER TABLE "vault_entries" ADD COLUMN "category" "vault_category" DEFAULT 'other' NOT NULL;--> statement-breakpoint
ALTER TABLE "vault_entries" ADD COLUMN "environment" "vault_environment" DEFAULT 'all' NOT NULL;--> statement-breakpoint
ALTER TABLE "vault_entries" ADD COLUMN "rotation_reminder_days" integer;--> statement-breakpoint
ALTER TABLE "vault_entries" ADD COLUMN "access_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "vault_entries" ADD COLUMN "last_rotated_at" timestamp with time zone;--> statement-breakpoint

-- Create vault_access_log table
CREATE TABLE "vault_access_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"vault_entry_id" integer NOT NULL,
	"accessed_by" varchar(255) NOT NULL,
	"access_type" "vault_access_type" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

-- Add foreign key for vault_access_log
ALTER TABLE "vault_access_log" ADD CONSTRAINT "vault_access_log_vault_entry_id_vault_entries_id_fk" FOREIGN KEY ("vault_entry_id") REFERENCES "public"."vault_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

-- Create index for vault_access_log
CREATE INDEX "vault_access_log_vault_entry_id_created_at_idx" ON "vault_access_log" USING btree ("vault_entry_id","created_at" DESC NULLS LAST);--> statement-breakpoint

-- Update the foreign key constraint name (if needed by Drizzle)
-- Note: The actual FK constraint vault_items_user_id_users_id_fk will be automatically renamed to vault_entries_user_id_users_id_fk by PostgreSQL
