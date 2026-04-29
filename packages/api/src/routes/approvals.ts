/**
 * Approval Queue Routes
 *
 * API endpoints for managing agent approval queue items.
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { db, schema } from '@os-solo/db';
import { eq, and, desc, lt, ne } from 'drizzle-orm';
import { ok, fail } from '../lib/response.js';
import { executeApprovedRun } from '../services/approval-executor.js';

const router: Router = Router();

/**
 * GET /api/v1/approvals
 * List pending approval queue items for the authenticated user.
 */
router.get('/', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const status = (req.query.status as string) ?? 'pending';
  const limit = Math.min(parseInt(req.query.limit as string, 10) || 20, 100);
  const offset = parseInt(req.query.offset as string, 10) || 0;

  const items = await db
    .select({
      id: schema.approvalQueue.id,
      agentId: schema.approvalQueue.agentId,
      actionType: schema.approvalQueue.actionType,
      title: schema.approvalQueue.title,
      description: schema.approvalQueue.description,
      proposedOutput: schema.approvalQueue.proposedOutput,
      confidenceScore: schema.approvalQueue.confidenceScore,
      status: schema.approvalQueue.status,
      context: schema.approvalQueue.context,
      reviewedAt: schema.approvalQueue.reviewedAt,
      reviewNotes: schema.approvalQueue.reviewNotes,
      expiresAt: schema.approvalQueue.expiresAt,
      createdAt: schema.approvalQueue.createdAt,
    })
    .from(schema.approvalQueue)
    .where(
      and(
        eq(schema.approvalQueue.userId, req.user.id),
        eq(schema.approvalQueue.status, status)
      )
    )
    .orderBy(desc(schema.approvalQueue.createdAt))
    .limit(limit)
    .offset(offset);

  // Get total count for pagination
  const countResult = await db
    .select({ count: db.$count(schema.approvalQueue) })
    .from(schema.approvalQueue)
    .where(
      and(
        eq(schema.approvalQueue.userId, req.user.id),
        eq(schema.approvalQueue.status, status)
      )
    );

  const total = countResult[0]?.count ?? 0;

  res.json(ok({ items, total, limit, offset }));
});

/**
 * GET /api/v1/approvals/count
 * Get count of pending approvals.
 */
router.get('/count', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const countResult = await db
    .select({ count: db.$count(schema.approvalQueue) })
    .from(schema.approvalQueue)
    .where(
      and(
        eq(schema.approvalQueue.userId, req.user.id),
        eq(schema.approvalQueue.status, 'pending')
      )
    );

  const count = countResult[0]?.count ?? 0;

  res.json(ok({ count }));
});

/**
 * GET /api/v1/approvals/:id
 * Get a specific approval queue item.
 */
router.get('/:id', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const approvalId = parseInt(req.params.id as string, 10);
  if (isNaN(approvalId)) {
    res.status(400).json(fail('INVALID_REQUEST', 'Invalid approval ID'));
    return;
  }

  const item = await db.query.approvalQueue.findFirst({
    where: and(
      eq(schema.approvalQueue.id, approvalId),
      eq(schema.approvalQueue.userId, req.user.id)
    ),
  });

  if (!item) {
    res.status(404).json(fail('NOT_FOUND', 'Approval item not found'));
    return;
  }

  // Also get the associated agent info
  const agent = await db.query.agents.findFirst({
    where: eq(schema.agents.id, item.agentId),
  });

  // Get the associated run if any
  const run = await db.query.agentRuns.findFirst({
    where: eq(schema.agentRuns.approvalQueueId, approvalId),
  });

  res.json(ok({ item, agent: agent ? { id: agent.id, name: agent.name } : null, run }));
});

/**
 * POST /api/v1/approvals/:id/approve
 * Approve a pending item.
 */
router.post('/:id/approve', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const approvalId = parseInt(req.params.id as string, 10);
  if (isNaN(approvalId)) {
    res.status(400).json(fail('INVALID_REQUEST', 'Invalid approval ID'));
    return;
  }

  const { notes } = req.body;

  // Get the approval item
  const item = await db.query.approvalQueue.findFirst({
    where: and(
      eq(schema.approvalQueue.id, approvalId),
      eq(schema.approvalQueue.userId, req.user.id)
    ),
  });

  if (!item) {
    res.status(404).json(fail('NOT_FOUND', 'Approval item not found'));
    return;
  }

  if (item.status !== 'pending') {
    res.status(400).json(fail('INVALID_STATE', `Item is already ${item.status}`));
    return;
  }

  // Check if expired
  if (new Date() > item.expiresAt) {
    await db
      .update(schema.approvalQueue)
      .set({ status: 'expired' })
      .where(eq(schema.approvalQueue.id, approvalId));

    res.status(400).json(fail('EXPIRED', 'Approval item has expired'));
    return;
  }

  // Update the approval queue entry
  const [updated] = await db
    .update(schema.approvalQueue)
    .set({
      status: 'approved',
      reviewedAt: new Date(),
      reviewNotes: notes ?? null,
    })
    .where(eq(schema.approvalQueue.id, approvalId))
    .returning();

  // Execute the approved run
  const executeImmediately = req.body.execute !== false; // Default to executing immediately
  let runResult = null;

  if (executeImmediately) {
    runResult = await executeApprovedRun(approvalId, req.user.id);
  }

  res.json(ok({ item: updated, run: runResult }));
});

/**
 * POST /api/v1/approvals/:id/reject
 * Reject a pending item.
 */
router.post('/:id/reject', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const approvalId = parseInt(req.params.id as string, 10);
  if (isNaN(approvalId)) {
    res.status(400).json(fail('INVALID_REQUEST', 'Invalid approval ID'));
    return;
  }

  const { notes } = req.body;

  // Get the approval item
  const item = await db.query.approvalQueue.findFirst({
    where: and(
      eq(schema.approvalQueue.id, approvalId),
      eq(schema.approvalQueue.userId, req.user.id)
    ),
  });

  if (!item) {
    res.status(404).json(fail('NOT_FOUND', 'Approval item not found'));
    return;
  }

  if (item.status !== 'pending') {
    res.status(400).json(fail('INVALID_STATE', `Item is already ${item.status}`));
    return;
  }

  // Update the approval queue entry
  const [updated] = await db
    .update(schema.approvalQueue)
    .set({
      status: 'rejected',
      reviewedAt: new Date(),
      reviewNotes: notes ?? null,
    })
    .where(eq(schema.approvalQueue.id, approvalId))
    .returning();

  // Also update the associated run if any
  await db
    .update(schema.agentRuns)
    .set({
      status: 'cancelled',
      completedAt: new Date(),
      error: 'Approval rejected',
    })
    .where(eq(schema.agentRuns.approvalQueueId, approvalId));

  res.json(ok({ item: updated }));
});

/**
 * DELETE /api/v1/approvals/:id
 * Delete an approval queue item (only if not pending).
 */
router.delete('/:id', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const approvalId = parseInt(req.params.id as string, 10);
  if (isNaN(approvalId)) {
    res.status(400).json(fail('INVALID_REQUEST', 'Invalid approval ID'));
    return;
  }

  const item = await db.query.approvalQueue.findFirst({
    where: and(
      eq(schema.approvalQueue.id, approvalId),
      eq(schema.approvalQueue.userId, req.user.id)
    ),
  });

  if (!item) {
    res.status(404).json(fail('NOT_FOUND', 'Approval item not found'));
    return;
  }

  if (item.status === 'pending') {
    res.status(400).json(fail('INVALID_STATE', 'Cannot delete pending approval items'));
    return;
  }

  await db.delete(schema.approvalQueue).where(eq(schema.approvalQueue.id, approvalId));

  res.json(ok({ message: 'Approval item deleted' }));
});

export default router;
