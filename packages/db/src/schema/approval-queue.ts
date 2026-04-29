import { pgTable, serial, varchar, text, integer, timestamp, jsonb, real, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// Reference tables - avoid direct imports to prevent module resolution issues
const usersRef = pgTable('users', { id: serial('id').primaryKey() });
const agentsRef = pgTable('agents', { id: serial('id').primaryKey() });

/**
 * Approval Queue table - Pending agent actions requiring human review.
 *
 * When an agent with requires_approval=true proposes an action:
 * - If no threshold OR confidence < threshold: status='pending', action NOT executed
 * - If confidence >= threshold: status='auto_approved', action IS executed
 *
 * expires_at defaults to 48 hours from creation.
 */
export const approvalQueue = pgTable('approval_queue', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => usersRef.id, { onDelete: 'cascade' }),
  agentId: integer('agent_id').notNull().references(() => agentsRef.id, { onDelete: 'cascade' }),
  actionType: varchar('action_type', { length: 50 }).notNull(),
  title: varchar('title', { length: 500 }).notNull(),
  description: text('description'),
  proposedOutput: text('proposed_output'),
  confidenceScore: real('confidence_score'),
  status: varchar('status', { length: 20 }).notNull().default('pending'), // 'pending', 'approved', 'rejected', 'auto_approved', 'expired'
  context: jsonb('context').notNull().default({}),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  reviewNotes: text('review_notes'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).default(sql`now() + interval '48 hours'`).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userIdStatusIdx: index('approval_queue_user_id_status_idx').on(table.userId, table.status),
  agentIdStatusIdx: index('approval_queue_agent_id_status_idx').on(table.agentId, table.status),
  expiresAtIdx: index('approval_queue_expires_at_idx').on(table.expiresAt),
}));
