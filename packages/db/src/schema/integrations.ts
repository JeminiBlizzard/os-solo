import { pgTable, serial, integer, varchar, jsonb, timestamp, index, pgEnum } from 'drizzle-orm/pg-core';

// Reference to users table - avoid importing to prevent module resolution issues
const usersRef = pgTable('users', { id: serial('id').primaryKey() });

// Integration types enum
export const integrationType = pgEnum('integration_type', [
  'stripe',
  'github',
  'email',
  'mcp',
  'webhook',
  'custom',
]);

// Integration status enum
export const integrationStatus = pgEnum('integration_status', [
  'connected',
  'disconnected',
  'error',
]);

// Integrations table - stores third-party service connections
export const integrations = pgTable('integrations', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => usersRef.id, { onDelete: 'cascade' }),
  type: integrationType('type').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  // JSONB config stores encrypted sensitive fields (api_key, webhook_secret, IMAP/SMTP passwords, GitHub tokens)
  config: jsonb('config').notNull().default({}),
  status: integrationStatus('status').notNull().default('disconnected'),
  lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
  errorMessage: varchar('error_message', { length: 1000 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('integrations_user_id_idx').on(table.userId),
  typeIdx: index('integrations_type_idx').on(table.type),
}));
