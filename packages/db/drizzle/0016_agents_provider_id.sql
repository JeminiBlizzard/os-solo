-- Add provider_id to agents table
ALTER TABLE "agents" ADD COLUMN "provider_id" integer;

-- Add foreign key constraint
ALTER TABLE "agents" ADD CONSTRAINT "agents_provider_id_ai_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."ai_providers"("id") ON DELETE set null ON UPDATE no action;
