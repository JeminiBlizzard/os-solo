/**
 * Inbox Routes
 *
 * API endpoints for inbox management, triage, and responses.
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { db, schema } from '@os-solo/db';
import { eq, and, desc, asc, inArray, or, ilike, sql, ne } from 'drizzle-orm';
import { ok, fail } from '../lib/response.js';
import { triageInboxItem, bulkTriage } from '../services/triage.js';
import { validateTransition } from '../inbox/status-transitions.js';

const router: Router = Router();

// ========== Inbox Items ==========

/**
 * GET /api/v1/inbox
 * List inbox items with filtering and pagination.
 * Default: returns status IN (new, triaged, in_progress) sorted by received_at DESC.
 */
router.get('/', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const limit = Math.min(parseInt(req.query.limit as string, 10) || 50, 100);
  const offset = parseInt(req.query.offset as string, 10) || 0;
  const status = req.query.status as string | undefined;
  const source = req.query.source as string | undefined;
  const category = req.query.category as string | undefined;
  const priority = req.query.priority as string | undefined;
  const search = req.query.search as string | undefined;

  // Build where conditions
  const conditions = [eq(schema.inboxItems.userId, req.user.id)];

  // Status filter: if provided use exact match, otherwise default to non-archived/non-resolved
  if (status) {
    conditions.push(eq(schema.inboxItems.status, status));
  } else {
    conditions.push(inArray(schema.inboxItems.status, ['new', 'triaged', 'in_progress']));
  }

  // Source filter
  if (source) {
    conditions.push(eq(schema.inboxItems.source, source));
  }

  if (category) {
    conditions.push(eq(schema.inboxItems.category, category));
  }
  if (priority) {
    conditions.push(eq(schema.inboxItems.priority, priority));
  }

  // Search: ILIKE on subject + from_name + substring(body, 0, 500)
  if (search) {
    conditions.push(
      or(
        ilike(schema.inboxItems.subject, `%${search}%`),
        ilike(schema.inboxItems.fromName, `%${search}%`),
        sql`SUBSTRING(${schema.inboxItems.body}, 1, 500) ILIKE ${'%' + search + '%'}`
      )!
    );
  }

  const items = await db
    .select({
      id: schema.inboxItems.id,
      source: schema.inboxItems.source,
      fromAddress: schema.inboxItems.fromAddress,
      fromName: schema.inboxItems.fromName,
      subject: schema.inboxItems.subject,
      category: schema.inboxItems.category,
      priority: schema.inboxItems.priority,
      status: schema.inboxItems.status,
      aiTriageSummary: schema.inboxItems.aiTriageSummary,
      aiConfidence: schema.inboxItems.aiConfidence,
      receivedAt: schema.inboxItems.receivedAt,
      triagedAt: schema.inboxItems.triagedAt,
    })
    .from(schema.inboxItems)
    .where(and(...conditions))
    .orderBy(desc(schema.inboxItems.receivedAt))
    .limit(limit)
    .offset(offset);

  // Get total count using SQL COUNT(*)
  const countResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.inboxItems)
    .where(and(...conditions));

  const total = countResult[0]?.count ?? 0;

  res.json(
    ok({
      data: items,
      total,
      limit,
      offset,
    })
  );
});

/**
 * GET /api/v1/inbox/:id
 * Get a specific inbox item with full details including thread siblings.
 */
router.get('/:id', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const itemId = parseInt(req.params.id as string, 10);
  if (isNaN(itemId)) {
    res.status(400).json(fail('INVALID_REQUEST', 'Invalid item ID'));
    return;
  }

  const item = await db.query.inboxItems.findFirst({
    where: and(
      eq(schema.inboxItems.id, itemId),
      eq(schema.inboxItems.userId, req.user.id)
    ),
  });

  if (!item) {
    res.status(404).json(fail('NOT_FOUND', 'Inbox item not found'));
    return;
  }

  // Get responses for this item
  const responses = await db
    .select()
    .from(schema.inboxResponses)
    .where(eq(schema.inboxResponses.inboxItemId, itemId))
    .orderBy(asc(schema.inboxResponses.createdAt));

  // Get thread siblings (items sharing the same thread_id, ordered by received_at ASC)
  let thread: typeof item[] = [];
  if (item.threadId) {
    thread = await db
      .select()
      .from(schema.inboxItems)
      .where(
        and(
          eq(schema.inboxItems.userId, req.user.id),
          eq(schema.inboxItems.threadId, item.threadId),
          ne(schema.inboxItems.id, itemId)
        )
      )
      .orderBy(asc(schema.inboxItems.receivedAt));
  }

  res.json(ok({
    data: {
      ...item,
      ai_draft_response: item.aiDraftResponse,
      ai_confidence: item.aiConfidence,
      ai_triage_summary: item.aiTriageSummary,
    },
    thread,
    responses,
  }));
});

/**
 * PATCH /api/v1/inbox/:id
 * Update an inbox item (status, category, priority, assigned_agent_id, ai_draft_response).
 * Status transitions are validated.
 */
router.patch('/:id', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const itemId = parseInt(req.params.id as string, 10);
  if (isNaN(itemId)) {
    res.status(400).json(fail('INVALID_REQUEST', 'Invalid item ID'));
    return;
  }

  // Verify ownership
  const existing = await db.query.inboxItems.findFirst({
    where: and(
      eq(schema.inboxItems.id, itemId),
      eq(schema.inboxItems.userId, req.user.id)
    ),
  });

  if (!existing) {
    res.status(404).json(fail('NOT_FOUND', 'Inbox item not found'));
    return;
  }

  const { status, category, priority, assignedAgentId, ai_draft_response } = req.body;

  // Validate status transition if status is being changed
  if (status !== undefined && status !== existing.status) {
    const error = validateTransition(existing.status, status);
    if (error) {
      res.status(400).json(fail('INVALID_TRANSITION', error));
      return;
    }
  }

  const updates: Partial<typeof schema.inboxItems.$inferInsert> = {};

  if (status !== undefined) updates.status = status;
  if (category !== undefined) updates.category = category;
  if (priority !== undefined) updates.priority = priority;
  if (assignedAgentId !== undefined) updates.assignedAgentId = assignedAgentId;
  if (ai_draft_response !== undefined) updates.aiDraftResponse = ai_draft_response;

  // Set timestamps based on status changes
  if (status === 'triaged' && !existing.triagedAt) {
    updates.triagedAt = new Date();
  }
  if (status === 'resolved' && !existing.resolvedAt) {
    updates.resolvedAt = new Date();
  }

  const [updated] = await db
    .update(schema.inboxItems)
    .set(updates)
    .where(eq(schema.inboxItems.id, itemId))
    .returning();

  // Trigger agent if assigned_agent_id was set and is different from existing
  if (assignedAgentId !== undefined && assignedAgentId !== existing.assignedAgentId && assignedAgentId !== null) {
    // Import executeAgent dynamically to avoid circular dependencies
    try {
      const { executeAgent } = await import('../services/agent-runtime.js');
      // Run agent with delegation trigger and inbox item as context
      executeAgent(req.user.id, assignedAgentId, {
        triggeredBy: 'event',
        message: `Process inbox item: ${existing.subject || 'No subject'}`,
        context: {
          inboxItemId: itemId,
          source: existing.source,
          fromAddress: existing.fromAddress,
          fromName: existing.fromName,
          subject: existing.subject,
          body: existing.body,
          priority: updated?.priority ?? existing.priority,
          triggerType: 'delegation',
        },
      }).catch((err: Error) => {
        console.error(`Failed to trigger agent ${assignedAgentId} for inbox item ${itemId}:`, err);
      });
    } catch {
      // agent-runtime may not be available, log and continue
      console.warn('Agent runtime not available, skipping agent trigger');
    }
  }

  res.json(ok({ data: updated }));
});

/**
 * DELETE /api/v1/inbox/:id
 * Delete an inbox item.
 */
router.delete('/:id', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const itemId = parseInt(req.params.id as string, 10);
  if (isNaN(itemId)) {
    res.status(400).json(fail('INVALID_REQUEST', 'Invalid item ID'));
    return;
  }

  // Verify ownership
  const existing = await db.query.inboxItems.findFirst({
    where: and(
      eq(schema.inboxItems.id, itemId),
      eq(schema.inboxItems.userId, req.user.id)
    ),
  });

  if (!existing) {
    res.status(404).json(fail('NOT_FOUND', 'Inbox item not found'));
    return;
  }

  await db.delete(schema.inboxItems).where(eq(schema.inboxItems.id, itemId));

  res.json(ok({ message: 'Item deleted' }));
});

// ========== Triage ==========

/**
 * POST /api/v1/inbox/:id/triage
 * Trigger triage for a single item.
 */
router.post('/:id/triage', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const itemId = parseInt(req.params.id as string, 10);
  if (isNaN(itemId)) {
    res.status(400).json(fail('INVALID_REQUEST', 'Invalid item ID'));
    return;
  }

  // Verify ownership
  const existing = await db.query.inboxItems.findFirst({
    where: and(
      eq(schema.inboxItems.id, itemId),
      eq(schema.inboxItems.userId, req.user.id)
    ),
  });

  if (!existing) {
    res.status(404).json(fail('NOT_FOUND', 'Inbox item not found'));
    return;
  }

  const useAi = req.body.useAi !== false; // Default to true

  const result = await triageInboxItem(itemId, useAi);

  res.json(ok({ triage: result }));
});

/**
 * POST /api/v1/inbox/bulk-triage
 * Trigger triage for multiple items.
 */
router.post('/bulk-triage', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const { itemIds, useAi = true } = req.body;

  if (!Array.isArray(itemIds) || itemIds.length === 0) {
    res.status(400).json(fail('INVALID_REQUEST', 'itemIds array is required'));
    return;
  }

  // Verify ownership of all items
  const items = await db
    .select({ id: schema.inboxItems.id })
    .from(schema.inboxItems)
    .where(
      and(
        eq(schema.inboxItems.userId, req.user.id),
        inArray(schema.inboxItems.id, itemIds)
      )
    );

  const validIds = items.map((i) => i.id);

  if (validIds.length === 0) {
    res.status(404).json(fail('NOT_FOUND', 'No valid items found'));
    return;
  }

  const results = await bulkTriage(validIds, useAi);

  res.json(
    ok({
      triaged: validIds.length,
      results: Object.fromEntries(results),
    })
  );
});

// ========== Responses ==========

/**
 * POST /api/v1/inbox/:id/respond
 * Create and send a response to an inbox item.
 * Returns 409 if already responded, 410 if archived.
 */
router.post('/:id/respond', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const itemId = parseInt(req.params.id as string, 10);
  if (isNaN(itemId)) {
    res.status(400).json(fail('INVALID_REQUEST', 'Invalid item ID'));
    return;
  }

  const { response_body, responseBody: legacyBody, responseType = 'manual' } = req.body;
  const body = response_body || legacyBody;

  if (!body || typeof body !== 'string') {
    res.status(400).json(fail('INVALID_REQUEST', 'response_body is required'));
    return;
  }

  // Verify ownership
  const item = await db.query.inboxItems.findFirst({
    where: and(
      eq(schema.inboxItems.id, itemId),
      eq(schema.inboxItems.userId, req.user.id)
    ),
  });

  if (!item) {
    res.status(404).json(fail('NOT_FOUND', 'Inbox item not found'));
    return;
  }

  // Check if item is archived
  if (item.status === 'archived') {
    res.status(410).json(fail('GONE', 'Cannot respond to archived item'));
    return;
  }

  // Check if already responded
  if (item.status === 'responded') {
    res.status(409).json(fail('ALREADY_RESPONDED', 'Already responded to this item'));
    return;
  }

  // Create response record
  const [responseRecord] = await db
    .insert(schema.inboxResponses)
    .values({
      inboxItemId: itemId,
      userId: req.user.id,
      responseBody: body,
      responseType,
      sentAt: new Date(),
    })
    .returning();

  // Update item status to 'responded'
  const [updatedItem] = await db
    .update(schema.inboxItems)
    .set({ status: 'responded' })
    .where(eq(schema.inboxItems.id, itemId))
    .returning();

  res.status(200).json(ok({
    data: {
      response: responseRecord,
      item: updatedItem,
      status: 'responded',
    },
  }));
});

// ========== Stats ==========

/**
 * GET /api/v1/inbox/stats
 * Get inbox statistics.
 */
router.get('/stats', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  // Count by status
  const byStatus = await db
    .select({
      status: schema.inboxItems.status,
      count: schema.inboxItems.id,
    })
    .from(schema.inboxItems)
    .where(eq(schema.inboxItems.userId, req.user.id));

  // Count by category
  const byCategory = await db
    .select({
      category: schema.inboxItems.category,
      count: schema.inboxItems.id,
    })
    .from(schema.inboxItems)
    .where(eq(schema.inboxItems.userId, req.user.id));

  // Count by priority
  const byPriority = await db
    .select({
      priority: schema.inboxItems.priority,
      count: schema.inboxItems.id,
    })
    .from(schema.inboxItems)
    .where(eq(schema.inboxItems.userId, req.user.id));

  res.json(
    ok({
      byStatus: Object.fromEntries(byStatus.map((r) => [r.status ?? 'unknown', 1])),
      byCategory: Object.fromEntries(byCategory.map((r) => [r.category ?? 'unknown', 1])),
      byPriority: Object.fromEntries(byPriority.map((r) => [r.priority ?? 'unknown', 1])),
    })
  );
});

export default router;
