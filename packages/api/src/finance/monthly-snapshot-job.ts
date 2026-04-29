/**
 * Monthly Snapshot Job
 *
 * Scheduled job that runs on the 1st of each month at 00:15 UTC
 * to compute and write MRR snapshots for all users.
 *
 * Registered in scheduled_jobs with cron '15 0 1 * *'
 */

import { db, schema } from '@os-solo/db';
import { eq, and } from 'drizzle-orm';
import { CronExpressionParser } from 'cron-parser';
import { writeMRRSnapshot } from './mrr-calculator.js';

export const MRR_SNAPSHOT_JOB_TYPE = 'mrr_snapshot';
export const MRR_SNAPSHOT_CRON = '15 0 1 * *'; // 1st of each month at 00:15 UTC

/**
 * Calculate the previous month for snapshot.
 * When running on the 1st, we snapshot the previous month.
 */
export function getPreviousMonth(date: Date = new Date()): { year: number; month: number } {
  let year = date.getUTCFullYear();
  let month = date.getUTCMonth(); // 0-indexed

  if (month === 0) {
    // January, so previous month is December of last year
    year -= 1;
    month = 12;
  }

  return { year, month };
}

/**
 * Register the MRR snapshot job in scheduled_jobs table.
 * This is called once during system initialization.
 */
export async function registerMRRSnapshotJob(userId: number): Promise<void> {
  // Check if job already exists for this user
  const existing = await db
    .select()
    .from(schema.scheduledJobs)
    .where(
      and(
        eq(schema.scheduledJobs.userId, userId),
        eq(schema.scheduledJobs.jobType, MRR_SNAPSHOT_JOB_TYPE)
      )
    );

  if (existing.length > 0) {
    console.log(`[monthly-snapshot] Job already registered for user ${userId}`);
    return;
  }

  // Calculate next run time
  const interval = CronExpressionParser.parse(MRR_SNAPSHOT_CRON);
  const nextRunAt = interval.next().toDate();

  await db.insert(schema.scheduledJobs).values({
    userId,
    jobType: MRR_SNAPSHOT_JOB_TYPE,
    cronExpression: MRR_SNAPSHOT_CRON,
    nextRunAt,
    status: 'active',
  });

  console.log(`[monthly-snapshot] Registered MRR snapshot job for user ${userId}, next run: ${nextRunAt.toISOString()}`);
}

/**
 * Execute the MRR snapshot job for a specific user.
 * Called by the scheduler when the job is due.
 */
export async function executeMRRSnapshotJob(userId: number): Promise<void> {
  const { year, month } = getPreviousMonth();

  console.log(`[monthly-snapshot] Running MRR snapshot for user ${userId}, period: ${year}-${month.toString().padStart(2, '0')}`);

  await writeMRRSnapshot(userId, year, month);

  // Update job's lastRunAt and calculate next run
  const interval = CronExpressionParser.parse(MRR_SNAPSHOT_CRON);
  const nextRunAt = interval.next().toDate();

  await db
    .update(schema.scheduledJobs)
    .set({
      lastRunAt: new Date(),
      nextRunAt,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(schema.scheduledJobs.userId, userId),
        eq(schema.scheduledJobs.jobType, MRR_SNAPSHOT_JOB_TYPE)
      )
    );

  console.log(`[monthly-snapshot] Completed snapshot for user ${userId}, next run: ${nextRunAt.toISOString()}`);
}

/**
 * Run the monthly snapshot job for all users.
 * This is called by the scheduler when jobs are due.
 */
export async function runMonthlySnapshotForAllUsers(): Promise<void> {
  const { year, month } = getPreviousMonth();

  console.log(`[monthly-snapshot] Running MRR snapshot for all users, period: ${year}-${month.toString().padStart(2, '0')}`);

  // Get all unique user IDs with subscriptions
  const users = await db
    .selectDistinct({
      userId: schema.subscriptions.userId,
    })
    .from(schema.subscriptions);

  if (users.length === 0) {
    console.log('[monthly-snapshot] No users with subscriptions found');
    return;
  }

  console.log(`[monthly-snapshot] Processing ${users.length} user(s)`);

  // Write snapshot for each user
  let successCount = 0;
  let errorCount = 0;

  for (const user of users) {
    try {
      await writeMRRSnapshot(user.userId, year, month);
      successCount++;
    } catch (error) {
      console.error(`[monthly-snapshot] Failed to write snapshot for user ${user.userId}:`, error);
      errorCount++;
    }
  }

  console.log(
    `[monthly-snapshot] Completed: ${successCount} successful, ${errorCount} errors`
  );
}

const SCHEDULER_CHECK_INTERVAL_MS = 60 * 1000; // 1 minute

/**
 * Check if job is due based on cron expression.
 */
function isJobDue(cronExpression: string, lastRunAt: Date | null): boolean {
  try {
    const interval = CronExpressionParser.parse(cronExpression, {
      currentDate: lastRunAt ?? new Date(0),
    });
    const nextRun = interval.next().toDate();
    return nextRun <= new Date();
  } catch {
    return false;
  }
}

/**
 * Scheduler tick - check if MRR snapshot jobs are due and run them.
 */
async function schedulerTick(): Promise<void> {
  try {
    // Get all active MRR snapshot jobs
    const jobs = await db
      .select()
      .from(schema.scheduledJobs)
      .where(
        and(
          eq(schema.scheduledJobs.jobType, MRR_SNAPSHOT_JOB_TYPE),
          eq(schema.scheduledJobs.status, 'active')
        )
      );

    for (const job of jobs) {
      if (job.cronExpression && isJobDue(job.cronExpression, job.lastRunAt)) {
        try {
          await executeMRRSnapshotJob(job.userId);
        } catch (error) {
          console.error(`[monthly-snapshot] Error running job for user ${job.userId}:`, error);
        }
      }
    }
  } catch (error) {
    console.error('[monthly-snapshot] Error in scheduler tick:', error);
  }
}

/**
 * Start the monthly snapshot job scheduler.
 * Checks every minute for due jobs.
 */
export function startMonthlySnapshotJob(): void {
  console.log('[monthly-snapshot] Starting monthly MRR snapshot scheduler (cron: 15 0 1 * *)');

  // Run a check shortly after startup
  setTimeout(schedulerTick, 5000);

  // Then check every minute
  setInterval(schedulerTick, SCHEDULER_CHECK_INTERVAL_MS);
}
