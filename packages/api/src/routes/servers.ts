/**
 * Server Routes
 *
 * CRUD operations for the servers table.
 * Manages VPS endpoints with discovery capabilities.
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { db, schema } from '@os-solo/db';
import { eq, and, desc, sql } from 'drizzle-orm';
import { ok, fail } from '../lib/response.js';

const router: Router = Router();

// ========== Server CRUD ==========

/**
 * GET /api/v1/servers
 * List all servers for the authenticated user with status and container count.
 */
router.get('/', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const servers = await db
    .select({
      id: schema.servers.id,
      name: schema.servers.name,
      hostname: schema.servers.hostname,
      status: schema.servers.status,
      monthlyCostCents: schema.servers.monthlyCostCents,
      containerCount: sql<number>`(
        SELECT COUNT(*)::int
        FROM ${schema.containers}
        WHERE ${schema.containers.serverId} = ${schema.servers.id}
      )`,
    })
    .from(schema.servers)
    .where(eq(schema.servers.userId, req.user.id))
    .orderBy(desc(schema.servers.updatedAt));

  res.json(ok({ servers }));
});

/**
 * GET /api/v1/servers/:id
 * Get full server details including linked containers, caddy routes, and recent incidents.
 */
router.get('/:id', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const serverId = parseInt(req.params.id as string, 10);
  if (isNaN(serverId)) {
    res.status(400).json(fail('INVALID_REQUEST', 'Invalid server ID'));
    return;
  }

  // Get server details
  const server = await db.query.servers.findFirst({
    where: and(
      eq(schema.servers.id, serverId),
      eq(schema.servers.userId, req.user.id)
    ),
  });

  if (!server) {
    res.status(404).json(fail('NOT_FOUND', 'Server not found'));
    return;
  }

  // Get linked containers
  const containers = await db
    .select()
    .from(schema.containers)
    .where(eq(schema.containers.serverId, serverId))
    .orderBy(desc(schema.containers.lastSeenAt));

  // Get linked caddy routes
  const caddyRoutes = await db
    .select()
    .from(schema.caddyRoutes)
    .where(eq(schema.caddyRoutes.serverId, serverId))
    .orderBy(schema.caddyRoutes.domain);

  // Get recent incidents (last 10)
  const recentIncidents = await db
    .select()
    .from(schema.serverIncidents)
    .where(eq(schema.serverIncidents.serverId, serverId))
    .orderBy(desc(schema.serverIncidents.startedAt))
    .limit(10);

  res.json(ok({
    server: {
      ...server,
      containers,
      caddyRoutes,
      recentIncidents,
    }
  }));
});

/**
 * POST /api/v1/servers
 * Create a new server.
 */
router.post('/', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const {
    name,
    hostname,
    ipAddress,
    provider,
    mcpEndpoint,
    monthlyCostCents,
    notes,
  } = req.body;

  // Validate required fields
  if (!name || typeof name !== 'string') {
    res.status(400).json(fail('INVALID_REQUEST', 'Name is required'));
    return;
  }

  if (!hostname || typeof hostname !== 'string') {
    res.status(400).json(fail('INVALID_REQUEST', 'Hostname is required'));
    return;
  }

  // Validate mcpEndpoint is a valid URL if provided
  if (mcpEndpoint) {
    try {
      new URL(mcpEndpoint);
    } catch {
      res.status(400).json(fail('INVALID_REQUEST', 'MCP endpoint must be a valid URL'));
      return;
    }
  }

  const [server] = await db
    .insert(schema.servers)
    .values({
      userId: req.user.id,
      name,
      hostname,
      ipAddress: ipAddress ?? null,
      provider: provider ?? null,
      mcpEndpoint: mcpEndpoint ?? null,
      monthlyCostCents: monthlyCostCents ?? null,
      notes: notes ?? null,
    })
    .returning();

  res.status(201).json(ok({ server }));
});

/**
 * PATCH /api/v1/servers/:id
 * Update server fields.
 */
router.patch('/:id', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const serverId = parseInt(req.params.id as string, 10);
  if (isNaN(serverId)) {
    res.status(400).json(fail('INVALID_REQUEST', 'Invalid server ID'));
    return;
  }

  // Verify ownership
  const existing = await db.query.servers.findFirst({
    where: and(
      eq(schema.servers.id, serverId),
      eq(schema.servers.userId, req.user.id)
    ),
  });

  if (!existing) {
    res.status(404).json(fail('NOT_FOUND', 'Server not found'));
    return;
  }

  const {
    name,
    hostname,
    ipAddress,
    provider,
    mcpEndpoint,
    status,
    os,
    monthlyCostCents,
    notes,
  } = req.body;

  // Validate mcpEndpoint is a valid URL if provided
  if (mcpEndpoint !== undefined && mcpEndpoint !== null) {
    try {
      new URL(mcpEndpoint);
    } catch {
      res.status(400).json(fail('INVALID_REQUEST', 'MCP endpoint must be a valid URL'));
      return;
    }
  }

  // Build update object
  const updates: Partial<typeof schema.servers.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (name !== undefined) updates.name = name;
  if (hostname !== undefined) updates.hostname = hostname;
  if (ipAddress !== undefined) updates.ipAddress = ipAddress;
  if (provider !== undefined) updates.provider = provider;
  if (mcpEndpoint !== undefined) updates.mcpEndpoint = mcpEndpoint;
  if (status !== undefined) updates.status = status;
  if (os !== undefined) updates.os = os;
  if (monthlyCostCents !== undefined) updates.monthlyCostCents = monthlyCostCents;
  if (notes !== undefined) updates.notes = notes;

  const [server] = await db
    .update(schema.servers)
    .set(updates)
    .where(eq(schema.servers.id, serverId))
    .returning();

  res.json(ok({ server }));
});

/**
 * DELETE /api/v1/servers/:id
 * Soft-delete a server by setting status to 'offline'.
 */
router.delete('/:id', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const serverId = parseInt(req.params.id as string, 10);
  if (isNaN(serverId)) {
    res.status(400).json(fail('INVALID_REQUEST', 'Invalid server ID'));
    return;
  }

  // Verify ownership
  const existing = await db.query.servers.findFirst({
    where: and(
      eq(schema.servers.id, serverId),
      eq(schema.servers.userId, req.user.id)
    ),
  });

  if (!existing) {
    res.status(404).json(fail('NOT_FOUND', 'Server not found'));
    return;
  }

  // Soft delete by setting status to 'offline'
  await db
    .update(schema.servers)
    .set({
      status: 'offline',
      updatedAt: new Date(),
    })
    .where(eq(schema.servers.id, serverId));

  res.json(ok({ message: 'Server marked offline' }));
});

export default router;
