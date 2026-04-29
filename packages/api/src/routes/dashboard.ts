/**
 * Dashboard Routes
 *
 * Provides aggregated metrics for the command center dashboard.
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { db, schema } from '@os-solo/db';
import { eq, and, desc, sql, gte, inArray } from 'drizzle-orm';
import { ok, fail } from '../lib/response.js';
import briefingRouter from './briefing.js';
import focusModeRouter from './focus-mode.js';
import quickActionsRouter from './quick-actions.js';

const router: Router = Router();

interface DashboardMetrics {
  mrr: {
    current_cents: number;
    delta_cents: number;
    delta_pct: number;
  };
  system_health: {
    online: number;
    degraded: number;
    offline: number;
  };
  approval_pending: number;
  open_tickets: number;
  ai_spend: {
    current_cents: number;
    budget_cents: number;
    pct_used: number;
  };
}

/**
 * GET /api/v1/dashboard/metrics
 * Returns aggregated metrics for the dashboard.
 * Cache-Control: max-age=30
 */
router.get('/metrics', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const userId = req.user.id;

  // Get first day of current month (UTC)
  const now = new Date();
  const firstOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  // Execute all queries in parallel
  const [
    mrrResult,
    serverHealthResult,
    approvalPendingResult,
    openTicketsResult,
    aiSpendResult,
    aiBudgetResult,
  ] = await Promise.all([
    // MRR: Get latest two snapshots to calculate delta
    db
      .select({
        mrrCents: schema.mrrSnapshots.mrrCents,
        snapshotDate: schema.mrrSnapshots.snapshotDate,
      })
      .from(schema.mrrSnapshots)
      .where(eq(schema.mrrSnapshots.userId, userId))
      .orderBy(desc(schema.mrrSnapshots.snapshotDate))
      .limit(2),

    // System health: Count servers by status
    db
      .select({
        status: schema.servers.status,
        count: sql<number>`count(*)::int`,
      })
      .from(schema.servers)
      .where(eq(schema.servers.userId, userId))
      .groupBy(schema.servers.status),

    // Approval pending count
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.approvalQueue)
      .where(
        and(
          eq(schema.approvalQueue.userId, userId),
          eq(schema.approvalQueue.status, 'pending')
        )
      ),

    // Open tickets count
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.inboxItems)
      .where(
        and(
          eq(schema.inboxItems.userId, userId),
          inArray(schema.inboxItems.status, ['new', 'triaged', 'in_progress'])
        )
      ),

    // AI spend this month
    db
      .select({ total: sql<number>`COALESCE(SUM(cost_cents), 0)::int` })
      .from(schema.agentRuns)
      .where(
        and(
          eq(schema.agentRuns.userId, userId),
          gte(schema.agentRuns.completedAt, firstOfMonth)
        )
      ),

    // AI budget from user_settings
    db
      .select({ budget: schema.userSettings.aiMonthlyBudgetCents })
      .from(schema.userSettings)
      .where(eq(schema.userSettings.userId, userId))
      .limit(1),
  ]);

  // Process MRR
  const currentMrr = mrrResult[0]?.mrrCents ?? 0;
  const previousMrr = mrrResult[1]?.mrrCents ?? 0;
  const mrrDelta = currentMrr - previousMrr;
  const mrrDeltaPct = previousMrr > 0 ? (mrrDelta / previousMrr) * 100 : 0;

  // Process system health
  let onlineCount = 0;
  let degradedCount = 0;
  let offlineCount = 0;

  for (const row of serverHealthResult) {
    const status = row.status?.toLowerCase() ?? 'unknown';
    if (status === 'online') {
      onlineCount = row.count;
    } else if (status === 'degraded') {
      degradedCount = row.count;
    } else {
      offlineCount += row.count; // Treat unknown/offline as offline
    }
  }

  // Process counts
  const approvalPending = approvalPendingResult[0]?.count ?? 0;
  const openTickets = openTicketsResult[0]?.count ?? 0;

  // Process AI spend
  const aiCurrentSpend = aiSpendResult[0]?.total ?? 0;
  const aiBudget = aiBudgetResult[0]?.budget ?? 30000; // Default 300 USD
  const aiPctUsed = aiBudget > 0 ? (aiCurrentSpend / aiBudget) * 100 : 0;

  const metrics: DashboardMetrics = {
    mrr: {
      current_cents: currentMrr,
      delta_cents: mrrDelta,
      delta_pct: Math.round(mrrDeltaPct * 100) / 100,
    },
    system_health: {
      online: onlineCount,
      degraded: degradedCount,
      offline: offlineCount,
    },
    approval_pending: approvalPending,
    open_tickets: openTickets,
    ai_spend: {
      current_cents: aiCurrentSpend,
      budget_cents: aiBudget,
      pct_used: Math.round(aiPctUsed * 100) / 100,
    },
  };

  // Set cache control header
  res.set('Cache-Control', 'private, max-age=30');
  res.json(ok(metrics));
});

// Mount briefing routes
router.use('/', briefingRouter);

// Mount focus mode routes
router.use('/', focusModeRouter);

// Mount quick actions routes
router.use('/', quickActionsRouter);

export default router;
