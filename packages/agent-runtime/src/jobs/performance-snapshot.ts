/**
 * Performance Snapshot Job
 *
 * Daily scheduled job that aggregates agent_runs data into performance snapshots.
 * Creates daily, weekly, and monthly rollups for agent performance metrics.
 */

import { db, schema } from '@os-solo/db';
import { eq, and, gte, lt, sql } from 'drizzle-orm';

interface DailySnapshot {
  agentId: number;
  userId: number;
  period: string; // 'YYYY-MM-DD'
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  approvalCount: number;
  rejectionCount: number;
  autoApprovalCount: number;
  totalTokens: number;
  totalCostCents: number;
  avgDurationMs: number;
  estimatedTimeSavedMinutes: number;
}

/**
 * Calculate estimated time saved based on average duration.
 * Assumes each successful run saves ~30 minutes of manual work.
 */
function calculateTimeSaved(successfulRuns: number): number {
  const minutesPerRun = 30;
  return successfulRuns * minutesPerRun;
}

/**
 * Format date as YYYY-MM-DD
 */
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]!;
}

/**
 * Format date as YYYY-Www (ISO week format)
 */
function formatWeek(date: Date): string {
  const year = date.getFullYear();
  const firstDayOfYear = new Date(year, 0, 1);
  const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
  const weekNumber = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  return `${year}-W${weekNumber.toString().padStart(2, '0')}`;
}

/**
 * Format date as YYYY-MM (month format)
 */
function formatMonth(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Aggregate agent runs for a specific day.
 */
export async function aggregateDailySnapshots(targetDate: Date): Promise<DailySnapshot[]> {
  const startOfDay = new Date(targetDate);
  startOfDay.setUTCHours(0, 0, 0, 0);

  const endOfDay = new Date(targetDate);
  endOfDay.setUTCHours(23, 59, 59, 999);

  const period = formatDate(targetDate);

  // Aggregate runs grouped by agent_id
  const results = await db
    .select({
      agentId: schema.agentRuns.agentId,
      userId: schema.agentRuns.userId,
      totalRuns: sql<number>`count(*)::int`,
      successfulRuns: sql<number>`count(case when ${schema.agentRuns.status} = 'success' then 1 end)::int`,
      failedRuns: sql<number>`count(case when ${schema.agentRuns.status} = 'failure' then 1 end)::int`,
      approvalCount: sql<number>`count(case when ${schema.agentRuns.status} = 'needs_approval' then 1 end)::int`,
      totalTokens: sql<number>`sum(coalesce(${schema.agentRuns.tokensPrompt}, 0) + coalesce(${schema.agentRuns.tokensCompletion}, 0))::int`,
      totalCostCents: sql<number>`sum(coalesce(${schema.agentRuns.costCents}, 0))::int`,
      avgDurationMs: sql<number>`avg(${schema.agentRuns.durationMs})::int`,
    })
    .from(schema.agentRuns)
    .where(
      and(
        gte(schema.agentRuns.startedAt, startOfDay),
        lt(schema.agentRuns.startedAt, endOfDay)
      )
    )
    .groupBy(schema.agentRuns.agentId, schema.agentRuns.userId);

  // Get approval queue counts from approval_queue table
  const approvalResults = await db
    .select({
      agentId: schema.approvalQueue.agentId,
      rejectionCount: sql<number>`count(case when ${schema.approvalQueue.status} = 'rejected' then 1 end)::int`,
      autoApprovalCount: sql<number>`count(case when ${schema.approvalQueue.status} = 'auto_approved' then 1 end)::int`,
    })
    .from(schema.approvalQueue)
    .where(
      and(
        gte(schema.approvalQueue.createdAt, startOfDay),
        lt(schema.approvalQueue.createdAt, endOfDay)
      )
    )
    .groupBy(schema.approvalQueue.agentId);

  // Merge approval data into results
  const approvalMap = new Map(
    approvalResults.map(r => [r.agentId, { rejectionCount: r.rejectionCount, autoApprovalCount: r.autoApprovalCount }])
  );

  return results.map(r => {
    const approvalData = approvalMap.get(r.agentId) ?? { rejectionCount: 0, autoApprovalCount: 0 };
    return {
      agentId: r.agentId,
      userId: r.userId,
      period,
      totalRuns: r.totalRuns ?? 0,
      successfulRuns: r.successfulRuns ?? 0,
      failedRuns: r.failedRuns ?? 0,
      approvalCount: r.approvalCount ?? 0,
      rejectionCount: approvalData.rejectionCount,
      autoApprovalCount: approvalData.autoApprovalCount,
      totalTokens: r.totalTokens ?? 0,
      totalCostCents: r.totalCostCents ?? 0,
      avgDurationMs: r.avgDurationMs ?? 0,
      estimatedTimeSavedMinutes: calculateTimeSaved(r.successfulRuns ?? 0),
    };
  });
}

/**
 * Save daily snapshots to database.
 */
export async function saveDailySnapshots(snapshots: DailySnapshot[]): Promise<void> {
  for (const snapshot of snapshots) {
    // Check if snapshot already exists
    const existing = await db
      .select()
      .from(schema.agentPerformanceSnapshots)
      .where(
        and(
          eq(schema.agentPerformanceSnapshots.agentId, snapshot.agentId),
          eq(schema.agentPerformanceSnapshots.period, snapshot.period),
          eq(schema.agentPerformanceSnapshots.periodType, 'daily')
        )
      )
      .limit(1);

    if (existing.length > 0) {
      // Update existing snapshot
      await db
        .update(schema.agentPerformanceSnapshots)
        .set({
          totalRuns: snapshot.totalRuns,
          successfulRuns: snapshot.successfulRuns,
          failedRuns: snapshot.failedRuns,
          approvalCount: snapshot.approvalCount,
          rejectionCount: snapshot.rejectionCount,
          autoApprovalCount: snapshot.autoApprovalCount,
          totalTokens: snapshot.totalTokens,
          totalCostCents: snapshot.totalCostCents,
          avgDurationMs: snapshot.avgDurationMs,
          estimatedTimeSavedMinutes: snapshot.estimatedTimeSavedMinutes,
        })
        .where(eq(schema.agentPerformanceSnapshots.id, existing[0]!.id));
    } else {
      // Insert new snapshot
      await db
        .insert(schema.agentPerformanceSnapshots)
        .values({
          agentId: snapshot.agentId,
          userId: snapshot.userId,
          period: snapshot.period,
          periodType: 'daily',
          totalRuns: snapshot.totalRuns,
          successfulRuns: snapshot.successfulRuns,
          failedRuns: snapshot.failedRuns,
          approvalCount: snapshot.approvalCount,
          rejectionCount: snapshot.rejectionCount,
          autoApprovalCount: snapshot.autoApprovalCount,
          totalTokens: snapshot.totalTokens,
          totalCostCents: snapshot.totalCostCents,
          avgDurationMs: snapshot.avgDurationMs,
          estimatedTimeSavedMinutes: snapshot.estimatedTimeSavedMinutes,
        });
    }
  }
}

/**
 * Generate weekly snapshots from daily snapshots.
 */
export async function generateWeeklySnapshots(targetDate: Date): Promise<void> {
  const weekPeriod = formatWeek(targetDate);

  // Get all agents with daily snapshots in this week
  const weekStart = new Date(targetDate);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Start of week (Sunday)
  weekStart.setUTCHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const dailySnapshots = await db
    .select()
    .from(schema.agentPerformanceSnapshots)
    .where(
      and(
        eq(schema.agentPerformanceSnapshots.periodType, 'daily'),
        gte(sql`${schema.agentPerformanceSnapshots.period}::date`, weekStart),
        lt(sql`${schema.agentPerformanceSnapshots.period}::date`, weekEnd)
      )
    );

  // Group by agent and aggregate
  const agentWeeklyData = new Map<number, DailySnapshot>();

  for (const snapshot of dailySnapshots) {
    const existing = agentWeeklyData.get(snapshot.agentId);
    if (existing) {
      existing.totalRuns += snapshot.totalRuns;
      existing.successfulRuns += snapshot.successfulRuns;
      existing.failedRuns += snapshot.failedRuns;
      existing.approvalCount += snapshot.approvalCount;
      existing.rejectionCount += snapshot.rejectionCount;
      existing.autoApprovalCount += snapshot.autoApprovalCount;
      existing.totalTokens += snapshot.totalTokens;
      existing.totalCostCents += snapshot.totalCostCents;
      existing.avgDurationMs = Math.round((existing.avgDurationMs + (snapshot.avgDurationMs ?? 0)) / 2);
      existing.estimatedTimeSavedMinutes += snapshot.estimatedTimeSavedMinutes ?? 0;
    } else {
      agentWeeklyData.set(snapshot.agentId, {
        agentId: snapshot.agentId,
        userId: snapshot.userId,
        period: weekPeriod,
        totalRuns: snapshot.totalRuns,
        successfulRuns: snapshot.successfulRuns,
        failedRuns: snapshot.failedRuns,
        approvalCount: snapshot.approvalCount,
        rejectionCount: snapshot.rejectionCount,
        autoApprovalCount: snapshot.autoApprovalCount,
        totalTokens: snapshot.totalTokens,
        totalCostCents: snapshot.totalCostCents,
        avgDurationMs: snapshot.avgDurationMs ?? 0,
        estimatedTimeSavedMinutes: snapshot.estimatedTimeSavedMinutes ?? 0,
      });
    }
  }

  // Save weekly snapshots
  for (const [, weeklySnapshot] of agentWeeklyData) {
    const existing = await db
      .select()
      .from(schema.agentPerformanceSnapshots)
      .where(
        and(
          eq(schema.agentPerformanceSnapshots.agentId, weeklySnapshot.agentId),
          eq(schema.agentPerformanceSnapshots.period, weekPeriod),
          eq(schema.agentPerformanceSnapshots.periodType, 'weekly')
        )
      )
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(schema.agentPerformanceSnapshots)
        .set({
          totalRuns: weeklySnapshot.totalRuns,
          successfulRuns: weeklySnapshot.successfulRuns,
          failedRuns: weeklySnapshot.failedRuns,
          approvalCount: weeklySnapshot.approvalCount,
          rejectionCount: weeklySnapshot.rejectionCount,
          autoApprovalCount: weeklySnapshot.autoApprovalCount,
          totalTokens: weeklySnapshot.totalTokens,
          totalCostCents: weeklySnapshot.totalCostCents,
          avgDurationMs: weeklySnapshot.avgDurationMs,
          estimatedTimeSavedMinutes: weeklySnapshot.estimatedTimeSavedMinutes,
        })
        .where(eq(schema.agentPerformanceSnapshots.id, existing[0]!.id));
    } else {
      await db
        .insert(schema.agentPerformanceSnapshots)
        .values({
          agentId: weeklySnapshot.agentId,
          userId: weeklySnapshot.userId,
          period: weekPeriod,
          periodType: 'weekly',
          totalRuns: weeklySnapshot.totalRuns,
          successfulRuns: weeklySnapshot.successfulRuns,
          failedRuns: weeklySnapshot.failedRuns,
          approvalCount: weeklySnapshot.approvalCount,
          rejectionCount: weeklySnapshot.rejectionCount,
          autoApprovalCount: weeklySnapshot.autoApprovalCount,
          totalTokens: weeklySnapshot.totalTokens,
          totalCostCents: weeklySnapshot.totalCostCents,
          avgDurationMs: weeklySnapshot.avgDurationMs,
          estimatedTimeSavedMinutes: weeklySnapshot.estimatedTimeSavedMinutes,
        });
    }
  }
}

/**
 * Generate monthly snapshots from daily snapshots.
 */
export async function generateMonthlySnapshots(targetDate: Date): Promise<void> {
  const monthPeriod = formatMonth(targetDate);

  // Get all daily snapshots in this month
  const monthStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const monthEnd = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0);
  monthEnd.setUTCHours(23, 59, 59, 999);

  const dailySnapshots = await db
    .select()
    .from(schema.agentPerformanceSnapshots)
    .where(
      and(
        eq(schema.agentPerformanceSnapshots.periodType, 'daily'),
        gte(sql`${schema.agentPerformanceSnapshots.period}::date`, monthStart),
        lt(sql`${schema.agentPerformanceSnapshots.period}::date`, monthEnd)
      )
    );

  // Group by agent and aggregate
  const agentMonthlyData = new Map<number, DailySnapshot>();

  for (const snapshot of dailySnapshots) {
    const existing = agentMonthlyData.get(snapshot.agentId);
    if (existing) {
      existing.totalRuns += snapshot.totalRuns;
      existing.successfulRuns += snapshot.successfulRuns;
      existing.failedRuns += snapshot.failedRuns;
      existing.approvalCount += snapshot.approvalCount;
      existing.rejectionCount += snapshot.rejectionCount;
      existing.autoApprovalCount += snapshot.autoApprovalCount;
      existing.totalTokens += snapshot.totalTokens;
      existing.totalCostCents += snapshot.totalCostCents;
      existing.avgDurationMs = Math.round((existing.avgDurationMs + (snapshot.avgDurationMs ?? 0)) / 2);
      existing.estimatedTimeSavedMinutes += snapshot.estimatedTimeSavedMinutes ?? 0;
    } else {
      agentMonthlyData.set(snapshot.agentId, {
        agentId: snapshot.agentId,
        userId: snapshot.userId,
        period: monthPeriod,
        totalRuns: snapshot.totalRuns,
        successfulRuns: snapshot.successfulRuns,
        failedRuns: snapshot.failedRuns,
        approvalCount: snapshot.approvalCount,
        rejectionCount: snapshot.rejectionCount,
        autoApprovalCount: snapshot.autoApprovalCount,
        totalTokens: snapshot.totalTokens,
        totalCostCents: snapshot.totalCostCents,
        avgDurationMs: snapshot.avgDurationMs ?? 0,
        estimatedTimeSavedMinutes: snapshot.estimatedTimeSavedMinutes ?? 0,
      });
    }
  }

  // Save monthly snapshots
  for (const [, monthlySnapshot] of agentMonthlyData) {
    const existing = await db
      .select()
      .from(schema.agentPerformanceSnapshots)
      .where(
        and(
          eq(schema.agentPerformanceSnapshots.agentId, monthlySnapshot.agentId),
          eq(schema.agentPerformanceSnapshots.period, monthPeriod),
          eq(schema.agentPerformanceSnapshots.periodType, 'monthly')
        )
      )
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(schema.agentPerformanceSnapshots)
        .set({
          totalRuns: monthlySnapshot.totalRuns,
          successfulRuns: monthlySnapshot.successfulRuns,
          failedRuns: monthlySnapshot.failedRuns,
          approvalCount: monthlySnapshot.approvalCount,
          rejectionCount: monthlySnapshot.rejectionCount,
          autoApprovalCount: monthlySnapshot.autoApprovalCount,
          totalTokens: monthlySnapshot.totalTokens,
          totalCostCents: monthlySnapshot.totalCostCents,
          avgDurationMs: monthlySnapshot.avgDurationMs,
          estimatedTimeSavedMinutes: monthlySnapshot.estimatedTimeSavedMinutes,
        })
        .where(eq(schema.agentPerformanceSnapshots.id, existing[0]!.id));
    } else {
      await db
        .insert(schema.agentPerformanceSnapshots)
        .values({
          agentId: monthlySnapshot.agentId,
          userId: monthlySnapshot.userId,
          period: monthPeriod,
          periodType: 'monthly',
          totalRuns: monthlySnapshot.totalRuns,
          successfulRuns: monthlySnapshot.successfulRuns,
          failedRuns: monthlySnapshot.failedRuns,
          approvalCount: monthlySnapshot.approvalCount,
          rejectionCount: monthlySnapshot.rejectionCount,
          autoApprovalCount: monthlySnapshot.autoApprovalCount,
          totalTokens: monthlySnapshot.totalTokens,
          totalCostCents: monthlySnapshot.totalCostCents,
          avgDurationMs: monthlySnapshot.avgDurationMs,
          estimatedTimeSavedMinutes: monthlySnapshot.estimatedTimeSavedMinutes,
        });
    }
  }
}

/**
 * Main job entry point: run daily snapshot aggregation for previous day.
 */
export async function runDailySnapshotJob(): Promise<void> {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setUTCHours(0, 0, 0, 0);

  console.log(`[Performance Snapshot Job] Running for date: ${formatDate(yesterday)}`);

  // Aggregate and save daily snapshots
  const dailySnapshots = await aggregateDailySnapshots(yesterday);
  await saveDailySnapshots(dailySnapshots);

  console.log(`[Performance Snapshot Job] Saved ${dailySnapshots.length} daily snapshots`);

  // Generate weekly snapshots if it's Monday (start of week)
  if (yesterday.getDay() === 1) {
    await generateWeeklySnapshots(yesterday);
    console.log(`[Performance Snapshot Job] Generated weekly snapshots`);
  }

  // Generate monthly snapshots if it's the 1st of the month
  if (yesterday.getDate() === 1) {
    await generateMonthlySnapshots(yesterday);
    console.log(`[Performance Snapshot Job] Generated monthly snapshots`);
  }

  console.log(`[Performance Snapshot Job] Completed`);
}
