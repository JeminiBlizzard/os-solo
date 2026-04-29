import { pgTable, serial, varchar, text, integer, timestamp, jsonb, index, pgEnum } from 'drizzle-orm/pg-core';

// Reference to users table from foundation.ts
const usersRef = pgTable('users', { id: serial('id').primaryKey() });

// Actor type enum: who/what performed the action
export const actorTypeEnum = pgEnum('actor_type', ['human', 'agent', 'system']);

// Domain enum: which part of the system the action occurred in
export const auditDomainEnum = pgEnum('audit_domain', [
  'agents',
  'inbox',
  'infrastructure',
  'finance',
  'projects',
  'vault',
  'settings',
  'auth'
]);

// Action enum: what type of action was performed
export const auditActionEnum = pgEnum('audit_action', [
  'create',
  'update',
  'delete',
  'read',
  'execute',
  'approve',
  'reject',
  'login',
  'logout',
  'export',
  'import'
]);

// Audit Log table - append-only table capturing all state-changing actions
export const auditLog = pgTable('audit_log', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => usersRef.id, { onDelete: 'set null' }),
  actor: varchar('actor', { length: 255 }).notNull(), // Display name or identifier of the actor
  actorType: actorTypeEnum('actor_type').notNull(),
  domain: auditDomainEnum('domain').notNull(),
  action: auditActionEnum('action').notNull(),
  resourceType: varchar('resource_type', { length: 100 }), // e.g., 'agent', 'invoice', 'server'
  resourceId: varchar('resource_id', { length: 100 }), // ID of the resource affected (nullable)
  description: text('description').notNull(), // Human-readable description of the action
  metadata: jsonb('metadata').notNull().default({}), // Additional context (sanitized, no secrets)
  ipAddress: varchar('ip_address', { length: 45 }), // IPv4 or IPv6
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  // Index for querying by user and time
  userIdCreatedAtIdx: index('audit_log_user_id_created_at_idx').on(table.userId, table.createdAt.desc()),
  // Index for querying by domain and time
  domainCreatedAtIdx: index('audit_log_domain_created_at_idx').on(table.domain, table.createdAt.desc()),
}));
