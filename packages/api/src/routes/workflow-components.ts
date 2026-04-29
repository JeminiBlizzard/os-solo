/**
 * Workflow Components Routes
 *
 * API endpoints for managing workflow components (triggers, agents, actions).
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { db, schema } from '@os-solo/db';
import { eq, and, desc, or, isNull } from 'drizzle-orm';
import { ok, fail } from '../lib/response.js';

const router: Router = Router();

/**
 * GET /api/v1/workflow-components
 * List available workflow components (builtin + user-created).
 */
router.get('/', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const type = req.query.type as string | undefined;

  const conditions = [
    or(
      eq(schema.workflowComponents.isBuiltin, true),
      eq(schema.workflowComponents.userId, req.user.id)
    ),
  ];

  if (type) {
    conditions.push(eq(schema.workflowComponents.type, type));
  }

  const components = await db
    .select({
      id: schema.workflowComponents.id,
      type: schema.workflowComponents.type,
      name: schema.workflowComponents.name,
      description: schema.workflowComponents.description,
      icon: schema.workflowComponents.icon,
      defaultConfig: schema.workflowComponents.defaultConfig,
      isBuiltin: schema.workflowComponents.isBuiltin,
      createdAt: schema.workflowComponents.createdAt,
    })
    .from(schema.workflowComponents)
    .where(and(...conditions))
    .orderBy(schema.workflowComponents.type, schema.workflowComponents.name);

  res.json(ok({ components }));
});

/**
 * GET /api/v1/workflow-components/:id
 * Get a specific workflow component by ID.
 */
router.get('/:id', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const id = parseInt(req.params.id as string, 10);

  if (isNaN(id)) {
    res.status(400).json(fail('INVALID_ID', 'Component ID must be a number'));
    return;
  }

  const components = await db
    .select()
    .from(schema.workflowComponents)
    .where(
      and(
        eq(schema.workflowComponents.id, id),
        or(
          eq(schema.workflowComponents.isBuiltin, true),
          eq(schema.workflowComponents.userId, req.user.id)
        )
      )
    )
    .limit(1);

  if (components.length === 0) {
    res.status(404).json(fail('NOT_FOUND', 'Component not found'));
    return;
  }

  res.json(ok({ component: components[0] }));
});

/**
 * POST /api/v1/workflow-components
 * Create a new custom workflow component.
 */
router.post('/', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const { type, name, description, icon, defaultConfig } = req.body;

  // Validate required fields
  if (!type || !name) {
    res.status(400).json(fail('VALIDATION_ERROR', 'Type and name are required'));
    return;
  }

  // Validate type
  if (!['trigger', 'agent', 'action'].includes(type)) {
    res.status(400).json(fail('INVALID_TYPE', 'Type must be trigger, agent, or action'));
    return;
  }

  try {
    const [newComponent] = await db
      .insert(schema.workflowComponents)
      .values({
        userId: req.user.id,
        type,
        name: name.trim(),
        description: description?.trim() || null,
        icon: icon?.trim() || null,
        defaultConfig: defaultConfig || {},
        isBuiltin: false,
      })
      .returning();

    res.status(201).json(ok({ component: newComponent }));
  } catch (error) {
    res.status(500).json(fail('CREATE_FAILED', 'Failed to create component'));
  }
});

export default router;
