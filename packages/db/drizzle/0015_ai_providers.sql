-- Create AI provider type enum
CREATE TYPE "ai_provider_type" AS ENUM('anthropic', 'openai', 'google', 'ollama', 'custom');

-- Create AI providers table
CREATE TABLE "ai_providers" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name" "ai_provider_type" NOT NULL,
	"display_name" varchar(100) NOT NULL,
	"base_url" text,
	"api_key_vault_id" integer,
	"default_model" varchar(100),
	"available_models" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"pricing" jsonb,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Add foreign key constraints
ALTER TABLE "ai_providers" ADD CONSTRAINT "ai_providers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "ai_providers" ADD CONSTRAINT "ai_providers_api_key_vault_id_vault_entries_id_fk" FOREIGN KEY ("api_key_vault_id") REFERENCES "public"."vault_entries"("id") ON DELETE set null ON UPDATE no action;
