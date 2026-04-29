import { pgTable, serial, varchar, text, integer, boolean, timestamp, jsonb, index, unique } from 'drizzle-orm/pg-core';

// Reference to users and agents tables - avoid importing to prevent module resolution issues
const usersRef = pgTable('users', { id: serial('id').primaryKey() });
const agentsRef = pgTable('agents', { id: serial('id').primaryKey() });

// Agent Workflows table - Visual workflow configurations for agents
export const agentWorkflows = pgTable('agent_workflows', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => usersRef.id, { onDelete: 'cascade' }),
  agentId: integer('agent_id').notNull().references(() => agentsRef.id, { onDelete: 'cascade' }),
  nodes: jsonb('nodes').notNull().default([]), // Array of workflow nodes {id, type, position, data}
  edges: jsonb('edges').notNull().default([]), // Array of edges {id, source, target, sourceHandle, targetHandle}
  isActive: boolean('is_active').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  uniqueAgentId: unique('agent_workflows_agent_id_unique').on(table.agentId),
  userIdIdx: index('agent_workflows_user_id_idx').on(table.userId),
  agentIdIdx: index('agent_workflows_agent_id_idx').on(table.agentId),
}));

// Workflow Components table - Available components for building workflows
export const workflowComponents = pgTable('workflow_components', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => usersRef.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 20 }).notNull(), // 'trigger', 'agent', 'action'
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  icon: varchar('icon', { length: 50 }), // Lucide icon name
  defaultConfig: jsonb('default_config').notNull().default({}),
  isBuiltin: boolean('is_builtin').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  typeIdx: index('workflow_components_type_idx').on(table.type),
  isBuiltinIdx: index('workflow_components_is_builtin_idx').on(table.isBuiltin),
}));
