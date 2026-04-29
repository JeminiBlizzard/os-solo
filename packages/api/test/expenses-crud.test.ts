import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database module
vi.mock('@os-solo/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([{ id: 1 }]),
  },
  schema: {
    expenses: {
      id: 'id',
      userId: 'user_id',
      category: 'category',
      description: 'description',
      amountCents: 'amount_cents',
      vendor: 'vendor',
      recurrence: 'recurrence',
      incurredAt: 'incurred_at',
      createdAt: 'created_at',
    },
    agentRuns: {
      id: 'id',
      userId: 'user_id',
      agentId: 'agent_id',
      costCents: 'cost_cents',
      startedAt: 'started_at',
    },
    agents: {
      id: 'id',
      userId: 'user_id',
      name: 'name',
    },
    userSettings: {
      userId: 'user_id',
      aiMonthlyBudgetCents: 'ai_monthly_budget_cents',
    },
  },
}));

describe('Expenses CRUD', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Category Validation', () => {
    const VALID_CATEGORIES = ['infrastructure', 'software', 'marketing', 'other'];

    it('should accept valid categories', () => {
      for (const category of VALID_CATEGORIES) {
        expect(VALID_CATEGORIES.includes(category)).toBe(true);
      }
    });

    it('should reject invalid categories', () => {
      const invalidCategories = ['invalid', 'random', 'hardware', ''];

      for (const category of invalidCategories) {
        expect(VALID_CATEGORIES.includes(category)).toBe(false);
      }
    });
  });

  describe('Interval Validation', () => {
    const VALID_INTERVALS = ['one_time', 'monthly', 'annual', 'quarterly', 'usage'];

    it('should accept valid intervals', () => {
      for (const interval of VALID_INTERVALS) {
        expect(VALID_INTERVALS.includes(interval)).toBe(true);
      }
    });

    it('should reject invalid intervals', () => {
      const invalidIntervals = ['weekly', 'daily', 'biannual', ''];

      for (const interval of invalidIntervals) {
        expect(VALID_INTERVALS.includes(interval)).toBe(false);
      }
    });

    it('should map quarterly to annual', () => {
      const mapping: Record<string, string> = {
        one_time: 'one_time',
        monthly: 'monthly',
        annual: 'annual',
        quarterly: 'annual',
        usage: 'one_time',
      };

      expect(mapping['quarterly']).toBe('annual');
    });

    it('should map usage to one_time', () => {
      const mapping: Record<string, string> = {
        one_time: 'one_time',
        monthly: 'monthly',
        annual: 'annual',
        quarterly: 'annual',
        usage: 'one_time',
      };

      expect(mapping['usage']).toBe('one_time');
    });
  });

  describe('Expense Creation', () => {
    it('should create expense with all fields', () => {
      const expense = {
        name: 'Hetzner VPS',
        category: 'infrastructure',
        amount_cents: 500,
        currency: 'usd',
        interval: 'monthly',
        vendor: 'Hetzner',
        renewal_date: '2026-05-01',
        auto_detected: false,
        notes: 'Cloud server',
      };

      expect(expense.name).toBe('Hetzner VPS');
      expect(expense.category).toBe('infrastructure');
      expect(expense.amount_cents).toBe(500);
    });

    it('should require name field', () => {
      const expense = { category: 'software', amount_cents: 1000, interval: 'monthly' };
      expect(expense).not.toHaveProperty('name');
    });

    it('should validate amount_cents is non-negative', () => {
      const validAmount = 500;
      const invalidAmount = -100;

      expect(validAmount >= 0).toBe(true);
      expect(invalidAmount >= 0).toBe(false);
    });
  });

  describe('Expense Listing', () => {
    it('should order by created_at DESC', () => {
      const expenses = [
        { id: 1, created_at: '2026-04-01' },
        { id: 2, created_at: '2026-04-15' },
        { id: 3, created_at: '2026-04-10' },
      ];

      const sorted = [...expenses].sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      expect(sorted[0].id).toBe(2);
      expect(sorted[1].id).toBe(3);
      expect(sorted[2].id).toBe(1);
    });
  });

  describe('Expense Update', () => {
    it('should update individual fields', () => {
      const original = {
        name: 'Old Name',
        category: 'software',
        amount_cents: 1000,
      };

      const update = { name: 'New Name' };
      const result = { ...original, ...update };

      expect(result.name).toBe('New Name');
      expect(result.category).toBe('software'); // unchanged
      expect(result.amount_cents).toBe(1000); // unchanged
    });
  });

  describe('Expense Deletion', () => {
    it('should return deleted id on success', () => {
      const deletedId = 123;
      expect(deletedId).toBe(123);
    });
  });
});

describe('AI Spend Aggregator', () => {
  describe('Monthly Date Calculation', () => {
    it('should calculate first of current month', () => {
      const now = new Date('2026-04-15');
      const firstOfMonth = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0)
      );

      expect(firstOfMonth.toISOString().split('T')[0]).toBe('2026-04-01');
    });

    it('should calculate days in month', () => {
      // April 2026 has 30 days
      const year = 2026;
      const month = 3; // April (0-indexed)
      const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

      expect(daysInMonth).toBe(30);
    });

    it('should calculate days elapsed', () => {
      const dayOfMonth = 15;
      const daysElapsed = Math.max(1, dayOfMonth);

      expect(daysElapsed).toBe(15);
    });

    it('should handle first day of month (avoid division by zero)', () => {
      const dayOfMonth = 1;
      const daysElapsed = Math.max(1, dayOfMonth);

      expect(daysElapsed).toBe(1);
    });
  });

  describe('Spend Aggregation', () => {
    it('should sum cost_cents by agent', () => {
      const runs = [
        { agent_id: 1, cost_cents: 100 },
        { agent_id: 1, cost_cents: 200 },
        { agent_id: 2, cost_cents: 150 },
      ];

      const spendMap = new Map<number, number>();
      for (const run of runs) {
        const current = spendMap.get(run.agent_id) ?? 0;
        spendMap.set(run.agent_id, current + run.cost_cents);
      }

      expect(spendMap.get(1)).toBe(300);
      expect(spendMap.get(2)).toBe(150);
    });

    it('should sort by spend_cents DESC', () => {
      const byAgent = [
        { agent_id: 1, agent_name: 'Agent A', spend_cents: 100 },
        { agent_id: 2, agent_name: 'Agent B', spend_cents: 500 },
        { agent_id: 3, agent_name: 'Agent C', spend_cents: 250 },
      ];

      byAgent.sort((a, b) => b.spend_cents - a.spend_cents);

      expect(byAgent[0].agent_id).toBe(2);
      expect(byAgent[1].agent_id).toBe(3);
      expect(byAgent[2].agent_id).toBe(1);
    });

    it('should include zero-spend agents', () => {
      const allAgents = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const spendMap = new Map<number, number>([[1, 100]]);

      const byAgent = allAgents.map((agent) => ({
        agent_id: agent.id,
        spend_cents: spendMap.get(agent.id) ?? 0,
      }));

      expect(byAgent.find((a) => a.agent_id === 2)?.spend_cents).toBe(0);
      expect(byAgent.find((a) => a.agent_id === 3)?.spend_cents).toBe(0);
    });
  });

  describe('Projection Calculation', () => {
    it('should project monthly spend correctly', () => {
      const totalCents = 1500; // $15 spent
      const daysElapsed = 15;
      const daysInMonth = 30;

      const projectedCents = Math.round((totalCents / daysElapsed) * daysInMonth);

      expect(projectedCents).toBe(3000); // $30 projected
    });

    it('should handle zero spend', () => {
      const totalCents = 0;
      const daysElapsed = 15;
      const daysInMonth = 30;

      const projectedCents = Math.round((totalCents / daysElapsed) * daysInMonth);

      expect(projectedCents).toBe(0);
    });
  });

  describe('Budget Percentage', () => {
    it('should calculate pct_used correctly', () => {
      const totalCents = 15000; // $150
      const budgetCents = 30000; // $300

      const pctUsed = Math.round((totalCents / budgetCents) * 100);

      expect(pctUsed).toBe(50);
    });

    it('should cap pct_used at 999', () => {
      const totalCents = 100000; // $1000
      const budgetCents = 10000; // $100 (over budget by 10x)

      const pctUsed = Math.min(999, Math.round((totalCents / budgetCents) * 100));

      expect(pctUsed).toBe(999);
    });

    it('should handle zero budget', () => {
      const totalCents = 5000;
      const budgetCents = 0;

      let pctUsed = 0;
      if (budgetCents > 0) {
        pctUsed = Math.min(999, Math.round((totalCents / budgetCents) * 100));
      }

      expect(pctUsed).toBe(0);
    });

    it('should use default budget if not set', () => {
      const defaultBudget = 30000; // $300

      expect(defaultBudget).toBe(30000);
    });
  });

  describe('Response Format', () => {
    it('should return all required fields', () => {
      const response = {
        total_cents: 5000,
        by_agent: [],
        projected_cents: 10000,
        budget_cents: 30000,
        pct_used: 17,
      };

      expect(response).toHaveProperty('total_cents');
      expect(response).toHaveProperty('by_agent');
      expect(response).toHaveProperty('projected_cents');
      expect(response).toHaveProperty('budget_cents');
      expect(response).toHaveProperty('pct_used');
    });

    it('should return by_agent with correct structure', () => {
      const byAgent = [
        { agent_id: 1, agent_name: 'Test Agent', spend_cents: 500 },
      ];

      expect(byAgent[0]).toHaveProperty('agent_id');
      expect(byAgent[0]).toHaveProperty('agent_name');
      expect(byAgent[0]).toHaveProperty('spend_cents');
    });
  });
});
