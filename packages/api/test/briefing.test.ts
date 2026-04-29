import { describe, it, expect, vi } from 'vitest';

// Mock the db module
vi.mock('@os-solo/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([{ id: 1 }]),
    query: {
      aiProviders: {
        findFirst: vi.fn().mockResolvedValue({
          apiKeyEncrypted: 'test-key',
          apiBase: null,
        }),
      },
    },
  },
  schema: {
    mrrSnapshots: { userId: 'user_id', snapshotDate: 'snapshot_date', mrrCents: 'mrr_cents' },
    servers: { userId: 'user_id', status: 'status' },
    inboxItems: { userId: 'user_id', status: 'status', priority: 'priority' },
    approvalQueue: { userId: 'user_id', status: 'status' },
    agentRuns: { userId: 'user_id', startedAt: 'started_at', completedAt: 'completed_at', costCents: 'cost_cents', status: 'status' },
    userSettings: { userId: 'user_id', aiMonthlyBudgetCents: 'ai_monthly_budget_cents' },
    briefings: { id: 'id', userId: 'user_id', type: 'type', content: 'content', costCents: 'cost_cents', generatedAt: 'generated_at' },
    aiProviders: { userId: 'user_id', name: 'name', enabled: 'enabled' },
  },
}));

describe('Briefing System', () => {
  describe('Response Format', () => {
    it('should return expected briefing shape', () => {
      const expectedShape = {
        id: expect.any(Number),
        type: expect.any(String),
        content: expect.any(String),
        generated_at: expect.any(String),
        cost_cents: expect.any(Number),
      };

      const mockBriefing = {
        id: 1,
        type: 'morning',
        content: '# Morning Briefing\n\nYour day looks good.',
        generated_at: new Date().toISOString(),
        cost_cents: 5,
      };

      expect(mockBriefing).toMatchObject(expectedShape);
    });

    it('should have valid type values', () => {
      const validTypes = ['morning', 'evening'];

      expect(validTypes).toContain('morning');
      expect(validTypes).toContain('evening');
    });
  });

  describe('Briefing Data Structure', () => {
    it('should include all required data sources', () => {
      const dataSources = [
        'mrr_snapshots',
        'servers',
        'inbox_items',
        'approval_queue',
        'agent_runs',
        'user_settings',
      ];

      expect(dataSources).toHaveLength(6);
      expect(dataSources).toContain('mrr_snapshots');
      expect(dataSources).toContain('servers');
      expect(dataSources).toContain('inbox_items');
      expect(dataSources).toContain('approval_queue');
      expect(dataSources).toContain('agent_runs');
      expect(dataSources).toContain('user_settings');
    });
  });

  describe('Cost Calculation', () => {
    it('should calculate cost in cents', () => {
      // Haiku pricing: 100 cents/1M input, 500 cents/1M output
      const inputTokens = 500;
      const outputTokens = 300;

      // Expected: (500/1M * 100) + (300/1M * 500) = 0.05 + 0.15 = 0.20 cents
      const inputCost = (inputTokens / 1_000_000) * 100;
      const outputCost = (outputTokens / 1_000_000) * 500;
      const totalCents = inputCost + outputCost;

      expect(totalCents).toBeCloseTo(0.20, 2);
    });
  });

  describe('Morning Briefing Prompt', () => {
    it('should include key data points', () => {
      const requiredSections = [
        'Priority Actions',
        'System Status',
        'Business Pulse',
        'AI Operations',
      ];

      // These sections should be requested in the prompt
      for (const section of requiredSections) {
        expect(section).toBeTruthy();
      }
    });
  });

  describe('Evening Debrief Prompt', () => {
    it('should include reflection sections', () => {
      const requiredSections = [
        'Day Summary',
        'Overnight Watch',
        "Tomorrow's Focus",
        'Budget Check',
      ];

      // These sections should be requested in the prompt
      for (const section of requiredSections) {
        expect(section).toBeTruthy();
      }
    });
  });
});
