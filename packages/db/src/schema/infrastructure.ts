import { pgTable, serial, varchar, text, integer, boolean, timestamp, jsonb, index, unique, foreignKey } from 'drizzle-orm/pg-core';

// Reference to users table - avoid importing to prevent module resolution issues
const usersRef = pgTable('users', { id: serial('id').primaryKey() });

// Servers table - VPS endpoints
export const servers = pgTable('servers', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => usersRef.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  hostname: varchar('hostname', { length: 255 }).notNull(),
  ipAddress: varchar('ip_address', { length: 45 }),
  provider: varchar('provider', { length: 100 }), // 'digitalocean', 'aws', 'hetzner', 'custom'
  mcpEndpoint: varchar('mcp_endpoint', { length: 500 }),
  status: varchar('status', { length: 20 }).notNull().default('unknown'), // 'healthy', 'degraded', 'down', 'unknown'
  os: varchar('os', { length: 100 }),
  monthlyCostCents: integer('monthly_cost_cents'),
  notes: text('notes'),
  lastCheckedAt: timestamp('last_checked_at', { withTimezone: true }),
  lastHealthyAt: timestamp('last_healthy_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Containers table - discovered containers per server
export const containers = pgTable('containers', {
  id: serial('id').primaryKey(),
  serverId: integer('server_id').notNull().references(() => servers.id, { onDelete: 'cascade' }),
  containerId: varchar('container_id', { length: 255 }).notNull(), // Docker container ID
  name: varchar('name', { length: 255 }).notNull(),
  image: varchar('image', { length: 500 }).notNull(),
  status: varchar('status', { length: 30 }).notNull(), // 'running', 'stopped', 'paused', 'exited'
  ports: jsonb('ports').notNull().default([]),
  createdAtDocker: varchar('created_at_docker', { length: 100 }), // Preserve Docker's timestamp format
  discoveredAt: timestamp('discovered_at', { withTimezone: true }).notNull(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull(),
}, (table) => ({
  uniqueServerContainer: unique('containers_server_id_container_id_unique').on(table.serverId, table.containerId),
}));

// Server Incidents table - detected issues with optional similarity linking
export const serverIncidents = pgTable('server_incidents', {
  id: serial('id').primaryKey(),
  serverId: integer('server_id').notNull().references(() => servers.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => usersRef.id, { onDelete: 'cascade' }),
  severity: varchar('severity', { length: 20 }).notNull(), // 'critical', 'high', 'medium', 'low', 'info'
  title: varchar('title', { length: 500 }).notNull(),
  description: text('description'),
  status: varchar('status', { length: 20 }).notNull().default('open'), // 'open', 'acknowledged', 'resolved', 'closed'
  aiAnalysis: text('ai_analysis'),
  similarIncidentId: integer('similar_incident_id'),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
  acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
}, (table) => ({
  serverIdStatusStartedAtIdx: index('server_incidents_server_id_status_started_at_idx').on(table.serverId, table.status, table.startedAt.desc()),
  similarIncidentFk: foreignKey({
    columns: [table.similarIncidentId],
    foreignColumns: [table.id],
  }).onDelete('set null'),
}));

// Caddy Routes table - discovered reverse proxy routes
export const caddyRoutes = pgTable('caddy_routes', {
  id: serial('id').primaryKey(),
  serverId: integer('server_id').notNull().references(() => servers.id, { onDelete: 'cascade' }),
  domain: varchar('domain', { length: 255 }).notNull(),
  upstream: varchar('upstream', { length: 500 }).notNull(),
  tls: boolean('tls').notNull().default(true),
  discoveredAt: timestamp('discovered_at', { withTimezone: true }).notNull(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull(),
}, (table) => ({
  uniqueServerDomain: unique('caddy_routes_server_id_domain_unique').on(table.serverId, table.domain),
}));
