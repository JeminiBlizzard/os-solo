/**
 * Finance AI Spend Routes
 *
 * Aggregates AI spending from agent_runs for the current month.
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { db, schema } from '@os-solo/db';
import { eq, and, gte, sql } from 'drizzle-orm';
import { ok, fail } from '../lib/response.js';

const router: Router = Router();

interface AgentSpend {
  agent_id: number;
  agent_name: string;
  spend_cents: number;
}

interface AISpendResponse {
  total_cents: number;
  by_agent: AgentSpend[];
  projected_cents: number;
  budget_cents: number;
  pct_used: number;
}

/**
 * GET /api/v1/finance/ai-spend
 * Returns current month AI spend aggregated from agent_runs.cost_cents.
 */
router.get('/ai-spend', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const userId = req.user.id;

  // Get first day of current month (UTC)
  const now = new Date();
  const firstOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
  const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  const dayOfMonth = now.getUTCDate();
  const daysElapsed = Math.max(1, dayOfMonth); // At least 1 to avoid division by zero

  // Get all agents for this user (to include zero-spend agents)
  const allAgents = await db
    .select({
      id: schema.agents.id,
      name: schema.agents.name,
    })
    .from(schema.agents)
    .where(eq(schema.agents.userId, userId));

  // Aggregate spend by agent for current month
  const spendByAgent = await db
    .select({
      agentId: schema.agentRuns.agentId,
      totalSpend: sql<number>`COALESCE(SUM(${schema.agentRuns.costCents}), 0)::int`,
    })
    .from(schema.agentRuns)
    .where(
      and(
        eq(schema.agentRuns.userId, userId),
        gte(schema.agentRuns.startedAt, firstOfMonth)
      )
    )
    .groupBy(schema.agentRuns.agentId);

  // Create a map of agent spend
  const spendMap = new Map<number, number>();
  for (const row of spendByAgent) {
    spendMap.set(row.agentId, row.totalSpend);
  }

  // Build by_agent array with all agents (including zero spend)
  const byAgent: AgentSpend[] = allAgents.map((agent) => ({
    agent_id: agent.id,
    agent_name: agent.name,
    spend_cents: spendMap.get(agent.id) ?? 0,
  }));

  // Sort by spend_cents DESC
  byAgent.sort((a, b) => b.spend_cents - a.spend_cents);

  // Calculate total
  const totalCents = byAgent.reduce((sum, a) => sum + a.spend_cents, 0);

  // Calculate projected monthly spend
  const projectedCents = Math.round((totalCents / daysElapsed) * daysInMonth);

  // Get budget from user_settings
  const [settings] = await db
    .select({
      budgetCents: schema.userSettings.aiMonthlyBudgetCents,
    })
    .from(schema.userSettings)
    .where(eq(schema.userSettings.userId, userId))
    .limit(1);

  const budgetCents = settings?.budgetCents ?? 30000; // Default $300

  // Calculate pct_used (capped at 999)
  let pctUsed = 0;
  if (budgetCents > 0) {
    pctUsed = Math.min(999, Math.round((totalCents / budgetCents) * 100));
  }

  const response: AISpendResponse = {
    total_cents: totalCents,
    by_agent: byAgent,
    projected_cents: projectedCents,
    budget_cents: budgetCents,
    pct_used: pctUsed,
  };

  res.json(ok(response));
});

export default router;
