-- Rename existing user_settings key-value table to user_preferences_kv
-- (This was done manually, but documenting here for completeness)
-- ALTER TABLE "user_settings" RENAME TO "user_preferences_kv";
-- ALTER SEQUENCE "user_settings_id_seq" RENAME TO "user_preferences_kv_id_seq";
-- ALTER TABLE "user_preferences_kv" RENAME CONSTRAINT "user_settings_pkey" TO "user_preferences_kv_pkey";
-- ALTER TABLE "user_preferences_kv" RENAME CONSTRAINT "user_settings_user_id_key_unique" TO "user_preferences_kv_user_id_key_unique";
-- ALTER TABLE "user_preferences_kv" RENAME CONSTRAINT "user_settings_user_id_users_id_fk" TO "user_preferences_kv_user_id_users_id_fk";

--> statement-breakpoint
CREATE TABLE "user_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"timezone" varchar(100) DEFAULT 'America/New_York' NOT NULL,
	"default_ai_model" varchar(100),
	"ai_monthly_budget_cents" integer DEFAULT 30000 NOT NULL,
	"focus_mode_active" boolean DEFAULT false NOT NULL,
	"focus_mode_started_at" timestamp with time zone,
	"briefing_schedule" varchar(20) DEFAULT '09:00' NOT NULL,
	"evening_debrief_enabled" boolean DEFAULT true NOT NULL,
	"notification_email_enabled" boolean DEFAULT false NOT NULL,
	"notification_critical_only" boolean DEFAULT false NOT NULL,
	"theme" varchar(20) DEFAULT 'light' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_settings_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
