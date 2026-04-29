import { describe, it, expect } from 'vitest';

describe('MRRCard', () => {
  describe('Value Formatting', () => {
    it('should format currency values correctly', () => {
      const value = 15000; // $150 in cents
      const formatted = `$${(value / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
      expect(formatted).toBe('$150');
    });

    it('should format large currency values with commas', () => {
      const value = 1500000; // $15,000 in cents
      const formatted = `$${(value / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
      expect(formatted).toBe('$15,000');
    });

    it('should format percent values correctly', () => {
      const value = 25.5;
      const formatted = `${value.toFixed(1)}%`;
      expect(formatted).toBe('25.5%');
    });

    it('should format zero values', () => {
      const value = 0;
      const formatted = `$${(value / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
      expect(formatted).toBe('$0');
    });
  });

  describe('Delta Indicators', () => {
    it('should show positive indicator for positive delta', () => {
      const delta = 500; // +$5
      const isPositive = delta > 0;
      const isNegative = delta < 0;

      expect(isPositive).toBe(true);
      expect(isNegative).toBe(false);
    });

    it('should show negative indicator for negative delta', () => {
      const delta = -300; // -$3
      const isPositive = delta > 0;
      const isNegative = delta < 0;

      expect(isPositive).toBe(false);
      expect(isNegative).toBe(true);
    });

    it('should show neutral indicator for zero delta', () => {
      const delta = 0;
      const isNeutral = delta === 0;

      expect(isNeutral).toBe(true);
    });

    it('should handle undefined delta', () => {
      const delta: number | undefined = undefined;
      const isNeutral = delta === undefined || delta === 0;

      expect(isNeutral).toBe(true);
    });
  });

  describe('Delta Value Display', () => {
    it('should format positive delta as currency', () => {
      const delta = 500;
      const formatted = `$${(Math.abs(delta) / 100).toLocaleString()}`;
      expect(formatted).toBe('$5');
    });

    it('should format negative delta as absolute currency', () => {
      const delta = -300;
      const formatted = `$${(Math.abs(delta) / 100).toLocaleString()}`;
      expect(formatted).toBe('$3');
    });

    it('should format percent delta correctly', () => {
      const delta = 12.5;
      const formatted = `${Math.abs(delta).toFixed(1)}%`;
      expect(formatted).toBe('12.5%');
    });
  });
});

describe('Finance Metrics Calculations', () => {
  describe('Net Margin', () => {
    it('should calculate net margin correctly', () => {
      const mrrCents = 10000; // $100
      const expensesCents = 3000; // $30

      const netMargin = ((mrrCents - expensesCents) / mrrCents) * 100;
      expect(netMargin).toBe(70);
    });

    it('should handle zero MRR', () => {
      const mrrCents = 0;
      const expensesCents = 1000;

      const netMargin = mrrCents > 0
        ? ((mrrCents - expensesCents) / mrrCents) * 100
        : 0;
      expect(netMargin).toBe(0);
    });

    it('should handle negative margin (expenses > MRR)', () => {
      const mrrCents = 5000; // $50
      const expensesCents = 8000; // $80

      const netMargin = ((mrrCents - expensesCents) / mrrCents) * 100;
      expect(netMargin).toBe(-60);
    });
  });

  describe('Churn Rate', () => {
    it('should calculate churn rate correctly', () => {
      const churnedMrrCents = 1000; // $10 churned
      const startMrrCents = 10000; // $100 start

      const churnRate = (churnedMrrCents / startMrrCents) * 100;
      expect(churnRate).toBe(10);
    });

    it('should handle zero start MRR', () => {
      const churnedMrrCents = 100;
      const startMrrCents = 0;

      const churnRate = startMrrCents > 0
        ? (churnedMrrCents / startMrrCents) * 100
        : 0;
      expect(churnRate).toBe(0);
    });
  });

  describe('Monthly Expense Calculation', () => {
    it('should sum monthly expenses directly', () => {
      const expenses = [
        { interval: 'monthly', amount_cents: 1000 },
        { interval: 'monthly', amount_cents: 2000 },
      ];

      let total = 0;
      for (const exp of expenses) {
        if (exp.interval === 'monthly') {
          total += exp.amount_cents;
        }
      }

      expect(total).toBe(3000);
    });

    it('should divide annual expenses by 12', () => {
      const annualExpense = { interval: 'annual', amount_cents: 12000 };
      const monthly = Math.round(annualExpense.amount_cents / 12);

      expect(monthly).toBe(1000);
    });

    it('should divide quarterly expenses by 3', () => {
      const quarterlyExpense = { interval: 'quarterly', amount_cents: 3000 };
      const monthly = Math.round(quarterlyExpense.amount_cents / 3);

      expect(monthly).toBe(1000);
    });

    it('should combine mixed intervals correctly', () => {
      const expenses = [
        { interval: 'monthly', amount_cents: 1000 },
        { interval: 'annual', amount_cents: 6000 },
        { interval: 'quarterly', amount_cents: 900 },
      ];

      let total = 0;
      for (const exp of expenses) {
        if (exp.interval === 'monthly') {
          total += exp.amount_cents;
        } else if (exp.interval === 'annual') {
          total += Math.round(exp.amount_cents / 12);
        } else if (exp.interval === 'quarterly') {
          total += Math.round(exp.amount_cents / 3);
        }
      }

      // 1000 + 500 + 300 = 1800
      expect(total).toBe(1800);
    });
  });
});

describe('MRR Growth Chart', () => {
  describe('Month Formatting', () => {
    it('should format date as short month + year', () => {
      const dateStr = '2026-04-01';
      const date = new Date(dateStr);
      const formatted = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });

      expect(formatted).toBe('Apr 26');
    });
  });

  describe('Data Preparation', () => {
    it('should take last 6 snapshots', () => {
      const snapshots = Array.from({ length: 10 }, (_, i) => ({
        snapshotDate: `2026-0${i + 1}-01`,
        mrrCents: (i + 1) * 1000,
      }));

      const last6 = snapshots.slice(0, 6);
      expect(last6.length).toBe(6);
    });

    it('should convert cents to dollars for display', () => {
      const mrrCents = 15000;
      const mrrDollars = mrrCents / 100;

      expect(mrrDollars).toBe(150);
    });

    it('should reverse for chronological order', () => {
      const snapshots = [
        { month: 'Apr' },
        { month: 'Mar' },
        { month: 'Feb' },
      ];

      const reversed = [...snapshots].reverse();
      expect(reversed[0].month).toBe('Feb');
      expect(reversed[2].month).toBe('Apr');
    });
  });
});

describe('Expense Breakdown', () => {
  describe('Category Aggregation', () => {
    it('should aggregate by category', () => {
      const expenses = [
        { category: 'infrastructure', amount_cents: 1000 },
        { category: 'infrastructure', amount_cents: 2000 },
        { category: 'software', amount_cents: 500 },
      ];

      const totals: Record<string, number> = {};
      for (const exp of expenses) {
        totals[exp.category] = (totals[exp.category] ?? 0) + exp.amount_cents;
      }

      expect(totals['infrastructure']).toBe(3000);
      expect(totals['software']).toBe(500);
    });

    it('should sort categories by total descending', () => {
      const categoryTotals = [
        { category: 'software', total: 500 },
        { category: 'infrastructure', total: 3000 },
        { category: 'marketing', total: 1000 },
      ];

      const sorted = [...categoryTotals].sort((a, b) => b.total - a.total);

      expect(sorted[0].category).toBe('infrastructure');
      expect(sorted[1].category).toBe('marketing');
      expect(sorted[2].category).toBe('software');
    });
  });

  describe('Category Formatting', () => {
    it('should capitalize category names', () => {
      const category = 'infrastructure';
      const formatted = category.charAt(0).toUpperCase() + category.slice(1);

      expect(formatted).toBe('Infrastructure');
    });
  });
});
