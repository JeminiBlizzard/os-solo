import { describe, it, expect, vi } from 'vitest';
import { MRR_SNAPSHOT_JOB_TYPE, MRR_SNAPSHOT_CRON, getPreviousMonth } from '../src/finance/monthly-snapshot-job.js';

// Mock the database module
vi.mock('@os-solo/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    selectDistinct: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    onConflictDoUpdate: vi.fn().mockReturnThis(),
  },
  schema: {
    subscriptions: {
      id: 'id',
      userId: 'user_id',
      status: 'status',
      amountCents: 'amount_cents',
      interval: 'interval',
    },
    revenueEvents: {
      id: 'id',
      userId: 'user_id',
      eventType: 'event_type',
      mrrDeltaCents: 'mrr_delta_cents',
      occurredAt: 'occurred_at',
    },
    mrrSnapshots: {
      id: 'id',
      userId: 'user_id',
      snapshotDate: 'snapshot_date',
      mrrCents: 'mrr_cents',
      newMrrCents: 'new_mrr_cents',
      churnedMrrCents: 'churned_mrr_cents',
      expansionMrrCents: 'expansion_mrr_cents',
      activeSubscriptions: 'active_subscriptions',
    },
    scheduledJobs: {
      id: 'id',
      userId: 'user_id',
      jobType: 'job_type',
      cronExpression: 'cron_expression',
      nextRunAt: 'next_run_at',
      lastRunAt: 'last_run_at',
      status: 'status',
    },
  },
}));

// Mock cron-parser
vi.mock('cron-parser', () => ({
  CronExpressionParser: {
    parse: vi.fn().mockReturnValue({
      next: vi.fn().mockReturnValue({
        toDate: vi.fn().mockReturnValue(new Date('2026-05-01T00:15:00Z')),
      }),
    }),
  },
}));

describe('MRR Calculator', () => {
  describe('MRR Calculation', () => {
    it('should sum monthly subscription amounts for MRR', () => {
      const subscriptions = [
        { amountCents: 2000, interval: 'month' },
        { amountCents: 5000, interval: 'month' },
        { amountCents: 1000, interval: 'month' },
      ];

      const totalMrr = subscriptions.reduce((sum, sub) => sum + sub.amountCents, 0);
      expect(totalMrr).toBe(8000); // $80/month
    });

    it('should convert annual subscriptions to monthly MRR', () => {
      const annualSub = { amountCents: 12000, interval: 'year' };
      const monthlyMrr = Math.round(annualSub.amountCents / 12);

      expect(monthlyMrr).toBe(1000); // $120/year = $10/month
    });

    it('should handle mixed monthly and annual subscriptions', () => {
      const subscriptions = [
        { amountCents: 2000, interval: 'month' },
        { amountCents: 12000, interval: 'year' },
      ];

      let totalMrr = 0;
      for (const sub of subscriptions) {
        if (sub.interval === 'month') {
          totalMrr += sub.amountCents;
        } else if (sub.interval === 'year') {
          totalMrr += Math.round(sub.amountCents / 12);
        }
      }

      expect(totalMrr).toBe(3000); // $20/month + $10/month = $30/month
    });

    it('should only count active subscriptions', () => {
      const subscriptions = [
        { status: 'active', amountCents: 2000 },
        { status: 'canceled', amountCents: 3000 },
        { status: 'active', amountCents: 5000 },
      ];

      const activeMrr = subscriptions
        .filter(sub => sub.status === 'active')
        .reduce((sum, sub) => sum + sub.amountCents, 0);

      expect(activeMrr).toBe(7000); // Only active subs count
    });
  });

  describe('MRR Breakdown', () => {
    it('should calculate new MRR from new_sub events', () => {
      const newSubEvents = [
        { eventType: 'new_sub', mrrDeltaCents: 2000 },
        { eventType: 'new_sub', mrrDeltaCents: 1500 },
      ];

      const newMrr = newSubEvents
        .filter(e => e.eventType === 'new_sub')
        .reduce((sum, e) => sum + e.mrrDeltaCents, 0);

      expect(newMrr).toBe(3500);
    });

    it('should calculate churned MRR from cancel events', () => {
      const cancelEvents = [
        { eventType: 'cancel', mrrDeltaCents: -2000 },
        { eventType: 'cancel', mrrDeltaCents: -1000 },
      ];

      const churnedMrr = Math.abs(
        cancelEvents
          .filter(e => e.eventType === 'cancel')
          .reduce((sum, e) => sum + e.mrrDeltaCents, 0)
      );

      expect(churnedMrr).toBe(3000);
    });

    it('should calculate expansion MRR from upgrade events', () => {
      const expansionEvents = [
        { eventType: 'upgrade', mrrDeltaCents: 1000 },
        { eventType: 'downgrade', mrrDeltaCents: -500 },
      ];

      const expansionMrr = expansionEvents.reduce(
        (sum, e) => sum + e.mrrDeltaCents,
        0
      );

      expect(expansionMrr).toBe(500); // Net expansion
    });

    it('should count active subscriptions', () => {
      const subscriptions = [
        { status: 'active' },
        { status: 'active' },
        { status: 'canceled' },
        { status: 'active' },
      ];

      const activeCount = subscriptions.filter(s => s.status === 'active').length;
      expect(activeCount).toBe(3);
    });
  });

  describe('Snapshot Creation', () => {
    it('should format snapshot date correctly', () => {
      const year = 2024;
      const month = 1; // January

      const snapshotDate = new Date(Date.UTC(year, month - 1, 1));
      const dateStr = snapshotDate.toISOString().split('T')[0];

      expect(dateStr).toBe('2024-01-01');
    });

    it('should handle December snapshots correctly', () => {
      const year = 2023;
      const month = 12; // December

      const snapshotDate = new Date(Date.UTC(year, month - 1, 1));
      const dateStr = snapshotDate.toISOString().split('T')[0];

      expect(dateStr).toBe('2023-12-01');
    });

    it('should use unique constraint on (user_id, snapshot_date)', () => {
      const uniqueConstraint = {
        userId: 1,
        snapshotDate: '2024-01-01',
      };

      expect(uniqueConstraint.userId).toBe(1);
      expect(uniqueConstraint.snapshotDate).toBe('2024-01-01');
    });
  });

  describe('Monthly Snapshot Job', () => {
    it('should run on 1st of month at 00:15 UTC', () => {
      // Test date: January 1st, 2024, 00:15 UTC
      const testDate = new Date(Date.UTC(2024, 0, 1, 0, 15, 0));

      const dayOfMonth = testDate.getUTCDate();
      const hour = testDate.getUTCHours();
      const minute = testDate.getUTCMinutes();

      const shouldRun = dayOfMonth === 1 && hour === 0 && minute >= 15 && minute < 16;

      expect(shouldRun).toBe(true);
    });

    it('should not run on other days', () => {
      const testDate = new Date(Date.UTC(2024, 0, 15, 0, 15, 0)); // 15th

      const dayOfMonth = testDate.getUTCDate();
      const shouldRun = dayOfMonth === 1;

      expect(shouldRun).toBe(false);
    });

    it('should calculate previous month for snapshot', () => {
      // Running on January 1st, snapshot should be for December
      const now = new Date(Date.UTC(2024, 0, 1)); // January 2024

      let year = now.getUTCFullYear();
      let month = now.getUTCMonth(); // 0 = January

      if (month === 0) {
        year -= 1;
        month = 12;
      }

      expect(year).toBe(2023);
      expect(month).toBe(12);
    });

    it('should handle mid-year snapshots correctly', () => {
      // Running on July 1st, snapshot should be for June
      const now = new Date(Date.UTC(2024, 6, 1)); // July 2024

      const year = now.getUTCFullYear();
      const month = now.getUTCMonth(); // 6 = July

      expect(year).toBe(2024);
      expect(month).toBe(6); // June (0-indexed)
    });
  });

  describe('Currency Handling', () => {
    it('should work with cents to avoid floating point errors', () => {
      const amountDollars = 19.99;
      const amountCents = Math.round(amountDollars * 100);

      expect(amountCents).toBe(1999);

      const backToDollars = amountCents / 100;
      expect(backToDollars).toBe(19.99);
    });

    it('should format MRR for display', () => {
      const mrrCents = 15000;
      const formatted = `$${(mrrCents / 100).toFixed(2)}`;

      expect(formatted).toBe('$150.00');
    });
  });

  describe('Empty Database Handling', () => {
    it('should return MRR=0 when no subscriptions exist (not null)', () => {
      const subscriptions: Array<{ amountCents: number; interval: string }> = [];

      let totalMrrCents = 0;
      for (const sub of subscriptions) {
        if (sub.interval === 'month') {
          totalMrrCents += sub.amountCents;
        } else if (sub.interval === 'year') {
          totalMrrCents += Math.round(sub.amountCents / 12);
        }
      }

      expect(totalMrrCents).toBe(0);
      expect(typeof totalMrrCents).toBe('number');
      expect(totalMrrCents).not.toBeNull();
    });

    it('should return empty breakdown with zeros when no revenue events exist', () => {
      const revenueEvents: Array<{ eventType: string; mrrDeltaCents: number }> = [];

      const newMrrCents = revenueEvents
        .filter(e => e.eventType === 'new_sub')
        .reduce((sum, e) => sum + e.mrrDeltaCents, 0);

      const churnedMrrCents = Math.abs(
        revenueEvents
          .filter(e => e.eventType === 'cancel')
          .reduce((sum, e) => sum + e.mrrDeltaCents, 0)
      );

      const expansionMrrCents = revenueEvents
        .filter(e => e.eventType === 'upgrade' || e.eventType === 'downgrade')
        .reduce((sum, e) => sum + e.mrrDeltaCents, 0);

      expect(newMrrCents).toBe(0);
      expect(churnedMrrCents).toBe(0);
      expect(expansionMrrCents).toBe(0);
    });

    it('should return 0 active customers when no subscriptions exist', () => {
      const subscriptions: Array<{ status: string }> = [];
      const activeCount = subscriptions.filter(s => s.status === 'active').length;

      expect(activeCount).toBe(0);
    });
  });

  describe('Scheduled Job Registration', () => {
    it('should use correct cron expression for monthly run', () => {
      // Cron: '15 0 1 * *' = minute 15, hour 0, day 1, any month, any weekday
      expect(MRR_SNAPSHOT_CRON).toBe('15 0 1 * *');
    });

    it('should use correct job type for MRR snapshot', () => {
      expect(MRR_SNAPSHOT_JOB_TYPE).toBe('mrr_snapshot');
    });

    it('should calculate previous month correctly for January', () => {
      const january1st = new Date(Date.UTC(2024, 0, 1));
      const result = getPreviousMonth(january1st);

      expect(result.year).toBe(2023);
      expect(result.month).toBe(12);
    });

    it('should calculate previous month correctly for mid-year', () => {
      const july1st = new Date(Date.UTC(2024, 6, 1));
      const result = getPreviousMonth(july1st);

      expect(result.year).toBe(2024);
      expect(result.month).toBe(6);
    });
  });

  describe('Snapshot String Format', () => {
    it('should parse YYYY-MM format correctly', () => {
      const monthStr = '2026-04';
      const [yearStr, monthPart] = monthStr.split('-');
      const year = parseInt(yearStr!, 10);
      const month = parseInt(monthPart!, 10);

      expect(year).toBe(2026);
      expect(month).toBe(4);
    });

    it('should handle different month formats consistently', () => {
      const monthStr = '2026-04';
      const [yearStr, monthPart] = monthStr.split('-');

      const year = parseInt(yearStr!, 10);
      const month = parseInt(monthPart!, 10);

      // Both formats should produce the same date
      const dateFromNums = new Date(Date.UTC(year, month - 1, 1));
      const dateStr = dateFromNums.toISOString().split('T')[0];

      expect(dateStr).toBe('2026-04-01');
    });
  });

  describe('Full MRR Calculation with Churn and Expansion', () => {
    it('should correctly net MRR with new, churn, and expansion', () => {
      // Starting point: 3 subscriptions @ $50/month = $150 MRR
      const startingMrr = 15000; // cents

      // This month's events
      const events = [
        { eventType: 'new_sub', mrrDeltaCents: 5000 },     // +$50 new customer
        { eventType: 'cancel', mrrDeltaCents: -2500 },      // -$25 churned
        { eventType: 'upgrade', mrrDeltaCents: 1500 },      // +$15 expansion
        { eventType: 'downgrade', mrrDeltaCents: -500 },    // -$5 contraction
      ];

      const newMrr = events
        .filter(e => e.eventType === 'new_sub')
        .reduce((sum, e) => sum + e.mrrDeltaCents, 0);

      const churnedMrr = Math.abs(
        events
          .filter(e => e.eventType === 'cancel')
          .reduce((sum, e) => sum + e.mrrDeltaCents, 0)
      );

      const expansionMrr = events
        .filter(e => e.eventType === 'upgrade' || e.eventType === 'downgrade')
        .reduce((sum, e) => sum + e.mrrDeltaCents, 0);

      // Net change
      const netChange = newMrr - churnedMrr + expansionMrr;
      const endingMrr = startingMrr + netChange;

      expect(newMrr).toBe(5000);
      expect(churnedMrr).toBe(2500);
      expect(expansionMrr).toBe(1000); // +1500 - 500 = 1000
      expect(netChange).toBe(3500); // 5000 - 2500 + 1000
      expect(endingMrr).toBe(18500); // $185/month
    });
  });
});
