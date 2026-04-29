-- Add read_at column to notification_log for tracking which notifications have been read
ALTER TABLE "notification_log" ADD COLUMN "read_at" timestamp with time zone;
