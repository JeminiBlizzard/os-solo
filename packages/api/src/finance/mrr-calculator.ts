/**
 * MRR Calculator
 *
 * Computes Monthly Recurring Revenue (MRR) from active subscriptions.
 */

import { db, schema } from '@os-solo/db';
import { eq, and, gte } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

export interface MRRBreakdown {
  totalMrrCents: number;
  newMrrCents: number;
  churnedMrrCents: number;
  expansionMrrCents: number;
  activeCustomers: number;
}

/**
 * Calculate current MRR for a user
 *
 * MRR is the sum of monthly subscription values from all active subscriptions.
 * For annual subscriptions, we divide by 12 to get the monthly value.
 */
export async function calculateMRR(userId: number): Promise<number> {
  const activeSubscriptions = await db
    .select({
      amountCents: schema.subscriptions.amountCents,
      interval: schema.subscriptions.interval,
    })
    .from(schema.subscriptions)
    .where(
      and(
        eq(schema.subscriptions.userId, userId),
        eq(schema.subscriptions.status, 'active')
      )
    );

  let totalMrrCents = 0;

  for (const sub of activeSubscriptions) {
    if (sub.interval === 'month') {
      totalMrrCents += sub.amountCents;
    } else if (sub.interval === 'year') {
      // Convert annual to monthly
      totalMrrCents += Math.round(sub.amountCents / 12);
    }
  }

  return totalMrrCents;
}

/**
 * Calculate MRR breakdown for a specific month
 * Includes new MRR, churned MRR, expansion MRR, and active customers
 */
export async function calculateMRRBreakdown(
  userId: number,
  year: number,
  month: number
): Promise<MRRBreakdown> {
  // Calculate date range for the month
  const monthStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
  const monthEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59));

  // Get current active subscriptions
  const currentMrrCents = await calculateMRR(userId);

  // Count active subscriptions
  const [activeCustomersResult] = await db
    .select({
      count: sql<number>`COUNT(*)::int`,
    })
    .from(schema.subscriptions)
    .where(
      and(
        eq(schema.subscriptions.userId, userId),
        eq(schema.subscriptions.status, 'active')
      )
    );

  const activeCustomers = activeCustomersResult?.count || 0;

  // Get new subscriptions in this month (new_sub events)
  const newSubscriptions = await db
    .select({
      mrrDeltaCents: schema.revenueEvents.mrrDeltaCents,
    })
    .from(schema.revenueEvents)
    .where(
      and(
        eq(schema.revenueEvents.userId, userId),
        eq(schema.revenueEvents.eventType, 'new_sub'),
        gte(schema.revenueEvents.occurredAt, monthStart),
        sql`${schema.revenueEvents.occurredAt} <= ${monthEnd}`
      )
    );

  const newMrrCents = newSubscriptions.reduce(
    (sum, event) => sum + (event.mrrDeltaCents || 0),
    0
  );

  // Get churned subscriptions in this month (cancel events)
  const churnedSubscriptions = await db
    .select({
      mrrDeltaCents: schema.revenueEvents.mrrDeltaCents,
    })
    .from(schema.revenueEvents)
    .where(
      and(
        eq(schema.revenueEvents.userId, userId),
        eq(schema.revenueEvents.eventType, 'cancel'),
        gte(schema.revenueEvents.occurredAt, monthStart),
        sql`${schema.revenueEvents.occurredAt} <= ${monthEnd}`
      )
    );

  const churnedMrrCents = Math.abs(
    churnedSubscriptions.reduce(
      (sum, event) => sum + (event.mrrDeltaCents || 0),
      0
    )
  );

  // Get expansion/contraction in this month (upgrade/downgrade events)
  const expansionEvents = await db
    .select({
      mrrDeltaCents: schema.revenueEvents.mrrDeltaCents,
    })
    .from(schema.revenueEvents)
    .where(
      and(
        eq(schema.revenueEvents.userId, userId),
        sql`${schema.revenueEvents.eventType} IN ('upgrade', 'downgrade')`,
        gte(schema.revenueEvents.occurredAt, monthStart),
        sql`${schema.revenueEvents.occurredAt} <= ${monthEnd}`
      )
    );

  const expansionMrrCents = expansionEvents.reduce(
    (sum, event) => sum + (event.mrrDeltaCents || 0),
    0
  );

  return {
    totalMrrCents: currentMrrCents,
    newMrrCents,
    churnedMrrCents,
    expansionMrrCents,
    activeCustomers,
  };
}

/**
 * Write MRR snapshot for a specific month.
 * Accepts either (userId, year, month) or (userId, 'YYYY-MM') format.
 */
export async function writeMRRSnapshot(
  userId: number,
  yearOrMonth: number | string,
  month?: number
): Promise<void> {
  let year: number;
  let monthNum: number;

  if (typeof yearOrMonth === 'string') {
    // Parse 'YYYY-MM' format
    const [yearStr, monthStr] = yearOrMonth.split('-');
    year = parseInt(yearStr!, 10);
    monthNum = parseInt(monthStr!, 10);
  } else {
    year = yearOrMonth;
    monthNum = month!;
  }

  const breakdown = await calculateMRRBreakdown(userId, year, monthNum);

  const snapshotDate = new Date(Date.UTC(year, monthNum - 1, 1));
  const snapshotDateStr = snapshotDate.toISOString().split('T')[0]!;

  // Upsert snapshot
  await db
    .insert(schema.mrrSnapshots)
    .values({
      userId,
      snapshotDate: snapshotDateStr,
      mrrCents: breakdown.totalMrrCents,
      newMrrCents: breakdown.newMrrCents,
      churnedMrrCents: breakdown.churnedMrrCents,
      expansionMrrCents: breakdown.expansionMrrCents,
      activeSubscriptions: breakdown.activeCustomers,
    })
    .onConflictDoUpdate({
      target: [schema.mrrSnapshots.userId, schema.mrrSnapshots.snapshotDate],
      set: {
        mrrCents: breakdown.totalMrrCents,
        newMrrCents: breakdown.newMrrCents,
        churnedMrrCents: breakdown.churnedMrrCents,
        expansionMrrCents: breakdown.expansionMrrCents,
        activeSubscriptions: breakdown.activeCustomers,
      },
    });

  console.log(
    `[mrr-calculator] Snapshot for ${year}-${monthNum.toString().padStart(2, '0')}: $${(breakdown.totalMrrCents / 100).toFixed(2)} MRR, ${breakdown.activeCustomers} customers`
  );
}
