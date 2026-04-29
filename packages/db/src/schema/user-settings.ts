import { pgTable, serial, varchar, integer, boolean, timestamp, jsonb, unique } from 'drizzle-orm/pg-core';

// Reference to users table - avoid importing to prevent module resolution issues
const usersRef = pgTable('users', { id: serial('id').primaryKey() });

// User Settings table - extends users 1:1 with dashboard/briefing preferences
export const userSettings = pgTable('user_settings', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => usersRef.id, { onDelete: 'cascade' }),
  timezone: varchar('timezone', { length: 100 }).notNull().default('America/New_York'),
  defaultAiModel: varchar('default_ai_model', { length: 100 }),
  aiMonthlyBudgetCents: integer('ai_monthly_budget_cents').notNull().default(30000),
  focusModeActive: boolean('focus_mode_active').notNull().default(false),
  focusModeStartedAt: timestamp('focus_mode_started_at', { withTimezone: true }),
  briefingSchedule: varchar('briefing_schedule', { length: 20 }).notNull().default('09:00'),
  eveningDebriefEnabled: boolean('evening_debrief_enabled').notNull().default(true),
  notificationEmailEnabled: boolean('notification_email_enabled').notNull().default(false),
  notificationCriticalOnly: boolean('notification_critical_only').notNull().default(false),
  notificationEvents: jsonb('notification_events').$type<{
    new_ticket?: boolean;
    urgent_ticket?: boolean;
    agent_failure?: boolean;
    budget_warning?: boolean;
    server_offline?: boolean;
    daily_briefing?: boolean;
  }>(),
  autoMemoryExtraction: boolean('auto_memory_extraction').notNull().default(true),
  autoPauseBudget: boolean('auto_pause_budget').notNull().default(false),
  theme: varchar('theme', { length: 20 }).notNull().default('light'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userIdUnique: unique('user_settings_user_id_unique').on(table.userId),
}));
