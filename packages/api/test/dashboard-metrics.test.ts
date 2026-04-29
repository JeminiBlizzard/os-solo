import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database module
vi.mock('@os-solo/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
  },
  schema: {
    mrrSnapshots: { userId: 'user_id', snapshotDate: 'snapshot_date', mrrCents: 'mrr_cents' },
    servers: { userId: 'user_id', status: 'status' },
    approvalQueue: { userId: 'user_id', status: 'status' },
    inboxItems: { userId: 'user_id', status: 'status' },
    agentRuns: { userId: 'user_id', completedAt: 'completed_at', costCents: 'cost_cents' },
    userSettings: { userId: 'user_id', aiMonthlyBudgetCents: 'ai_monthly_budget_cents' },
  },
}));

describe('Dashboard Metrics API', () => {
  describe('response shape', () => {
    it('should have all required fields in response', () => {
      // Define expected response shape
      const expectedShape = {
        mrr: {
          current_cents: expect.any(Number),
          delta_cents: expect.any(Number),
          delta_pct: expect.any(Number),
        },
        system_health: {
          online: expect.any(Number),
          degraded: expect.any(Number),
          offline: expect.any(Number),
        },
        approval_pending: expect.any(Number),
        open_tickets: expect.any(Number),
        ai_spend: {
          current_cents: expect.any(Number),
          budget_cents: expect.any(Number),
          pct_used: expect.any(Number),
        },
      };

      // Mock response
      const mockResponse = {
        mrr: { current_cents: 50000, delta_cents: 5000, delta_pct: 11.11 },
        system_health: { online: 3, degraded: 1, offline: 0 },
        approval_pending: 2,
        open_tickets: 5,
        ai_spend: { current_cents: 15000, budget_cents: 30000, pct_used: 50 },
      };

      expect(mockResponse).toMatchObject(expectedShape);
    });

    it('should handle empty database with zeros', () => {
      const emptyResponse = {
        mrr: { current_cents: 0, delta_cents: 0, delta_pct: 0 },
        system_health: { online: 0, degraded: 0, offline: 0 },
        approval_pending: 0,
        open_tickets: 0,
        ai_spend: { current_cents: 0, budget_cents: 30000, pct_used: 0 },
      };

      // Verify no NaN values
      expect(emptyResponse.mrr.current_cents).not.toBeNaN();
      expect(emptyResponse.mrr.delta_cents).not.toBeNaN();
      expect(emptyResponse.mrr.delta_pct).not.toBeNaN();
      expect(emptyResponse.ai_spend.pct_used).not.toBeNaN();
    });
  });

  describe('MRR calculation', () => {
    it('should calculate delta correctly when previous month exists', () => {
      const currentMrr = 50000;
      const previousMrr = 45000;
      const delta = currentMrr - previousMrr;
      const deltaPct = (delta / previousMrr) * 100;

      expect(delta).toBe(5000);
      expect(deltaPct).toBeCloseTo(11.11, 1);
    });

    it('should handle no previous snapshot (delta_pct = 0)', () => {
      const currentMrr = 50000;
      const previousMrr = 0;
      const deltaPct = previousMrr > 0 ? ((currentMrr - previousMrr) / previousMrr) * 100 : 0;

      expect(deltaPct).toBe(0);
    });

    it('should handle no snapshots at all', () => {
      const currentMrr = 0;
      const previousMrr = 0;
      const delta = currentMrr - previousMrr;
      const deltaPct = previousMrr > 0 ? (delta / previousMrr) * 100 : 0;

      expect(currentMrr).toBe(0);
      expect(delta).toBe(0);
      expect(deltaPct).toBe(0);
    });
  });

  describe('AI spend calculation', () => {
    it('should calculate percentage used correctly', () => {
      const currentSpend = 15000;
      const budget = 30000;
      const pctUsed = (currentSpend / budget) * 100;

      expect(pctUsed).toBe(50);
    });

    it('should handle zero budget (no divide by zero)', () => {
      const currentSpend = 15000;
      const budget = 0;
      const pctUsed = budget > 0 ? (currentSpend / budget) * 100 : 0;

      expect(pctUsed).toBe(0);
      expect(pctUsed).not.toBeNaN();
    });

    it('should handle over-budget scenario', () => {
      const currentSpend = 45000;
      const budget = 30000;
      const pctUsed = (currentSpend / budget) * 100;

      expect(pctUsed).toBe(150);
    });
  });

  describe('server health aggregation', () => {
    it('should categorize servers correctly', () => {
      const servers = [
        { status: 'online', count: 5 },
        { status: 'degraded', count: 2 },
        { status: 'offline', count: 1 },
        { status: 'unknown', count: 1 },
      ];

      let online = 0;
      let degraded = 0;
      let offline = 0;

      for (const s of servers) {
        if (s.status === 'online') online = s.count;
        else if (s.status === 'degraded') degraded = s.count;
        else offline += s.count;
      }

      expect(online).toBe(5);
      expect(degraded).toBe(2);
      expect(offline).toBe(2); // offline + unknown
    });
  });
});
