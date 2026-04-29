import { pgTable, serial, varchar, text, integer, timestamp, index } from 'drizzle-orm/pg-core';

// Reference to users table from foundation.ts
const usersRef = pgTable('users', { id: serial('id').primaryKey() });

/**
 * Update History table - tracks self-update operations
 *
 * Records all system update attempts, successes, failures, and rollbacks.
 * Used for audit trail and displaying update history in System settings.
 */
export const updateHistory = pgTable('update_history', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => usersRef.id, { onDelete: 'cascade' }),
  fromVersion: varchar('from_version', { length: 20 }).notNull(),
  toVersion: varchar('to_version', { length: 20 }).notNull(),
  status: varchar('status', { length: 20 }).notNull(), // 'success', 'failed', 'rolled_back'
  changelogSummary: text('changelog_summary'), // Optional release notes summary
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }), // NULL if in progress or failed before completion
  error: text('error'), // Error message if status is 'failed'
}, (table) => ({
  userIdIdx: index('update_history_user_id_idx').on(table.userId),
  statusIdx: index('update_history_status_idx').on(table.status),
  startedAtIdx: index('update_history_started_at_idx').on(table.startedAt.desc()),
}));
