import { pgTable, serial, integer, varchar, text, boolean, timestamp, jsonb, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Reference to users table - avoid importing to prevent module resolution issues
const usersRef = pgTable('users', { id: serial('id').primaryKey() });

// Reference to vault_entries table
const vaultEntriesRef = pgTable('vault_entries', { id: serial('id').primaryKey() });

// AI Provider Type enum
export const aiProviderTypeEnum = pgEnum('ai_provider_type', [
  'anthropic',
  'openai',
  'google',
  'ollama',
  'custom',
]);

// AI Providers table - Multi-provider AI configuration
export const aiProviders = pgTable('ai_providers', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => usersRef.id, { onDelete: 'cascade' }),
  name: aiProviderTypeEnum('name').notNull(), // Provider type: anthropic, openai, google, ollama, custom
  displayName: varchar('display_name', { length: 100 }).notNull(), // User-friendly name for this provider
  baseUrl: text('base_url'), // API base URL (null for cloud providers using default URLs)
  apiKeyVaultId: integer('api_key_vault_id').references(() => vaultEntriesRef.id, { onDelete: 'set null' }), // Reference to encrypted API key in vault
  defaultModel: varchar('default_model', { length: 100 }), // Default model for this provider (e.g., 'claude-opus-4')
  availableModels: jsonb('available_models').$type<string[]>().notNull().default([]), // Array of available model identifiers
  pricing: jsonb('pricing').$type<{
    // Optional pricing information per model
    [model: string]: {
      inputPerMillion?: number; // Cost per million input tokens in cents
      outputPerMillion?: number; // Cost per million output tokens in cents
    };
  }>(),
  isDefault: boolean('is_default').notNull().default(false), // Whether this is the default provider for the user
  isEnabled: boolean('is_enabled').notNull().default(true), // Whether this provider is enabled for use
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// AI Providers relations
export const aiProvidersRelations = relations(aiProviders, ({ one }) => ({
  vaultEntry: one(vaultEntriesRef, {
    fields: [aiProviders.apiKeyVaultId],
    references: [vaultEntriesRef.id],
  }),
  user: one(usersRef, {
    fields: [aiProviders.userId],
    references: [usersRef.id],
  }),
}));
