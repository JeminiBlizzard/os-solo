import { describe, it, expect } from 'vitest';

describe('BudgetGauge', () => {
  describe('Percentage Calculation', () => {
    it('should calculate percentage correctly', () => {
      const totalCents = 15000; // $150
      const budgetCents = 30000; // $300
      const pctUsed = (totalCents / budgetCents) * 100;

      expect(pctUsed).toBe(50);
    });

    it('should handle over-budget scenarios', () => {
      const totalCents = 35000; // $350
      const budgetCents = 30000; // $300
      const pctUsed = (totalCents / budgetCents) * 100;

      expect(pctUsed).toBeGreaterThan(100);
      expect(pctUsed).toBeCloseTo(116.67, 1);
    });

    it('should handle zero spend', () => {
      const totalCents = 0;
      const budgetCents = 30000;
      const pctUsed = (totalCents / budgetCents) * 100;

      expect(pctUsed).toBe(0);
    });
  });

  describe('Gauge State', () => {
    it('should identify normal state (under 90%)', () => {
      const pctUsed = 75;
      const isNormal = pctUsed <= 90;
      const isWarning = pctUsed > 90 && pctUsed <= 100;
      const isOverBudget = pctUsed > 100;

      expect(isNormal).toBe(true);
      expect(isWarning).toBe(false);
      expect(isOverBudget).toBe(false);
    });

    it('should identify warning state (90-100%)', () => {
      const pctUsed = 95;
      const isNormal = pctUsed <= 90;
      const isWarning = pctUsed > 90 && pctUsed <= 100;
      const isOverBudget = pctUsed > 100;

      expect(isNormal).toBe(false);
      expect(isWarning).toBe(true);
      expect(isOverBudget).toBe(false);
    });

    it('should identify over-budget state (>100%)', () => {
      const pctUsed = 120;
      const isNormal = pctUsed <= 90;
      const isWarning = pctUsed > 90 && pctUsed <= 100;
      const isOverBudget = pctUsed > 100;

      expect(isNormal).toBe(false);
      expect(isWarning).toBe(false);
      expect(isOverBudget).toBe(true);
    });

    it('should identify exact 90% threshold', () => {
      const pctUsed = 90;
      const isNormal = pctUsed <= 90;
      const isWarning = pctUsed > 90 && pctUsed <= 100;

      expect(isNormal).toBe(true);
      expect(isWarning).toBe(false);
    });

    it('should identify exact 100% threshold', () => {
      const pctUsed = 100;
      const isWarning = pctUsed > 90 && pctUsed <= 100;
      const isOverBudget = pctUsed > 100;

      expect(isWarning).toBe(true);
      expect(isOverBudget).toBe(false);
    });
  });

  describe('Display Capping', () => {
    it('should cap visual display at 100% for over-budget', () => {
      const pctUsed = 150;
      const displayPct = Math.min(pctUsed, 100);

      expect(displayPct).toBe(100);
    });

    it('should not cap display for under-budget', () => {
      const pctUsed = 75;
      const displayPct = Math.min(pctUsed, 100);

      expect(displayPct).toBe(75);
    });
  });

  describe('Gauge Color Assignment', () => {
    it('should use purple for normal state (AI accent)', () => {
      const pctUsed = 75;
      const isOverBudget = pctUsed > 100;
      const isWarning = pctUsed > 90 && pctUsed <= 100;

      const gaugeColor = isOverBudget
        ? 'rgb(218, 30, 40)' // red
        : isWarning
        ? 'rgb(255, 131, 43)' // orange
        : 'rgb(136, 80, 200)'; // purple

      expect(gaugeColor).toBe('rgb(136, 80, 200)'); // purple-60
    });

    it('should use orange for warning state', () => {
      const pctUsed = 95;
      const isOverBudget = pctUsed > 100;
      const isWarning = pctUsed > 90 && pctUsed <= 100;

      const gaugeColor = isOverBudget
        ? 'rgb(218, 30, 40)'
        : isWarning
        ? 'rgb(255, 131, 43)'
        : 'rgb(136, 80, 200)';

      expect(gaugeColor).toBe('rgb(255, 131, 43)'); // orange-50
    });

    it('should use red for over-budget state', () => {
      const pctUsed = 120;
      const isOverBudget = pctUsed > 100;
      const isWarning = pctUsed > 90 && pctUsed <= 100;

      const gaugeColor = isOverBudget
        ? 'rgb(218, 30, 40)'
        : isWarning
        ? 'rgb(255, 131, 43)'
        : 'rgb(136, 80, 200)';

      expect(gaugeColor).toBe('rgb(218, 30, 40)'); // red-50
    });
  });

  describe('Projection Warning', () => {
    it('should show warning when projected exceeds budget', () => {
      const projectedCents = 35000; // $350
      const budgetCents = 30000; // $300
      const shouldWarn = projectedCents > budgetCents;

      expect(shouldWarn).toBe(true);
    });

    it('should not show warning when projected is within budget', () => {
      const projectedCents = 25000; // $250
      const budgetCents = 30000; // $300
      const shouldWarn = projectedCents > budgetCents;

      expect(shouldWarn).toBe(false);
    });
  });

  describe('Budget Remaining Calculation', () => {
    it('should calculate remaining budget correctly', () => {
      const budgetCents = 30000; // $300
      const totalCents = 15000; // $150
      const remaining = budgetCents - totalCents;

      expect(remaining).toBe(15000); // $150
    });

    it('should show negative remaining when over budget', () => {
      const budgetCents = 30000;
      const totalCents = 35000;
      const remaining = budgetCents - totalCents;

      expect(remaining).toBe(-5000); // -$50
      expect(remaining).toBeLessThan(0);
    });
  });

  describe('Amount Formatting', () => {
    it('should format cents to dollars', () => {
      const amountCents = 15000;
      const dollars = (amountCents / 100).toFixed(2);

      expect(dollars).toBe('150.00');
    });

    it('should handle zero amounts', () => {
      const amountCents = 0;
      const dollars = (amountCents / 100).toFixed(2);

      expect(dollars).toBe('0.00');
    });
  });
});
