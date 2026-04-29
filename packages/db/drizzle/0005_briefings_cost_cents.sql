-- Add cost_cents column to briefings table for tracking AI generation costs
ALTER TABLE "briefings" ADD COLUMN "cost_cents" integer DEFAULT 0;
