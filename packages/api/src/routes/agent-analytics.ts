/**
 * Agent Analytics Routes
 *
 * API endpoints for agent performance metrics and analytics.
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { db, schema } from '@os-solo/db';
import { eq, and, sql, gte } from 'drizzle-orm';
import { ok, fail } from '../lib/response.js';

const router: Router = Router();

/**
 * GET /api/v1/agents/:agentId/analytics/overview
 * Get summary analytics and trends for an agent.
 */
router.get('/:agentId/analytics/overview', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const agentId = parseInt(req.params.agentId as string, 10);
  if (isNaN(agentId)) {
    res.status(400).json(fail('INVALID_REQUEST', 'Invalid agent ID'));
    return;
  }

  // Verify ownership
  const agent = await db.query.agents.findFirst({
    where: and(
      eq(schema.agents.id, agentId),
      eq(schema.agents.userId, req.user.id)
    ),
  });

  if (!agent) {
    res.status(404).json(fail('NOT_FOUND', 'Agent not found'));
    return;
  }

  // Get all-time stats
  const allTimeStats = await db
    .select({
      totalRuns: sql<number>`COUNT(*)::int`,
      successfulRuns: sql<number>`COUNT(*) FILTER (WHERE ${schema.agentRuns.status} = 'success')::int`,
      approvedRuns: sql<number>`COUNT(*) FILTER (WHERE ${schema.agentRuns.status} = 'success' AND ${schema.agentRuns.approvalQueueId} IS NOT NULL)::int`,
      rejectedRuns: sql<number>`COUNT(*) FILTER (WHERE ${schema.agentRuns.status} = 'cancelled')::int`,
      totalCostCents: sql<number>`COALESCE(SUM(${schema.agentRuns.costCents}), 0)::int`,
    })
    .from(schema.agentRuns)
    .where(eq(schema.agentRuns.agentId, agentId));

  const stats = allTimeStats[0] ?? {
    totalRuns: 0,
    successfulRuns: 0,
    approvedRuns: 0,
    rejectedRuns: 0,
    totalCostCents: 0,
  };

  // Calculate rates
  const successRate = stats.totalRuns > 0
    ? (stats.successfulRuns / stats.totalRuns) * 100
    : 0;

  const totalApprovalActions = stats.approvedRuns + stats.rejectedRuns;
  const approvalRate = totalApprovalActions > 0
    ? (stats.approvedRuns / totalApprovalActions) * 100
    : 0;

  // Estimated time saved (assuming average task takes time if configured in agent)
  // For now, use a default of 30 minutes per successful run
  const estimatedMinutesPerTask = 30; // Could be pulled from agent.config in future
  const estimatedTimeSavedMinutes = stats.successfulRuns * estimatedMinutesPerTask;

  // Get current week stats (last 7 days)
  const currentWeekStart = new Date();
  currentWeekStart.setDate(currentWeekStart.getDate() - 7);

  const currentWeekStats = await db
    .select({
      totalRuns: sql<number>`COUNT(*)::int`,
      successfulRuns: sql<number>`COUNT(*) FILTER (WHERE ${schema.agentRuns.status} = 'success')::int`,
      approvedRuns: sql<number>`COUNT(*) FILTER (WHERE ${schema.agentRuns.status} = 'success' AND ${schema.agentRuns.approvalQueueId} IS NOT NULL)::int`,
      rejectedRuns: sql<number>`COUNT(*) FILTER (WHERE ${schema.agentRuns.status} = 'cancelled')::int`,
      totalCostCents: sql<number>`COALESCE(SUM(${schema.agentRuns.costCents}), 0)::int`,
    })
    .from(schema.agentRuns)
    .where(
      and(
        eq(schema.agentRuns.agentId, agentId),
        gte(schema.agentRuns.startedAt, currentWeekStart)
      )
    );

  const currentWeek = currentWeekStats[0] ?? {
    totalRuns: 0,
    successfulRuns: 0,
    approvedRuns: 0,
    rejectedRuns: 0,
    totalCostCents: 0,
  };

  // Get previous week stats (14-7 days ago)
  const previousWeekStart = new Date();
  previousWeekStart.setDate(previousWeekStart.getDate() - 14);
  const previousWeekEnd = new Date();
  previousWeekEnd.setDate(previousWeekEnd.getDate() - 7);

  const previousWeekStats = await db
    .select({
      totalRuns: sql<number>`COUNT(*)::int`,
      successfulRuns: sql<number>`COUNT(*) FILTER (WHERE ${schema.agentRuns.status} = 'success')::int`,
      approvedRuns: sql<number>`COUNT(*) FILTER (WHERE ${schema.agentRuns.status} = 'success' AND ${schema.agentRuns.approvalQueueId} IS NOT NULL)::int`,
      rejectedRuns: sql<number>`COUNT(*) FILTER (WHERE ${schema.agentRuns.status} = 'cancelled')::int`,
      totalCostCents: sql<number>`COALESCE(SUM(${schema.agentRuns.costCents}), 0)::int`,
    })
    .from(schema.agentRuns)
    .where(
      and(
        eq(schema.agentRuns.agentId, agentId),
        gte(schema.agentRuns.startedAt, previousWeekStart),
        sql`${schema.agentRuns.startedAt} < ${previousWeekEnd}`
      )
    );

  const previousWeek = previousWeekStats[0] ?? {
    totalRuns: 0,
    successfulRuns: 0,
    approvedRuns: 0,
    rejectedRuns: 0,
    totalCostCents: 0,
  };

  // Calculate trends
  const currentWeekSuccessRate = currentWeek.totalRuns > 0
    ? (currentWeek.successfulRuns / currentWeek.totalRuns) * 100
    : 0;

  const previousWeekSuccessRate = previousWeek.totalRuns > 0
    ? (previousWeek.successfulRuns / previousWeek.totalRuns) * 100
    : 0;

  const currentWeekApprovalActions = currentWeek.approvedRuns + currentWeek.rejectedRuns;
  const currentWeekApprovalRate = currentWeekApprovalActions > 0
    ? (currentWeek.approvedRuns / currentWeekApprovalActions) * 100
    : 0;

  const previousWeekApprovalActions = previousWeek.approvedRuns + previousWeek.rejectedRuns;
  const previousWeekApprovalRate = previousWeekApprovalActions > 0
    ? (previousWeek.approvedRuns / previousWeekApprovalActions) * 100
    : 0;

  // Calculate trend direction
  const getTrend = (current: number, previous: number): 'up' | 'down' | 'neutral' => {
    if (previous === 0 && current === 0) return 'neutral';
    if (previous === 0 && current > 0) return 'up';
    const diff = current - previous;
    if (Math.abs(diff) < 1) return 'neutral'; // Less than 1 percentage point difference
    return diff > 0 ? 'up' : 'down';
  };

  const summary = {
    totalRuns: stats.totalRuns,
    successRate: Math.round(successRate * 100) / 100, // Round to 2 decimal places
    approvalRate: Math.round(approvalRate * 100) / 100,
    totalCost: stats.totalCostCents,
    estimatedTimeSavedMinutes,
  };

  const trends = {
    totalRuns: {
      trend: getTrend(currentWeek.totalRuns, previousWeek.totalRuns),
      change: currentWeek.totalRuns - previousWeek.totalRuns,
    },
    successRate: {
      trend: getTrend(currentWeekSuccessRate, previousWeekSuccessRate),
      change: Math.round((currentWeekSuccessRate - previousWeekSuccessRate) * 100) / 100,
    },
    approvalRate: {
      trend: getTrend(currentWeekApprovalRate, previousWeekApprovalRate),
      change: Math.round((currentWeekApprovalRate - previousWeekApprovalRate) * 100) / 100,
    },
    totalCost: {
      trend: getTrend(currentWeek.totalCostCents, previousWeek.totalCostCents),
      change: currentWeek.totalCostCents - previousWeek.totalCostCents,
    },
  };

  res.json(ok({ summary, trends }));
});

/**
 * GET /api/v1/agents/:agentId/analytics/charts
 * Get time-series chart data for an agent (last N days).
 */
router.get('/:agentId/analytics/charts', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const agentId = parseInt(req.params.agentId as string, 10);
  if (isNaN(agentId)) {
    res.status(400).json(fail('INVALID_REQUEST', 'Invalid agent ID'));
    return;
  }

  const days = parseInt(req.query.days as string || '30', 10);
  if (isNaN(days) || days < 1 || days > 365) {
    res.status(400).json(fail('INVALID_REQUEST', 'Days must be between 1 and 365'));
    return;
  }

  // Verify ownership
  const agent = await db.query.agents.findFirst({
    where: and(
      eq(schema.agents.id, agentId),
      eq(schema.agents.userId, req.user.id)
    ),
  });

  if (!agent) {
    res.status(404).json(fail('NOT_FOUND', 'Agent not found'));
    return;
  }

  // Calculate date range
  const endDate = new Date();
  endDate.setHours(23, 59, 59, 999);
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  // Query daily aggregated data from agent_runs (grouped by day)
  // We aggregate directly from agent_runs since performance_snapshots may not exist yet
  const dailyData = await db
    .select({
      date: sql<string>`DATE(${schema.agentRuns.startedAt})::text`,
      runs: sql<number>`COUNT(*)::int`,
      cost: sql<number>`COALESCE(SUM(${schema.agentRuns.costCents}), 0)::int`,
      avgDurationMs: sql<number>`COALESCE(AVG(${schema.agentRuns.durationMs})::int, 0)`,
    })
    .from(schema.agentRuns)
    .where(
      and(
        eq(schema.agentRuns.agentId, agentId),
        gte(schema.agentRuns.startedAt, startDate),
        sql`${schema.agentRuns.startedAt} <= ${endDate}`
      )
    )
    .groupBy(sql`DATE(${schema.agentRuns.startedAt})`)
    .orderBy(sql`DATE(${schema.agentRuns.startedAt})`);

  // Fill in missing days with zero data
  const timeSeriesMap = new Map<string, { date: string; runs: number; cost: number; avgDurationMs: number }>();

  // Initialize all days with zero
  for (let i = 0; i < days; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split('T')[0] as string;
    timeSeriesMap.set(dateStr, {
      date: dateStr,
      runs: 0,
      cost: 0,
      avgDurationMs: 0,
    });
  }

  // Overlay actual data
  dailyData.forEach((day) => {
    if (timeSeriesMap.has(day.date)) {
      timeSeriesMap.set(day.date, {
        date: day.date,
        runs: day.runs,
        cost: day.cost,
        avgDurationMs: day.avgDurationMs,
      });
    }
  });

  const timeSeries = Array.from(timeSeriesMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  // Get approval stats (all-time for simplicity)
  const approvalStats = await db
    .select({
      approved: sql<number>`COUNT(*) FILTER (WHERE ${schema.agentRuns.status} = 'success' AND ${schema.agentRuns.approvalQueueId} IS NOT NULL)::int`,
      rejected: sql<number>`COUNT(*) FILTER (WHERE ${schema.agentRuns.status} = 'cancelled' AND ${schema.agentRuns.approvalQueueId} IS NOT NULL)::int`,
      autoApproved: sql<number>`COUNT(*) FILTER (WHERE ${schema.agentRuns.status} = 'success' AND ${schema.agentRuns.approvalQueueId} IS NULL AND ${schema.agents.requiresApproval} = true)::int`,
    })
    .from(schema.agentRuns)
    .innerJoin(schema.agents, eq(schema.agentRuns.agentId, schema.agents.id))
    .where(eq(schema.agentRuns.agentId, agentId));

  const stats = approvalStats[0] ?? { approved: 0, rejected: 0, autoApproved: 0 };

  res.json(ok({ timeSeries, approvalStats: stats }));
});

export default router;
