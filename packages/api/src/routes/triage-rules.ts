/**
 * Triage Rules Routes
 *
 * API endpoints for managing inbox triage rules.
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { db, schema } from '@os-solo/db';
import { eq, and, asc } from 'drizzle-orm';
import { ok, fail } from '../lib/response.js';

const router: Router = Router();

/**
 * GET /api/v1/triage-rules
 * List all triage rules for the user.
 */
router.get('/', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const rules = await db
    .select()
    .from(schema.triageRules)
    .where(eq(schema.triageRules.userId, req.user.id))
    .orderBy(asc(schema.triageRules.sortOrder));

  res.json(ok({ rules }));
});

/**
 * POST /api/v1/triage-rules
 * Create a new triage rule.
 */
router.post('/', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const {
    name,
    conditionType,
    conditionValue,
    action,
    actionValue,
    sortOrder = 0,
    enabled = true,
  } = req.body;

  if (!name || typeof name !== 'string') {
    res.status(400).json(fail('INVALID_REQUEST', 'Name is required'));
    return;
  }

  const validConditionTypes = [
    'from_contains',
    'subject_contains',
    'body_contains',
    'source_equals',
  ];
  if (!validConditionTypes.includes(conditionType)) {
    res
      .status(400)
      .json(fail('INVALID_REQUEST', `conditionType must be one of: ${validConditionTypes.join(', ')}`));
    return;
  }

  const validActions = ['assign_category', 'assign_agent', 'set_priority', 'auto_respond'];
  if (!validActions.includes(action)) {
    res
      .status(400)
      .json(fail('INVALID_REQUEST', `action must be one of: ${validActions.join(', ')}`));
    return;
  }

  if (!conditionValue || typeof conditionValue !== 'string') {
    res.status(400).json(fail('INVALID_REQUEST', 'conditionValue is required'));
    return;
  }

  if (!actionValue || typeof actionValue !== 'string') {
    res.status(400).json(fail('INVALID_REQUEST', 'actionValue is required'));
    return;
  }

  const [rule] = await db
    .insert(schema.triageRules)
    .values({
      userId: req.user.id,
      name,
      conditionType,
      conditionValue,
      action,
      actionValue,
      sortOrder,
      enabled,
    })
    .returning();

  res.status(201).json(ok({ rule }));
});

/**
 * GET /api/v1/triage-rules/:id
 * Get a specific triage rule.
 */
router.get('/:id', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const ruleId = parseInt(req.params.id as string, 10);
  if (isNaN(ruleId)) {
    res.status(400).json(fail('INVALID_REQUEST', 'Invalid rule ID'));
    return;
  }

  const rule = await db.query.triageRules.findFirst({
    where: and(
      eq(schema.triageRules.id, ruleId),
      eq(schema.triageRules.userId, req.user.id)
    ),
  });

  if (!rule) {
    res.status(404).json(fail('NOT_FOUND', 'Rule not found'));
    return;
  }

  res.json(ok({ rule }));
});

/**
 * PATCH /api/v1/triage-rules/:id
 * Update a triage rule.
 */
router.patch('/:id', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const ruleId = parseInt(req.params.id as string, 10);
  if (isNaN(ruleId)) {
    res.status(400).json(fail('INVALID_REQUEST', 'Invalid rule ID'));
    return;
  }

  // Verify ownership
  const existing = await db.query.triageRules.findFirst({
    where: and(
      eq(schema.triageRules.id, ruleId),
      eq(schema.triageRules.userId, req.user.id)
    ),
  });

  if (!existing) {
    res.status(404).json(fail('NOT_FOUND', 'Rule not found'));
    return;
  }

  const {
    name,
    conditionType,
    conditionValue,
    action,
    actionValue,
    sortOrder,
    enabled,
  } = req.body;

  const updates: Partial<typeof schema.triageRules.$inferInsert> = {};

  if (name !== undefined) updates.name = name;
  if (conditionType !== undefined) updates.conditionType = conditionType;
  if (conditionValue !== undefined) updates.conditionValue = conditionValue;
  if (action !== undefined) updates.action = action;
  if (actionValue !== undefined) updates.actionValue = actionValue;
  if (sortOrder !== undefined) updates.sortOrder = sortOrder;
  if (enabled !== undefined) updates.enabled = enabled;

  const [rule] = await db
    .update(schema.triageRules)
    .set(updates)
    .where(eq(schema.triageRules.id, ruleId))
    .returning();

  res.json(ok({ rule }));
});

/**
 * DELETE /api/v1/triage-rules/:id
 * Delete a triage rule.
 */
router.delete('/:id', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const ruleId = parseInt(req.params.id as string, 10);
  if (isNaN(ruleId)) {
    res.status(400).json(fail('INVALID_REQUEST', 'Invalid rule ID'));
    return;
  }

  // Verify ownership
  const existing = await db.query.triageRules.findFirst({
    where: and(
      eq(schema.triageRules.id, ruleId),
      eq(schema.triageRules.userId, req.user.id)
    ),
  });

  if (!existing) {
    res.status(404).json(fail('NOT_FOUND', 'Rule not found'));
    return;
  }

  await db.delete(schema.triageRules).where(eq(schema.triageRules.id, ruleId));

  res.json(ok({ message: 'Rule deleted' }));
});

/**
 * POST /api/v1/triage-rules/reorder
 * Reorder triage rules.
 */
router.post('/reorder', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const { ruleIds } = req.body;

  if (!Array.isArray(ruleIds)) {
    res.status(400).json(fail('INVALID_REQUEST', 'ruleIds array is required'));
    return;
  }

  // Update sort orders
  for (let i = 0; i < ruleIds.length; i++) {
    await db
      .update(schema.triageRules)
      .set({ sortOrder: i })
      .where(
        and(
          eq(schema.triageRules.id, ruleIds[i]),
          eq(schema.triageRules.userId, req.user.id)
        )
      );
  }

  res.json(ok({ message: 'Rules reordered' }));
});

export default router;
