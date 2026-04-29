import { pgTable, serial, varchar, text, integer, boolean, timestamp, jsonb, index } from 'drizzle-orm/pg-core';

// Reference to users table from foundation.ts - avoid importing to prevent module resolution issues
// The FK will be created by Drizzle when both schema files are loaded together
const usersRef = pgTable('users', { id: serial('id').primaryKey() });
const aiProvidersRef = pgTable('ai_providers', { id: serial('id').primaryKey() });

// Agents table - AI agents with configuration and scheduling
export const agents = pgTable('agents', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => usersRef.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  systemPrompt: text('system_prompt'),
  status: varchar('status', { length: 20 }).notNull().default('active'), // 'active', 'paused', 'archived'
  scheduleType: varchar('schedule_type', { length: 20 }), // 'cron', 'event', 'manual'
  scheduleCron: varchar('schedule_cron', { length: 100 }),
  scheduleEvent: varchar('schedule_event', { length: 100 }),
  requiresApproval: boolean('requires_approval').notNull().default(false),
  approvalThreshold: integer('approval_threshold'),
  providerId: integer('provider_id').references(() => aiProvidersRef.id, { onDelete: 'set null' }),
  model: varchar('model', { length: 100 }),
  monthlyBudgetCents: integer('monthly_budget_cents'),
  currentMonthSpendCents: integer('current_month_spend_cents').notNull().default(0),
  skills: jsonb('skills').notNull().default([]),
  config: jsonb('config').notNull().default({}),
  lastRunAt: timestamp('last_run_at', { withTimezone: true }),
  lastRunStatus: varchar('last_run_status', { length: 20 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Agent Templates table - Pre-built agent configurations
export const agentTemplates = pgTable('agent_templates', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  category: varchar('category', { length: 100 }),
  systemPrompt: text('system_prompt'),
  defaultSkills: jsonb('default_skills').notNull().default([]),
  defaultSchedule: varchar('default_schedule', { length: 100 }),
  defaultRequiresApproval: boolean('default_requires_approval').notNull().default(false),
  isBuiltin: boolean('is_builtin').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Reference to approval_queue table - will be created in approval-queue.ts
const approvalQueueRef = pgTable('approval_queue', { id: serial('id').primaryKey() });

// Agent Runs table - Execution history for agents
export const agentRuns = pgTable('agent_runs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => usersRef.id, { onDelete: 'cascade' }),
  agentId: integer('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  triggeredBy: varchar('triggered_by', { length: 30 }).notNull(), // 'schedule', 'event', 'manual', 'chain'
  status: varchar('status', { length: 20 }).notNull(), // 'running', 'success', 'failure', 'needs_approval', 'cancelled'
  input: jsonb('input').notNull(),
  output: jsonb('output'),
  tokensPrompt: integer('tokens_prompt'),
  tokensCompletion: integer('tokens_completion'),
  costCents: integer('cost_cents'),
  durationMs: integer('duration_ms'),
  error: text('error'),
  approvalQueueId: integer('approval_queue_id').references(() => approvalQueueRef.id, { onDelete: 'set null' }),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
}, (table) => ({
  agentIdStartedAtIdx: index('agent_runs_agent_id_started_at_idx').on(table.agentId, table.startedAt.desc()),
  userIdStatusIdx: index('agent_runs_user_id_status_idx').on(table.userId, table.status),
}));

// Agent Memory table - Persistent memory for agents
export const agentMemory = pgTable('agent_memory', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => usersRef.id, { onDelete: 'cascade' }),
  agentId: integer('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  kind: varchar('kind', { length: 30 }).notNull(), // 'fact', 'episodic', 'preference'
  content: text('content').notNull(),
  embedding: text('embedding'), // Placeholder for future vector support
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
}, (table) => ({
  agentIdKindIdx: index('agent_memory_agent_id_kind_idx').on(table.agentId, table.kind),
}));
