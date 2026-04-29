/**
 * Quick Actions Routes
 *
 * Provides streamlined endpoints for common dashboard actions.
 * Designed for one-click operations from the command center.
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { db, schema } from '@os-solo/db';
import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import { ok, fail } from '../lib/response.js';

const router: Router = Router();

interface QuickAction {
  id: string;
  label: string;
  icon: string;
  enabled: boolean;
  badge?: number;
}

/**
 * GET /api/v1/dashboard/quick-actions
 * Get available quick actions with their current state.
 */
router.get('/quick-actions', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const userId = req.user.id;

  // Fetch counts in parallel
  const [
    pendingApprovals,
    newInboxItems,
    availableAgents,
    focusMode,
  ] = await Promise.all([
    // Pending approvals count
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.approvalQueue)
      .where(
        and(
          eq(schema.approvalQueue.userId, userId),
          eq(schema.approvalQueue.status, 'pending')
        )
      ),

    // New inbox items count
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.inboxItems)
      .where(
        and(
          eq(schema.inboxItems.userId, userId),
          eq(schema.inboxItems.status, 'new')
        )
      ),

    // Available agents count
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.agents)
      .where(
        and(
          eq(schema.agents.userId, userId),
          eq(schema.agents.status, 'active')
        )
      ),

    // Focus mode status
    db
      .select({ active: schema.userSettings.focusModeActive })
      .from(schema.userSettings)
      .where(eq(schema.userSettings.userId, userId))
      .limit(1),
  ]);

  const approvalCount = pendingApprovals[0]?.count ?? 0;
  const inboxCount = newInboxItems[0]?.count ?? 0;
  const agentCount = availableAgents[0]?.count ?? 0;
  const focusModeActive = focusMode[0]?.active ?? false;

  const actions: QuickAction[] = [
    {
      id: 'generate-briefing',
      label: 'Generate Briefing',
      icon: 'sparkles',
      enabled: true,
    },
    {
      id: 'review-approvals',
      label: 'Review Approvals',
      icon: 'check-circle',
      enabled: approvalCount > 0,
      badge: approvalCount,
    },
    {
      id: 'process-inbox',
      label: 'Process Inbox',
      icon: 'inbox',
      enabled: inboxCount > 0,
      badge: inboxCount,
    },
    {
      id: 'run-agent',
      label: 'Run Agent',
      icon: 'play',
      enabled: agentCount > 0,
    },
    {
      id: 'toggle-focus',
      label: focusModeActive ? 'Exit Focus Mode' : 'Enter Focus Mode',
      icon: focusModeActive ? 'eye' : 'eye-off',
      enabled: true,
    },
  ];

  res.json(ok({ actions }));
});

/**
 * POST /api/v1/dashboard/quick-actions/:actionId
 * Execute a quick action.
 */
router.post('/quick-actions/:actionId', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const { actionId } = req.params;
  const userId = req.user.id;

  switch (actionId) {
    case 'bulk-approve': {
      // Approve all pending items with high confidence score (>= 0.8)
      const result = await db
        .update(schema.approvalQueue)
        .set({
          status: 'approved',
          reviewedAt: new Date(),
          reviewNotes: 'Bulk approved via quick action',
        })
        .where(
          and(
            eq(schema.approvalQueue.userId, userId),
            eq(schema.approvalQueue.status, 'pending'),
            sql`${schema.approvalQueue.confidenceScore} >= 0.8`
          )
        )
        .returning({ id: schema.approvalQueue.id });

      res.json(ok({
        action: 'bulk-approve',
        approved_count: result.length,
        message: `Approved ${result.length} high-confidence items`,
      }));
      break;
    }

    case 'triage-inbox': {
      // Mark all new inbox items as triaged
      const result = await db
        .update(schema.inboxItems)
        .set({
          status: 'triaged',
          triagedAt: new Date(),
        })
        .where(
          and(
            eq(schema.inboxItems.userId, userId),
            eq(schema.inboxItems.status, 'new')
          )
        )
        .returning({ id: schema.inboxItems.id });

      res.json(ok({
        action: 'triage-inbox',
        triaged_count: result.length,
        message: `Triaged ${result.length} inbox items`,
      }));
      break;
    }

    case 'dismiss-low-priority': {
      // Resolve low priority inbox items
      const result = await db
        .update(schema.inboxItems)
        .set({
          status: 'resolved',
          resolvedAt: new Date(),
        })
        .where(
          and(
            eq(schema.inboxItems.userId, userId),
            inArray(schema.inboxItems.status, ['new', 'triaged']),
            eq(schema.inboxItems.priority, 'low')
          )
        )
        .returning({ id: schema.inboxItems.id });

      res.json(ok({
        action: 'dismiss-low-priority',
        dismissed_count: result.length,
        message: `Dismissed ${result.length} low-priority items`,
      }));
      break;
    }

    default:
      res.status(400).json(fail('INVALID_ACTION', `Unknown action: ${actionId}`));
  }
});

/**
 * GET /api/v1/dashboard/quick-stats
 * Get quick stats for dashboard widgets.
 */
router.get('/quick-stats', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const userId = req.user.id;
  const now = new Date();
  const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const [
    todayRuns,
    activeAgents,
    resolvedToday,
  ] = await Promise.all([
    // Agent runs today
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.agentRuns)
      .where(
        and(
          eq(schema.agentRuns.userId, userId),
          sql`${schema.agentRuns.startedAt} >= ${startOfToday}`
        )
      ),

    // Active agents
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.agents)
      .where(
        and(
          eq(schema.agents.userId, userId),
          eq(schema.agents.status, 'active')
        )
      ),

    // Items resolved today
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.inboxItems)
      .where(
        and(
          eq(schema.inboxItems.userId, userId),
          eq(schema.inboxItems.status, 'resolved'),
          sql`${schema.inboxItems.resolvedAt} >= ${startOfToday}`
        )
      ),
  ]);

  res.json(ok({
    agent_runs_today: todayRuns[0]?.count ?? 0,
    active_agents: activeAgents[0]?.count ?? 0,
    resolved_today: resolvedToday[0]?.count ?? 0,
  }));
});

export default router;
