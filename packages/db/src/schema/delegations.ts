import { pgTable, serial, varchar, text, integer, timestamp, index } from 'drizzle-orm/pg-core';

// Reference to users table from foundation.ts
const usersRef = pgTable('users', { id: serial('id').primaryKey() });

// Reference to agents table from agents.ts
const agentsRef = pgTable('agents', { id: serial('id').primaryKey() });

// Reference to agent_runs table from agents.ts
const agentRunsRef = pgTable('agent_runs', { id: serial('id').primaryKey() });

// Delegations table - Agent-to-agent delegation tracking
export const delegations = pgTable('delegations', {
  id: serial('id').primaryKey(),
  parentRunId: integer('parent_run_id').notNull().references(() => agentRunsRef.id, { onDelete: 'cascade' }),
  parentAgentId: integer('parent_agent_id').notNull().references(() => agentsRef.id, { onDelete: 'cascade' }),
  childAgentId: integer('child_agent_id').notNull().references(() => agentsRef.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => usersRef.id, { onDelete: 'cascade' }),
  requestContext: text('request_context').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('pending'), // 'pending', 'accepted', 'completed', 'failed', 'rejected'
  childRunId: integer('child_run_id').references(() => agentRunsRef.id, { onDelete: 'set null' }),
  result: text('result'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
}, (table) => ({
  parentRunIdIdx: index('delegations_parent_run_id_idx').on(table.parentRunId),
  childAgentIdStatusIdx: index('delegations_child_agent_id_status_idx').on(table.childAgentId, table.status),
  userIdIdx: index('delegations_user_id_idx').on(table.userId),
}));
