import { pgTable, serial, varchar, text, integer, timestamp, jsonb, index, unique } from 'drizzle-orm/pg-core';

// Reference to users table - avoid importing to prevent module resolution issues
const usersRef = pgTable('users', { id: serial('id').primaryKey() });

// Reference to servers table
const serversRef = pgTable('servers', { id: serial('id').primaryKey() });

// Projects table - project organization
export const projects = pgTable('projects', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => usersRef.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  status: varchar('status', { length: 20 }).notNull().default('active'), // 'active', 'archived'
  color: varchar('color', { length: 7 }), // Hex color code
  serverId: integer('server_id').references(() => serversRef.id, { onDelete: 'set null' }),
  stripeProductId: varchar('stripe_product_id', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Project Notes table - notes within projects
export const projectNotes = pgTable('project_notes', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => usersRef.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 500 }),
  body: text('body'),
  tags: jsonb('tags').notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  projectIdIdx: index('project_notes_project_id_idx').on(table.projectId),
}));

// Project Knowledge table - 1:1 relationship with projects containing technical context
export const projectKnowledge = pgTable('project_knowledge', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  version: varchar('version', { length: 50 }),
  techStack: text('tech_stack'),
  architecture: text('architecture'),
  conventions: text('conventions'),
  folderStructure: text('folder_structure'),
  authApproach: text('auth_approach'),
  errorHandling: text('error_handling'),
  hardConstraints: text('hard_constraints'),
  endStateVision: text('end_state_vision'),
  customFields: jsonb('custom_fields').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  uniqueProjectId: unique('project_knowledge_project_id_unique').on(table.projectId),
}));

// Project Activity table - activity log for projects
export const projectActivity = pgTable('project_activity', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 50 }).notNull(), // 'created', 'updated', 'note_added', 'agent_run', 'deployment', 'custom'
  description: text('description').notNull(),
  sourceType: varchar('source_type', { length: 50 }), // 'agent', 'user', 'system', 'integration'
  sourceId: integer('source_id'),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  projectIdCreatedAtIdx: index('project_activity_project_id_created_at_idx').on(table.projectId, table.createdAt.desc()),
}));
