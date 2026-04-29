/**
 * Global Analytics Routes
 *
 * Cross-agent analytics and aggregate metrics.
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { db, schema } from '@os-solo/db';
import { eq, and, sql, gte } from 'drizzle-orm';
import { ok, fail } from '../lib/response.js';

const router: Router = Router();

/**
 * GET /api/v1/analytics/global
 * Get aggregate analytics across all agents for the authenticated user.
 */
router.get('/global', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  // Get current month date range
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  // Get total cost this month
  const costResult = await db
    .select({
      totalCostCents: sql<number>`COALESCE(SUM(${schema.agentRuns.costCents}), 0)::int`,
    })
    .from(schema.agentRuns)
    .where(
      and(
        eq(schema.agentRuns.userId, req.user.id),
        gte(schema.agentRuns.startedAt, monthStart),
        sql`${schema.agentRuns.startedAt} <= ${monthEnd}`
      )
    );

  const totalCostThisMonth = costResult[0]?.totalCostCents ?? 0;

  // Get total runs this month
  const runsResult = await db
    .select({
      totalRuns: sql<number>`COUNT(*)::int`,
    })
    .from(schema.agentRuns)
    .where(
      and(
        eq(schema.agentRuns.userId, req.user.id),
        gte(schema.agentRuns.startedAt, monthStart),
        sql`${schema.agentRuns.startedAt} <= ${monthEnd}`
      )
    );

  const totalRunsThisMonth = runsResult[0]?.totalRuns ?? 0;

  // Get top agent by run count
  const topAgentByRuns = await db
    .select({
      agentId: schema.agentRuns.agentId,
      agentName: schema.agents.name,
      runCount: sql<number>`COUNT(*)::int`,
    })
    .from(schema.agentRuns)
    .innerJoin(schema.agents, eq(schema.agentRuns.agentId, schema.agents.id))
    .where(eq(schema.agentRuns.userId, req.user.id))
    .groupBy(schema.agentRuns.agentId, schema.agents.name)
    .orderBy(sql`COUNT(*) DESC`)
    .limit(1);

  const topByRuns = topAgentByRuns[0] ?? null;

  // Get top agent by cost
  const topAgentByCost = await db
    .select({
      agentId: schema.agentRuns.agentId,
      agentName: schema.agents.name,
      totalCost: sql<number>`COALESCE(SUM(${schema.agentRuns.costCents}), 0)::int`,
    })
    .from(schema.agentRuns)
    .innerJoin(schema.agents, eq(schema.agentRuns.agentId, schema.agents.id))
    .where(eq(schema.agentRuns.userId, req.user.id))
    .groupBy(schema.agentRuns.agentId, schema.agents.name)
    .orderBy(sql`COALESCE(SUM(${schema.agentRuns.costCents}), 0) DESC`)
    .limit(1);

  const topByCost = topAgentByCost[0] ?? null;

  // Get agent health distribution
  const healthDistribution = await db
    .select({
      status: schema.agents.status,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(schema.agents)
    .where(eq(schema.agents.userId, req.user.id))
    .groupBy(schema.agents.status);

  const healthMap: Record<string, number> = {
    active: 0,
    paused: 0,
    archived: 0,
  };

  healthDistribution.forEach((item) => {
    if (item.status in healthMap) {
      healthMap[item.status] = item.count;
    }
  });

  // Get list of top 5 agents by various metrics
  const topAgentsByRuns = await db
    .select({
      agentId: schema.agentRuns.agentId,
      agentName: schema.agents.name,
      runCount: sql<number>`COUNT(*)::int`,
      totalCost: sql<number>`COALESCE(SUM(${schema.agentRuns.costCents}), 0)::int`,
    })
    .from(schema.agentRuns)
    .innerJoin(schema.agents, eq(schema.agentRuns.agentId, schema.agents.id))
    .where(eq(schema.agentRuns.userId, req.user.id))
    .groupBy(schema.agentRuns.agentId, schema.agents.name)
    .orderBy(sql`COUNT(*) DESC`)
    .limit(5);

  const topAgentsByCost = await db
    .select({
      agentId: schema.agentRuns.agentId,
      agentName: schema.agents.name,
      totalCost: sql<number>`COALESCE(SUM(${schema.agentRuns.costCents}), 0)::int`,
      runCount: sql<number>`COUNT(*)::int`,
    })
    .from(schema.agentRuns)
    .innerJoin(schema.agents, eq(schema.agentRuns.agentId, schema.agents.id))
    .where(eq(schema.agentRuns.userId, req.user.id))
    .groupBy(schema.agentRuns.agentId, schema.agents.name)
    .orderBy(sql`COALESCE(SUM(${schema.agentRuns.costCents}), 0) DESC`)
    .limit(5);

  res.json(
    ok({
      summary: {
        totalCostThisMonth,
        totalRunsThisMonth,
        topAgentByRuns: topByRuns,
        topAgentByCost: topByCost,
      },
      healthDistribution: healthMap,
      topAgents: {
        byRuns: topAgentsByRuns,
        byCost: topAgentsByCost,
      },
    })
  );
});

export default router;
