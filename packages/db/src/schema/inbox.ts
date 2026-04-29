import { pgTable, serial, varchar, text, integer, boolean, timestamp, jsonb, index, real } from 'drizzle-orm/pg-core';

// Reference to users and agents tables - avoid importing to prevent module resolution issues
const usersRef = pgTable('users', { id: serial('id').primaryKey() });
const agentsRef = pgTable('agents', { id: serial('id').primaryKey() });

// Inbox Items table - unified inbox for all communication channels
export const inboxItems = pgTable('inbox_items', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => usersRef.id, { onDelete: 'cascade' }),
  source: varchar('source', { length: 50 }).notNull(), // 'email', 'sms', 'slack', 'webhook', etc.
  externalId: varchar('external_id', { length: 255 }),
  fromAddress: varchar('from_address', { length: 255 }).notNull(),
  fromName: varchar('from_name', { length: 255 }),
  subject: varchar('subject', { length: 500 }),
  body: text('body'),
  bodyHtml: text('body_html'),
  category: varchar('category', { length: 20 }), // 'support', 'billing', 'sales', 'other'
  priority: varchar('priority', { length: 30 }), // 'urgent', 'high', 'normal', 'low'
  status: varchar('status', { length: 20 }).notNull().default('new'), // 'new', 'triaged', 'assigned', 'resolved', 'archived'
  assignedAgentId: integer('assigned_agent_id').references(() => agentsRef.id, { onDelete: 'set null' }),
  aiTriageSummary: text('ai_triage_summary'),
  aiDraftResponse: text('ai_draft_response'),
  aiConfidence: real('ai_confidence'),
  threadId: varchar('thread_id', { length: 255 }),
  metadata: jsonb('metadata').notNull().default({}),
  receivedAt: timestamp('received_at', { withTimezone: true }).notNull(),
  triagedAt: timestamp('triaged_at', { withTimezone: true }),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userIdStatusReceivedAtIdx: index('inbox_items_user_id_status_received_at_idx').on(table.userId, table.status, table.receivedAt.desc()),
  threadIdIdx: index('inbox_items_thread_id_idx').on(table.threadId),
}));

// Inbox Responses table - tracks outgoing replies
export const inboxResponses = pgTable('inbox_responses', {
  id: serial('id').primaryKey(),
  inboxItemId: integer('inbox_item_id').notNull().references(() => inboxItems.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => usersRef.id, { onDelete: 'cascade' }),
  responseBody: text('response_body').notNull(),
  responseType: varchar('response_type', { length: 30 }).notNull(), // 'manual', 'ai_generated', 'template', 'auto_approved'
  sentAt: timestamp('sent_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Triage Rules table - deterministic routing rules
export const triageRules = pgTable('triage_rules', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => usersRef.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  conditionType: varchar('condition_type', { length: 50 }).notNull(), // 'from_contains', 'subject_contains', 'body_contains', 'source_equals'
  conditionValue: text('condition_value').notNull(),
  action: varchar('action', { length: 50 }).notNull(), // 'assign_category', 'assign_agent', 'set_priority', 'auto_respond'
  actionValue: text('action_value').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  enabled: boolean('enabled').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Response Templates table - reusable AI-fillable templates
export const responseTemplates = pgTable('response_templates', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => usersRef.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  category: varchar('category', { length: 50 }),
  subjectTemplate: varchar('subject_template', { length: 500 }),
  bodyTemplate: text('body_template').notNull(),
  variables: jsonb('variables').notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
