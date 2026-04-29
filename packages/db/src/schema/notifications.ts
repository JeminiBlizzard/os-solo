import { pgTable, serial, integer, varchar, text, boolean, timestamp, jsonb } from 'drizzle-orm/pg-core';

// Reference to users table - avoid importing to prevent module resolution issues
const usersRef = pgTable('users', { id: serial('id').primaryKey() });

// Notification Channels table - User-configured notification destinations
export const notificationChannels = pgTable('notification_channels', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => usersRef.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 20 }).notNull(), // 'browser_push', 'slack', 'discord', 'email'
  config: jsonb('config').notNull().default({}), // Channel-specific configuration (webhook URLs, tokens, etc.)
  enabled: boolean('enabled').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Notification Rules table - User-defined rules for when to send notifications
export const notificationRules = pgTable('notification_rules', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => usersRef.id, { onDelete: 'cascade' }),
  eventType: varchar('event_type', { length: 50 }).notNull(), // e.g., 'agent.run.completed', 'agent.run.failed', 'approval.requested'
  severityMinimum: varchar('severity_minimum', { length: 20 }).notNull().default('info'), // 'info', 'warning', 'critical'
  channelId: integer('channel_id').notNull().references(() => notificationChannels.id, { onDelete: 'cascade' }),
  enabled: boolean('enabled').notNull().default(true),
  suppressInFocusMode: boolean('suppress_in_focus_mode').notNull().default(true), // Don't send if user is actively using the app
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Notification Log table - Records all notification dispatches for audit and debugging
export const notificationLog = pgTable('notification_log', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => usersRef.id, { onDelete: 'cascade' }),
  channelId: integer('channel_id').references(() => notificationChannels.id, { onDelete: 'set null' }),
  eventType: varchar('event_type', { length: 50 }).notNull(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  status: varchar('status', { length: 20 }).notNull(), // 'sent', 'failed', 'suppressed'
  error: text('error'), // Error message if status is 'failed'
  readAt: timestamp('read_at', { withTimezone: true }), // Timestamp when notification was marked as read (null = unread)
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
