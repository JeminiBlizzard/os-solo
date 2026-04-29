-- Add notification_events, auto_memory_extraction, and auto_pause_budget columns to user_settings
ALTER TABLE "user_settings" ADD COLUMN "notification_events" jsonb;
ALTER TABLE "user_settings" ADD COLUMN "auto_memory_extraction" boolean DEFAULT true NOT NULL;
ALTER TABLE "user_settings" ADD COLUMN "auto_pause_budget" boolean DEFAULT false NOT NULL;
