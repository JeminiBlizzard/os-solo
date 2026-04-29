/**
 * Autopilot Scheduler
 *
 * Background job that triggers agents based on their cron schedules.
 * Runs every minute to check for due agents.
 */

import { CronExpressionParser } from 'cron-parser';
import { db, schema } from '@os-solo/db';
import { eq, and, isNotNull, lte, or, isNull } from 'drizzle-orm';
import { executeAgent } from '../services/agent-runtime.js';
import type { TriggerType } from '@os-solo/shared';

const SCHEDULER_INTERVAL_MS = 60 * 1000; // 1 minute
const MAX_CONCURRENT_RUNS = 5;

// Track running agents to prevent concurrent runs of the same agent
const runningAgents = new Set<number>();

/**
 * Calculate the next run time for a cron expression.
 */
function getNextRunTime(cronExpression: string): Date | null {
  try {
    const interval = CronExpressionParser.parse(cronExpression, {
      currentDate: new Date(),
    });
    return interval.next().toDate();
  } catch (error) {
    console.error(`[autopilot] Invalid cron expression: ${cronExpression}`, error);
    return null;
  }
}

/**
 * Check if an agent is due to run based on its schedule.
 */
function isDueToRun(lastRunAt: Date | null, cronExpression: string): boolean {
  try {
    const interval = CronExpressionParser.parse(cronExpression, {
      currentDate: lastRunAt ?? new Date(0), // Start from epoch if never run
    });

    // Get the next scheduled time after last run
    const nextRun = interval.next().toDate();

    // If next scheduled time is in the past or now, it's due
    return nextRun <= new Date();
  } catch {
    return false;
  }
}

/**
 * Get all agents that are due for a scheduled run.
 */
async function getDueAgents(): Promise<
  Array<{
    id: number;
    userId: number;
    name: string;
    scheduleCron: string;
    lastRunAt: Date | null;
  }>
> {
  // Get active agents with cron schedules
  const agents = await db
    .select({
      id: schema.agents.id,
      userId: schema.agents.userId,
      name: schema.agents.name,
      scheduleCron: schema.agents.scheduleCron,
      lastRunAt: schema.agents.lastRunAt,
    })
    .from(schema.agents)
    .where(
      and(
        eq(schema.agents.status, 'active'),
        eq(schema.agents.scheduleType, 'cron'),
        isNotNull(schema.agents.scheduleCron)
      )
    );

  // Filter to only agents that are due (and have scheduleCron)
  return agents
    .filter((agent): agent is typeof agent & { scheduleCron: string } => {
      if (!agent.scheduleCron) return false;
      if (runningAgents.has(agent.id)) return false; // Already running
      return isDueToRun(agent.lastRunAt, agent.scheduleCron);
    });
}

/**
 * Run a single scheduled agent.
 */
async function runScheduledAgent(agent: {
  id: number;
  userId: number;
  name: string;
}): Promise<void> {
  runningAgents.add(agent.id);

  try {
    console.log(`[autopilot] Starting scheduled run for agent: ${agent.name} (id=${agent.id})`);

    const result = await executeAgent(agent.userId, agent.id, {
      triggeredBy: 'schedule' as TriggerType,
    });

    console.log(
      `[autopilot] Completed run for agent: ${agent.name} ` +
        `(status=${result.status}, duration=${result.durationMs}ms, cost=$${(result.costCents / 100).toFixed(4)})`
    );
  } catch (error) {
    console.error(`[autopilot] Error running agent ${agent.name}:`, error);
  } finally {
    runningAgents.delete(agent.id);
  }
}

/**
 * Main scheduler tick - check for due agents and run them.
 */
async function schedulerTick(): Promise<void> {
  try {
    const dueAgents = await getDueAgents();

    if (dueAgents.length === 0) {
      return;
    }

    console.log(`[autopilot] Found ${dueAgents.length} agent(s) due for scheduled run`);

    // Limit concurrent runs
    const toRun = dueAgents.slice(0, MAX_CONCURRENT_RUNS);

    // Run agents in parallel (up to limit)
    await Promise.all(toRun.map(runScheduledAgent));
  } catch (error) {
    console.error('[autopilot] Error in scheduler tick:', error);
  }
}

/**
 * Start the autopilot scheduler.
 * Runs every minute to check for due agents.
 */
export function startAutopilotScheduler(): void {
  console.log('[autopilot] Starting autopilot scheduler');

  // Run immediately on startup (after a short delay to let other services initialize)
  setTimeout(() => {
    schedulerTick();
  }, 5000);

  // Schedule to run every minute
  setInterval(schedulerTick, SCHEDULER_INTERVAL_MS);
}

/**
 * Manually trigger an event-based agent run.
 * Used by webhooks and event handlers.
 */
export async function triggerEventAgent(
  agentId: number,
  event: string,
  context: Record<string, unknown>
): Promise<void> {
  const agent = await db.query.agents.findFirst({
    where: and(
      eq(schema.agents.id, agentId),
      eq(schema.agents.status, 'active'),
      eq(schema.agents.scheduleType, 'event'),
      eq(schema.agents.scheduleEvent, event)
    ),
  });

  if (!agent) {
    console.log(`[autopilot] No active event agent found for event: ${event}`);
    return;
  }

  if (runningAgents.has(agentId)) {
    console.log(`[autopilot] Agent ${agent.name} is already running, skipping event trigger`);
    return;
  }

  console.log(`[autopilot] Triggering event agent: ${agent.name} for event: ${event}`);

  runningAgents.add(agentId);

  try {
    await executeAgent(agent.userId, agentId, {
      triggeredBy: 'event' as TriggerType,
      context,
    });
  } finally {
    runningAgents.delete(agentId);
  }
}

/**
 * Get scheduler status for debugging/monitoring.
 */
export function getSchedulerStatus(): {
  runningAgents: number[];
  isRunning: boolean;
} {
  return {
    runningAgents: Array.from(runningAgents),
    isRunning: true,
  };
}
