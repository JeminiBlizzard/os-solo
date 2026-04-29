/**
 * Scheduler Routes
 *
 * API endpoints for monitoring and managing the autopilot scheduler.
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { db, schema } from '@os-solo/db';
import { eq, and, isNotNull, desc } from 'drizzle-orm';
import { CronExpressionParser } from 'cron-parser';
import { ok, fail } from '../lib/response.js';
import { getSchedulerStatus, triggerEventAgent } from '../jobs/autopilot-scheduler.js';

const router: Router = Router();

/**
 * GET /api/v1/scheduler/status
 * Get current scheduler status.
 */
router.get('/status', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const status = getSchedulerStatus();

  // Get scheduled agents for this user
  const scheduledAgents = await db
    .select({
      id: schema.agents.id,
      name: schema.agents.name,
      scheduleCron: schema.agents.scheduleCron,
      lastRunAt: schema.agents.lastRunAt,
      lastRunStatus: schema.agents.lastRunStatus,
    })
    .from(schema.agents)
    .where(
      and(
        eq(schema.agents.userId, req.user.id),
        eq(schema.agents.status, 'active'),
        eq(schema.agents.scheduleType, 'cron'),
        isNotNull(schema.agents.scheduleCron)
      )
    );

  // Calculate next run times
  const agentsWithNextRun = scheduledAgents.map((agent) => {
    let nextRunAt: Date | null = null;
    try {
      if (agent.scheduleCron) {
        const interval = CronExpressionParser.parse(agent.scheduleCron);
        nextRunAt = interval.next().toDate();
      }
    } catch {
      // Invalid cron expression
    }

    return {
      ...agent,
      nextRunAt,
      isRunning: status.runningAgents.includes(agent.id),
    };
  });

  res.json(
    ok({
      schedulerRunning: status.isRunning,
      currentlyRunning: status.runningAgents,
      scheduledAgents: agentsWithNextRun,
    })
  );
});

/**
 * POST /api/v1/scheduler/trigger-event
 * Manually trigger an event for event-based agents.
 */
router.post('/trigger-event', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const { event, context } = req.body;

  if (!event || typeof event !== 'string') {
    res.status(400).json(fail('INVALID_REQUEST', 'Event name is required'));
    return;
  }

  // Find agents listening for this event
  const eventAgents = await db
    .select({
      id: schema.agents.id,
      name: schema.agents.name,
    })
    .from(schema.agents)
    .where(
      and(
        eq(schema.agents.userId, req.user.id),
        eq(schema.agents.status, 'active'),
        eq(schema.agents.scheduleType, 'event'),
        eq(schema.agents.scheduleEvent, event)
      )
    );

  if (eventAgents.length === 0) {
    res.json(ok({ message: 'No agents found for this event', triggered: [] }));
    return;
  }

  // Trigger all matching agents (async, don't wait)
  const triggered: string[] = [];
  for (const agent of eventAgents) {
    triggerEventAgent(agent.id, event, context ?? {});
    triggered.push(agent.name);
  }

  res.json(
    ok({
      message: `Triggered ${triggered.length} agent(s)`,
      triggered,
    })
  );
});

/**
 * GET /api/v1/scheduler/upcoming
 * Get upcoming scheduled runs for the next 24 hours.
 */
router.get('/upcoming', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const scheduledAgents = await db
    .select({
      id: schema.agents.id,
      name: schema.agents.name,
      scheduleCron: schema.agents.scheduleCron,
    })
    .from(schema.agents)
    .where(
      and(
        eq(schema.agents.userId, req.user.id),
        eq(schema.agents.status, 'active'),
        eq(schema.agents.scheduleType, 'cron'),
        isNotNull(schema.agents.scheduleCron)
      )
    );

  const now = new Date();
  const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  // Calculate all runs in the next 24 hours
  const upcomingRuns: Array<{
    agentId: number;
    agentName: string;
    scheduledAt: Date;
  }> = [];

  for (const agent of scheduledAgents) {
    if (!agent.scheduleCron) continue;

    try {
      const interval = CronExpressionParser.parse(agent.scheduleCron, {
        currentDate: now,
        endDate: in24Hours,
      });

      // Get all occurrences in the next 24 hours
      // eslint-disable-next-line no-constant-condition
      while (true) {
        try {
          const next = interval.next();
          if (next.toDate() > in24Hours) break;

          upcomingRuns.push({
            agentId: agent.id,
            agentName: agent.name,
            scheduledAt: next.toDate(),
          });
        } catch {
          break; // No more occurrences
        }
      }
    } catch {
      // Invalid cron expression
    }
  }

  // Sort by scheduled time
  upcomingRuns.sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());

  res.json(ok({ upcoming: upcomingRuns }));
});

/**
 * GET /api/v1/scheduler/history
 * Get recent scheduled run history.
 */
router.get('/history', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return;
  }

  const limit = Math.min(parseInt(req.query.limit as string, 10) || 20, 100);

  const runs = await db
    .select({
      id: schema.agentRuns.id,
      agentId: schema.agentRuns.agentId,
      agentName: schema.agents.name,
      triggeredBy: schema.agentRuns.triggeredBy,
      status: schema.agentRuns.status,
      costCents: schema.agentRuns.costCents,
      durationMs: schema.agentRuns.durationMs,
      startedAt: schema.agentRuns.startedAt,
      completedAt: schema.agentRuns.completedAt,
    })
    .from(schema.agentRuns)
    .innerJoin(schema.agents, eq(schema.agentRuns.agentId, schema.agents.id))
    .where(
      and(
        eq(schema.agentRuns.userId, req.user.id),
        eq(schema.agentRuns.triggeredBy, 'schedule')
      )
    )
    .orderBy(desc(schema.agentRuns.startedAt))
    .limit(limit);

  res.json(ok({ runs }));
});

export default router;
