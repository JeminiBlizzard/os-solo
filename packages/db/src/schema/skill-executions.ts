import { pgTable, serial, integer, varchar, jsonb, timestamp } from 'drizzle-orm/pg-core';

// Reference to tables - avoid importing to prevent module resolution issues
const skillsRef = pgTable('skills', { id: serial('id').primaryKey() });
const agentsRef = pgTable('agents', { id: serial('id').primaryKey() });
const agentRunsRef = pgTable('agent_runs', { id: serial('id').primaryKey() });

// Skill Executions table - Track per-execution data for skills
export const skillExecutions = pgTable('skill_executions', {
  id: serial('id').primaryKey(),
  skillId: integer('skill_id').notNull().references(() => skillsRef.id, { onDelete: 'cascade' }),
  agentId: integer('agent_id').references(() => agentsRef.id, { onDelete: 'set null' }),
  agentRunId: integer('agent_run_id').references(() => agentRunsRef.id, { onDelete: 'set null' }),
  input: jsonb('input'),
  output: jsonb('output'),
  status: varchar('status', { length: 20 }).notNull(), // 'success', 'failure'
  durationMs: integer('duration_ms'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
