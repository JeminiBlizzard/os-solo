import { pgTable, serial, varchar, text, integer, timestamp, index } from 'drizzle-orm/pg-core';

// Reference to users table from foundation.ts
const usersRef = pgTable('users', { id: serial('id').primaryKey() });

/**
 * Command History table - stores user command bar queries and their results
 * for analytics, search history, and learning patterns.
 */
export const commandHistory = pgTable('command_history', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => usersRef.id, { onDelete: 'cascade' }),
  query: text('query').notNull(), // The natural language query entered by the user
  resultType: varchar('result_type', { length: 30 }).notNull(), // 'navigation' | 'action' | 'answer' | 'error'
  resultSummary: text('result_summary'), // Brief description of what happened (nullable)
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  // Index for querying user's command history by time
  userIdCreatedAtIdx: index('command_history_user_id_created_at_idx').on(table.userId, table.createdAt.desc()),
}));
