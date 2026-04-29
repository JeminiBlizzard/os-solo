import { pgTable, serial, varchar, text, integer, boolean, timestamp, jsonb, index, unique } from 'drizzle-orm/pg-core';

// Reference to users and agents tables - avoid importing to prevent module resolution issues
const usersRef = pgTable('users', { id: serial('id').primaryKey() });
const agentsRef = pgTable('agents', { id: serial('id').primaryKey() });

// Briefings table - Dashboard briefings
export const briefings = pgTable('briefings', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => usersRef.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 20 }).notNull(), // 'daily', 'weekly', 'incident', 'custom', 'morning', 'evening'
  content: text('content'),
  dataSources: jsonb('data_sources').notNull().default([]),
  costCents: integer('cost_cents').default(0),
  generatedAt: timestamp('generated_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Update History table - Self-update tracking
export const updateHistory = pgTable('update_history', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => usersRef.id, { onDelete: 'cascade' }),
  fromVersion: varchar('from_version', { length: 50 }),
  toVersion: varchar('to_version', { length: 50 }).notNull(),
  status: varchar('status', { length: 20 }).notNull(), // 'pending', 'in_progress', 'success', 'failed', 'rolled_back'
  changelogSummary: text('changelog_summary'),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  error: text('error'),
});

// Workflows table - Visual workflow canvas
export const workflows = pgTable('workflows', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => usersRef.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  definition: jsonb('definition').notNull(), // Stores nodes + edges
  enabled: boolean('enabled').notNull().default(true),
  lastRunAt: timestamp('last_run_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Scheduled Jobs table - Autopilot scheduler internals
export const scheduledJobs = pgTable('scheduled_jobs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => usersRef.id, { onDelete: 'cascade' }),
  agentId: integer('agent_id').references(() => agentsRef.id, { onDelete: 'set null' }),
  jobType: varchar('job_type', { length: 30 }).notNull(), // 'agent_run', 'workflow', 'backup', 'cleanup'
  cronExpression: varchar('cron_expression', { length: 100 }),
  nextRunAt: timestamp('next_run_at', { withTimezone: true }),
  lastRunAt: timestamp('last_run_at', { withTimezone: true }),
  status: varchar('status', { length: 20 }).notNull().default('active'), // 'active', 'paused', 'failed'
  lockedAt: timestamp('locked_at', { withTimezone: true }),
  lockOwner: varchar('lock_owner', { length: 100 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  nextRunAtStatusIdx: index('scheduled_jobs_next_run_at_status_idx').on(table.nextRunAt, table.status),
}));
