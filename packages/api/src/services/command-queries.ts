/**
 * Command Queries Service
 *
 * Handles data queries from the command bar like "what's MRR this month",
 * "how many tickets", "show AI spend", etc. Reads from existing app endpoints
 * and formats responses for display.
 */

import { db, schema } from '@os-solo/db';
import { eq, and, sql, desc, gte } from 'drizzle-orm';
import type { ClassificationEntity } from './command-classifier.js';

export interface QueryRequest {
  query: string;
  entities: ClassificationEntity[];
}

export interface QueryResult {
  answer: string;
  data?: unknown;
  visualization?: 'number' | 'chart' | 'table' | 'list';
}

/**
 * Execute a data query and return formatted results.
 */
export async function executeQuery(
  userId: number,
  request: QueryRequest
): Promise<QueryResult> {
  const { query, entities } = request;

  try {
    const result = await performQuery(userId, query, entities);

    // Log successful query to command history
    await db.insert(schema.commandHistory).values({
      userId,
      query,
      resultType: 'answer',
      resultSummary: result.answer,
    });

    return result;
  } catch (error) {
    console.error('[command-queries] Query execution error:', error);

    // Log failed query
    await db.insert(schema.commandHistory).values({
      userId,
      query,
      resultType: 'error',
      resultSummary: error instanceof Error ? error.message : 'Query failed',
    });

    throw error;
  }
}

/**
 * Perform the actual query execution based on entities and query text.
 */
async function performQuery(
  userId: number,
  query: string,
  entities: ClassificationEntity[]
): Promise<QueryResult> {
  const queryLower = query.toLowerCase();

  // Extract metric type from entities
  const metricEntity = entities.find((e) => e.type === 'metric');
  const metric = metricEntity?.value.toLowerCase();

  // MRR queries
  if (metric?.includes('mrr') || queryLower.includes('mrr') || queryLower.includes('revenue')) {
    return await queryMRR(userId);
  }

  // AI spend queries
  if (metric?.includes('ai') || metric?.includes('spend') || queryLower.includes('ai spend')) {
    return await queryAISpend(userId);
  }

  // Agent activity queries
  if (metric?.includes('agent') || queryLower.includes('agent')) {
    if (queryLower.includes('active') || queryLower.includes('running')) {
      return await queryActiveAgents(userId);
    }
    return await queryAgentActivity(userId);
  }

  // Inbox / ticket queries
  if (queryLower.includes('inbox') || queryLower.includes('ticket') || queryLower.includes('message')) {
    return await queryInboxCount(userId);
  }

  // Approval queue queries
  if (queryLower.includes('approval') || queryLower.includes('pending')) {
    return await queryPendingApprovals(userId);
  }

  // Server/infrastructure queries
  if (queryLower.includes('server') || queryLower.includes('infrastructure')) {
    return await queryServerStatus(userId);
  }

  // Project queries
  if (queryLower.includes('project')) {
    return await queryProjects(userId);
  }

  // Default: unable to determine query intent
  return {
    answer: "I couldn't understand that query. Try asking about MRR, AI spend, agents, inbox, or servers.",
  };
}

/**
 * Query current MRR.
 */
async function queryMRR(userId: number): Promise<QueryResult> {
  // Get the most recent monthly snapshot
  const [snapshot] = await db
    .select({
      mrr: schema.monthlySnapshots.totalMrr,
      month: schema.monthlySnapshots.month,
    })
    .from(schema.monthlySnapshots)
    .where(eq(schema.monthlySnapshots.userId, userId))
    .orderBy(desc(schema.monthlySnapshots.month))
    .limit(1);

  if (!snapshot) {
    return {
      answer: 'No MRR data available yet.',
    };
  }

  const mrrFormatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(snapshot.mrr / 100);

  return {
    answer: `Current MRR is ${mrrFormatted}`,
    data: { mrr: snapshot.mrr, month: snapshot.month },
    visualization: 'number',
  };
}

/**
 * Query AI spend (total or this month).
 */
async function queryAISpend(userId: number): Promise<QueryResult> {
  const now = new Date();
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const [result] = await db
    .select({
      total: sql<number>`COALESCE(SUM(${schema.agentRuns.costCents}), 0)::int`,
    })
    .from(schema.agentRuns)
    .where(
      and(
        eq(schema.agentRuns.userId, userId),
        gte(schema.agentRuns.startedAt, startOfMonth)
      )
    );

  const totalCents = result?.total ?? 0;
  const totalFormatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(totalCents / 100);

  return {
    answer: `AI spend this month: ${totalFormatted}`,
    data: { costCents: totalCents },
    visualization: 'number',
  };
}

/**
 * Query active agents.
 */
async function queryActiveAgents(userId: number): Promise<QueryResult> {
  const [result] = await db
    .select({
      count: sql<number>`count(*)::int`,
    })
    .from(schema.agents)
    .where(
      and(
        eq(schema.agents.userId, userId),
        eq(schema.agents.status, 'active')
      )
    );

  const count = result?.count ?? 0;

  return {
    answer: `You have ${count} active agent${count !== 1 ? 's' : ''}`,
    data: { count },
    visualization: 'number',
  };
}

/**
 * Query agent activity (runs today).
 */
async function queryAgentActivity(userId: number): Promise<QueryResult> {
  const now = new Date();
  const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const [result] = await db
    .select({
      count: sql<number>`count(*)::int`,
    })
    .from(schema.agentRuns)
    .where(
      and(
        eq(schema.agentRuns.userId, userId),
        gte(schema.agentRuns.startedAt, startOfToday)
      )
    );

  const count = result?.count ?? 0;

  return {
    answer: `${count} agent run${count !== 1 ? 's' : ''} today`,
    data: { count },
    visualization: 'number',
  };
}

/**
 * Query inbox item count.
 */
async function queryInboxCount(userId: number): Promise<QueryResult> {
  const [result] = await db
    .select({
      total: sql<number>`count(*)::int`,
      new: sql<number>`count(*) filter (where status = 'new')::int`,
    })
    .from(schema.inboxItems)
    .where(eq(schema.inboxItems.userId, userId));

  const total = result?.total ?? 0;
  const newCount = result?.new ?? 0;

  return {
    answer: `You have ${newCount} new message${newCount !== 1 ? 's' : ''} (${total} total in inbox)`,
    data: { total, new: newCount },
    visualization: 'number',
  };
}

/**
 * Query pending approvals.
 */
async function queryPendingApprovals(userId: number): Promise<QueryResult> {
  const [result] = await db
    .select({
      count: sql<number>`count(*)::int`,
    })
    .from(schema.approvalQueue)
    .where(
      and(
        eq(schema.approvalQueue.userId, userId),
        eq(schema.approvalQueue.status, 'pending')
      )
    );

  const count = result?.count ?? 0;

  return {
    answer: `You have ${count} pending approval${count !== 1 ? 's' : ''}`,
    data: { count },
    visualization: 'number',
  };
}

/**
 * Query server status.
 */
async function queryServerStatus(userId: number): Promise<QueryResult> {
  const [result] = await db
    .select({
      total: sql<number>`count(*)::int`,
      healthy: sql<number>`count(*) filter (where health_status = 'healthy')::int`,
      unhealthy: sql<number>`count(*) filter (where health_status IN ('unhealthy', 'degraded'))::int`,
    })
    .from(schema.servers)
    .where(eq(schema.servers.userId, userId));

  const total = result?.total ?? 0;
  const healthy = result?.healthy ?? 0;
  const unhealthy = result?.unhealthy ?? 0;

  return {
    answer: `${healthy}/${total} servers healthy${unhealthy > 0 ? `, ${unhealthy} need attention` : ''}`,
    data: { total, healthy, unhealthy },
    visualization: 'number',
  };
}

/**
 * Query project count.
 */
async function queryProjects(userId: number): Promise<QueryResult> {
  const [result] = await db
    .select({
      total: sql<number>`count(*)::int`,
      active: sql<number>`count(*) filter (where status = 'active')::int`,
    })
    .from(schema.projects)
    .where(eq(schema.projects.userId, userId));

  const total = result?.total ?? 0;
  const active = result?.active ?? 0;

  return {
    answer: `You have ${active} active project${active !== 1 ? 's' : ''} (${total} total)`,
    data: { total, active },
    visualization: 'number',
  };
}
