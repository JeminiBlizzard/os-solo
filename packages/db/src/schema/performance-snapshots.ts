import { pgTable, serial, varchar, integer, timestamp, index } from 'drizzle-orm/pg-core';

// Reference to users table from foundation.ts
const usersRef = pgTable('users', { id: serial('id').primaryKey() });

// Reference to agents table from agents.ts
const agentsRef = pgTable('agents', { id: serial('id').primaryKey() });

// Agent Performance Snapshots table - Daily/weekly/monthly aggregated metrics
export const agentPerformanceSnapshots = pgTable('agent_performance_snapshots', {
  id: serial('id').primaryKey(),
  agentId: integer('agent_id').notNull().references(() => agentsRef.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => usersRef.id, { onDelete: 'cascade' }),
  period: varchar('period', { length: 10 }).notNull(), // 'YYYY-MM-DD' for daily, 'YYYY-Www' for weekly, 'YYYY-MM' for monthly
  periodType: varchar('period_type', { length: 10 }).notNull(), // 'daily', 'weekly', 'monthly'
  totalRuns: integer('total_runs').notNull().default(0),
  successfulRuns: integer('successful_runs').notNull().default(0),
  failedRuns: integer('failed_runs').notNull().default(0),
  approvalCount: integer('approval_count').notNull().default(0),
  rejectionCount: integer('rejection_count').notNull().default(0),
  autoApprovalCount: integer('auto_approval_count').notNull().default(0),
  totalTokens: integer('total_tokens').notNull().default(0),
  totalCostCents: integer('total_cost_cents').notNull().default(0),
  avgDurationMs: integer('avg_duration_ms'),
  estimatedTimeSavedMinutes: integer('estimated_time_saved_minutes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  agentPeriodIdx: index('agent_performance_snapshots_agent_period_idx').on(table.agentId, table.period, table.periodType),
  userIdIdx: index('agent_performance_snapshots_user_id_idx').on(table.userId),
  periodTypeIdx: index('agent_performance_snapshots_period_type_idx').on(table.periodType),
}));
