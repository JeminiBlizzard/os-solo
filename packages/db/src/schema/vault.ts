import { pgTable, serial, varchar, text, integer, timestamp, jsonb, unique, pgEnum } from 'drizzle-orm/pg-core';

// Reference to users table - avoid importing to prevent module resolution issues
const usersRef = pgTable('users', { id: serial('id').primaryKey() });

// Environment enum for vault entries
export const vaultEnvironmentEnum = pgEnum('vault_environment', ['development', 'staging', 'production', 'all']);

// Category enum for vault entries
export const vaultCategoryEnum = pgEnum('vault_category', [
  'api_key',
  'database_credential',
  'ssh_key',
  'oauth_token',
  'certificate',
  'password',
  'note',
  'other'
]);

// Access type enum for access logs
export const vaultAccessTypeEnum = pgEnum('vault_access_type', ['reveal', 'agent_read', 'copy']);

// Vault Entries table - encrypted secrets storage
export const vaultEntries = pgTable('vault_entries', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => usersRef.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  kind: varchar('kind', { length: 30 }).notNull(), // Deprecated - use category instead
  category: vaultCategoryEnum('category').notNull().default('other'),
  environment: vaultEnvironmentEnum('environment').notNull().default('all'),
  encryptedValue: text('encrypted_value').notNull(), // AES-256-GCM ciphertext+iv+tag concatenated
  metadata: jsonb('metadata').notNull().default({}),
  rotationReminderDays: integer('rotation_reminder_days'), // null = no rotation reminder
  accessCount: integer('access_count').notNull().default(0),
  lastAccessedAt: timestamp('last_accessed_at', { withTimezone: true }),
  lastRotatedAt: timestamp('last_rotated_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  uniqueUserName: unique('vault_entries_user_id_name_unique').on(table.userId, table.name),
}));

// Vault Access Log table - audit trail for secret access
export const vaultAccessLog = pgTable('vault_access_log', {
  id: serial('id').primaryKey(),
  vaultEntryId: integer('vault_entry_id').notNull().references(() => vaultEntries.id, { onDelete: 'cascade' }),
  accessedBy: varchar('accessed_by', { length: 255 }).notNull(), // User email or 'agent:task_id' or 'agent:workflow_id'
  accessType: vaultAccessTypeEnum('access_type').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
