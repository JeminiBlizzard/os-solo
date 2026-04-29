/**
 * Finance Routes
 *
 * Endpoints for MRR snapshots and revenue events.
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { db, schema } from '@os-solo/db';
import { eq, desc, sql } from 'drizzle-orm';
import { ok, fail } from '../lib/response.js';

const router: Router = Router();

/**
 * GET /api/v1/finance/mrr-snapshots
 *
 * Returns last 6 months of MRR snapshots for the authenticated user.
 */
router.get('/mrr-snapshots', async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { userId?: number }).userId;

    if (!userId) {
      return fail(res, 401, 'Authentication required');
    }

    const snapshots = await db
      .select({
        id: schema.mrrSnapshots.id,
        snapshotDate: schema.mrrSnapshots.snapshotDate,
        mrrCents: schema.mrrSnapshots.mrrCents,
        newMrrCents: schema.mrrSnapshots.newMrrCents,
        churnedMrrCents: schema.mrrSnapshots.churnedMrrCents,
        expansionMrrCents: schema.mrrSnapshots.expansionMrrCents,
        activeSubscriptions: schema.mrrSnapshots.activeSubscriptions,
      })
      .from(schema.mrrSnapshots)
      .where(eq(schema.mrrSnapshots.userId, userId))
      .orderBy(desc(schema.mrrSnapshots.snapshotDate))
      .limit(6);

    return ok(res, { snapshots });
  } catch (error) {
    console.error('[finance] Error fetching MRR snapshots:', error);
    return fail(res, 500, 'Failed to fetch MRR snapshots');
  }
});

/**
 * GET /api/v1/finance/revenue-events
 *
 * Returns paginated list of revenue events for the authenticated user.
 * Query params: page (default 1), limit (default 20)
 */
router.get('/revenue-events', async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { userId?: number }).userId;

    if (!userId) {
      return fail(res, 401, 'Authentication required');
    }

    const page = parseInt(String(req.query.page ?? '1'), 10);
    const limit = Math.min(parseInt(String(req.query.limit ?? '20'), 10), 100);
    const offset = (page - 1) * limit;

    // Get total count
    const [countResult] = await db
      .select({
        count: sql<number>`COUNT(*)::int`,
      })
      .from(schema.revenueEvents)
      .where(eq(schema.revenueEvents.userId, userId));

    const total = countResult?.count ?? 0;

    // Get events
    const events = await db
      .select({
        id: schema.revenueEvents.id,
        eventType: schema.revenueEvents.eventType,
        amountCents: schema.revenueEvents.amountCents,
        mrrDeltaCents: schema.revenueEvents.mrrDeltaCents,
        occurredAt: schema.revenueEvents.occurredAt,
        subscriptionId: schema.revenueEvents.subscriptionId,
      })
      .from(schema.revenueEvents)
      .where(eq(schema.revenueEvents.userId, userId))
      .orderBy(desc(schema.revenueEvents.occurredAt))
      .limit(limit)
      .offset(offset);

    return ok(res, { events, total, page, limit });
  } catch (error) {
    console.error('[finance] Error fetching revenue events:', error);
    return fail(res, 500, 'Failed to fetch revenue events');
  }
});

export default router;
